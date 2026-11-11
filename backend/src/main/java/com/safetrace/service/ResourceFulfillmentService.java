package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceReturn;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceLossRequest;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.dto.ResourceReturnApplyRequest;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceApprovalMapper;
import com.safetrace.mapper.ResourceFulfillmentMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * 출고·도착 확인·반납 신청·반납 확인·손실 확정.
 *
 * 규칙 (기획 문서 "상태 전이" 표와 같다)
 *  - 출고(ADMIN): APPROVED → DISPATCHED(반납형) 또는 COMPLETED(소모품). 반납형은 재고 숫자가 그대로이고(승인 때 이미 빠졌다),
 *    소모품은 총보유량이 요청 수량만큼 줄어든다(가용은 그대로).
 *  - 도착 확인(요청자 또는 ADMIN): 출고 이후 요청에 한 번만 도착 시각을 남긴다. 상태와 재고는 바뀌지 않는다.
 *  - 반납 신청(요청자 STAFF): 실제로 돌려보낼 수량을 신청 행으로 남긴다. 재고도 요청의 누적 반납도 바뀌지 않는다.
 *  - 반납 확인(ADMIN): 신청 PENDING → CONFIRMED. 그 수량만큼 누적 반납과 가용이 늘고, 남은 수량이 0이 되면 SETTLED.
 *  - 반납 신청 반려(ADMIN): PENDING → REJECTED. 사유 필수, 재고 변화 없음.
 *  - 손실 확정(ADMIN): 분실·파손으로 확인한 수량만 누적 손실과 총보유량에서 뺀다. 아직 돌아오지 않은 수량은 손실로 보지 않는다.
 *
 * 재고 정합성
 *  - 모든 메서드는 맨 처음에 요청 행을 잠그고(필요하면 그 다음에 재고 행) 현재 값을 다시 읽는다.
 *    잠금 순서는 요청 → 재고이고 반납 신청 행은 요청 행을 잠근 뒤에만 바꾼다. 사건 단계는 건너뛴다.
 *  - 상태·수량은 조건부 UPDATE이고, 0행이면 예외로 같은 트랜잭션의 변경을 모두 되돌린다.
 *    같은 반납 신청을 두 번 확인하면 두 번째는 신청 행 UPDATE(AND STATUS = 'PENDING')가 0행이라 409다.
 *    같은 손실 확정이 두 번 와도 expectedProcessedQty가 달라져 두 번째는 409다.
 *  - 요청 상태·누적 수량, 재고, 요청 이력, 재고 이력은 한 트랜잭션이다. 이력 INSERT가 실패하면 모두 롤백된다.
 *  - 잠금 대기가 3초를 넘으면 락 예외가 나고 GlobalExceptionHandler가 409(LOCK_CONFLICT)로 바꾼다.
 *  - 출고 이후(DISPATCHED)의 반납·손실 처리는 사건이 종료돼도 계속된다. 반면 출고는 종료된 사건이면 거절한다.
 *    사건 종료(7단계)가 출고 전 요청을 정리하기 전까지의 보조 방어선이다 (본 방어선은 7단계 종료 처리).
 */
@Service
@RequiredArgsConstructor
public class ResourceFulfillmentService {

    static final int MAX_TEXT_LENGTH = 500;
    // 같은 반납 신청이 이 시간(초) 안에 또 오면 더블클릭으로 보고 거절한다
    static final int DUPLICATE_APPLY_SECONDS = 10;

    private static final Set<String> ARRIVAL_STATUSES = Set.of("DISPATCHED", "SETTLED", "COMPLETED");

    private final ResourceFulfillmentMapper fulfillmentMapper;
    private final ResourceApprovalMapper approvalMapper;   // 요청 행 잠금·상태 변경·가용 복구·재고 이력 INSERT·사건 상태 읽기 재사용
    private final ResourceAdminMapper adminMapper;         // 재고 행 잠금(lockStock) 재사용
    private final ResourceRequestMapper requestMapper;     // 요청 이력 INSERT, 처리 결과 조회 재사용
    private final MemberMapper memberMapper;

    /** 출고: 반납형은 DISPATCHED, 소모품은 COMPLETED(총보유량 차감). */
    @Transactional
    public ResourceRequest dispatch(Long memberId, Long requestId) {
        Member admin = requireActiveMember(memberId);
        requireAdminRole(admin, "출고는 자원 관리자(ADMIN)만 할 수 있습니다.");

        ResourceRequest request = lockExistingRequest(requestId);
        requireStatus(request, "APPROVED", "승인된 요청만 출고할 수 있습니다. 이미 처리됐거나 취소된 요청입니다.");
        // 사건 종료(7단계)가 출고 전 요청을 정리하기 전까지의 보조 방어선. 요청 행을 잠근 뒤에 읽는다.
        if ("CLOSED".equals(approvalMapper.findIncidentStatus(request.getIncidentId()))) {
            throw new IllegalStateException("종료된 사건의 요청은 출고할 수 없습니다.");
        }

        String returnable = fulfillmentMapper.findReturnable(request.getStockId());
        if (returnable == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }

        if ("N".equals(returnable)) {
            // 소모품: 출고와 함께 소모가 확정되어 총보유량이 줄어든다. 가용은 승인 때 이미 빠졌다.
            ResourceStock stock = lockExistingStock(request.getStockId());
            int quantity = request.getQuantity();
            if (fulfillmentMapper.reduceTotal(stock.getStockId(), quantity) != 1) {
                throw new IllegalStateException("재고가 방금 바뀌어 출고하지 못했습니다. 다시 시도해 주세요.");
            }
            changeRequestStatus(request, "APPROVED", "COMPLETED", "이미 처리된 요청입니다.");
            writeRequestLog(requestId, "APPROVED", "COMPLETED", "DISPATCH", null, memberId);
            writeStockLog(stock, "CONSUME", stock.getTotalQty() - quantity, stock.getAvailableQty(), requestId, null, memberId);
        } else {
            // 반납형: 재고 숫자는 그대로 (예약해 둔 수량이 "출고 중"으로 바뀔 뿐이다)
            changeRequestStatus(request, "APPROVED", "DISPATCHED", "이미 처리된 요청입니다.");
            writeRequestLog(requestId, "APPROVED", "DISPATCHED", "DISPATCH", null, memberId);
        }

        return requestMapper.findById(requestId);
    }

    /** 도착 확인: 출고 이후 요청에 한 번만 도착 시각을 남긴다. 상태·재고는 그대로. */
    @Transactional
    public ResourceRequest arrive(Long memberId, Long requestId) {
        Member actor = requireActiveMember(memberId);
        boolean admin = "ADMIN".equals(actor.getRole());
        if (!admin && !"STAFF".equals(actor.getRole())) {
            throw new AccessDeniedException("도착 확인은 요청자 본인과 자원 관리자만 할 수 있습니다.");
        }

        ResourceRequest request = lockExistingRequest(requestId);
        if (!admin && !memberId.equals(request.getRequesterId())) {
            throw new AccessDeniedException("본인이 보낸 요청만 도착 확인할 수 있습니다.");
        }
        if (!ARRIVAL_STATUSES.contains(request.getStatus())) {
            throw new IllegalStateException("출고된 요청만 도착 확인을 할 수 있습니다.");
        }
        if (request.getArrivedAt() != null) {
            throw new IllegalStateException("이미 도착 확인된 요청입니다.");
        }
        if (fulfillmentMapper.markArrived(requestId) != 1) {
            throw new IllegalStateException("이미 도착 확인된 요청입니다.");
        }
        writeRequestLog(requestId, request.getStatus(), request.getStatus(), "ARRIVE", null, memberId);

        return requestMapper.findById(requestId);
    }

    /** 반납 신청: 신청 행만 만든다. 재고와 요청의 누적 반납은 건드리지 않는다. */
    @Transactional
    public ResourceReturn applyReturn(Long memberId, Long requestId, ResourceReturnApplyRequest body) {
        Member staff = requireActiveMember(memberId);
        if (!"STAFF".equals(staff.getRole())) {
            throw new AccessDeniedException("반납 신청은 요청자 본인(STAFF)만 할 수 있습니다.");
        }
        if (body == null || body.appliedQty() == null || body.appliedQty() < 1) {
            throw new IllegalArgumentException("반납 수량은 1 이상이어야 합니다.");
        }
        String memo = optionalText(body.memo(), "메모");
        int appliedQty = body.appliedQty();

        ResourceRequest request = lockExistingRequest(requestId);
        if (!memberId.equals(request.getRequesterId())) {
            throw new AccessDeniedException("본인이 보낸 요청만 반납 신청할 수 있습니다.");
        }
        if ("COMPLETED".equals(request.getStatus())) {
            throw new IllegalStateException("소모품은 반납 신청을 할 수 없습니다.");
        }
        if (!"DISPATCHED".equals(request.getStatus())) {
            throw new IllegalStateException("출고되어 아직 정산이 끝나지 않은 요청만 반납 신청을 할 수 있습니다.");
        }

        // 같은 신청이 방금 들어왔다면 더블클릭이다 (요청 행을 잠갔으므로 동시에 두 번 와도 한쪽만 통과한다)
        if (fulfillmentMapper.countRecentSameReturn(requestId, memberId, appliedQty, DUPLICATE_APPLY_SECONDS) > 0) {
            throw new IllegalStateException("같은 반납 신청이 방금 접수됐습니다. 목록을 확인해 주세요.");
        }
        int pending = fulfillmentMapper.sumPendingReturnQty(requestId);
        int applicable = request.getQuantity() - request.getReturnedQty() - request.getLostQty() - pending;
        if (appliedQty > applicable) {
            throw new IllegalStateException(String.format(
                    "신청할 수 있는 수량을 넘었습니다. (신청 가능 %d, 신청 %d)", Math.max(applicable, 0), appliedQty));
        }

        ResourceReturn application = new ResourceReturn();
        application.setRequestId(requestId);
        application.setAppliedQty(appliedQty);
        application.setApplyMemo(memo);
        application.setApplicantId(memberId);
        fulfillmentMapper.insertReturn(application);

        writeRequestLog(requestId, "DISPATCHED", "DISPATCHED", "RETURN_APPLY",
                limit("반납 신청 수량 " + appliedQty + (memo == null ? "" : " - " + memo)), memberId);

        return fulfillmentMapper.findReturnById(application.getReturnId());
    }

    /** 반납 확인: 신청 수량만큼 누적 반납과 가용 수량을 올린다. 남은 수량이 없어지면 SETTLED. */
    @Transactional
    public ResourceReturn confirmReturn(Long memberId, Long returnId) {
        Member admin = requireActiveMember(memberId);
        requireAdminRole(admin, "반납 확인은 자원 관리자(ADMIN)만 할 수 있습니다.");

        // 신청 행에서 요청 번호와 수량만 먼저 읽는다 (둘 다 바뀌지 않는 값). 실제 판단은 요청 행을 잠근 뒤에 한다.
        ResourceReturn application = requireReturn(returnId);
        Long requestId = application.getRequestId();
        int quantity = application.getAppliedQty();

        ResourceRequest request = lockExistingRequest(requestId);
        requireStatus(request, "DISPATCHED", "출고되어 정산이 끝나지 않은 요청만 반납을 확인할 수 있습니다.");

        if (fulfillmentMapper.updateReturnStatus(returnId, "PENDING", "CONFIRMED", memberId, null) != 1) {
            throw new IllegalStateException("이미 처리된 반납 신청입니다.");
        }
        if (fulfillmentMapper.applyReturnToRequest(requestId, quantity) != 1) {
            throw new IllegalStateException("남은 수량을 넘는 반납 신청이라 확인할 수 없습니다.");
        }

        ResourceStock stock = lockExistingStock(request.getStockId());
        int availableBefore = stock.getAvailableQty();
        if (approvalMapper.releaseStock(stock.getStockId(), quantity) != 1) {
            throw new IllegalStateException("재고를 되돌리지 못했습니다. 재고 상태를 확인해 주세요.");
        }

        boolean settled = request.getReturnedQty() + request.getLostQty() + quantity == request.getQuantity();
        writeRequestLog(requestId, "DISPATCHED", settled ? "SETTLED" : "DISPATCHED", "RETURN_CONFIRM",
                "반납 확인 수량 " + quantity + " (신청 번호 " + returnId + ")", memberId);
        writeStockLog(stock, "RETURN", stock.getTotalQty(), availableBefore + quantity, requestId, null, memberId);

        return fulfillmentMapper.findReturnById(returnId);
    }

    /** 반납 신청 반려: 신청 행만 REJECTED로 바꾼다. 재고와 요청의 누적 수량은 그대로. */
    @Transactional
    public ResourceReturn rejectReturn(Long memberId, Long returnId, ResourceRequestRejectRequest body) {
        Member admin = requireActiveMember(memberId);
        requireAdminRole(admin, "반납 신청 반려는 자원 관리자(ADMIN)만 할 수 있습니다.");
        String reason = requireText(body == null ? null : body.reason(), "반려 사유");

        ResourceReturn application = requireReturn(returnId);
        ResourceRequest request = lockExistingRequest(application.getRequestId());

        if (fulfillmentMapper.updateReturnStatus(returnId, "PENDING", "REJECTED", memberId, reason) != 1) {
            throw new IllegalStateException("이미 처리된 반납 신청입니다.");
        }
        writeRequestLog(request.getRequestId(), request.getStatus(), request.getStatus(), "RETURN_REJECT",
                limit("반납 신청 반려 (신청 번호 " + returnId + "): " + reason), memberId);

        return fulfillmentMapper.findReturnById(returnId);
    }

    /** 손실 확정: ADMIN이 분실·파손을 확인해 입력한 수량만 누적 손실과 총보유량에서 뺀다. */
    @Transactional
    public ResourceRequest confirmLoss(Long memberId, Long requestId, ResourceLossRequest body) {
        Member admin = requireActiveMember(memberId);
        requireAdminRole(admin, "손실 확정은 자원 관리자(ADMIN)만 할 수 있습니다.");
        if (body == null || body.lostQty() == null || body.lostQty() < 1) {
            throw new IllegalArgumentException("손실 수량은 1 이상이어야 합니다.");
        }
        if (body.expectedProcessedQty() == null || body.expectedProcessedQty() < 0) {
            throw new IllegalArgumentException("처리 완료 수량(expectedProcessedQty)이 올바르지 않습니다.");
        }
        String reason = requireText(body.reason(), "손실 사유");
        int lostQty = body.lostQty();
        int expectedProcessed = body.expectedProcessedQty();

        ResourceRequest request = lockExistingRequest(requestId);
        requireStatus(request, "DISPATCHED", "출고되어 정산이 끝나지 않은 요청만 손실을 확정할 수 있습니다.");

        int processed = request.getReturnedQty() + request.getLostQty();
        if (processed != expectedProcessed) {
            throw new IllegalStateException("다른 처리가 먼저 반영됐습니다. 화면을 새로 고친 뒤 다시 입력해 주세요.");
        }
        // 대기 중인 반납 신청은 아직 확인 전이므로 손실로 넘기지 않는다 (먼저 확인하거나 반려해야 한다)
        int pending = fulfillmentMapper.sumPendingReturnQty(requestId);
        int applicable = request.getQuantity() - processed - pending;
        if (lostQty > applicable) {
            throw new IllegalStateException(String.format(
                    "손실로 확정할 수 있는 수량을 넘었습니다. (확정 가능 %d, 입력 %d) 대기 중인 반납 신청은 먼저 처리해 주세요.",
                    Math.max(applicable, 0), lostQty));
        }
        if (fulfillmentMapper.applyLossToRequest(requestId, lostQty, expectedProcessed) != 1) {
            throw new IllegalStateException("다른 처리가 먼저 반영됐습니다. 화면을 새로 고친 뒤 다시 입력해 주세요.");
        }

        ResourceStock stock = lockExistingStock(request.getStockId());
        if (fulfillmentMapper.reduceTotal(stock.getStockId(), lostQty) != 1) {
            throw new IllegalStateException("재고가 방금 바뀌어 손실을 반영하지 못했습니다. 다시 시도해 주세요.");
        }

        boolean settled = processed + lostQty == request.getQuantity();
        writeRequestLog(requestId, "DISPATCHED", settled ? "SETTLED" : "DISPATCHED", "LOSS",
                limit("손실 수량 " + lostQty + ": " + reason), memberId);
        writeStockLog(stock, "LOSS", stock.getTotalQty() - lostQty, stock.getAvailableQty(), requestId, reason, memberId);

        return requestMapper.findById(requestId);
    }

    // 요청 행을 잠그고 현재 값을 읽는다. 없으면 400
    private ResourceRequest lockExistingRequest(Long requestId) {
        if (requestId == null) {
            throw new IllegalArgumentException("요청 번호가 없습니다.");
        }
        ResourceRequest request = approvalMapper.lockRequest(requestId);
        if (request == null) {
            throw new IllegalArgumentException("존재하지 않는 자원 요청입니다.");
        }
        return request;
    }

    private ResourceStock lockExistingStock(Long stockId) {
        ResourceStock stock = adminMapper.lockStock(stockId);
        if (stock == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        return stock;
    }

    private ResourceReturn requireReturn(Long returnId) {
        if (returnId == null) {
            throw new IllegalArgumentException("반납 신청 번호가 없습니다.");
        }
        ResourceReturn application = fulfillmentMapper.findReturnById(returnId);
        if (application == null) {
            throw new IllegalArgumentException("존재하지 않는 반납 신청입니다.");
        }
        return application;
    }

    // 잠근 뒤에 읽은 현재 상태가 기대와 다르면 다른 처리가 먼저 끝난 것이다
    private void requireStatus(ResourceRequest request, String expected, String message) {
        if (!expected.equals(request.getStatus())) {
            throw new IllegalStateException(message);
        }
    }

    // 조건부 UPDATE. 0행이면 예외를 던져 같은 트랜잭션의 다른 변경까지 롤백한다
    private void changeRequestStatus(ResourceRequest request, String from, String to, String message) {
        if (approvalMapper.updateRequestStatus(request.getRequestId(), from, to, null) != 1) {
            throw new IllegalStateException(message);
        }
    }

    private void writeRequestLog(Long requestId, String prevStatus, String newStatus, String action,
                                 String memo, Long changedBy) {
        ResourceLog log = new ResourceLog();
        log.setRequestId(requestId);
        log.setPrevStatus(prevStatus);
        log.setNewStatus(newStatus);
        log.setAction(action);
        log.setMemo(memo);
        log.setChangedBy(changedBy);
        requestMapper.insertLog(log);
    }

    // 전·후 값은 잠근 재고 행에서 계산한다 (잠근 뒤에 읽으므로 실제와 어긋나지 않는다)
    private void writeStockLog(ResourceStock stock, String action, int totalAfter, int availableAfter,
                               Long requestId, String reason, Long changedBy) {
        ResourceStockLog log = new ResourceStockLog();
        log.setStockId(stock.getStockId());
        log.setAction(action);
        log.setTotalBefore(stock.getTotalQty());
        log.setTotalAfter(totalAfter);
        log.setAvailableBefore(stock.getAvailableQty());
        log.setAvailableAfter(availableAfter);
        log.setRequestId(requestId);
        log.setReason(reason);
        log.setChangedBy(changedBy);
        approvalMapper.insertStockLog(log);
    }

    // 필수 문장: 앞뒤 공백을 지우고 비어 있으면 400, 500자를 넘으면 400
    private String requireText(String text, String label) {
        String trimmed = text == null ? null : text.trim();
        if (trimmed == null || trimmed.isEmpty()) {
            throw new IllegalArgumentException(label + "를 입력해주세요.");
        }
        if (trimmed.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException(label + "는 " + MAX_TEXT_LENGTH + "자 이하로 입력해주세요.");
        }
        return trimmed;
    }

    // 선택 문장: 비어 있으면 null, 500자를 넘으면 400
    private String optionalText(String text, String label) {
        String trimmed = text == null ? null : text.trim();
        if (trimmed == null || trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException(label + "는 " + MAX_TEXT_LENGTH + "자 이하로 입력해주세요.");
        }
        return trimmed;
    }

    // 이력 MEMO는 500자까지다. 앞에 붙인 안내 문구 때문에 넘치지 않게 자른다
    private String limit(String memo) {
        return memo.length() <= MAX_TEXT_LENGTH ? memo : memo.substring(0, MAX_TEXT_LENGTH);
    }

    // 역할은 토큰이 아니라 DB의 현재 값으로 판단한다 (탈퇴·권한 변경 직후의 오래된 토큰 방어)
    private Member requireActiveMember(Long memberId) {
        if (memberId == null) {
            throw new IllegalArgumentException("처리자 정보가 없습니다.");
        }
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("처리자가 존재하지 않습니다.");
        }
        if ("Y".equals(member.getIsWithdrawn())) {
            throw new IllegalArgumentException("탈퇴한 회원입니다.");
        }
        return member;
    }

    private void requireAdminRole(Member member, String message) {
        if (!"ADMIN".equals(member.getRole())) {
            throw new AccessDeniedException(message);
        }
    }
}
