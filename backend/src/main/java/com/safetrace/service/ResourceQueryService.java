package com.safetrace.service;

import com.safetrace.domain.Department;
import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceItemLog;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockAdminView;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceStatusCount;
import com.safetrace.dto.ResourceStockPageResponse;
import com.safetrace.mapper.DepartmentMapper;
import com.safetrace.mapper.ResourceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// 자원 조회 전용 서비스 (데이터를 바꾸지 않는다)
@Service
@RequiredArgsConstructor
public class ResourceQueryService {

    private static final Set<String> CATEGORIES = Set.of("DRAINAGE", "RESCUE", "RELIEF", "VEHICLE");
    static final int DEFAULT_LOG_LIMIT = 50;
    static final int MAX_LOG_LIMIT = 200;
    static final int DEFAULT_PAGE_SIZE = 10;
    static final int MAX_PAGE_SIZE = 50;
    static final int MAX_PAGE = 10000;
    // ADMIN 재고 목록의 상태 조건: ACTIVE(사용 중), INACTIVE(사용 중지), EMPTY(사용 중인데 가용 0). 없거나 ALL이면 전체
    private static final List<String> STOCK_STATUS_ORDER = List.of("ACTIVE", "INACTIVE", "EMPTY");

    private final DepartmentMapper departmentMapper;
    private final ResourceMapper resourceMapper;

    @Transactional(readOnly = true)
    public List<Department> getDepartments() {
        return departmentMapper.findAll();
    }

    @Transactional(readOnly = true)
    public List<ResourceItem> getItems() {
        return resourceMapper.findItems();
    }

    /**
     * 재고 조회. 사용 중지(INACTIVE) 재고는 ADMIN이 includeInactive=true로 요청할 때만 포함한다.
     * STAFF가 includeInactive=true를 보내도 무시한다 (요청 가능한 재고만 보여야 하므로).
     */
    @Transactional(readOnly = true)
    public List<ResourceStock> getStocks(Long departmentId, Long itemId, String category,
                                         boolean includeInactive, boolean admin) {
        if (category != null && !CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("올바르지 않은 자원 분류입니다.");
        }
        boolean withInactive = admin && includeInactive;
        return resourceMapper.findStocks(departmentId, itemId, category, withInactive);
    }

    /** 재고 변경 이력 (ADMIN 전용은 컨트롤러에서 막는다). limit이 없거나 범위를 벗어나면 보정한다. */
    @Transactional(readOnly = true)
    public List<ResourceStockLog> getStockLogs(Long stockId, Integer limit) {
        if (resourceMapper.findStockById(stockId) == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        int safeLimit = limit == null ? DEFAULT_LOG_LIMIT : Math.min(Math.max(limit, 1), MAX_LOG_LIMIT);
        return resourceMapper.findStockLogs(stockId, safeLimit);
    }

    // ---- ADMIN 재고 관리 조회 (컨트롤러가 ADMIN만 통과시킨다). STAFF 재고 조회(getStocks)는 그대로다. ----

    /**
     * ADMIN 재고 목록: 검색어(품목명·부서명)·부서·분류·상태 필터와 페이징, 예약·출고 중 수량 포함.
     * 각 행의 총보유량 − 가용이 예약 + 출고 중과 같은지 확인해 qtyConsistent에 담는다 (다르면 데이터 점검이 필요하다).
     */
    @Transactional(readOnly = true)
    public ResourceStockPageResponse getAdminStocks(String status, String keyword, Long departmentId, String category,
                                                    Integer page, Integer size) {
        String safeStatus = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
            safeStatus = status.trim().toUpperCase();
            if (!STOCK_STATUS_ORDER.contains(safeStatus)) {
                throw new IllegalArgumentException("올바르지 않은 재고 상태입니다.");
            }
        }
        String safeCategory = requireCategory(category);
        int safePage = page == null ? 1 : Math.min(Math.max(page, 1), MAX_PAGE);
        int safeSize = size == null ? DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        String safeKeyword = ResourceRequestService.normalizeKeyword(keyword);

        long total = resourceMapper.countAdminStocks(safeStatus, safeKeyword, departmentId, safeCategory);
        List<ResourceStockAdminView> items = total == 0
                ? List.of()
                : resourceMapper.findAdminStocks(safeStatus, safeKeyword, departmentId, safeCategory,
                        (safePage - 1) * safeSize, safePage * safeSize);
        items.forEach(ResourceQueryService::checkQuantities);
        return new ResourceStockPageResponse(items, total, safePage, safeSize);
    }

    /**
     * ADMIN 재고 현황 카드용: 목록과 같은 검색어·부서·분류 조건에서 상태 조건만 뺀 건수. 0건인 상태도 0으로 채운다.
     * 건수(재고 행 수)만 센다 — 단위가 다른 품목의 수량을 더한 값은 만들지 않는다. total은 ACTIVE + INACTIVE이고 EMPTY는 ACTIVE의 일부다.
     */
    @Transactional(readOnly = true)
    public ResourceRequestSummaryResponse getAdminStockSummary(String keyword, Long departmentId, String category) {
        Map<String, Long> counts = new LinkedHashMap<>();
        STOCK_STATUS_ORDER.forEach(status -> counts.put(status, 0L));
        for (ResourceStatusCount row : resourceMapper.countAdminStocksByStatus(
                ResourceRequestService.normalizeKeyword(keyword), departmentId, requireCategory(category))) {
            counts.computeIfPresent(row.getStatus(), (key, old) -> row.getRequestCount());
        }
        return new ResourceRequestSummaryResponse(counts.get("ACTIVE") + counts.get("INACTIVE"), counts);
    }

    /** ADMIN 재고 한 건 (목록과 같은 모양). 없으면 400. */
    @Transactional(readOnly = true)
    public ResourceStockAdminView getAdminStock(Long stockId) {
        ResourceStockAdminView view = resourceMapper.findAdminStockById(stockId);
        if (view == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        checkQuantities(view);
        return view;
    }

    /** 품목 수정 이력 (ADMIN 전용은 컨트롤러에서 막는다). limit 보정은 재고 이력과 같다. */
    @Transactional(readOnly = true)
    public List<ResourceItemLog> getItemLogs(Long itemId, Integer limit) {
        if (resourceMapper.findItemById(itemId) == null) {
            throw new IllegalArgumentException("존재하지 않는 품목입니다.");
        }
        int safeLimit = limit == null ? DEFAULT_LOG_LIMIT : Math.min(Math.max(limit, 1), MAX_LOG_LIMIT);
        return resourceMapper.findItemLogs(itemId, safeLimit);
    }

    private static String requireCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        if (!CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("올바르지 않은 자원 분류입니다.");
        }
        return category;
    }

    // 총보유량 − 가용 = 예약 + 출고 중 (승인 시 가용에서 빠지고, 반납 확인 시 돌아오며, 손실·소모는 총보유량에서 빠진다)
    private static void checkQuantities(ResourceStockAdminView view) {
        int held = view.getTotalQty() - view.getAvailableQty();
        view.setQtyConsistent(held == view.getReservedQty() + view.getDispatchedQty());
    }
}
