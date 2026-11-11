package com.safetrace.controller;

import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
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

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
