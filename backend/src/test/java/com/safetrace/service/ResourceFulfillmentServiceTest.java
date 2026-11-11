package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceReturn;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceLossRequest;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.dto.ResourceReturnApplyRequest;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceApprovalMapper;
import com.safetrace.mapper.ResourceFulfillmentMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Arrays;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 업무 규칙만 확인한다. 실제 잠금·SQL·롤백·동시 실행은 Oracle 테스트 스키마가 준비된 뒤 통합 테스트로 확인한다.
class ResourceFulfillmentServiceTest {

    private static final long ADMIN_ID = 9L;
    private static final long OWNER_ID = 5L;     // 요청자(STAFF)
    private static final long OTHER_ID = 6L;     // 다른 STAFF
    private static final long USER_ID = 7L;      // 시민
    private static final long REQUEST_ID = 100L;
    private static final long STOCK_ID = 200L;
    private static final long INCIDENT_ID = 50L;
    private static final long RETURN_ID = 300L;

    private ResourceFulfillmentMapper fulfillmentMapper;
    private ResourceApprovalMapper approvalMapper;
    private ResourceAdminMapper adminMapper;
    private ResourceRequestMapper requestMapper;
    private MemberMapper memberMapper;
    private ResourceFulfillmentService service;

    @BeforeEach
    void setUp() {
        fulfillmentMapper = mock(ResourceFulfillmentMapper.class);
        approvalMapper = mock(ResourceApprovalMapper.class);
        adminMapper = mock(ResourceAdminMapper.class);
        requestMapper = mock(ResourceRequestMapper.class);
        memberMapper = mock(MemberMapper.class);
        service = new ResourceFulfillmentService(fulfillmentMapper, approvalMapper, adminMapper, requestMapper, memberMapper);

        when(memberMapper.findById(ADMIN_ID)).thenReturn(member(ADMIN_ID, "ADMIN", "N"));
        when(memberMapper.findById(OWNER_ID)).thenReturn(member(OWNER_ID, "STAFF", "N"));
        when(memberMapper.findById(OTHER_ID)).thenReturn(member(OTHER_ID, "STAFF", "N"));
        when(memberMapper.findById(USER_ID)).thenReturn(member(USER_ID, "USER", "N"));
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3, 0, 0, null));
        when(approvalMapper.findIncidentStatus(INCIDENT_ID)).thenReturn("RESPONDING");
        when(approvalMapper.updateRequestStatus(anyLong(), anyString(), anyString(), any())).thenReturn(1);
        when(approvalMapper.releaseStock(anyLong(), anyInt())).thenReturn(1);
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));
        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn("Y");
        when(fulfillmentMapper.reduceTotal(anyLong(), anyInt())).thenReturn(1);
        when(fulfillmentMapper.markArrived(anyLong())).thenReturn(1);
        when(fulfillmentMapper.updateReturnStatus(anyLong(), anyString(), anyString(), anyLong(), any())).thenReturn(1);
        when(fulfillmentMapper.applyReturnToRequest(anyLong(), anyInt())).thenReturn(1);
        when(fulfillmentMapper.applyLossToRequest(anyLong(), anyInt(), anyInt())).thenReturn(1);
        when(requestMapper.findById(REQUEST_ID)).thenReturn(request("DISPATCHED", 3, 0, 0, null));
        when(fulfillmentMapper.findReturnById(RETURN_ID)).thenReturn(application(3, "PENDING"));
    }

    // ================= 출고 =================

    @Test
    void 반납형_출고는_요청_상태만_바꾸고_재고는_건드리지_않는다() {
        ResourceRequest result = service.dispatch(ADMIN_ID, REQUEST_ID);

        assertSame(requestMapper.findById(REQUEST_ID), result);
        InOrder order = inOrder(approvalMapper, fulfillmentMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(approvalMapper).findIncidentStatus(INCIDENT_ID);
        order.verify(fulfillmentMapper).findReturnable(STOCK_ID);
        order.verify(approvalMapper).updateRequestStatus(REQUEST_ID, "APPROVED", "DISPATCHED", null);
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(captor.capture());

        ResourceLog log = captor.getValue();
        assertEquals("APPROVED", log.getPrevStatus());
        assertEquals("DISPATCHED", log.getNewStatus());
        assertEquals("DISPATCH", log.getAction());
        assertEquals(ADMIN_ID, log.getChangedBy());
        // 승인 때 이미 가용이 빠졌으므로 재고 숫자·재고 이력은 그대로
        verify(adminMapper, never()).lockStock(anyLong());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 소모품_출고는_총보유량만_줄이고_COMPLETED가_된다() {
        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn("N");

        service.dispatch(ADMIN_ID, REQUEST_ID);

        // 잠금 순서: 요청 → 재고
        InOrder order = inOrder(approvalMapper, adminMapper, fulfillmentMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(fulfillmentMapper).reduceTotal(STOCK_ID, 3);
        order.verify(approvalMapper).updateRequestStatus(REQUEST_ID, "APPROVED", "COMPLETED", null);
        ArgumentCaptor<ResourceLog> requestLog = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(requestLog.capture());
        ArgumentCaptor<ResourceStockLog> stockLog = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(approvalMapper).insertStockLog(stockLog.capture());

        assertEquals("DISPATCH", requestLog.getValue().getAction());
        assertEquals("COMPLETED", requestLog.getValue().getNewStatus());
        ResourceStockLog sl = stockLog.getValue();
        assertEquals("CONSUME", sl.getAction());
        assertEquals(10, sl.getTotalBefore());
        assertEquals(7, sl.getTotalAfter());          // 총보유량만 요청 수량만큼 감소
        assertEquals(4, sl.getAvailableBefore());
        assertEquals(4, sl.getAvailableAfter());      // 가용은 그대로
        assertEquals(REQUEST_ID, sl.getRequestId());
        assertEquals(ADMIN_ID, sl.getChangedBy());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
    }

    @Test
    void 출고는_ADMIN만_할_수_있다() {
        assertThrows(AccessDeniedException.class, () -> service.dispatch(OWNER_ID, REQUEST_ID));
        assertThrows(AccessDeniedException.class, () -> service.dispatch(USER_ID, REQUEST_ID));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 존재하지_않거나_탈퇴한_처리자는_400이다() {
        when(memberMapper.findById(8L)).thenReturn(null);
        when(memberMapper.findById(4L)).thenReturn(member(4L, "ADMIN", "Y"));

        assertThrows(IllegalArgumentException.class, () -> service.dispatch(8L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.dispatch(4L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.dispatch(null, REQUEST_ID));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 승인된_요청이_아니면_출고할_수_없다() {
        for (String status : List.of("REQUESTED", "REJECTED", "CANCELLED", "DISPATCHED", "SETTLED", "COMPLETED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3, 0, 0, null));
            assertThrows(IllegalStateException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID), status);
        }
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 종료된_사건의_요청은_출고할_수_없다() {
        when(approvalMapper.findIncidentStatus(INCIDENT_ID)).thenReturn("CLOSED");

        assertThrows(IllegalStateException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));
        verify(fulfillmentMapper, never()).findReturnable(anyLong());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 같은_소모품_요청을_두_번_출고해도_총보유량은_한_번만_줄어든다() {
        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn("N");
        // 첫 호출은 APPROVED, 요청 행 잠금 뒤 두 번째 호출은 첫 호출이 끝난 상태(COMPLETED)를 본다
        when(approvalMapper.lockRequest(REQUEST_ID))
                .thenReturn(request("APPROVED", 3, 0, 0, null))
                .thenReturn(request("COMPLETED", 3, 0, 0, null));

        service.dispatch(ADMIN_ID, REQUEST_ID);
        assertThrows(IllegalStateException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));

        verify(fulfillmentMapper, times(1)).reduceTotal(STOCK_ID, 3);
        verify(approvalMapper, times(1)).insertStockLog(any());
    }

    @Test
    void 출고_중_조건부_UPDATE가_0행이면_409이고_다음_단계로_가지_않는다() {
        when(approvalMapper.updateRequestStatus(REQUEST_ID, "APPROVED", "DISPATCHED", null)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 소모품_총보유량_차감이_0행이면_409이고_요청_상태도_바꾸지_않는다() {
        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn("N");
        when(fulfillmentMapper.reduceTotal(STOCK_ID, 3)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 요청이나_재고가_없으면_400이다() {
        when(approvalMapper.lockRequest(999L)).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> service.dispatch(ADMIN_ID, 999L));
        assertThrows(IllegalArgumentException.class, () -> service.dispatch(ADMIN_ID, null));

        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));

        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn("N");
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));
    }

    @Test
    void 출고_중_이력_저장이_실패하면_예외가_그대로_올라간다() {
        doThrow(new RuntimeException("요청 이력 INSERT 실패")).when(requestMapper).insertLog(any(ResourceLog.class));
        assertThrows(RuntimeException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));

        when(fulfillmentMapper.findReturnable(STOCK_ID)).thenReturn("N");
        doThrow(new RuntimeException("재고 이력 INSERT 실패")).when(approvalMapper).insertStockLog(any(ResourceStockLog.class));
        assertThrows(RuntimeException.class, () -> service.dispatch(ADMIN_ID, REQUEST_ID));
    }

    // ================= 도착 확인 =================

    @Test
    void 요청자가_출고된_요청의_도착을_확인하면_이력만_남고_상태와_재고는_그대로다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 3, 0, 0, null));

        service.arrive(OWNER_ID, REQUEST_ID);

        InOrder order = inOrder(approvalMapper, fulfillmentMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(fulfillmentMapper).markArrived(REQUEST_ID);
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(captor.capture());
        assertEquals("ARRIVE", captor.getValue().getAction());
        assertEquals("DISPATCHED", captor.getValue().getPrevStatus());
        assertEquals("DISPATCHED", captor.getValue().getNewStatus());   // 상태는 그대로
        assertEquals(OWNER_ID, captor.getValue().getChangedBy());
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void ADMIN도_출고_이후_상태_세_가지에서_도착을_확인할_수_있다() {
        for (String status : List.of("DISPATCHED", "SETTLED", "COMPLETED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3, 0, 0, null));
            service.arrive(ADMIN_ID, REQUEST_ID);
        }
        verify(fulfillmentMapper, times(3)).markArrived(REQUEST_ID);
    }

    @Test
    void 남의_요청이나_시민은_도착을_확인할_수_없다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 3, 0, 0, null));

        assertThrows(AccessDeniedException.class, () -> service.arrive(OTHER_ID, REQUEST_ID));
        assertThrows(AccessDeniedException.class, () -> service.arrive(USER_ID, REQUEST_ID));
        verify(fulfillmentMapper, never()).markArrived(anyLong());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 출고_전_요청은_도착을_확인할_수_없다() {
        for (String status : List.of("REQUESTED", "APPROVED", "REJECTED", "CANCELLED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3, 0, 0, null));
            assertThrows(IllegalStateException.class, () -> service.arrive(OWNER_ID, REQUEST_ID), status);
        }
        verify(fulfillmentMapper, never()).markArrived(anyLong());
    }

    @Test
    void 이미_도착_확인된_요청은_409다() {
        when(approvalMapper.lockRequest(REQUEST_ID))
                .thenReturn(request("DISPATCHED", 3, 0, 0, LocalDateTime.now()));

        assertThrows(IllegalStateException.class, () -> service.arrive(OWNER_ID, REQUEST_ID));
        verify(fulfillmentMapper, never()).markArrived(anyLong());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 도착_기록_UPDATE가_0행이면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 3, 0, 0, null));
        when(fulfillmentMapper.markArrived(REQUEST_ID)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.arrive(OWNER_ID, REQUEST_ID));
        verify(requestMapper, never()).insertLog(any());
    }

    // ================= 반납 신청 =================

    @Test
    void 반납_신청은_신청_행과_이력만_남기고_재고와_누적_반납은_바꾸지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 2, 1, null));
        when(fulfillmentMapper.sumPendingReturnQty(REQUEST_ID)).thenReturn(3);
        // 신청 가능 수량 = 10 - 2 - 1 - 3 = 4
        stubInsertReturnId(RETURN_ID);

        ResourceReturn result = service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(4, " 첫 번째 반납 "));

        assertSame(fulfillmentMapper.findReturnById(RETURN_ID), result);
        InOrder order = inOrder(approvalMapper, fulfillmentMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(fulfillmentMapper).countRecentSameReturn(REQUEST_ID, OWNER_ID, 4, 10);
        order.verify(fulfillmentMapper).sumPendingReturnQty(REQUEST_ID);
        ArgumentCaptor<ResourceReturn> saved = ArgumentCaptor.forClass(ResourceReturn.class);
        order.verify(fulfillmentMapper).insertReturn(saved.capture());
        ArgumentCaptor<ResourceLog> log = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(log.capture());

        assertEquals(REQUEST_ID, saved.getValue().getRequestId());
        assertEquals(4, saved.getValue().getAppliedQty());
        assertEquals("첫 번째 반납", saved.getValue().getApplyMemo());   // 앞뒤 공백은 지운다
        assertEquals(OWNER_ID, saved.getValue().getApplicantId());
        assertEquals("RETURN_APPLY", log.getValue().getAction());
        assertEquals("DISPATCHED", log.getValue().getPrevStatus());
        assertEquals("DISPATCHED", log.getValue().getNewStatus());
        // 신청만으로는 재고도 요청 수량도 바뀌지 않는다
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
        verify(fulfillmentMapper, never()).applyReturnToRequest(anyLong(), anyInt());
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 신청_가능_수량과_정확히_같은_수량은_신청할_수_있고_하나_넘으면_409다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 2, 1, null));
        when(fulfillmentMapper.sumPendingReturnQty(REQUEST_ID)).thenReturn(3);

        service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(4, null));

        verify(fulfillmentMapper, times(1)).insertReturn(any());
        assertThrows(IllegalStateException.class,
                () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(5, null)));
        verify(fulfillmentMapper, times(1)).insertReturn(any());
    }

    @Test
    void 메모가_비어_있으면_null로_저장한다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));

        service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(1, "   "));

        ArgumentCaptor<ResourceReturn> saved = ArgumentCaptor.forClass(ResourceReturn.class);
        verify(fulfillmentMapper).insertReturn(saved.capture());
        assertNull(saved.getValue().getApplyMemo());
    }

    @Test
    void 반납_신청은_요청자_본인_STAFF만_할_수_있다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        ResourceReturnApplyRequest body = new ResourceReturnApplyRequest(1, null);

        assertThrows(AccessDeniedException.class, () -> service.applyReturn(ADMIN_ID, REQUEST_ID, body));
        assertThrows(AccessDeniedException.class, () -> service.applyReturn(USER_ID, REQUEST_ID, body));
        assertThrows(AccessDeniedException.class, () -> service.applyReturn(OTHER_ID, REQUEST_ID, body));
        verify(fulfillmentMapper, never()).insertReturn(any());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 반납_수량이_없거나_1_미만이면_400이고_요청을_잠그지도_않는다() {
        assertThrows(IllegalArgumentException.class, () -> service.applyReturn(OWNER_ID, REQUEST_ID, null));
        assertThrows(IllegalArgumentException.class,
                () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(null, null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(0, null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(-2, null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(1, "가".repeat(501))));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 출고되지_않았거나_정산이_끝났거나_소모품이면_반납_신청은_409다() {
        for (String status : List.of("REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "SETTLED", "COMPLETED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 10, 0, 0, null));
            assertThrows(IllegalStateException.class,
                    () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(1, null)), status);
        }
        verify(fulfillmentMapper, never()).insertReturn(any());
    }

    @Test
    void 같은_신청이_방금_들어왔다면_더블클릭으로_보고_409다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        // 첫 번째 클릭은 통과하고, 요청 행 잠금 뒤에 온 두 번째 클릭은 첫 번째 신청을 본다
        when(fulfillmentMapper.countRecentSameReturn(REQUEST_ID, OWNER_ID, 2, 10)).thenReturn(0).thenReturn(1);

        ResourceReturnApplyRequest body = new ResourceReturnApplyRequest(2, null);
        service.applyReturn(OWNER_ID, REQUEST_ID, body);
        assertThrows(IllegalStateException.class, () -> service.applyReturn(OWNER_ID, REQUEST_ID, body));

        verify(fulfillmentMapper, times(1)).insertReturn(any());
        verify(requestMapper, times(1)).insertLog(any());
    }

    @Test
    void 반납_신청_중_이력_저장이_실패하면_예외가_그대로_올라간다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        doThrow(new RuntimeException("요청 이력 INSERT 실패")).when(requestMapper).insertLog(any(ResourceLog.class));

        assertThrows(RuntimeException.class,
                () -> service.applyReturn(OWNER_ID, REQUEST_ID, new ResourceReturnApplyRequest(1, null)));
    }

    // ================= 반납 확인 =================

    @Test
    void 반납을_확인하면_신청과_요청과_재고를_순서대로_바꾸고_이력_두_줄을_남긴다() {
        // 요청 10개 중 반납 2·손실 1, 신청 3개를 확인한다. 남은 수량 4가 있으므로 DISPATCHED 유지
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 2, 1, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));

        ResourceReturn result = service.confirmReturn(ADMIN_ID, RETURN_ID);

        assertSame(fulfillmentMapper.findReturnById(RETURN_ID), result);
        // 잠금 순서: 신청 읽기 → 요청 잠금 → (신청·요청 UPDATE) → 재고 잠금
        InOrder order = inOrder(fulfillmentMapper, approvalMapper, adminMapper, requestMapper);
        order.verify(fulfillmentMapper).findReturnById(RETURN_ID);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(fulfillmentMapper).updateReturnStatus(RETURN_ID, "PENDING", "CONFIRMED", ADMIN_ID, null);
        order.verify(fulfillmentMapper).applyReturnToRequest(REQUEST_ID, 3);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(approvalMapper).releaseStock(STOCK_ID, 3);
        ArgumentCaptor<ResourceLog> requestLog = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(requestLog.capture());
        ArgumentCaptor<ResourceStockLog> stockLog = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(approvalMapper).insertStockLog(stockLog.capture());

        ResourceLog rl = requestLog.getValue();
        assertEquals("RETURN_CONFIRM", rl.getAction());
        assertEquals("DISPATCHED", rl.getPrevStatus());
        assertEquals("DISPATCHED", rl.getNewStatus());
        assertEquals(ADMIN_ID, rl.getChangedBy());
        ResourceStockLog sl = stockLog.getValue();
        assertEquals("RETURN", sl.getAction());
        assertEquals(10, sl.getTotalBefore());
        assertEquals(10, sl.getTotalAfter());           // 총보유량은 그대로
        assertEquals(4, sl.getAvailableBefore());
        assertEquals(7, sl.getAvailableAfter());        // 가용만 반납 수량만큼 증가
        assertEquals(REQUEST_ID, sl.getRequestId());
    }

    @Test
    void 마지막_수량을_확인하면_이력의_새_상태가_SETTLED다() {
        // 요청 10개 중 반납 4·손실 3, 신청 3개 → 4 + 3 + 3 = 10 → SETTLED
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 4, 3, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));

        service.confirmReturn(ADMIN_ID, RETURN_ID);

        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(captor.capture());
        assertEquals("DISPATCHED", captor.getValue().getPrevStatus());
        assertEquals("SETTLED", captor.getValue().getNewStatus());
    }

    @Test
    void 사용_중지된_재고도_반납은_가용으로_돌아온다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 0, "INACTIVE"));

        service.confirmReturn(ADMIN_ID, RETURN_ID);

        verify(approvalMapper).releaseStock(STOCK_ID, 3);
    }

    @Test
    void 반납_확인은_ADMIN만_할_수_있다() {
        assertThrows(AccessDeniedException.class, () -> service.confirmReturn(OWNER_ID, RETURN_ID));
        assertThrows(AccessDeniedException.class, () -> service.confirmReturn(USER_ID, RETURN_ID));
        verify(fulfillmentMapper, never()).findReturnById(anyLong());
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 없는_반납_신청은_400이다() {
        when(fulfillmentMapper.findReturnById(999L)).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.confirmReturn(ADMIN_ID, 999L));
        assertThrows(IllegalArgumentException.class, () -> service.confirmReturn(ADMIN_ID, null));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 요청이_출고_상태가_아니면_반납을_확인할_수_없다() {
        for (String status : List.of("APPROVED", "CANCELLED", "SETTLED", "COMPLETED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 10, 0, 0, null));
            assertThrows(IllegalStateException.class, () -> service.confirmReturn(ADMIN_ID, RETURN_ID), status);
        }
        verify(fulfillmentMapper, never()).updateReturnStatus(anyLong(), anyString(), anyString(), anyLong(), any());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
    }

    @Test
    void 이미_처리된_신청이면_409이고_요청과_재고를_건드리지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(fulfillmentMapper.updateReturnStatus(RETURN_ID, "PENDING", "CONFIRMED", ADMIN_ID, null)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.confirmReturn(ADMIN_ID, RETURN_ID));
        verify(fulfillmentMapper, never()).applyReturnToRequest(anyLong(), anyInt());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 같은_신청을_두_번_확인해도_가용은_한_번만_늘어난다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        // 첫 번째는 PENDING → CONFIRMED로 1행, 요청 행 잠금 뒤에 온 두 번째는 이미 CONFIRMED라 0행
        when(fulfillmentMapper.updateReturnStatus(RETURN_ID, "PENDING", "CONFIRMED", ADMIN_ID, null))
                .thenReturn(1).thenReturn(0);

        service.confirmReturn(ADMIN_ID, RETURN_ID);
        assertThrows(IllegalStateException.class, () -> service.confirmReturn(ADMIN_ID, RETURN_ID));

        verify(approvalMapper, times(1)).releaseStock(STOCK_ID, 3);
        verify(fulfillmentMapper, times(1)).applyReturnToRequest(REQUEST_ID, 3);
        verify(approvalMapper, times(1)).insertStockLog(any());
    }

    @Test
    void 남은_수량을_넘는_신청이면_409이고_재고를_건드리지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(fulfillmentMapper.applyReturnToRequest(REQUEST_ID, 3)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.confirmReturn(ADMIN_ID, RETURN_ID));
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 가용_복구가_0행이면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(approvalMapper.releaseStock(STOCK_ID, 3)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.confirmReturn(ADMIN_ID, RETURN_ID));
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 반납_확인_중_이력_저장이_실패하면_예외가_그대로_올라간다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        doThrow(new RuntimeException("재고 이력 INSERT 실패")).when(approvalMapper).insertStockLog(any(ResourceStockLog.class));

        assertThrows(RuntimeException.class, () -> service.confirmReturn(ADMIN_ID, RETURN_ID));
    }

    // ================= 반납 신청 반려 =================

    @Test
    void 반려하면_신청_행과_이력만_바꾸고_재고는_건드리지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));

        ResourceReturn result = service.rejectReturn(ADMIN_ID, RETURN_ID, new ResourceRequestRejectRequest("  수량이 맞지 않음  "));

        assertSame(fulfillmentMapper.findReturnById(RETURN_ID), result);
        InOrder order = inOrder(fulfillmentMapper, approvalMapper, requestMapper);
        order.verify(fulfillmentMapper).findReturnById(RETURN_ID);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(fulfillmentMapper).updateReturnStatus(RETURN_ID, "PENDING", "REJECTED", ADMIN_ID, "수량이 맞지 않음");
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(captor.capture());
        assertEquals("RETURN_REJECT", captor.getValue().getAction());
        assertEquals("DISPATCHED", captor.getValue().getPrevStatus());
        assertEquals("DISPATCHED", captor.getValue().getNewStatus());
        assertTrue(captor.getValue().getMemo().contains("수량이 맞지 않음"));
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(fulfillmentMapper, never()).applyReturnToRequest(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 반려_사유가_없거나_너무_길면_400이고_요청을_잠그지도_않는다() {
        assertThrows(IllegalArgumentException.class, () -> service.rejectReturn(ADMIN_ID, RETURN_ID, null));
        assertThrows(IllegalArgumentException.class,
                () -> service.rejectReturn(ADMIN_ID, RETURN_ID, new ResourceRequestRejectRequest(null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.rejectReturn(ADMIN_ID, RETURN_ID, new ResourceRequestRejectRequest("   ")));
        assertThrows(IllegalArgumentException.class,
                () -> service.rejectReturn(ADMIN_ID, RETURN_ID, new ResourceRequestRejectRequest("가".repeat(501))));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 반납_신청_반려는_ADMIN만_할_수_있다() {
        ResourceRequestRejectRequest body = new ResourceRequestRejectRequest("사유");

        assertThrows(AccessDeniedException.class, () -> service.rejectReturn(OWNER_ID, RETURN_ID, body));
        assertThrows(AccessDeniedException.class, () -> service.rejectReturn(USER_ID, RETURN_ID, body));
        verify(fulfillmentMapper, never()).updateReturnStatus(anyLong(), anyString(), anyString(), anyLong(), any());
    }

    @Test
    void 이미_처리된_신청을_반려하면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(fulfillmentMapper.updateReturnStatus(RETURN_ID, "PENDING", "REJECTED", ADMIN_ID, "사유")).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.rejectReturn(ADMIN_ID, RETURN_ID, new ResourceRequestRejectRequest("사유")));
        verify(requestMapper, never()).insertLog(any());
    }

    // ================= 손실 확정 =================

    @Test
    void 손실을_확정하면_누적_손실과_총보유량을_줄이고_이력_두_줄을_남긴다() {
        // 요청 10개 중 반납 2·손실 1(처리 완료 3), 대기 중 신청 2개. 확정 가능 = 10 - 3 - 2 = 5
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 2, 1, null));
        when(fulfillmentMapper.sumPendingReturnQty(REQUEST_ID)).thenReturn(2);
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));

        ResourceRequest result = service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(4, " 침수로 파손 ", 3));

        assertSame(requestMapper.findById(REQUEST_ID), result);
        InOrder order = inOrder(approvalMapper, fulfillmentMapper, adminMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(fulfillmentMapper).sumPendingReturnQty(REQUEST_ID);
        order.verify(fulfillmentMapper).applyLossToRequest(REQUEST_ID, 4, 3);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(fulfillmentMapper).reduceTotal(STOCK_ID, 4);
        ArgumentCaptor<ResourceLog> requestLog = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(requestLog.capture());
        ArgumentCaptor<ResourceStockLog> stockLog = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(approvalMapper).insertStockLog(stockLog.capture());

        ResourceLog rl = requestLog.getValue();
        assertEquals("LOSS", rl.getAction());
        assertEquals("DISPATCHED", rl.getPrevStatus());
        assertEquals("DISPATCHED", rl.getNewStatus());     // 3 + 4 = 7 < 10, 아직 남았다
        assertTrue(rl.getMemo().contains("4"));
        assertTrue(rl.getMemo().contains("침수로 파손"));
        ResourceStockLog sl = stockLog.getValue();
        assertEquals("LOSS", sl.getAction());
        assertEquals(10, sl.getTotalBefore());
        assertEquals(6, sl.getTotalAfter());               // 총보유량만 손실 수량만큼 감소
        assertEquals(4, sl.getAvailableBefore());
        assertEquals(4, sl.getAvailableAfter());           // 가용은 그대로
        assertEquals("침수로 파손", sl.getReason());
        assertEquals(REQUEST_ID, sl.getRequestId());
        // 손실은 가용을 늘리지 않는다
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
    }

    @Test
    void 남은_수량을_모두_손실로_확정하면_이력의_새_상태가_SETTLED다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 4, 3, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));

        service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(3, "분실", 7));

        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(captor.capture());
        assertEquals("SETTLED", captor.getValue().getNewStatus());
    }

    @Test
    void 확정_가능_수량을_넘는_손실은_409이고_아무것도_바꾸지_않는다() {
        // 확정 가능 = 10 - 3 - 2 = 5. 대기 중 신청 2개는 손실로 넘길 수 없다
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 2, 1, null));
        when(fulfillmentMapper.sumPendingReturnQty(REQUEST_ID)).thenReturn(2);

        assertThrows(IllegalStateException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(6, "분실", 3)));
        verify(fulfillmentMapper, never()).applyLossToRequest(anyLong(), anyInt(), anyInt());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
        verify(requestMapper, never()).insertLog(any());

        // 경계: 확정 가능 수량과 정확히 같으면 통과한다
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));
        service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(5, "분실", 3));
        verify(fulfillmentMapper).applyLossToRequest(REQUEST_ID, 5, 3);
    }

    @Test
    void 화면이_본_처리_완료_수량과_다르면_409다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 2, 1, null));

        assertThrows(IllegalStateException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", 2)));
        verify(fulfillmentMapper, never()).sumPendingReturnQty(anyLong());
        verify(fulfillmentMapper, never()).applyLossToRequest(anyLong(), anyInt(), anyInt());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
    }

    @Test
    void 같은_손실_확정이_두_번_와도_총보유량은_한_번만_줄어든다() {
        // 첫 번째는 처리 완료 수량 3에서 시작해 7이 된다. 두 번째 요청도 화면은 3을 보고 있지만 지금 값은 7이다
        when(approvalMapper.lockRequest(REQUEST_ID))
                .thenReturn(request("DISPATCHED", 10, 2, 1, null))
                .thenReturn(request("DISPATCHED", 10, 2, 5, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 4, "ACTIVE"));
        ResourceLossRequest body = new ResourceLossRequest(4, "분실", 3);

        service.confirmLoss(ADMIN_ID, REQUEST_ID, body);
        assertThrows(IllegalStateException.class, () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, body));

        verify(fulfillmentMapper, times(1)).applyLossToRequest(REQUEST_ID, 4, 3);
        verify(fulfillmentMapper, times(1)).reduceTotal(STOCK_ID, 4);
        verify(approvalMapper, times(1)).insertStockLog(any());
    }

    @Test
    void 손실_확정은_ADMIN만_할_수_있다() {
        ResourceLossRequest body = new ResourceLossRequest(1, "분실", 0);

        assertThrows(AccessDeniedException.class, () -> service.confirmLoss(OWNER_ID, REQUEST_ID, body));
        assertThrows(AccessDeniedException.class, () -> service.confirmLoss(USER_ID, REQUEST_ID, body));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 손실_입력이_올바르지_않으면_400이고_요청을_잠그지도_않는다() {
        assertThrows(IllegalArgumentException.class, () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, null));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(null, "분실", 0)));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(0, "분실", 0)));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, null, 0)));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "   ", 0)));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "가".repeat(501), 0)));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", -1)));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 출고되어_정산이_끝나지_않은_요청이_아니면_손실을_확정할_수_없다() {
        for (String status : List.of("REQUESTED", "APPROVED", "CANCELLED", "SETTLED", "COMPLETED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 10, 0, 0, null));
            assertThrows(IllegalStateException.class,
                    () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", 0)), status);
        }
        verify(fulfillmentMapper, never()).applyLossToRequest(anyLong(), anyInt(), anyInt());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
    }

    @Test
    void 손실_UPDATE가_0행이면_409이고_총보유량을_건드리지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(fulfillmentMapper.applyLossToRequest(REQUEST_ID, 1, 0)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", 0)));
        verify(adminMapper, never()).lockStock(anyLong());
        verify(fulfillmentMapper, never()).reduceTotal(anyLong(), anyInt());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 총보유량_차감이_0행이면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(fulfillmentMapper.reduceTotal(STOCK_ID, 1)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", 0)));
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 손실_확정_중_이력_저장이_실패하면_예외가_그대로_올라간다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        doThrow(new RuntimeException("재고 이력 INSERT 실패")).when(approvalMapper).insertStockLog(any(ResourceStockLog.class));

        assertThrows(RuntimeException.class,
                () -> service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(1, "분실", 0)));
    }

    // ================= 재고 불변식 (이력 값으로 계산) =================

    @Test
    void 반납_확인과_손실_확정을_이어서_해도_가용_더하기_활성_합은_총보유량과_같다() {
        // 요청 10개를 출고한 직후: 총보유량 10, 가용 0 (승인 때 10개가 예약됨), 활성 합 10
        int total = 10;
        int available = 0;
        int unsettled = 10;

        // 1) 반납 3개 확인 → 가용 +3, 활성 합 -3
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 0, 0, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(total, available, "ACTIVE"));
        service.confirmReturn(ADMIN_ID, RETURN_ID);
        ArgumentCaptor<ResourceStockLog> first = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(approvalMapper, times(1)).insertStockLog(first.capture());
        available = first.getValue().getAvailableAfter();
        total = first.getValue().getTotalAfter();
        unsettled -= 3;
        assertEquals(total, available + unsettled);

        // 2) 손실 2개 확정 → 총보유량 -2, 활성 합 -2
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("DISPATCHED", 10, 3, 0, null));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(total, available, "ACTIVE"));
        service.confirmLoss(ADMIN_ID, REQUEST_ID, new ResourceLossRequest(2, "파손", 3));
        ArgumentCaptor<ResourceStockLog> second = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(approvalMapper, times(2)).insertStockLog(second.capture());
        ResourceStockLog loss = second.getAllValues().get(1);
        available = loss.getAvailableAfter();
        total = loss.getTotalAfter();
        unsettled -= 2;
        assertEquals(8, total);
        assertEquals(3, available);
        assertEquals(total, available + unsettled);
        assertTrue(available >= 0 && available <= total);
    }

    // ================= 트랜잭션 =================

    @Test
    void 모든_처리_메서드는_쓰기_트랜잭션이다() {
        List<String> names = List.of("dispatch", "arrive", "applyReturn", "confirmReturn", "rejectReturn", "confirmLoss");
        List<Method> found = Arrays.stream(ResourceFulfillmentService.class.getDeclaredMethods())
                .filter(method -> names.contains(method.getName()))
                .toList();
        for (Method method : found) {
            assertTrue(isTransactional(method), method.getName() + "에 @Transactional이 없습니다.");
        }
        assertEquals(names.size(), found.size());
    }

    private boolean isTransactional(Method method) {
        Transactional annotation = method.getAnnotation(Transactional.class);
        return annotation != null && !annotation.readOnly();
    }

    // ================= 도우미 =================

    // insertReturn이 호출되면 selectKey처럼 returnId가 채워지는 것을 흉내 낸다
    private void stubInsertReturnId(long id) {
        doAnswer(invocation -> {
            ResourceReturn saved = invocation.getArgument(0);
            saved.setReturnId(id);
            return 1;
        }).when(fulfillmentMapper).insertReturn(any(ResourceReturn.class));
    }

    private Member member(long id, String role, String withdrawn) {
        Member member = new Member();
        member.setMemberId(id);
        member.setRole(role);
        member.setIsWithdrawn(withdrawn);
        return member;
    }

    private ResourceRequest request(String status, int quantity, int returned, int lost, LocalDateTime arrivedAt) {
        ResourceRequest request = new ResourceRequest();
        request.setRequestId(REQUEST_ID);
        request.setIncidentId(INCIDENT_ID);
        request.setStockId(STOCK_ID);
        request.setRequesterId(OWNER_ID);
        request.setQuantity(quantity);
        request.setStatus(status);
        request.setReturnedQty(returned);
        request.setLostQty(lost);
        request.setArrivedAt(arrivedAt);
        return request;
    }

    private ResourceStock stock(int totalQty, int availableQty, String status) {
        ResourceStock stock = new ResourceStock();
        stock.setStockId(STOCK_ID);
        stock.setTotalQty(totalQty);
        stock.setAvailableQty(availableQty);
        stock.setStatus(status);
        return stock;
    }

    private ResourceReturn application(int appliedQty, String status) {
        ResourceReturn application = new ResourceReturn();
        application.setReturnId(RETURN_ID);
        application.setRequestId(REQUEST_ID);
        application.setAppliedQty(appliedQty);
        application.setStatus(status);
        application.setApplicantId(OWNER_ID);
        return application;
    }
}
