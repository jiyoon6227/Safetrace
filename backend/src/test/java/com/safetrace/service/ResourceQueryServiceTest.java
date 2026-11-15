package com.safetrace.service;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ResourceQueryServiceTest {

    private ResourceMapper resourceMapper;
    private ResourceQueryService service;

    @BeforeEach
    void setUp() {
        resourceMapper = mock(ResourceMapper.class);
        service = new ResourceQueryService(mock(DepartmentMapper.class), resourceMapper);
    }

    @Test
    void 올바르지_않은_분류로_재고를_조회하면_거절한다() {
        assertThrows(IllegalArgumentException.class,
                () -> service.getStocks(null, null, "WEAPON", false, true));
        verify(resourceMapper, never()).findStocks(any(), any(), any(), anyBoolean());
    }

    @Test
    void STAFF가_사용중지_포함을_요청해도_무시한다() {
        service.getStocks(1L, null, null, true, false);

        verify(resourceMapper).findStocks(1L, null, null, false);
    }

    @Test
    void ADMIN은_사용중지_포함을_요청하면_포함한다() {
        service.getStocks(null, null, "RESCUE", true, true);

        verify(resourceMapper).findStocks(null, null, "RESCUE", true);
    }

    @Test
    void ADMIN이어도_사용중지_포함을_요청하지_않으면_포함하지_않는다() {
        service.getStocks(null, null, null, false, true);

        verify(resourceMapper).findStocks(null, null, null, false);
    }

    @Test
    void 없는_재고의_이력을_조회하면_거절한다() {
        when(resourceMapper.findStockById(99L)).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.getStockLogs(99L, null));
        verify(resourceMapper, never()).findStockLogs(anyLong(), anyInt());
    }

    @Test
    void 이력_조회_건수는_범위를_벗어나면_보정한다() {
        when(resourceMapper.findStockById(1L)).thenReturn(new ResourceStock());
        when(resourceMapper.findStockLogs(anyLong(), anyInt())).thenReturn(List.of(new ResourceStockLog()));

        service.getStockLogs(1L, null);       // 지정 없음 → 기본 50
        service.getStockLogs(1L, 0);          // 0 이하 → 1
        service.getStockLogs(1L, 100000);     // 너무 큼 → 200

        verify(resourceMapper).findStockLogs(1L, 50);
        verify(resourceMapper).findStockLogs(1L, 1);
        verify(resourceMapper).findStockLogs(1L, 200);
        assertEquals(50, ResourceQueryService.DEFAULT_LOG_LIMIT);
    }

    // ---------- ADMIN 재고 관리 조회 ----------

    @Test
    void ADMIN_재고_목록은_조건을_다듬어_조회하고_행_범위로_자른다() {
        when(resourceMapper.countAdminStocks("EMPTY", "양수\\_기", 1L, "RESCUE")).thenReturn(45L);
        when(resourceMapper.findAdminStocks("EMPTY", "양수\\_기", 1L, "RESCUE", 20, 40))
                .thenReturn(List.of(adminView(10, 4, 2, 4)));

        // 상태는 대소문자 무시, 검색어는 앞뒤 공백 제거 + LIKE 특수문자 이스케이프, 2페이지 20건 = 21~40번째 행
        ResourceStockPageResponse page = service.getAdminStocks(" empty ", " 양수_기 ", 1L, "RESCUE", 2, 20);

        assertEquals(45L, page.total());
        assertEquals(2, page.page());
        assertEquals(20, page.size());
        assertEquals(1, page.items().size());
    }

    @Test
    void ADMIN_재고_목록은_상태가_없거나_ALL이면_상태_조건을_걸지_않는다() {
        service.getAdminStocks(null, null, null, null, null, null);
        service.getAdminStocks("all", "  ", null, "", 1, 10);

        verify(resourceMapper, org.mockito.Mockito.times(2)).countAdminStocks(null, null, null, null);
    }

    @Test
    void ADMIN_재고_목록은_올바르지_않은_상태나_분류를_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> service.getAdminStocks("DELETED", null, null, null, 1, 10));
        assertThrows(IllegalArgumentException.class, () -> service.getAdminStocks(null, null, null, "WEAPON", 1, 10));
        assertThrows(IllegalArgumentException.class, () -> service.getAdminStockSummary(null, null, "WEAPON"));
        verify(resourceMapper, never()).countAdminStocks(any(), any(), any(), any());
        verify(resourceMapper, never()).countAdminStocksByStatus(any(), any(), any());
    }

    @Test
    void ADMIN_재고_목록의_쪽_번호와_크기는_범위를_벗어나면_보정한다() {
        when(resourceMapper.countAdminStocks(any(), any(), any(), any())).thenReturn(1L);

        ResourceStockPageResponse page = service.getAdminStocks(null, null, null, null, 0, 100000);

        assertEquals(1, page.page());
        assertEquals(ResourceQueryService.MAX_PAGE_SIZE, page.size());
        verify(resourceMapper).findAdminStocks(null, null, null, null, 0, ResourceQueryService.MAX_PAGE_SIZE);
    }

    @Test
    void 조건에_맞는_재고가_없으면_목록_쿼리를_보내지_않는다() {
        when(resourceMapper.countAdminStocks(any(), any(), any(), any())).thenReturn(0L);

        ResourceStockPageResponse page = service.getAdminStocks(null, null, null, null, 1, 10);

        assertEquals(0L, page.total());
        assertTrue(page.items().isEmpty());
        verify(resourceMapper, never()).findAdminStocks(any(), any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void 총보유량_빼기_가용이_예약_더하기_출고_중과_같을_때만_일치로_표시한다() {
        when(resourceMapper.countAdminStocks(any(), any(), any(), any())).thenReturn(3L);
        when(resourceMapper.findAdminStocks(any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(List.of(adminView(10, 4, 2, 4), adminView(10, 4, 2, 3), adminView(5, 5, 0, 0)));

        List<ResourceStockAdminView> items = service.getAdminStocks(null, null, null, null, 1, 10).items();

        assertTrue(items.get(0).getQtyConsistent());    // 10 - 4 = 2 + 4
        assertFalse(items.get(1).getQtyConsistent());   // 10 - 4 = 6, 2 + 3 = 5 → 점검 필요
        assertTrue(items.get(2).getQtyConsistent());    // 가용 = 총보유량, 예약·출고 중 없음
    }

    @Test
    void 재고_현황_건수는_빠진_상태를_0으로_채우고_합계는_사용중_더하기_사용중지다() {
        ResourceStatusCount active = count("ACTIVE", 3);
        ResourceStatusCount inactive = count("INACTIVE", 1);
        ResourceStatusCount unknown = count("OTHER", 9);
        when(resourceMapper.countAdminStocksByStatus("양수", 2L, "RESCUE")).thenReturn(List.of(active, inactive, unknown));

        ResourceRequestSummaryResponse summary = service.getAdminStockSummary("양수", 2L, "RESCUE");

        assertEquals(4L, summary.total());               // EMPTY(사용 중의 일부)와 모르는 상태는 합계에 넣지 않는다
        assertEquals(3L, summary.counts().get("ACTIVE"));
        assertEquals(1L, summary.counts().get("INACTIVE"));
        assertEquals(0L, summary.counts().get("EMPTY"));
        assertEquals(List.of("ACTIVE", "INACTIVE", "EMPTY"), List.copyOf(summary.counts().keySet()));
    }

    @Test
    void ADMIN_재고_한_건은_없으면_거절하고_있으면_일치_여부를_담아_돌려준다() {
        when(resourceMapper.findAdminStockById(99L)).thenReturn(null);
        when(resourceMapper.findAdminStockById(1L)).thenReturn(adminView(10, 6, 2, 2));

        assertThrows(IllegalArgumentException.class, () -> service.getAdminStock(99L));
        assertTrue(service.getAdminStock(1L).getQtyConsistent());
    }

    @Test
    void STAFF_재고_조회_응답에는_예약_출고_중_수량이_섞이지_않는다() {
        // STAFF가 쓰는 ResourceStock의 응답 계약은 그대로다. 새 수량은 ADMIN 전용 ResourceStockAdminView에만 있다
        java.util.Set<String> staffFields = java.util.Arrays.stream(ResourceStock.class.getDeclaredFields())
                .map(java.lang.reflect.Field::getName).collect(java.util.stream.Collectors.toSet());
        assertFalse(staffFields.contains("reservedQty"));
        assertFalse(staffFields.contains("dispatchedQty"));
        assertFalse(staffFields.contains("qtyConsistent"));
    }

    @Test
    void 품목_수정_이력은_없는_품목이면_거절하고_건수를_보정한다() {
        when(resourceMapper.findItemById(99L)).thenReturn(null);
        when(resourceMapper.findItemById(1L)).thenReturn(new ResourceItem());
        when(resourceMapper.findItemLogs(anyLong(), anyInt())).thenReturn(List.of(new ResourceItemLog()));

        assertThrows(IllegalArgumentException.class, () -> service.getItemLogs(99L, null));
        verify(resourceMapper, never()).findItemLogs(eq(99L), anyInt());

        service.getItemLogs(1L, null);
        service.getItemLogs(1L, 100000);
        verify(resourceMapper).findItemLogs(1L, 50);
        verify(resourceMapper).findItemLogs(1L, 200);
    }

    private ResourceStockAdminView adminView(int total, int available, int reserved, int dispatched) {
        ResourceStockAdminView view = new ResourceStockAdminView();
        view.setTotalQty(total);
        view.setAvailableQty(available);
        view.setReservedQty(reserved);
        view.setDispatchedQty(dispatched);
        return view;
    }

    private ResourceStatusCount count(String status, long value) {
        ResourceStatusCount row = new ResourceStatusCount();
        row.setStatus(status);
        row.setRequestCount(value);
        return row;
    }
}
