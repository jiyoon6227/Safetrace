package com.safetrace.controller;

import com.safetrace.domain.ResourceRequest;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.service.ResourceApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 자원 요청 승인·반려·취소. 처리자 ID는 로그인 정보에서만 가져온다 (body로 받지 않는다).
// 요청 생성·조회는 ResourceRequestController가 맡는다 (같은 /api/resources/requests 아래, 경로가 겹치지 않는다).
@RestController
@RequestMapping("/api/resources/requests")
@RequiredArgsConstructor
public class ResourceApprovalController {

    private final ResourceApprovalService approvalService;

    // JwtAuthenticationFilter가 principal에 넣은 memberId
    private Long currentMemberId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    // 승인 + 가용 수량 예약 - ADMIN만
    @PatchMapping("/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceRequest approve(@PathVariable Long requestId, Authentication authentication) {
        return approvalService.approve(currentMemberId(authentication), requestId);
    }

    // 반려 - ADMIN만, 사유 필수
    @PatchMapping("/{requestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceRequest reject(@PathVariable Long requestId,
                                  @RequestBody @Valid ResourceRequestRejectRequest request,
                                  Authentication authentication) {
        return approvalService.reject(currentMemberId(authentication), requestId, request);
    }

    // 취소 - 요청자 본인(STAFF)과 ADMIN. 세부 규칙(승인 전은 본인만 등)은 서비스에서 다시 확인한다
    @PatchMapping("/{requestId}/cancel")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResourceRequest cancel(@PathVariable Long requestId, Authentication authentication) {
        return approvalService.cancel(currentMemberId(authentication), requestId);
    }
}
