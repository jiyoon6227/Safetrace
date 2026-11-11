package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ClosurePreviewResponse;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceApprovalMapper;
import com.safetrace.mapper.ResourceClosureMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * 사건 종료와 자원 요청의 연동.
 *
 * 규칙 (기획 문서 "사건 종료와의 관계"와 같다)
 *  - 종료는 출고 전 요청(REQUESTED·APPROVED)만 정리한다. 출고된 자원(DISPATCHED)은 건드리지 않고 미반납으로 남는다.
 *  - 담당자가 화면에서 확인한 요청 목록(cancelRequestIds) 안에 모든 출고 전 요청이 들어 있어야 한다.
 *    하나라도 빠졌으면(그 사이 새 요청이 생긴 경우 포함) 409로 전체를 되돌린다.
 *  - 승인된 요청은 예약했던 가용 재고를 되돌리고, 요청 이력에 CANCEL_BY_CLOSE, 재고 이력에 RELEASE를 남긴다.
 *
 * 잠금 순서: 사건 행 → 출고 전 요청 전부(번호 오름차순) → 취소할 승인 건의 재고 행(STOCK_ID 오름차순, 중복 제거).
 * 요청을 하나 취소할 때마다 그 재고를 잡지 않고, 요청을 모두 처리한 뒤 재고를 번호순으로 잡는다.
 * 코드상 순서를 이렇게 정했으나 실제 Oracle에서의 잠금·재평가·동시성은 8단계 테스트에서 확인한다.
 *
 * cancelOpenRequestsForClose는 IncidentService.changeStatus의 트랜잭션 안에서 불리고(같은 트랜잭션에 참여),
 * 사건을 CLOSED로 바꾸는 UPDATE는 호출한 쪽이 이어서 한다.
 */
@Service
@RequiredArgsConstructor
public class ResourceClosureService {

    private final ResourceClosureMapper closureMapper;
    private final ResourceRequestMapper requestMapper;     // 사건 행 잠금(lockIncident), 요청 이력 INSERT
    private final ResourceApprovalMapper approvalMapper;   // 요청 상태 변경, 가용 복구, 재고 이력 INSERT
    private final ResourceAdminMapper adminMapper;         // 재고 행 잠금(lockStock)
    private final IncidentMapper incidentMapper;           // 확인 목록 조회 권한 확인용 (담당자 읽기)
    private final MemberMapper memberMapper;

    /**
     * 사건을 종료하기 전에 출고 전 요청을 정리한다. 사건 상태를 CLOSED로 바꾸는 UPDATE는 호출한 쪽이 한다.
     *
     * @param expectedIncidentStatus 호출한 쪽이 읽은 사건 상태. 사건 행을 잠근 뒤 값이 달라졌으면 409
     * @param confirmedRequestIds    담당자가 화면에서 확인한 출고 전 요청 번호 (없으면 null)
     */
    @Transactional
    public void cancelOpenRequestsForClose(Long incidentId, String expectedIncidentStatus,
                                           List<Long> confirmedRequestIds, Long staffId) {
        if (incidentId == null) {
            throw new IllegalArgumentException("사건 번호가 없습니다.");
        }

        // (1) 사건 행을 잠그고 상태를 다시 읽는다
        Incident incident = requestMapper.lockIncident(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }
        if (expectedIncidentStatus == null || !expectedIncidentStatus.equals(incident.getStatus())) {
            throw new IllegalStateException("이미 처리된 요청입니다. 새로고침 후 다시 확인해주세요.");
        }

        // (2) 출고 전 요청 전부를 번호 오름차순으로 잠그고 현재 상태를 읽는다
        List<ResourceRequest> openRequests = closureMapper.lockOpenRequests(incidentId);
        Set<Long> confirmed = new HashSet<>();
        if (confirmedRequestIds != null) {
            for (Long id : confirmedRequestIds) {
                if (id != null) {
                    confirmed.add(id);
                }
            }
        }

        // 잠근 요청 중 확인한 목록에 없는 것이 하나라도 있으면 아무것도 바꾸지 않고 거절한다
        List<ResourceRequest> targets = new ArrayList<>();
        for (ResourceRequest request : openRequests) {
            if (!isOpen(request)) {
                continue;   // 출고된 요청(DISPATCHED 등)은 건드리지 않는다
            }
            if (!confirmed.contains(request.getRequestId())) {
                throw new IllegalStateException(
                        "확인하지 않은 출고 전 요청이 있어 종료할 수 없습니다. 목록을 다시 확인해 주세요.");
            }
            targets.add(request);
        }

        // (3) 요청 취소: 상태·요청 이력을 모두 바꾼 뒤에 재고를 잡는다
        List<ResourceRequest> approvedTargets = new ArrayList<>();
        for (ResourceRequest request : targets) {
            String from = request.getStatus();
            changeRequestStatus(request, from, "CANCELLED");
            writeRequestLog(request.getRequestId(), from, "CANCELLED", "CANCEL_BY_CLOSE",
                    "사건 종료 확인으로 취소 (사건 번호 " + incidentId + ")", staffId);
            if ("APPROVED".equals(from)) {
                approvedTargets.add(request);
            }
        }

        // 승인 건의 예약 재고 복구: 재고 행은 STOCK_ID 오름차순으로 한 행씩 잡는다 (중복 제거)
        Map<Long, List<ResourceRequest>> byStock = new TreeMap<>();
        for (ResourceRequest request : approvedTargets) {
            byStock.computeIfAbsent(request.getStockId(), key -> new ArrayList<>()).add(request);
        }
        for (Map.Entry<Long, List<ResourceRequest>> entry : byStock.entrySet()) {
            ResourceStock stock = lockExistingStock(entry.getKey());
            int available = stock.getAvailableQty();
            for (ResourceRequest request : entry.getValue()) {
                int quantity = request.getQuantity();
                if (approvalMapper.releaseStock(stock.getStockId(), quantity) != 1) {
                    throw new IllegalStateException("재고를 되돌리지 못했습니다. 재고 상태를 확인해 주세요.");
                }
                writeStockLog(stock, available, available + quantity, request.getRequestId(), staffId);
                available += quantity;
            }
        }

        // (4) 마지막으로 출고 전 요청이 0건인지 다시 센다
        if (closureMapper.countOpenRequests(incidentId) != 0) {
            throw new IllegalStateException("출고 전 요청이 남아 있어 종료할 수 없습니다. 다시 시도해 주세요.");
        }
    }

    /** 종료 전 확인 목록: 그 사건의 담당 STAFF 본인만 볼 수 있다. 아무것도 잠그지 않는다. */
    @Transactional(readOnly = true)
    public ClosurePreviewResponse getClosurePreview(Long memberId, Long incidentId) {
        Member member = requireActiveMember(memberId);
        if (!"STAFF".equals(member.getRole())) {
            throw new AccessDeniedException("종료 전 확인 목록은 사건 담당자(STAFF)만 볼 수 있습니다.");
        }
        Incident incident = incidentId == null ? null : incidentMapper.findById(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }
        if (!memberId.equals(incident.getAssignedStaffId())) {
            throw new AccessDeniedException("이 사건의 담당자만 종료 전 확인 목록을 볼 수 있습니다.");
        }
        return new ClosurePreviewResponse(
                closureMapper.findOpenRequests(incidentId),
                closureMapper.countDispatched(incidentId));
    }

    private boolean isOpen(ResourceRequest request) {
        return "REQUESTED".equals(request.getStatus()) || "APPROVED".equals(request.getStatus());
    }

    private ResourceStock lockExistingStock(Long stockId) {
        ResourceStock stock = adminMapper.lockStock(stockId);
        if (stock == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        return stock;
    }

    // 조건부 UPDATE. 0행이면 예외를 던져 같은 트랜잭션의 다른 변경(사건 종료 포함)까지 롤백한다
    private void changeRequestStatus(ResourceRequest request, String from, String to) {
        if (approvalMapper.updateRequestStatus(request.getRequestId(), from, to, null) != 1) {
            throw new IllegalStateException("이미 처리된 요청이 있어 종료할 수 없습니다. 다시 시도해 주세요.");
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

    // 총보유량은 그대로, 가용만 복구 수량만큼 늘어난다 (같은 재고의 여러 요청은 전·후 값이 이어진다)
    private void writeStockLog(ResourceStock stock, int availableBefore, int availableAfter,
                               Long requestId, Long changedBy) {
        ResourceStockLog log = new ResourceStockLog();
        log.setStockId(stock.getStockId());
        log.setAction("RELEASE");
        log.setTotalBefore(stock.getTotalQty());
        log.setTotalAfter(stock.getTotalQty());
        log.setAvailableBefore(availableBefore);
        log.setAvailableAfter(availableAfter);
        log.setRequestId(requestId);
        log.setChangedBy(changedBy);
        approvalMapper.insertStockLog(log);
    }

    // 역할은 토큰이 아니라 DB의 현재 값으로 판단한다 (탈퇴·권한 변경 직후의 오래된 토큰 방어)
    private Member requireActiveMember(Long memberId) {
        if (memberId == null) {
            throw new IllegalArgumentException("조회자 정보가 없습니다.");
        }
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("조회자가 존재하지 않습니다.");
        }
        if ("Y".equals(member.getIsWithdrawn())) {
            throw new IllegalArgumentException("탈퇴한 회원입니다.");
        }
        return member;
    }
}
