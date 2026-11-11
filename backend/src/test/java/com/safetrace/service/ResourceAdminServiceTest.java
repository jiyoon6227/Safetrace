package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceItemCreateRequest;
import com.safetrace.dto.ResourceStockAdjustRequest;
import com.safetrace.dto.ResourceStockCreateRequest;
import com.safetrace.dto.ResourceStockReasonRequest;
import com.safetrace.dto.ResourceStockReceiveRequest;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 업무 규칙만 확인한다. 실제 잠금·SQL·롤백은 Oracle 테스트 스키마가 준비된 뒤 통합 테스트로 확인한다.
class ResourceAdminServiceTest {

    private static final long ADMIN_ID = 9L;
    private static final long STOCK_ID = 200L;

    private ResourceAdminMapper adminMapper;
    private ResourceMapper resourceMapper;
    private MemberMapper memberMapper;
    private ResourceAdminService service;

    @BeforeEach
    void setUp() {
        adminMapper = mock(ResourceAdminMapper.class);
        resourceMapper = mock(ResourceMapper.class);
        memberMapper = mock(MemberMapper.class);
        service = new ResourceAdminService(adminMapper, resourceMapper, memberMapper);

        when(memberMapper.findById(ADMIN_ID)).thenReturn(member(ADMIN_ID, "ADMIN", "N"));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "ACTIVE"));
        when(adminMapper.receiveStock(anyLong(), anyInt())).thenReturn(1);
        when(adminMapper.adjustStock(anyLong(), anyInt())).thenReturn(1);
        when(adminMapper.changeStockStatus(anyLong(), anyString(), anyString())).thenReturn(1);
        when(resourceMapper.findStockById(STOCK_ID)).thenReturn(stock(10, 10, "ACTIVE"));
    }

    // ---------- 권한 ----------

    @Test
    void ADMIN이_아니면_모든_재고_관리_기능이_403이고_DB를_건드리지_않는다() {
        for (String role : List.of("STAFF", "USER")) {
            when(memberMapper.findById(5L)).thenReturn(member(5L, role, "N"));

            assertThrows(AccessDeniedException.class, () -> service.registerItem(5L, itemRequest()));
            assertThrows(AccessDeniedException.class, () -> service.registerStock(5L, stockRequest(1, null)));
            assertThrows(AccessDeniedException.class, () -> service.receive(5L, STOCK_ID, new ResourceStockReceiveRequest(1, null)));
            assertThrows(AccessDeniedException.class, () -> service.adjust(5L, STOCK_ID, new ResourceStockAdjustRequest(1, "사유")));
            assertThrows(AccessDeniedException.class, () -> service.deactivate(5L, STOCK_ID, new ResourceStockReasonRequest("사유")));
            assertThrows(AccessDeniedException.class, () -> service.reactivate(5L, STOCK_ID, new ResourceStockReasonRequest("사유")));
        }
        verify(adminMapper, never()).insertItem(any());
        verify(adminMapper, never()).insertStock(any());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 처리자_정보가_없거나_존재하지_않거나_탈퇴했으면_400이다() {
        when(memberMapper.findById(6L)).thenReturn(member(6L, "ADMIN", "Y"));

        assertThrows(IllegalArgumentException.class, () -> service.receive(null, STOCK_ID, new ResourceStockReceiveRequest(1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(999L, STOCK_ID, new ResourceStockReceiveRequest(1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(6L, STOCK_ID, new ResourceStockReceiveRequest(1, null)));
        verify(adminMapper, never()).lockStock(anyLong());
    }

    // ---------- 품목 등록 ----------

    @Test
    void 품목을_등록하면_앞뒤_공백을_자르고_저장한_품목을_돌려준다() {
        ResourceItem saved = new ResourceItem();
        doAnswer(invocation -> {
            ((ResourceItem) invocation.getArgument(0)).setItemId(77L);
            return 1;
        }).when(adminMapper).insertItem(any(ResourceItem.class));
        when(adminMapper.findItemById(77L)).thenReturn(saved);

        ResourceItem result = service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("  양수기 ", "DRAINAGE", " 대 ", "Y", "   "));

        assertSame(saved, result);
        ArgumentCaptor<ResourceItem> captor = ArgumentCaptor.forClass(ResourceItem.class);
        verify(adminMapper).insertItem(captor.capture());
        assertEquals("양수기", captor.getValue().getName());
        assertEquals("대", captor.getValue().getUnit());
        assertEquals("DRAINAGE", captor.getValue().getCategory());
        assertEquals("Y", captor.getValue().getReturnable());
        assertNull(captor.getValue().getDescription());
    }

    @Test
    void 품목_입력이_잘못되면_400이고_저장하지_않는다() {
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("  ", "DRAINAGE", "대", "Y", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("가".repeat(51), "DRAINAGE", "대", "Y", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", "UNKNOWN", "대", "Y", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", null, "대", "Y", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", "DRAINAGE", " ", "Y", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", "DRAINAGE", "가".repeat(11), "Y", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", "DRAINAGE", "대", "X", null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", "DRAINAGE", "대", null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerItem(ADMIN_ID,
                new ResourceItemCreateRequest("양수기", "DRAINAGE", "대", "Y", "가".repeat(201))));
        verify(adminMapper, never()).insertItem(any());
    }

    @Test
    void 같은_이름의_품목은_409다() {
        doThrow(new DuplicateKeyException("UK_SF_RES_ITEM_NAME")).when(adminMapper).insertItem(any(ResourceItem.class));

        assertThrows(IllegalStateException.class, () -> service.registerItem(ADMIN_ID, itemRequest()));
        verify(adminMapper, never()).findItemById(anyLong());
    }

    // ---------- 최초 재고 등록 ----------

    @Test
    void 최초_재고를_등록하면_총보유량과_가용이_같고_REGISTER_이력이_같은_흐름에서_남는다() {
        when(adminMapper.countDepartment(1L)).thenReturn(1);
        when(adminMapper.findItemById(2L)).thenReturn(new ResourceItem());
        doAnswer(invocation -> {
            ((ResourceStock) invocation.getArgument(0)).setStockId(300L);
            return 1;
        }).when(adminMapper).insertStock(any(ResourceStock.class));
        ResourceStock saved = new ResourceStock();
        when(resourceMapper.findStockById(300L)).thenReturn(saved);

        ResourceStock result = service.registerStock(ADMIN_ID, stockRequest(8, "  최초 보유분 "));

        assertSame(saved, result);
        ArgumentCaptor<ResourceStock> stockCaptor = ArgumentCaptor.forClass(ResourceStock.class);
        ArgumentCaptor<ResourceStockLog> logCaptor = ArgumentCaptor.forClass(ResourceStockLog.class);
        InOrder order = inOrder(adminMapper);
        order.verify(adminMapper).insertStock(stockCaptor.capture());
        order.verify(adminMapper).insertStockLog(logCaptor.capture());
        assertEquals(8, stockCaptor.getValue().getTotalQty());
        assertEquals(8, stockCaptor.getValue().getAvailableQty());
        ResourceStockLog log = logCaptor.getValue();
        assertEquals(300L, log.getStockId());
        assertEquals("REGISTER", log.getAction());
        assertEquals(0, log.getTotalBefore());
        assertEquals(8, log.getTotalAfter());
        assertEquals(0, log.getAvailableBefore());
        assertEquals(8, log.getAvailableAfter());
        assertEquals("최초 보유분", log.getReason());
        assertEquals(ADMIN_ID, log.getChangedBy());
        assertNull(log.getRequestId());
    }

    @Test
    void 최초_재고_입력이_잘못되거나_부서_품목이_없으면_400이다() {
        when(adminMapper.countDepartment(1L)).thenReturn(1);
        when(adminMapper.findItemById(2L)).thenReturn(new ResourceItem());

        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                new ResourceStockCreateRequest(null, 2L, 1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                new ResourceStockCreateRequest(1L, null, 1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID, stockRequest(0, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID, stockRequest(-3, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                new ResourceStockCreateRequest(1L, 2L, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                stockRequest(ResourceAdminService.MAX_QUANTITY + 1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                stockRequest(1, "가".repeat(501))));
        // 존재하지 않는 부서 / 품목
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                new ResourceStockCreateRequest(99L, 2L, 1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.registerStock(ADMIN_ID,
                new ResourceStockCreateRequest(1L, 99L, 1, null)));
        verify(adminMapper, never()).insertStock(any());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 같은_부서_품목_재고가_이미_있으면_409이고_이력을_남기지_않는다() {
        when(adminMapper.countDepartment(1L)).thenReturn(1);
        when(adminMapper.findItemById(2L)).thenReturn(new ResourceItem());
        doThrow(new DuplicateKeyException("UK_SF_RES_STOCK_DEPT_ITEM")).when(adminMapper).insertStock(any(ResourceStock.class));

        assertThrows(IllegalStateException.class, () -> service.registerStock(ADMIN_ID, stockRequest(5, null)));
        verify(adminMapper, never()).insertStockLog(any());
    }

    // ---------- 입고 ----------

    @Test
    void 입고는_재고를_잠근_뒤_갱신하고_전후_수량_이력을_남긴다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 6, "ACTIVE"));

        service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(5, " 추가 구매 "));

        InOrder order = inOrder(adminMapper, resourceMapper);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(adminMapper).receiveStock(STOCK_ID, 5);
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(adminMapper).insertStockLog(captor.capture());
        order.verify(resourceMapper).findStockById(STOCK_ID);
        ResourceStockLog log = captor.getValue();
        assertEquals("RECEIVE", log.getAction());
        assertEquals(10, log.getTotalBefore());
        assertEquals(15, log.getTotalAfter());
        assertEquals(6, log.getAvailableBefore());
        assertEquals(11, log.getAvailableAfter());
        assertEquals("추가 구매", log.getReason());
        assertEquals(ADMIN_ID, log.getChangedBy());
    }

    @Test
    void 사용_중지된_재고에는_입고할_수_없다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "INACTIVE"));

        assertThrows(IllegalStateException.class,
                () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(5, null)));
        verify(adminMapper, never()).receiveStock(anyLong(), anyInt());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 입고_수량이_잘못되거나_재고가_없으면_400이고_잠그기_전에_걸러낸다() {
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, STOCK_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(0, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(-1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, STOCK_ID,
                new ResourceStockReceiveRequest(ResourceAdminService.MAX_QUANTITY + 1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, STOCK_ID,
                new ResourceStockReceiveRequest(1, "가".repeat(501))));
        verify(adminMapper, never()).lockStock(anyLong());

        // 재고가 없음 (잠금 조회가 null)
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, 404L, new ResourceStockReceiveRequest(1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.receive(ADMIN_ID, null, new ResourceStockReceiveRequest(1, null)));
        verify(adminMapper, never()).receiveStock(anyLong(), anyInt());
    }

    @Test
    void 입고하면_총보유량이_한도를_넘을_때는_400이고_갱신하지_않는다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(ResourceAdminService.MAX_QUANTITY, ResourceAdminService.MAX_QUANTITY, "ACTIVE"));

        assertThrows(IllegalArgumentException.class,
                () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(1, null)));
        verify(adminMapper, never()).receiveStock(anyLong(), anyInt());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 입고_UPDATE가_반영되지_않으면_409이고_이력을_남기지_않는다() {
        when(adminMapper.receiveStock(STOCK_ID, 5)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(5, null)));
        verify(adminMapper, never()).insertStockLog(any());
    }

    // ---------- 조정 ----------

    @Test
    void 늘리는_조정은_총보유량과_가용에_같은_값을_더하고_ADJUST_이력을_남긴다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));

        service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(3, " 실사 결과 "));

        InOrder order = inOrder(adminMapper);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(adminMapper).adjustStock(STOCK_ID, 3);
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(adminMapper).insertStockLog(captor.capture());
        ResourceStockLog log = captor.getValue();
        assertEquals("ADJUST", log.getAction());
        assertEquals(10, log.getTotalBefore());
        assertEquals(13, log.getTotalAfter());
        assertEquals(4, log.getAvailableBefore());
        assertEquals(7, log.getAvailableAfter());
        assertEquals("실사 결과", log.getReason());
    }

    @Test
    void 줄이는_조정은_가용_수량_안에서만_된다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));

        // 가용 4까지(= 예약·출고 중 6은 그대로) 줄이는 것은 허용
        service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(-4, "파손 폐기"));
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(adminMapper).insertStockLog(captor.capture());
        assertEquals(6, captor.getValue().getTotalAfter());
        assertEquals(0, captor.getValue().getAvailableAfter());
    }

    @Test
    void 가용보다_많이_줄이면_409이고_갱신하지_않는다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));

        assertThrows(IllegalStateException.class,
                () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(-5, "사유")));
        verify(adminMapper, never()).adjustStock(anyLong(), anyInt());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 사용_중지된_재고도_조정할_수_있다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "INACTIVE"));

        service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(-2, "사유"));

        verify(adminMapper).adjustStock(STOCK_ID, -2);
        verify(adminMapper).insertStockLog(any(ResourceStockLog.class));
    }

    @Test
    void 조정_입력이_잘못되면_400이다() {
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(null, "사유")));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(0, "사유")));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(1, null)));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(1, "   ")));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(1, "가".repeat(501))));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID,
                new ResourceStockAdjustRequest(ResourceAdminService.MAX_QUANTITY + 1, "사유")));
        assertThrows(IllegalArgumentException.class, () -> service.adjust(ADMIN_ID, STOCK_ID,
                new ResourceStockAdjustRequest(Integer.MIN_VALUE, "사유")));
        verify(adminMapper, never()).lockStock(anyLong());
        verify(adminMapper, never()).adjustStock(anyLong(), anyInt());
    }

    @Test
    void 조정으로_총보유량이_한도를_넘으면_400이다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(ResourceAdminService.MAX_QUANTITY, 5, "ACTIVE"));

        assertThrows(IllegalArgumentException.class,
                () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(1, "사유")));
        verify(adminMapper, never()).adjustStock(anyLong(), anyInt());
    }

    @Test
    void 조정_UPDATE가_반영되지_않으면_409이고_이력을_남기지_않는다() {
        when(adminMapper.adjustStock(STOCK_ID, -3)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(-3, "사유")));
        verify(adminMapper, never()).insertStockLog(any());
    }

    // ---------- 사용 중지·재개 ----------

    @Test
    void 사용_중지는_상태만_바꾸고_수량은_같은_채_DEACTIVATE_이력을_남긴다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));

        service.deactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest(" 점검 중 "));

        InOrder order = inOrder(adminMapper);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(adminMapper).changeStockStatus(STOCK_ID, "ACTIVE", "INACTIVE");
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(adminMapper).insertStockLog(captor.capture());
        ResourceStockLog log = captor.getValue();
        assertEquals("DEACTIVATE", log.getAction());
        assertEquals(10, log.getTotalBefore());
        assertEquals(10, log.getTotalAfter());
        assertEquals(4, log.getAvailableBefore());
        assertEquals(4, log.getAvailableAfter());
        assertEquals("점검 중", log.getReason());
    }

    @Test
    void 사용_재개는_REACTIVATE_이력을_남긴다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "INACTIVE"));

        service.reactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("점검 끝"));

        verify(adminMapper).changeStockStatus(STOCK_ID, "INACTIVE", "ACTIVE");
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(adminMapper).insertStockLog(captor.capture());
        assertEquals("REACTIVATE", captor.getValue().getAction());
    }

    @Test
    void 이미_같은_상태면_409이고_아무것도_바꾸지_않는다() {
        // ACTIVE 재고를 다시 재개 / INACTIVE 재고를 다시 중지
        assertThrows(IllegalStateException.class,
                () -> service.reactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("사유")));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "INACTIVE"));
        assertThrows(IllegalStateException.class,
                () -> service.deactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("사유")));

        verify(adminMapper, never()).changeStockStatus(anyLong(), anyString(), anyString());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 사용_중지와_재개는_사유가_없으면_400이다() {
        assertThrows(IllegalArgumentException.class, () -> service.deactivate(ADMIN_ID, STOCK_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.deactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest(null)));
        assertThrows(IllegalArgumentException.class, () -> service.deactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("  ")));
        assertThrows(IllegalArgumentException.class, () -> service.reactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("")));
        assertThrows(IllegalArgumentException.class, () -> service.reactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("가".repeat(501))));
        assertThrows(IllegalArgumentException.class, () -> service.deactivate(ADMIN_ID, 404L, new ResourceStockReasonRequest("사유")));
        verify(adminMapper, never()).changeStockStatus(anyLong(), anyString(), anyString());
        verify(adminMapper, never()).insertStockLog(any());
    }

    @Test
    void 상태_UPDATE가_반영되지_않으면_409이고_이력을_남기지_않는다() {
        when(adminMapper.changeStockStatus(STOCK_ID, "ACTIVE", "INACTIVE")).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.deactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("사유")));
        verify(adminMapper, never()).insertStockLog(any());
    }

    // ---------- 재고 변경과 이력은 한 트랜잭션 ----------

    @Test
    void 이력_저장이_실패하면_예외가_그대로_올라가고_결과를_돌려주지_않는다() {
        // 예외가 서비스 밖으로 나가야 @Transactional이 재고 변경까지 롤백한다 (삼키면 안 된다)
        doThrow(new RuntimeException("이력 INSERT 실패")).when(adminMapper).insertStockLog(any(ResourceStockLog.class));

        assertThrows(RuntimeException.class, () -> service.receive(ADMIN_ID, STOCK_ID, new ResourceStockReceiveRequest(1, null)));
        assertThrows(RuntimeException.class, () -> service.adjust(ADMIN_ID, STOCK_ID, new ResourceStockAdjustRequest(1, "사유")));
        assertThrows(RuntimeException.class, () -> service.deactivate(ADMIN_ID, STOCK_ID, new ResourceStockReasonRequest("사유")));
        verify(resourceMapper, never()).findStockById(anyLong());
    }

    @Test
    void 데이터를_바꾸는_모든_공개_메서드는_트랜잭션으로_묶여_있다() {
        List<String> names = List.of("registerItem", "registerStock", "receive", "adjust", "deactivate", "reactivate");
        long found = java.util.Arrays.stream(ResourceAdminService.class.getDeclaredMethods())
                .filter(method -> names.contains(method.getName()))
                .peek(method -> assertTrue(isTransactional(method), method.getName() + "에 @Transactional이 없습니다."))
                .count();
        assertEquals(names.size(), found);
    }

    private boolean isTransactional(Method method) {
        Transactional annotation = method.getAnnotation(Transactional.class);
        return annotation != null && !annotation.readOnly();
    }

    // ---------- 도우미 ----------

    private Member member(long id, String role, String withdrawn) {
        Member member = new Member();
        member.setMemberId(id);
        member.setRole(role);
        member.setIsWithdrawn(withdrawn);
        return member;
    }

    private ResourceStock stock(int totalQty, int availableQty, String status) {
        ResourceStock stock = new ResourceStock();
        stock.setStockId(STOCK_ID);
        stock.setTotalQty(totalQty);
        stock.setAvailableQty(availableQty);
        stock.setStatus(status);
        return stock;
    }

    private ResourceItemCreateRequest itemRequest() {
        return new ResourceItemCreateRequest("양수기", "DRAINAGE", "대", "Y", "설명");
    }

    private ResourceStockCreateRequest stockRequest(int quantity, String memo) {
        return new ResourceStockCreateRequest(1L, 2L, quantity, memo);
    }
}
