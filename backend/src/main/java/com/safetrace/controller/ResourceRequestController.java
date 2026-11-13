package com.safetrace.controller;

import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.dto.ResourceRequestCreateRequest;
import com.safetrace.dto.ResourceRequestPageResponse;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceTimelineStep;
import com.safetrace.service.ResourceRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/resources/requests")
@RequiredArgsConstructor
public class ResourceRequestController {

    private final ResourceRequestService requestService;

    // JwtAuthenticationFilter가 principal에 넣은 memberId
    private Long currentMemberId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    // 자원 요청 생성 - 담당 직원(사건 담당자)만. 요청자 ID는 로그인 정보에서 가져온다.
    @PostMapping
    @PreAuthorize("hasRole('STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceRequest create(@RequestBody @Valid ResourceRequestCreateRequest request,
                                  Authentication authentication) {
        return requestService.createRequest(currentMemberId(authentication), request);
    }

    // 요청 목록 - 담당 직원은 내가 보낸 요청, 자원 관리자는 전체
    // 예: /api/resources/requests?status=REQUESTED&incidentId=3&keyword=발전기&page=1&size=10
    @GetMapping
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResourceRequestPageResponse getRequests(@RequestParam(required = false) String status,
                                                   @RequestParam(required = false) Long incidentId,
                                                   @RequestParam(required = false) String keyword,
                                                   @RequestParam(required = false) Integer page,
                                                   @RequestParam(required = false) Integer size,
                                                   Authentication authentication) {
        return requestService.getRequests(currentMemberId(authentication), status, incidentId, keyword, page, size);
    }

    // 요청 상태별 건수 - 목록과 같은 조건에서 상태만 뺀 건수 (화면 요약 카드·상태 탭용)
    // 예: /api/resources/requests/summary?incidentId=3&keyword=발전기
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResourceRequestSummaryResponse getRequestSummary(@RequestParam(required = false) Long incidentId,
                                                            @RequestParam(required = false) String keyword,
                                                            Authentication authentication) {
        return requestService.getRequestSummary(currentMemberId(authentication), incidentId, keyword);
    }

    // 요청 상세 - 요청한 본인과 자원 관리자만
    @GetMapping("/{requestId}")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResourceRequest getRequest(@PathVariable Long requestId, Authentication authentication) {
        return requestService.getRequest(currentMemberId(authentication), requestId);
    }

    // 요청 처리 이력 - 상세와 같은 조회 권한
    @GetMapping("/{requestId}/logs")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<ResourceLog> getRequestLogs(@PathVariable Long requestId, Authentication authentication) {
        return requestService.getRequestLogs(currentMemberId(authentication), requestId);
    }

    // 처리 이력 타임라인 - 기록된 처리 + 앞으로 남은 단계(안내 문구 포함). 상세와 같은 조회 권한
    @GetMapping("/{requestId}/timeline")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<ResourceTimelineStep> getRequestTimeline(@PathVariable Long requestId, Authentication authentication) {
        return requestService.getRequestTimeline(currentMemberId(authentication), requestId);
    }
}
