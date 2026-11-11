package com.safetrace.controller;

import com.safetrace.dto.ClosurePreviewResponse;
import com.safetrace.service.ResourceClosureService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 사건 종료 전 확인 목록. 종료 자체는 기존 PATCH /api/incidents/{id}/status (IncidentController)가 처리한다.
@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class ResourceClosureController {

    private final ResourceClosureService closureService;

    // 종료 전 확인 목록 - 그 사건의 담당 STAFF만. 서비스에서 담당자 본인인지 다시 확인한다
    @GetMapping("/{incidentId}/closure-preview")
    @PreAuthorize("hasRole('STAFF')")
    public ClosurePreviewResponse getClosurePreview(@PathVariable Long incidentId, Authentication authentication) {
        // JwtAuthenticationFilter가 principal에 넣은 memberId
        return closureService.getClosurePreview((Long) authentication.getPrincipal(), incidentId);
    }
}
