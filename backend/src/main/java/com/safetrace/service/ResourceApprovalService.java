package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceApprovalMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 자원 요청 승인·반려·취소와 재고 예약·복구.
 *
 * 규칙 (기획 문서 "상태 전이" 표와 같다)
 *  - 승인: ADMIN만. REQUESTED → APPROVED. 가용 수량을 요청 수량만큼 줄인다(예약). 총보유량은 그대로.
 *    가용이 모자라거나 재고가 사용 중지거나 사건이 이미 종료됐으면 409.
 *  - 반려: ADMIN만. REQUESTED → REJECTED. 사유 필수. 재고 변화 없음.
 *  - 취소: REQUESTED는 요청자 본인만, APPROVED는 요청자 본인 또는 ADMIN. 출고 이후나 이미 끝난 요청은 409.
 *    승인 후 취소는 가용 수량을 요청 수량만큼 되돌린다. 사용 중지된 재고도 복구할 수 있다.
 *
 * 재고 정합성
 *  - 잠금 순서는 요청 → 재고다 (사건 → 요청 → 재고 규칙의 일부. 승인·취소는 사건 행을 잠그지 않는다).
 *    사건 단계를 건너뛰어도 모든 경로가 같은 순서(사건 < 요청(번호 오름차순) < 재고(번호 오름차순))를 따르므로 교착이 생기지 않는다.
 *  - 승인은 사건 상태를 잠금 없이 읽어 종료된 사건이면 거절한다. 사건 종료(7단계)가 요청 행을 잠그고 출고 전 요청을
 *    취소하는 쪽이 본 방어선이고, 이 검사는 종료 처리가 아직 요청을 정리하지 않는 지금과 이전에 남은 요청을 위한 보조 방어선이다.
 *  - 요청 행을 먼저 잠그고 현재 상태를 다시 읽는다. 같은 요청에 승인·취소가 동시에 와도 한쪽이 끝난 뒤
 *    다른 쪽이 바뀐 상태를 보고 409가 되므로, 예약이나 복구가 두 번 반영되지 않는다.
 *  - 상태 변경과 재고 변경은 조건부 UPDATE이고, 0행이면 예외로 전체를 롤백한다. 서비스 검사가 뚫려도
 *    DB CHECK(가용 0 이상·총보유량 이하)가 마지막 방어선이다.
 *  - 요청 상태 변경, 재고 변경, 요청 이력, 재고 이력은 한 트랜잭션이다. 어느 하나가 실패하면 모두 롤백된다.
 *  - 잠금 대기가 3초를 넘으면 락 예외가 나고, GlobalExceptionHandler가 409(LOCK_CONFLICT)로 바꿔준다.
 */
@Service
@RequiredArgsConstructor
public class ResourceApprovalService {

    static final int MAX_REASON_LENGTH = 500;

    private final ResourceApprovalMapper approvalMapper;
    private final ResourceAdminMapper adminMapper;       // 재고 행 잠금(lockStock) 재사용
    private final ResourceRequestMapper requestMapper;   // 요청 이력 INSERT, 처리 결과 조회 재사용
    private final MemberMapper memberMapper;

    /** 승인: 가용 수량 예약. */
    @Transactional
    public ResourceRequest approve(Long memberId, Long requestId) {
        Member admin = requireActiveMember(memberId);
        requireAdminRole(admin, "요청 승인은 자원 관리자(ADMIN)만 할 수 있습니다.");

        ResourceRequest request = lockExistingRequest(requestId);
        requireStatus(request, "REQUESTED", "이미 처리된 요청입니다.");
        // 요청 행을 잠근 뒤에 읽는다. 종료 처리가 이 요청을 취소했다면 위에서 이미 409다.
        if ("CLOSED".equals(approvalMapper.findIncidentStatus(request.getIncidentId()))) {
            throw new IllegalStateException("종료된 사건의 요청은 승인할 수 없습니다.");
        }

        ResourceStock stock = lockExistingStock(request.getStockId());
        if (!"ACTIVE".equals(stock.getStatus())) {
            throw new IllegalStateException("사용이 중지된 재고라 승인할 수 없습니다.");
        }
        int quantity = request.getQuantity();
        int availableBefore = stock.getAvailableQty();
        if (availableBefore < quantity) {
            throw new IllegalStateException(String.format(
                    "재고가 부족합니다. (가용 %d, 요청 %d)", availableBefore, quantity));
        }

        if (approvalMapper.reserveStock(stock.getStockId(), quantity) != 1) {
            throw new IllegalStateException("재고가 방금 바뀌어 승인하지 못했습니다. 다시 시도해 주세요.");
        }
        changeRequestStatus(request, "REQUESTED", "APPROVED", null);
        writeRequestLog(requestId, "REQUESTED", "APPROVED", "APPROVE", null, memberId);
        writeStockLog(stock, "RESERVE", availableBefore, availableBefore - quantity, requestId, memberId);

        return requestMapper.findById(requestId);
    }

    /** 반려: 재고는 건드리지 않는다. */
    @Transactional
    public ResourceRequest reject(Long memberId, Long requestId, ResourceRequestRejectRequest body) {
        Member admin = requireActiveMember(memberId);
        requireAdminRole(admin, "요청 반려는 자원 관리자(ADMIN)만 할 수 있습니다.");
        String reason = requireReason(body == null ? null : body.reason());

        ResourceRequest request = lockExistingRequest(requestId);
        requireStatus(request, "REQUESTED", "이미 처리된 요청입니다.");

        changeRequestStatus(request, "REQUESTED", "REJECTED", reason);
        writeRequestLog(requestId, "REQUESTED", "REJECTED", "REJECT", reason, memberId);

        return requestMapper.findById(requestId);
    }

    /** 취소: 승인 전이면 상태만, 승인 후 출고 전이면 예약한 가용 수량을 되돌린다. */
    @Transactional
    public ResourceRequest cancel(Long memberId, Long requestId) {
        Member actor = requireActiveMember(memberId);
        boolean admin = "ADMIN".equals(actor.getRole());
        if (!admin && !"STAFF".equals(actor.getRole())) {
            throw new AccessDeniedException("요청 취소는 요청자 본인과 자원 관리자만 할 수 있습니다.");
        }

        ResourceRequest request = lockExistingRequest(requestId);
        // STAFF는 자기 요청만 취소할 수 있다 (남의 요청이면 상태와 무관하게 403)
        if (!admin && !memberId.equals(request.getRequesterId())) {
            throw new AccessDeniedException("본인이 보낸 요청만 취소할 수 있습니다.");
        }
        String current = request.getStatus();
        if (!"REQUESTED".equals(current) && !"APPROVED".equals(current)) {
            throw new IllegalStateException("이미 처리됐거나 출고된 요청은 취소할 수 없습니다.");
        }
        // 승인 전 요청은 요청자 본인만 취소한다. ADMIN은 승인 후 요청부터 취소할 수 있다.
        if ("REQUESTED".equals(current) && admin) {
            throw new AccessDeniedException("승인 전 요청은 요청자 본인만 취소할 수 있습니다. 처리하려면 반려해 주세요.");
        }

        if ("APPROVED".equals(current)) {
            ResourceStock stock = lockExistingStock(request.getStockId());
            int quantity = request.getQuantity();
            int availableBefore = stock.getAvailableQty();
            if (approvalMapper.releaseStock(stock.getStockId(), quantity) != 1) {
                throw new IllegalStateException("재고를 되돌리지 못했습니다. 재고 상태를 확인해 주세요.");
            }
            changeRequestStatus(request, "APPROVED", "CANCELLED", null);
            writeRequestLog(requestId, "APPROVED", "CANCELLED", "CANCEL", null, memberId);
            writeStockLog(stock, "RELEASE", availableBefore, availableBefore + quantity, requestId, memberId);
        } else {
            changeRequestStatus(request, "REQUESTED", "CANCELLED", null);
            writeRequestLog(requestId, "REQUESTED", "CANCELLED", "CANCEL", null, memberId);
        }

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

    // 잠근 뒤에 읽은 현재 상태가 기대와 다르면 다른 처리가 먼저 끝난 것이다
    private void requireStatus(ResourceRequest request, String expected, String message) {
        if (!expected.equals(request.getStatus())) {
            throw new IllegalStateException(message);
        }
    }

    // 조건부 UPDATE. 0행이면 예외를 던져 같은 트랜잭션의 재고 변경까지 롤백한다
    private void changeRequestStatus(ResourceRequest request, String from, String to, String rejectReason) {
        if (approvalMapper.updateRequestStatus(request.getRequestId(), from, to, rejectReason) != 1) {
            throw new IllegalStateException("이미 처리된 요청입니다.");
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

    // 총보유량은 승인·취소로 바뀌지 않는다. 가용 전·후 값은 잠근 값에서 계산한다
    private void writeStockLog(ResourceStock stock, String action, int availableBefore, int availableAfter,
                               Long requestId, Long changedBy) {
        ResourceStockLog log = new ResourceStockLog();
        log.setStockId(stock.getStockId());
        log.setAction(action);
        log.setTotalBefore(stock.getTotalQty());
        log.setTotalAfter(stock.getTotalQty());
        log.setAvailableBefore(availableBefore);
        log.setAvailableAfter(availableAfter);
        log.setRequestId(requestId);
        log.setChangedBy(changedBy);
        approvalMapper.insertStockLog(log);
    }

    private String requireReason(String reason) {
        String trimmed = reason == null ? null : reason.trim();
        if (trimmed == null || trimmed.isEmpty()) {
            throw new IllegalArgumentException("반려 사유를 입력해주세요.");
        }
        if (trimmed.length() > MAX_REASON_LENGTH) {
            throw new IllegalArgumentException("반려 사유는 " + MAX_REASON_LENGTH + "자 이하로 입력해주세요.");
        }
        return trimmed;
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
