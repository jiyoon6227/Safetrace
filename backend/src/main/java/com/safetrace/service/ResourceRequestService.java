package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.dto.ResourceRequestCreateRequest;
import com.safetrace.dto.ResourceRequestPageResponse;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceStatusCount;
import com.safetrace.dto.ResourceTimelineStep;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 자원 요청 생성·조회.
 * 역할은 둘뿐이다. STAFF(사건 담당자)가 요청하고, ADMIN이 승인·반려·출고·반납 확인과 재고 관리를 한다.
 * 승인·출고·반납 같은 재고를 바꾸는 처리는 다음 단계에서 이 서비스와 분리해서 만든다.
 *
 * 요청을 만들 때 잠그는 행은 사건 하나뿐이고, 재고는 잠금 없이 읽기만 한다
 * (재고 가용 수량·사용 중지 여부는 승인 때 다시 검사한다. 설계의 잠금 순서: 사건 → 요청 → 재고).
 * 사건 행 잠금 대기가 3초를 넘으면 락 예외가 나고, GlobalExceptionHandler가 409(LOCK_CONFLICT)로 바꿔준다.
 */
@Service
@RequiredArgsConstructor
public class ResourceRequestService {

    // 화면에서 보여주는 순서이기도 하다 (상태별 건수 응답의 순서)
    private static final List<String> STATUS_ORDER = List.of(
            "REQUESTED", "APPROVED", "DISPATCHED", "SETTLED", "COMPLETED", "REJECTED", "CANCELLED");
    private static final Set<String> STATUSES = Set.copyOf(STATUS_ORDER);

    // 처리 이력의 행동 이름표와, 아직 안 일어난 단계에 붙이는 안내 문구
    private static final Map<String, String> ACTION_LABEL = Map.ofEntries(
            Map.entry("CREATE", "요청 등록"), Map.entry("APPROVE", "승인"), Map.entry("REJECT", "반려"),
            Map.entry("CANCEL", "취소"), Map.entry("CANCEL_BY_CLOSE", "사건 종료로 자동 취소"),
            Map.entry("DISPATCH", "출고"), Map.entry("ARRIVE", "도착 확인"), Map.entry("RETURN_APPLY", "반납 신청"),
            Map.entry("RETURN_CONFIRM", "반납 확인"), Map.entry("RETURN_REJECT", "반납 신청 반려"),
            Map.entry("LOSS", "손실 확정"));
    private static final Map<String, String> NEXT_STEP_NOTE = Map.of(
            "APPROVE", "자원 관리자의 승인을 기다리고 있습니다.",
            "DISPATCH", "승인되면 출고됩니다.",
            "ARRIVE", "현장 도착 후 확인이 필요합니다.",
            "RETURN_APPLY", "사용이 끝나면 반납을 신청하세요.");
    // 도착 확인을 할 수 있는 요청 상태 (ResourceFulfillmentService.arrive와 같은 규칙)
    private static final Set<String> ARRIVAL_STATUSES = Set.of("DISPATCHED", "SETTLED", "COMPLETED");

    static final int DEFAULT_PAGE_SIZE = 10;
    static final int MAX_PAGE_SIZE = 50;
    static final int MAX_PAGE = 100_000;
    static final int MAX_REASON_LENGTH = 500;
    static final int MAX_KEYWORD_LENGTH = 50;
    // 화면에서 "지금"을 고르고 전송하는 사이의 시간 차이를 봐주는 여유
    static final long NEEDED_AT_TOLERANCE_MINUTES = 5;
    // 같은 내용(사건·재고·수량·사유)의 요청이 이 시간 안에 또 오면 더블클릭·재전송으로 본다.
    // 이보다 늦게 같은 내용으로 다시 요청하는 것은 정상적인 추가 요청이다.
    static final int DUPLICATE_CLICK_WINDOW_SECONDS = 10;

    private final ResourceRequestMapper requestMapper;
    private final MemberMapper memberMapper;
    private final ResourceMapper resourceMapper;

    /**
     * 자원 요청 생성. 규칙:
     *  - 요청자는 미탈퇴 STAFF여야 한다 (요청자 ID는 로그인 정보에서만 받는다). ADMIN은 요청할 수 없다
     *  - 사건은 종료되지 않았어야 하고, 사건 담당자 본인만 요청할 수 있다
     *  - 재고는 사용 중(ACTIVE)이어야 한다. 같은 부서 재고도 요청할 수 있다 (승인은 ADMIN이 하므로 자기 승인이 아니다)
     *  - 수량은 해당 재고의 보유 총량 이하, 넘으면 400 (지금 가용 수량이 모자라도 요청은 가능, 가용 검사는 승인 때)
     *  - 같은 내용의 요청이 10초 안에 또 오면 더블클릭으로 보고 거절 (그 뒤의 추가 요청은 허용)
     * 재고 수량은 이 단계에서 줄이지 않는다 (승인 때 예약한다).
     */
    @Transactional
    public ResourceRequest createRequest(Long memberId, ResourceRequestCreateRequest request) {
        requireActiveMember(memberId, false);
        validateCreateInput(request);

        Incident incident = requestMapper.lockIncident(request.incidentId());
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 사건입니다.");
        }
        if ("CLOSED".equals(incident.getStatus())) {
            throw new IllegalStateException("종료된 사건에는 자원을 요청할 수 없습니다.");
        }
        if (incident.getAssignedStaffId() == null) {
            throw new IllegalStateException("담당자가 배정되지 않은 사건입니다. 먼저 담당자를 배정해주세요.");
        }
        if (!incident.getAssignedStaffId().equals(memberId)) {
            throw new AccessDeniedException("이 사건의 담당자만 자원을 요청할 수 있습니다.");
        }

        // 재고는 잠금 없이 읽는다. 읽은 뒤 사용 중지돼도 승인 때 ACTIVE를 다시 검사한다.
        ResourceStock stock = resourceMapper.findStockById(request.stockId());
        if (stock == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        if (!"ACTIVE".equals(stock.getStatus())) {
            throw new IllegalStateException("사용이 중지된 재고는 요청할 수 없습니다.");
        }

        int quantity = request.quantity();
        if (quantity > stock.getTotalQty()) {
            throw new IllegalArgumentException(
                    String.format("요청 수량이 보유 총량(%d)을 넘을 수 없습니다.", stock.getTotalQty()));
        }
        String reason = request.reason().trim();
        if (requestMapper.countRecentSame(request.incidentId(), request.stockId(), memberId, quantity, reason,
                DUPLICATE_CLICK_WINDOW_SECONDS) > 0) {
            throw new IllegalStateException("같은 요청이 방금 접수되었습니다. 요청 목록에서 확인해주세요.");
        }

        ResourceRequest created = new ResourceRequest();
        created.setIncidentId(request.incidentId());
        created.setStockId(request.stockId());
        created.setRequesterId(memberId);
        created.setQuantity(quantity);
        created.setReason(reason);
        created.setNeededAt(request.neededAt());
        requestMapper.insertRequest(created);

        ResourceLog log = new ResourceLog();
        log.setRequestId(created.getRequestId());
        log.setPrevStatus(null);
        log.setNewStatus("REQUESTED");
        log.setAction("CREATE");
        log.setChangedBy(memberId);
        requestMapper.insertLog(log);

        return requestMapper.findById(created.getRequestId());
    }

    /**
     * 요청 목록. STAFF는 내가 보낸 요청만, ADMIN은 전부 본다.
     * status가 없거나 ALL이면 상태 조건 없이, incidentId가 있으면 그 사건의 요청만 본다.
     * keyword가 있으면 품목명·요청 사유·사건 제목·보유 부서명에 그 글자가 들어 있는 요청만 본다.
     */
    @Transactional(readOnly = true)
    public ResourceRequestPageResponse getRequests(Long memberId, String status, Long incidentId, String keyword,
                                                   Integer page, Integer size) {
        Member actor = requireActiveMember(memberId, true);

        String safeStatus = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
            safeStatus = status.trim().toUpperCase();
            if (!STATUSES.contains(safeStatus)) {
                throw new IllegalArgumentException("올바르지 않은 요청 상태입니다.");
            }
        }
        int safePage = page == null ? 1 : Math.min(Math.max(page, 1), MAX_PAGE);
        int safeSize = size == null ? DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        String safeKeyword = normalizeKeyword(keyword);

        // 요청자 조건이 null이면 제한 없음(ADMIN)
        Long requesterId = isAdmin(actor) ? null : memberId;

        long total = requestMapper.countRequests(requesterId, safeStatus, incidentId, safeKeyword);
        List<ResourceRequest> items = total == 0
                ? List.of()
                : requestMapper.findRequests(requesterId, safeStatus, incidentId, safeKeyword,
                        (safePage - 1) * safeSize, safePage * safeSize);
        items.forEach(item -> fillActions(item, actor));
        return new ResourceRequestPageResponse(items, total, safePage, safeSize);
    }

    /**
     * 요청 상태별 건수. 목록과 같은 조건(내 요청만/ADMIN은 전체, 사건, 검색어)에서 상태 조건만 뺀 결과다.
     * 요청이 없는 상태도 0으로 채워서, 화면이 건수를 직접 세거나 빈 칸을 채울 필요가 없다.
     */
    @Transactional(readOnly = true)
    public ResourceRequestSummaryResponse getRequestSummary(Long memberId, Long incidentId, String keyword) {
        Member actor = requireActiveMember(memberId, true);
        Long requesterId = isAdmin(actor) ? null : memberId;

        Map<String, Long> counts = new LinkedHashMap<>();
        STATUS_ORDER.forEach(status -> counts.put(status, 0L));
        long total = 0;
        for (ResourceStatusCount row : requestMapper.countRequestsByStatus(requesterId, incidentId, normalizeKeyword(keyword))) {
            counts.put(row.getStatus(), row.getRequestCount());
            total += row.getRequestCount();
        }
        return new ResourceRequestSummaryResponse(total, counts);
    }

    // 검색어를 다듬는다: 앞뒤 공백 제거, 비면 null(조건 없음), 최대 50자, LIKE 특수문자(\ % _)는 글자 그대로 찾도록 이스케이프
    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String trimmed = keyword.trim();
        if (trimmed.length() > MAX_KEYWORD_LENGTH) {
            trimmed = trimmed.substring(0, MAX_KEYWORD_LENGTH);
        }
        return trimmed.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** 요청 상세. 요청한 본인과 ADMIN만 볼 수 있다. */
    @Transactional(readOnly = true)
    public ResourceRequest getRequest(Long memberId, Long requestId) {
        Member actor = requireActiveMember(memberId, true);
        ResourceRequest found = loadVisibleRequest(actor, requestId);
        fillActions(found, actor);
        return found;
    }

    /** 요청 처리 이력. 상세와 같은 조회 권한. */
    @Transactional(readOnly = true)
    public List<ResourceLog> getRequestLogs(Long memberId, Long requestId) {
        Member actor = requireActiveMember(memberId, true);
        loadVisibleRequest(actor, requestId);
        return requestMapper.findLogs(requestId);
    }

    /**
     * 처리 이력 타임라인: 기록된 처리(done)에 이어, 앞으로 남은 단계를 안내 문구와 함께 붙인다.
     * 남은 단계 중 첫 번째가 "지금 해야 할 단계"(current)다. 상세와 같은 조회 권한.
     */
    @Transactional(readOnly = true)
    public List<ResourceTimelineStep> getRequestTimeline(Long memberId, Long requestId) {
        Member actor = requireActiveMember(memberId, true);
        ResourceRequest request = loadVisibleRequest(actor, requestId);
        List<ResourceLog> logs = requestMapper.findLogs(requestId);

        List<ResourceTimelineStep> steps = new ArrayList<>();
        Set<String> happened = new HashSet<>();
        for (ResourceLog log : logs) {
            happened.add(log.getAction());
            steps.add(new ResourceTimelineStep("log-" + log.getLogId(),
                    ACTION_LABEL.getOrDefault(log.getAction(), log.getAction()),
                    true, false, log.getChangedAt(), log.getChangedByName(), log.getMemo()));
        }

        // 남은 단계는 요청이 끝난 상태(반려·취소·종료)가 아니면 처음부터 전체 흐름을 보여준다 (아직 안 한 단계는 예정으로 표시)
        String status = request.getStatus();
        boolean beforeDispatch = "REQUESTED".equals(status) || "APPROVED".equals(status);
        List<String> next = new ArrayList<>();
        if ("REQUESTED".equals(status)) {
            next.add("APPROVE");
        }
        if (beforeDispatch) {
            next.add("DISPATCH");
        }
        if ((beforeDispatch || canArriveAt(status)) && request.getArrivedAt() == null
                && !happened.contains("ARRIVE")) {
            next.add("ARRIVE");
        }
        if ((beforeDispatch || "DISPATCHED".equals(status)) && "Y".equals(request.getReturnable())
                && !happened.contains("RETURN_APPLY")) {
            next.add("RETURN_APPLY");
        }
        for (int i = 0; i < next.size(); i++) {
            String action = next.get(i);
            steps.add(new ResourceTimelineStep("next-" + action, ACTION_LABEL.get(action),
                    false, i == 0, null, null, NEXT_STEP_NOTE.get(action)));
        }
        return steps;
    }

    // 조회한 사람 기준으로 버튼 가능 여부와 반납 가능 수량을 채운다. 도착 확인·반납 신청은 요청한 본인(STAFF)만 할 수 있다.
    // 반납 가능 수량 = 요청 수량 - 반납 확인 - 손실 - 확인 대기 중인 신청 (서버가 신청을 받을 때 하는 계산과 같다)
    private void fillActions(ResourceRequest request, Member actor) {
        boolean mine = "STAFF".equals(actor.getRole()) && actor.getMemberId().equals(request.getRequesterId());
        int left = zero(request.getQuantity()) - zero(request.getReturnedQty())
                - zero(request.getLostQty()) - zero(request.getPendingReturnQty());
        request.setApplicableReturnQty(Math.max(left, 0));
        request.setCanArrive(mine && canArriveAt(request.getStatus()) && request.getArrivedAt() == null);
        request.setCanApplyReturn(mine && "Y".equals(request.getReturnable()) && "DISPATCHED".equals(request.getStatus()));
    }

    // Set.of는 null을 넣고 찾으면 예외가 나므로 상태가 비어 있는 경우를 먼저 거른다
    private static boolean canArriveAt(String status) {
        return status != null && ARRIVAL_STATUSES.contains(status);
    }

    private static int zero(Integer value) {
        return value == null ? 0 : value;
    }

    private ResourceRequest loadVisibleRequest(Member actor, Long requestId) {
        ResourceRequest found = requestMapper.findById(requestId);
        if (found == null) {
            throw new IllegalArgumentException("존재하지 않는 자원 요청입니다.");
        }
        boolean visible = isAdmin(actor) || actor.getMemberId().equals(found.getRequesterId());
        if (!visible) {
            throw new AccessDeniedException("이 요청을 볼 수 있는 권한이 없습니다.");
        }
        return found;
    }

    private void validateCreateInput(ResourceRequestCreateRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("요청 정보가 없습니다.");
        }
        if (request.incidentId() == null) {
            throw new IllegalArgumentException("사건을 선택해주세요.");
        }
        if (request.stockId() == null) {
            throw new IllegalArgumentException("요청할 재고를 선택해주세요.");
        }
        if (request.quantity() == null || request.quantity() < 1) {
            throw new IllegalArgumentException("요청 수량은 1 이상이어야 합니다.");
        }
        if (request.reason() == null || request.reason().isBlank()) {
            throw new IllegalArgumentException("요청 사유를 입력해주세요.");
        }
        if (request.reason().trim().length() > MAX_REASON_LENGTH) {
            throw new IllegalArgumentException("요청 사유는 " + MAX_REASON_LENGTH + "자 이하로 입력해주세요.");
        }
        if (request.neededAt() != null
                && request.neededAt().isBefore(LocalDateTime.now().minusMinutes(NEEDED_AT_TOLERANCE_MINUTES))) {
            throw new IllegalArgumentException("필요 시각은 현재 이후로 입력해주세요.");
        }
    }

    // 역할은 토큰이 아니라 DB의 현재 값으로 판단한다 (탈퇴·권한 변경 직후의 오래된 토큰 방어)
    private Member requireActiveMember(Long memberId, boolean allowAdmin) {
        if (memberId == null) {
            throw new IllegalArgumentException("요청자 정보가 없습니다.");
        }
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("요청자가 존재하지 않습니다.");
        }
        if ("Y".equals(member.getIsWithdrawn())) {
            throw new IllegalArgumentException("탈퇴한 회원입니다.");
        }
        boolean roleOk = "STAFF".equals(member.getRole()) || (allowAdmin && "ADMIN".equals(member.getRole()));
        if (!roleOk) {
            throw new AccessDeniedException(allowAdmin
                    ? "자원 요청은 담당 직원과 자원 관리자만 이용할 수 있습니다."
                    : "자원 요청은 담당 직원(STAFF)만 할 수 있습니다.");
        }
        return member;
    }

    private boolean isAdmin(Member member) {
        return "ADMIN".equals(member.getRole());
    }
}
