package com.safetrace.controller;

import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceReturn;
import com.safetrace.dto.ResourceLossRequest;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.dto.ResourceReturnApplyRequest;
import com.safetrace.dto.ResourceReturnPageResponse;
import com.safetrace.service.ResourceFulfillmentService;
import com.safetrace.service.ResourceReturnQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// 출고·도착 확인·반납 신청·반납 확인·손실 확정. 처리자 ID는 로그인 정보에서만 가져온다 (body로 받지 않는다).
// 요청 생성·조회는 ResourceRequestController, 승인·반려·취소는 ResourceApprovalController가 맡는다 (경로가 겹치지 않는다).
@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceFulfillmentController {

    private final ResourceFulfillmentService fulfillmentService;
    private final ResourceReturnQueryService returnQueryService;

    // JwtAuthenticationFilter가 principal에 넣은 memberId
    private Long currentMemberId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    // 출고 (반납형은 DISPATCHED, 소모품은 COMPLETED + 총보유량 차감) - ADMIN만
    @PatchMapping("/requests/{requestId}/dispatch")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceRequest dispatch(@PathVariable Long requestId, Authentication authentication) {
        return fulfillmentService.dispatch(currentMemberId(authentication), requestId);
    }

    // 도착 확인 - 요청자 본인과 ADMIN. 세부 규칙(본인 요청인지 등)은 서비스에서 다시 확인한다
    @PatchMapping("/requests/{requestId}/arrive")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResourceRequest arrive(@PathVariable Long requestId, Authentication authentication) {
        return fulfillmentService.arrive(currentMemberId(authentication), requestId);
    }

    // 반납 신청 (재고 변화 없음) - 요청자 본인(STAFF)만
    @PostMapping("/requests/{requestId}/return-applications")
    @PreAuthorize("hasRole('STAFF')")
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceReturn applyReturn(@PathVariable Long requestId,
                                      @RequestBody @Valid ResourceReturnApplyRequest request,
                                      Authentication authentication) {
        return fulfillmentService.applyReturn(currentMemberId(authentication), requestId, request);
    }

    // 그 요청의 반납 신청 목록 - 요청자 본인과 ADMIN
    @GetMapping("/requests/{requestId}/return-applications")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<ResourceReturn> getReturnApplications(@PathVariable Long requestId, Authentication authentication) {
        return returnQueryService.getReturnApplications(currentMemberId(authentication), requestId);
    }

    // 반납 확인함 - ADMIN만. 예: /api/resources/admin/return-applications?status=PENDING&page=1&size=10
    @GetMapping("/admin/return-applications")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceReturnPageResponse getReturnInbox(@RequestParam(required = false) String status,
                                                     @RequestParam(required = false) Integer page,
                                                     @RequestParam(required = false) Integer size,
                                                     Authentication authentication) {
        return returnQueryService.getReturnInbox(currentMemberId(authentication), status, page, size);
    }

    // 반납 확인 (가용 수량 반영) - ADMIN만, 바디 없음
    @PatchMapping("/admin/return-applications/{returnId}/confirm")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceReturn confirmReturn(@PathVariable Long returnId, Authentication authentication) {
        return fulfillmentService.confirmReturn(currentMemberId(authentication), returnId);
    }

    // 반납 신청 반려 (재고 변화 없음) - ADMIN만, 사유 필수
    @PatchMapping("/admin/return-applications/{returnId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceReturn rejectReturn(@PathVariable Long returnId,
                                       @RequestBody @Valid ResourceRequestRejectRequest request,
                                       Authentication authentication) {
        return fulfillmentService.rejectReturn(currentMemberId(authentication), returnId, request);
    }

    // 손실 확정 (총보유량 차감) - ADMIN만
    @PatchMapping("/admin/requests/{requestId}/loss")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceRequest confirmLoss(@PathVariable Long requestId,
                                       @RequestBody @Valid ResourceLossRequest request,
                                       Authentication authentication) {
        return fulfillmentService.confirmLoss(currentMemberId(authentication), requestId, request);
    }
}
