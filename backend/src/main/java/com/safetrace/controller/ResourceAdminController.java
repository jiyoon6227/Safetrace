package com.safetrace.controller;

import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.dto.ResourceItemCreateRequest;
import com.safetrace.dto.ResourceStockAdjustRequest;
import com.safetrace.dto.ResourceStockCreateRequest;
import com.safetrace.dto.ResourceStockReasonRequest;
import com.safetrace.dto.ResourceStockReceiveRequest;
import com.safetrace.service.ResourceAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// ADMIN 재고 관리 API. 모든 메서드가 ADMIN 전용이고, 처리자 ID는 로그인 정보에서만 가져온다 (body로 받지 않는다).
// 재고 변경 이력 조회는 기존 GET /api/resources/stocks/{stockId}/logs(ResourceController)를 쓴다.
@RestController
@RequestMapping("/api/resources/admin")
@RequiredArgsConstructor
public class ResourceAdminController {

    private final ResourceAdminService adminService;

    // JwtAuthenticationFilter가 principal에 넣은 memberId
    private Long currentMemberId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    // 품목 등록
    @PostMapping("/items")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceItem registerItem(@RequestBody @Valid ResourceItemCreateRequest request,
                                     Authentication authentication) {
        return adminService.registerItem(currentMemberId(authentication), request);
    }

    // 부서별 최초 재고 등록
    @PostMapping("/stocks")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceStock registerStock(@RequestBody @Valid ResourceStockCreateRequest request,
                                       Authentication authentication) {
        return adminService.registerStock(currentMemberId(authentication), request);
    }

    // 추가 입고
    @PostMapping("/stocks/{stockId}/receive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceStock receive(@PathVariable Long stockId,
                                 @RequestBody @Valid ResourceStockReceiveRequest request,
                                 Authentication authentication) {
        return adminService.receive(currentMemberId(authentication), stockId, request);
    }

    // 수량 조정 (사유 필수)
    @PostMapping("/stocks/{stockId}/adjust")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceStock adjust(@PathVariable Long stockId,
                                @RequestBody @Valid ResourceStockAdjustRequest request,
                                Authentication authentication) {
        return adminService.adjust(currentMemberId(authentication), stockId, request);
    }

    // 사용 중지 (사유 필수)
    @PatchMapping("/stocks/{stockId}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceStock deactivate(@PathVariable Long stockId,
                                    @RequestBody @Valid ResourceStockReasonRequest request,
                                    Authentication authentication) {
        return adminService.deactivate(currentMemberId(authentication), stockId, request);
    }

    // 사용 재개 (사유 필수)
    @PatchMapping("/stocks/{stockId}/reactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceStock reactivate(@PathVariable Long stockId,
                                    @RequestBody @Valid ResourceStockReasonRequest request,
                                    Authentication authentication) {
        return adminService.reactivate(currentMemberId(authentication), stockId, request);
    }
}
