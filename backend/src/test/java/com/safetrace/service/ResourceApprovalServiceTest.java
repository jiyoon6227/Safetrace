package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceApprovalMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 업무 규칙만 확인한다. 실제 잠금·SQL·롤백·동시 실행은 Oracle 테스트 스키마가 준비된 뒤 통합 테스트로 확인한다.
class ResourceApprovalServiceTest {

    private static final long ADMIN_ID = 9L;
    private static final long OWNER_ID = 5L;     // 요청자(STAFF)
    private static final long OTHER_ID = 6L;     // 다른 STAFF
    private static final long REQUEST_ID = 100L;
    private static final long STOCK_ID = 200L;
    private static final long INCIDENT_ID = 50L;

    private ResourceApprovalMapper approvalMapper;
    private ResourceAdminMapper adminMapper;
    private ResourceRequestMapper requestMapper;
    private MemberMapper memberMapper;
    private ResourceApprovalService service;

    @BeforeEach
    void setUp() {
        approvalMapper = mock(ResourceApprovalMapper.class);
        adminMapper = mock(ResourceAdminMapper.class);
        requestMapper = mock(ResourceRequestMapper.class);
        memberMapper = mock(MemberMapper.class);
        service = new ResourceApprovalService(approvalMapper, adminMapper, requestMapper, memberMapper);

        when(memberMapper.findById(ADMIN_ID)).thenReturn(member(ADMIN_ID, "ADMIN", "N"));
        when(memberMapper.findById(OWNER_ID)).thenReturn(member(OWNER_ID, "STAFF", "N"));
        when(memberMapper.findById(OTHER_ID)).thenReturn(member(OTHER_ID, "STAFF", "N"));
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("REQUESTED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "ACTIVE"));
        when(approvalMapper.findIncidentStatus(INCIDENT_ID)).thenReturn("RESPONDING");
        when(approvalMapper.reserveStock(anyLong(), anyInt())).thenReturn(1);
        when(approvalMapper.releaseStock(anyLong(), anyInt())).thenReturn(1);
        when(approvalMapper.updateRequestStatus(anyLong(), anyString(), anyString(), any())).thenReturn(1);
        when(requestMapper.findById(REQUEST_ID)).thenReturn(request("APPROVED", 3));
    }

    // ================= 승인 =================

    @Test
    void 승인하면_요청과_재고를_잠그고_가용을_줄인_뒤_요청_이력과_재고_이력을_남긴다() {
        ResourceRequest result = service.approve(ADMIN_ID, REQUEST_ID);

        assertSame(requestMapper.findById(REQUEST_ID), result);
        // 잠금 순서: 요청 → 재고. 그 뒤에 변경과 이력
        InOrder order = inOrder(approvalMapper, adminMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(approvalMapper).findIncidentStatus(INCIDENT_ID);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(approvalMapper).reserveStock(STOCK_ID, 3);
        order.verify(approvalMapper).updateRequestStatus(REQUEST_ID, "REQUESTED", "APPROVED", null);
        ArgumentCaptor<ResourceLog> requestLog = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(requestLog.capture());
        ArgumentCaptor<ResourceStockLog> stockLog = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(approvalMapper).insertStockLog(stockLog.capture());

        ResourceLog rl = requestLog.getValue();
        assertEquals(REQUEST_ID, rl.getRequestId());
        assertEquals("REQUESTED", rl.getPrevStatus());
        assertEquals("APPROVED", rl.getNewStatus());
        assertEquals("APPROVE", rl.getAction());
        assertEquals(ADMIN_ID, rl.getChangedBy());

        ResourceStockLog sl = stockLog.getValue();
        assertEquals(STOCK_ID, sl.getStockId());
        assertEquals("RESERVE", sl.getAction());
        assertEquals(10, sl.getTotalBefore());
        assertEquals(10, sl.getTotalAfter());          // 총보유량은 그대로
        assertEquals(10, sl.getAvailableBefore());
        assertEquals(7, sl.getAvailableAfter());       // 가용만 요청 수량만큼 감소
        assertEquals(REQUEST_ID, sl.getRequestId());
        assertEquals(ADMIN_ID, sl.getChangedBy());
    }

    @Test
    void 가용이_요청_수량과_정확히_같으면_승인되고_가용은_0이_된다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 3, "ACTIVE"));

        service.approve(ADMIN_ID, REQUEST_ID);

        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(approvalMapper).insertStockLog(captor.capture());
        assertEquals(0, captor.getValue().getAvailableAfter());
    }

    @Test
    void 가용이_모자라면_409이고_아무것도_바꾸지_않는다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 2, "ACTIVE"));

        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(approvalMapper, never()).reserveStock(anyLong(), anyInt());
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 종료된_사건의_요청은_승인할_수_없고_재고를_잠그지도_않는다() {
        when(approvalMapper.findIncidentStatus(INCIDENT_ID)).thenReturn("CLOSED");

        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).reserveStock(anyLong(), anyInt());
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 사건_종료_처리가_먼저_요청을_취소했다면_승인은_사건을_보기_전에_409다() {
        // 종료 처리가 요청 행을 잠그고 CANCELLED로 바꾼 뒤 커밋하면, 기다리던 승인은 CANCELLED를 읽는다
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("CANCELLED", 3));

        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(approvalMapper, never()).findIncidentStatus(anyLong());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).reserveStock(anyLong(), anyInt());
    }

    @Test
    void 사용_중지된_재고는_승인할_수_없다() {
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 10, "INACTIVE"));

        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(approvalMapper, never()).reserveStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 이미_처리된_요청은_승인할_수_없고_재고를_잠그지도_않는다() {
        for (String status : List.of("APPROVED", "REJECTED", "CANCELLED", "DISPATCHED", "SETTLED", "COMPLETED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3));
            assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID), status);
        }
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).reserveStock(anyLong(), anyInt());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 같은_요청을_두_번_승인하면_두_번째는_409이고_예약은_한_번만_된다() {
        // 요청 행 잠금 덕에 두 번째 처리는 첫 번째가 끝난 뒤의 상태(APPROVED)를 읽는다
        when(approvalMapper.lockRequest(REQUEST_ID))
                .thenReturn(request("REQUESTED", 3))
                .thenReturn(request("APPROVED", 3));

        service.approve(ADMIN_ID, REQUEST_ID);
        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));

        verify(approvalMapper, times(1)).reserveStock(STOCK_ID, 3);
        verify(approvalMapper, times(1)).insertStockLog(any(ResourceStockLog.class));
    }

    @Test
    void 재고_예약_UPDATE가_반영되지_않으면_409이고_요청_상태와_이력을_남기지_않는다() {
        when(approvalMapper.reserveStock(STOCK_ID, 3)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 요청_상태_UPDATE가_반영되지_않으면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.updateRequestStatus(REQUEST_ID, "REQUESTED", "APPROVED", null)).thenReturn(0);

        // 예외가 서비스 밖으로 나가야 @Transactional이 앞서 한 재고 예약까지 롤백한다
        assertThrows(IllegalStateException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 승인_중_이력_저장이_실패하면_예외가_그대로_올라간다() {
        doThrow(new RuntimeException("재고 이력 INSERT 실패")).when(approvalMapper).insertStockLog(any(ResourceStockLog.class));
        assertThrows(RuntimeException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));

        doThrow(new RuntimeException("요청 이력 INSERT 실패")).when(requestMapper).insertLog(any(ResourceLog.class));
        assertThrows(RuntimeException.class, () -> service.approve(ADMIN_ID, REQUEST_ID));
        verify(requestMapper, never()).findById(anyLong());
    }

    @Test
    void 승인은_ADMIN만_할_수_있다() {
        when(memberMapper.findById(7L)).thenReturn(member(7L, "USER", "N"));

        assertThrows(AccessDeniedException.class, () -> service.approve(OWNER_ID, REQUEST_ID));   // STAFF (요청자 본인도 불가)
        assertThrows(AccessDeniedException.class, () -> service.approve(OTHER_ID, REQUEST_ID));
        assertThrows(AccessDeniedException.class, () -> service.approve(7L, REQUEST_ID));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 처리자가_없거나_탈퇴했거나_요청이_없으면_400이다() {
        when(memberMapper.findById(8L)).thenReturn(member(8L, "ADMIN", "Y"));

        assertThrows(IllegalArgumentException.class, () -> service.approve(null, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.approve(999L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.approve(8L, REQUEST_ID));
        verify(approvalMapper, never()).lockRequest(anyLong());

        assertThrows(IllegalArgumentException.class, () -> service.approve(ADMIN_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.approve(ADMIN_ID, 404L));
        verify(adminMapper, never()).lockStock(anyLong());
    }

    // ================= 반려 =================

    @Test
    void 반려하면_사유를_저장하고_재고는_건드리지_않는다() {
        service.reject(ADMIN_ID, REQUEST_ID, new ResourceRequestRejectRequest("  수량 과다  "));

        verify(approvalMapper).updateRequestStatus(REQUEST_ID, "REQUESTED", "REJECTED", "수량 과다");
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(captor.capture());
        assertEquals("REQUESTED", captor.getValue().getPrevStatus());
        assertEquals("REJECTED", captor.getValue().getNewStatus());
        assertEquals("REJECT", captor.getValue().getAction());
        assertEquals("수량 과다", captor.getValue().getMemo());
        assertEquals(ADMIN_ID, captor.getValue().getChangedBy());
        // 재고 행 잠금·변경·재고 이력 모두 없음
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).reserveStock(anyLong(), anyInt());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 반려_사유가_없거나_너무_길면_400이고_요청을_잠그지도_않는다() {
        assertThrows(IllegalArgumentException.class, () -> service.reject(ADMIN_ID, REQUEST_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.reject(ADMIN_ID, REQUEST_ID, new ResourceRequestRejectRequest(null)));
        assertThrows(IllegalArgumentException.class, () -> service.reject(ADMIN_ID, REQUEST_ID, new ResourceRequestRejectRequest("   ")));
        assertThrows(IllegalArgumentException.class, () -> service.reject(ADMIN_ID, REQUEST_ID,
                new ResourceRequestRejectRequest("가".repeat(501))));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 반려는_ADMIN만_할_수_있다() {
        assertThrows(AccessDeniedException.class,
                () -> service.reject(OWNER_ID, REQUEST_ID, new ResourceRequestRejectRequest("사유")));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 이미_처리된_요청은_반려할_수_없다() {
        for (String status : List.of("APPROVED", "REJECTED", "CANCELLED", "DISPATCHED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3));
            assertThrows(IllegalStateException.class,
                    () -> service.reject(ADMIN_ID, REQUEST_ID, new ResourceRequestRejectRequest("사유")), status);
        }
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 반려_UPDATE가_반영되지_않으면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.updateRequestStatus(REQUEST_ID, "REQUESTED", "REJECTED", "사유")).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.reject(ADMIN_ID, REQUEST_ID, new ResourceRequestRejectRequest("사유")));
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 없는_요청을_반려하면_400이다() {
        assertThrows(IllegalArgumentException.class,
                () -> service.reject(ADMIN_ID, 404L, new ResourceRequestRejectRequest("사유")));
    }

    // ================= 취소 =================

    @Test
    void 승인_전_요청은_요청자가_취소하고_재고는_그대로다() {
        service.cancel(OWNER_ID, REQUEST_ID);

        verify(approvalMapper).updateRequestStatus(REQUEST_ID, "REQUESTED", "CANCELLED", null);
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(captor.capture());
        assertEquals("REQUESTED", captor.getValue().getPrevStatus());
        assertEquals("CANCELLED", captor.getValue().getNewStatus());
        assertEquals("CANCEL", captor.getValue().getAction());
        assertEquals(OWNER_ID, captor.getValue().getChangedBy());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 승인_후_취소하면_예약한_가용_수량만큼_복구하고_RELEASE_이력을_남긴다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));

        service.cancel(OWNER_ID, REQUEST_ID);

        InOrder order = inOrder(approvalMapper, adminMapper, requestMapper);
        order.verify(approvalMapper).lockRequest(REQUEST_ID);
        order.verify(adminMapper).lockStock(STOCK_ID);
        order.verify(approvalMapper).releaseStock(STOCK_ID, 3);
        order.verify(approvalMapper).updateRequestStatus(REQUEST_ID, "APPROVED", "CANCELLED", null);
        ArgumentCaptor<ResourceLog> requestLog = ArgumentCaptor.forClass(ResourceLog.class);
        order.verify(requestMapper).insertLog(requestLog.capture());
        ArgumentCaptor<ResourceStockLog> stockLog = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(approvalMapper).insertStockLog(stockLog.capture());

        assertEquals("APPROVED", requestLog.getValue().getPrevStatus());
        assertEquals("CANCELLED", requestLog.getValue().getNewStatus());
        assertEquals("CANCEL", requestLog.getValue().getAction());
        ResourceStockLog sl = stockLog.getValue();
        assertEquals("RELEASE", sl.getAction());
        assertEquals(10, sl.getTotalBefore());
        assertEquals(10, sl.getTotalAfter());
        assertEquals(7, sl.getAvailableBefore());
        assertEquals(10, sl.getAvailableAfter());
        assertEquals(REQUEST_ID, sl.getRequestId());
        assertEquals(OWNER_ID, sl.getChangedBy());
    }

    @Test
    void ADMIN도_승인_후_요청은_취소할_수_있다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));

        service.cancel(ADMIN_ID, REQUEST_ID);

        verify(approvalMapper).releaseStock(STOCK_ID, 3);
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(captor.capture());
        assertEquals(ADMIN_ID, captor.getValue().getChangedBy());
    }

    @Test
    void ADMIN은_승인_전_요청을_취소할_수_없다() {
        assertThrows(AccessDeniedException.class, () -> service.cancel(ADMIN_ID, REQUEST_ID));
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 다른_STAFF의_요청은_상태와_상관없이_취소할_수_없다() {
        for (String status : List.of("REQUESTED", "APPROVED", "DISPATCHED", "CANCELLED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3));
            assertThrows(AccessDeniedException.class, () -> service.cancel(OTHER_ID, REQUEST_ID), status);
        }
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
    }

    @Test
    void 시민USER와_탈퇴_회원은_취소할_수_없다() {
        when(memberMapper.findById(7L)).thenReturn(member(7L, "USER", "N"));
        when(memberMapper.findById(8L)).thenReturn(member(8L, "STAFF", "Y"));

        assertThrows(AccessDeniedException.class, () -> service.cancel(7L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.cancel(8L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.cancel(null, REQUEST_ID));
        verify(approvalMapper, never()).lockRequest(anyLong());
    }

    @Test
    void 출고됐거나_이미_끝난_요청은_취소할_수_없고_재고는_그대로다() {
        for (String status : List.of("DISPATCHED", "SETTLED", "COMPLETED", "REJECTED", "CANCELLED")) {
            when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request(status, 3));
            assertThrows(IllegalStateException.class, () -> service.cancel(OWNER_ID, REQUEST_ID), status);
            assertThrows(IllegalStateException.class, () -> service.cancel(ADMIN_ID, REQUEST_ID), status);
        }
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 같은_요청을_두_번_취소하면_두_번째는_409이고_복구는_한_번만_된다() {
        when(approvalMapper.lockRequest(REQUEST_ID))
                .thenReturn(request("APPROVED", 3))
                .thenReturn(request("CANCELLED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));

        service.cancel(OWNER_ID, REQUEST_ID);
        assertThrows(IllegalStateException.class, () -> service.cancel(OWNER_ID, REQUEST_ID));
        assertThrows(IllegalStateException.class, () -> service.cancel(ADMIN_ID, REQUEST_ID));

        verify(approvalMapper, times(1)).releaseStock(STOCK_ID, 3);
        verify(approvalMapper, times(1)).insertStockLog(any(ResourceStockLog.class));
    }

    @Test
    void 사용_중지된_재고의_승인_건도_취소하면_복구된다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "INACTIVE"));

        service.cancel(OWNER_ID, REQUEST_ID);

        verify(approvalMapper).releaseStock(STOCK_ID, 3);
        verify(approvalMapper).insertStockLog(any(ResourceStockLog.class));
    }

    @Test
    void 복구_UPDATE가_반영되지_않으면_409이고_상태와_이력을_남기지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));
        when(approvalMapper.releaseStock(STOCK_ID, 3)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.cancel(OWNER_ID, REQUEST_ID));
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 취소_상태_UPDATE가_반영되지_않으면_409이고_이력을_남기지_않는다() {
        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, 7, "ACTIVE"));
        when(approvalMapper.updateRequestStatus(REQUEST_ID, "APPROVED", "CANCELLED", null)).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.cancel(OWNER_ID, REQUEST_ID));
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 없는_요청을_취소하면_400이다() {
        assertThrows(IllegalArgumentException.class, () -> service.cancel(OWNER_ID, 404L));
        assertThrows(IllegalArgumentException.class, () -> service.cancel(OWNER_ID, null));
    }

    // ================= 승인 후 취소로 원래 재고로 돌아오는지 (수량 정합성) =================

    @Test
    void 승인_뒤_취소하면_가용이_원래_값으로_돌아온다() {
        service.approve(ADMIN_ID, REQUEST_ID);
        ArgumentCaptor<ResourceStockLog> approved = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(approvalMapper).insertStockLog(approved.capture());
        int availableAfterApprove = approved.getValue().getAvailableAfter();

        when(approvalMapper.lockRequest(REQUEST_ID)).thenReturn(request("APPROVED", 3));
        when(adminMapper.lockStock(STOCK_ID)).thenReturn(stock(10, availableAfterApprove, "ACTIVE"));
        service.cancel(OWNER_ID, REQUEST_ID);

        ArgumentCaptor<ResourceStockLog> all = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(approvalMapper, times(2)).insertStockLog(all.capture());
        ResourceStockLog release = all.getAllValues().get(1);
        assertEquals(10, approved.getValue().getAvailableBefore());
        assertEquals(approved.getValue().getAvailableBefore(), release.getAvailableAfter());
        assertEquals(approved.getValue().getAvailableAfter(), release.getAvailableBefore());
    }

    // ================= 트랜잭션 =================

    @Test
    void 요청_상태와_재고를_바꾸는_메서드는_모두_트랜잭션으로_묶여_있다() {
        List<String> names = List.of("approve", "reject", "cancel");
        long found = Arrays.stream(ResourceApprovalService.class.getDeclaredMethods())
                .filter(method -> names.contains(method.getName()))
                .peek(method -> assertTrue(isTransactional(method), method.getName() + "에 @Transactional이 없습니다."))
                .count();
        assertEquals(names.size(), found);
    }

    private boolean isTransactional(Method method) {
        Transactional annotation = method.getAnnotation(Transactional.class);
        return annotation != null && !annotation.readOnly();
    }

    // ================= 도우미 =================

    private Member member(long id, String role, String withdrawn) {
        Member member = new Member();
        member.setMemberId(id);
        member.setRole(role);
        member.setIsWithdrawn(withdrawn);
        return member;
    }

    private ResourceRequest request(String status, int quantity) {
        ResourceRequest request = new ResourceRequest();
        request.setRequestId(REQUEST_ID);
        request.setIncidentId(INCIDENT_ID);
        request.setStockId(STOCK_ID);
        request.setRequesterId(OWNER_ID);
        request.setQuantity(quantity);
        request.setStatus(status);
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
}
