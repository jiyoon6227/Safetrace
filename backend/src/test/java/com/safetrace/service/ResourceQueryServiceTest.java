package com.safetrace.service;

import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.mapper.DepartmentMapper;
import com.safetrace.mapper.ResourceMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
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
}
