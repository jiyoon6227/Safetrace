package com.safetrace.controller;

import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceItemLog;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockAdminView;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceStockPageResponse;
import com.safetrace.service.ResourceQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceQueryService resourceQueryService;

    // 품목 목록 - 담당 직원, 자원 관리자
    @GetMapping("/items")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<ResourceItem> getItems() {
        return resourceQueryService.getItems();
    }

    // 부서별 재고 목록 - 담당 직원은 다른 부서 재고도 볼 수 있다 (자원을 요청하려면 어느 부서에 얼마 있는지 알아야 함)
    @GetMapping("/stocks")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<ResourceStock> getStocks(@RequestParam(required = false) Long departmentId,
                                         @RequestParam(required = false) Long itemId,
                                         @RequestParam(required = false) String category,
                                         @RequestParam(defaultValue = "false") boolean includeInactive,
                                         Authentication authentication) {
        return resourceQueryService.getStocks(departmentId, itemId, category, includeInactive, isAdmin(authentication));
    }

    // 재고 변경 이력 - 자원 관리자만
    @GetMapping("/stocks/{stockId}/logs")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ResourceStockLog> getStockLogs(@PathVariable Long stockId,
                                               @RequestParam(required = false) Integer limit) {
        return resourceQueryService.getStockLogs(stockId, limit);
    }

    // ---- ADMIN 재고 관리 조회 (STAFF 재고 조회 GET /stocks의 응답은 바꾸지 않고, 예약·출고 중 수량이 들어간 ADMIN 전용 응답을 따로 둔다) ----

    // 재고 목록 - 검색(품목명·부서명), 부서·분류·상태(ALL/ACTIVE/INACTIVE/EMPTY) 필터, 페이징
    // 예: /api/resources/admin/stocks?status=ACTIVE&keyword=양수기&departmentId=1&category=DRAINAGE&page=1&size=20
    @GetMapping("/admin/stocks")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceStockPageResponse getAdminStocks(@RequestParam(required = false) String status,
                                                    @RequestParam(required = false) String keyword,
                                                    @RequestParam(required = false) Long departmentId,
                                                    @RequestParam(required = false) String category,
                                                    @RequestParam(required = false) Integer page,
                                                    @RequestParam(required = false) Integer size) {
        return resourceQueryService.getAdminStocks(status, keyword, departmentId, category, page, size);
    }

    // 현황 카드용 건수 - 목록과 같은 검색어·부서·분류 조건에서 상태만 뺀 ACTIVE·INACTIVE·EMPTY 건수
    @GetMapping("/admin/stocks/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceRequestSummaryResponse getAdminStockSummary(@RequestParam(required = false) String keyword,
                                                               @RequestParam(required = false) Long departmentId,
                                                               @RequestParam(required = false) String category) {
        return resourceQueryService.getAdminStockSummary(keyword, departmentId, category);
    }

    @GetMapping("/admin/stocks/{stockId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResourceStockAdminView getAdminStock(@PathVariable Long stockId) {
        return resourceQueryService.getAdminStock(stockId);
    }

    // 품목 수정 이력 (이름·분류·설명이 바뀐 기록)
    @GetMapping("/admin/items/{itemId}/logs")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ResourceItemLog> getItemLogs(@PathVariable Long itemId,
                                             @RequestParam(required = false) Integer limit) {
        return resourceQueryService.getItemLogs(itemId, limit);
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
