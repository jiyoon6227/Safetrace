package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ClosurePreviewResponse;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceApprovalMapper;
import com.safetrace.mapper.ResourceClosureMapper;
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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 종료 연동 규칙만 확인한다. 실제 잠금·SQL·롤백·동시 실행은 Oracle 테스트 스키마가 준비된 뒤 통합 테스트로 확인한다.
class ResourceClosureServiceTest {

    private static final long STAFF_ID = 10L;      // 사건 담당자
    private static final long OTHER_STAFF_ID = 11L;
    private static final long USER_ID = 7L;
    private static final long ADMIN_ID = 9L;
    private static final long INCIDENT_ID = 50L;

    private ResourceClosureMapper closureMapper;
    private ResourceRequestMapper requestMapper;
    private ResourceApprovalMapper approvalMapper;
    private ResourceAdminMapper adminMapper;
    private IncidentMapper incidentMapper;
    private MemberMapper memberMapper;
    private ResourceClosureService service;

    @BeforeEach
    void setUp() {
        closureMapper = mock(ResourceClosureMapper.class);
        requestMapper = mock(ResourceRequestMapper.class);
        approvalMapper = mock(ResourceApprovalMapper.class);
        adminMapper = mock(ResourceAdminMapper.class);
        incidentMapper = mock(IncidentMapper.class);
        memberMapper = mock(MemberMapper.class);
        service = new ResourceClosureService(closureMapper, requestMapper, approvalMapper, adminMapper, incidentMapper, memberMapper);

        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("RECOVERING"));
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of());
        when(approvalMapper.updateRequestStatus(anyLong(), anyString(), anyString(), any())).thenReturn(1);
        when(approvalMapper.releaseStock(anyLong(), anyInt())).thenReturn(1);

        when(memberMapper.findById(STAFF_ID)).thenReturn(member("STAFF", "N"));
        when(memberMapper.findById(OTHER_STAFF_ID)).thenReturn(member("STAFF", "N"));
        when(memberMapper.findById(USER_ID)).thenReturn(member("USER", "N"));
        when(memberMapper.findById(ADMIN_ID)).thenReturn(member("ADMIN", "N"));
        when(incidentMapper.findById(INCIDENT_ID)).thenReturn(incident("RECOVERING"));
    }

    // ================= 종료 전 정리 =================

    @Test
    void 출고_전_요청이_없으면_아무것도_바꾸지_않는다() {
        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", null, STAFF_ID);

        InOrder order = inOrder(requestMapper, closureMapper);
        order.verify(requestMapper).lockIncident(INCIDENT_ID);
        order.verify(closureMapper).lockOpenRequests(INCIDENT_ID);
        order.verify(closureMapper).countOpenRequests(INCIDENT_ID);
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 승인_전_요청은_상태와_이력만_바꾸고_재고는_건드리지_않는다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "REQUESTED")));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID);

        verify(approvalMapper).updateRequestStatus(1L, "REQUESTED", "CANCELLED", null);
        ArgumentCaptor<ResourceLog> captor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(captor.capture());
        ResourceLog log = captor.getValue();
        assertEquals(1L, log.getRequestId());
        assertEquals("REQUESTED", log.getPrevStatus());
        assertEquals("CANCELLED", log.getNewStatus());
        assertEquals("CANCEL_BY_CLOSE", log.getAction());
        assertEquals(STAFF_ID, log.getChangedBy());     // 종료를 확인한 담당자
        verify(adminMapper, never()).lockStock(anyLong());
        verify(approvalMapper, never()).releaseStock(anyLong(), anyInt());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 승인된_요청은_예약_재고를_되돌리고_재고_이력_RELEASE를_남긴다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "APPROVED")));
        when(adminMapper.lockStock(200L)).thenReturn(stock(200L, 10, 4));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID);

        // 잠금 순서: 사건 → 요청 → 재고
        InOrder order = inOrder(requestMapper, closureMapper, approvalMapper, adminMapper);
        order.verify(requestMapper).lockIncident(INCIDENT_ID);
        order.verify(closureMapper).lockOpenRequests(INCIDENT_ID);
        order.verify(approvalMapper).updateRequestStatus(1L, "APPROVED", "CANCELLED", null);
        order.verify(requestMapper).insertLog(any(ResourceLog.class));
        order.verify(adminMapper).lockStock(200L);
        order.verify(approvalMapper).releaseStock(200L, 3);
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        order.verify(approvalMapper).insertStockLog(captor.capture());
        order.verify(closureMapper).countOpenRequests(INCIDENT_ID);

        ResourceStockLog log = captor.getValue();
        assertEquals("RELEASE", log.getAction());
        assertEquals(200L, log.getStockId());
        assertEquals(10, log.getTotalBefore());
        assertEquals(10, log.getTotalAfter());          // 총보유량은 그대로
        assertEquals(4, log.getAvailableBefore());
        assertEquals(7, log.getAvailableAfter());       // 가용만 예약했던 수량만큼 복구
        assertEquals(1L, log.getRequestId());
        assertEquals(STAFF_ID, log.getChangedBy());
    }

    @Test
    void 같은_재고의_승인_요청_여럿은_재고를_한_번만_잠그고_전후_값이_이어진다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(
                open(1L, 200L, 3, "APPROVED"), open(2L, 200L, 2, "APPROVED")));
        when(adminMapper.lockStock(200L)).thenReturn(stock(200L, 10, 4));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L, 2L), STAFF_ID);

        verify(adminMapper, times(1)).lockStock(200L);
        ArgumentCaptor<ResourceStockLog> captor = ArgumentCaptor.forClass(ResourceStockLog.class);
        verify(approvalMapper, times(2)).insertStockLog(captor.capture());
        ResourceStockLog first = captor.getAllValues().get(0);
        ResourceStockLog second = captor.getAllValues().get(1);
        assertEquals(4, first.getAvailableBefore());
        assertEquals(7, first.getAvailableAfter());
        assertEquals(7, second.getAvailableBefore());   // 앞 요청의 복구 결과에서 이어진다
        assertEquals(9, second.getAvailableAfter());
    }

    @Test
    void 재고는_요청을_모두_처리한_뒤_STOCK_ID_오름차순으로_잡는다() {
        // 요청 번호 순서(1, 2, 3)와 재고 번호 순서가 다르다: 요청 1 → 재고 30, 요청 2 → 재고 10, 요청 3 → 재고 30
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(
                open(1L, 30L, 1, "APPROVED"), open(2L, 10L, 1, "APPROVED"), open(3L, 30L, 1, "APPROVED")));
        when(adminMapper.lockStock(10L)).thenReturn(stock(10L, 5, 1));
        when(adminMapper.lockStock(30L)).thenReturn(stock(30L, 5, 1));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L, 2L, 3L), STAFF_ID);

        InOrder order = inOrder(approvalMapper, adminMapper);
        // 요청 세 건의 상태 변경이 모두 끝난 뒤에야 첫 재고를 잡는다
        order.verify(approvalMapper).updateRequestStatus(1L, "APPROVED", "CANCELLED", null);
        order.verify(approvalMapper).updateRequestStatus(2L, "APPROVED", "CANCELLED", null);
        order.verify(approvalMapper).updateRequestStatus(3L, "APPROVED", "CANCELLED", null);
        order.verify(adminMapper).lockStock(10L);
        order.verify(approvalMapper).releaseStock(10L, 1);
        order.verify(adminMapper).lockStock(30L);
        order.verify(approvalMapper, times(2)).releaseStock(30L, 1);
        verify(adminMapper, times(1)).lockStock(10L);
        verify(adminMapper, times(1)).lockStock(30L);
    }

    @Test
    void 승인_전과_승인_후_요청이_섞여_있으면_승인_건만_재고를_되돌린다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(
                open(1L, 200L, 3, "REQUESTED"), open(2L, 200L, 2, "APPROVED")));
        when(adminMapper.lockStock(200L)).thenReturn(stock(200L, 10, 4));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L, 2L), STAFF_ID);

        verify(approvalMapper).updateRequestStatus(1L, "REQUESTED", "CANCELLED", null);
        verify(approvalMapper).updateRequestStatus(2L, "APPROVED", "CANCELLED", null);
        verify(approvalMapper, times(1)).releaseStock(200L, 2);
        verify(approvalMapper, never()).releaseStock(200L, 3);
        verify(requestMapper, times(2)).insertLog(any(ResourceLog.class));
        verify(approvalMapper, times(1)).insertStockLog(any());
    }

    @Test
    void 이미_출고된_요청은_건드리지_않는다() {
        // 잠금 조회는 출고 전 요청만 돌려주지만, 혹시 출고된 행이 섞여 들어와도 취소하지 않는다
        ResourceRequest dispatched = open(5L, 200L, 3, "DISPATCHED");
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(dispatched));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", null, STAFF_ID);

        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(requestMapper, never()).insertLog(any());
    }

    // ================= 확인하지 않은 요청 =================

    @Test
    void 확인한_목록에_없는_출고_전_요청이_있으면_아무것도_바꾸지_않고_409다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(
                open(1L, 200L, 3, "APPROVED"), open(2L, 200L, 2, "REQUESTED")));

        // 요청 2번(그 사이 새로 생긴 요청)이 확인 목록에 없다
        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID));

        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(adminMapper, never()).lockStock(anyLong());
        verify(requestMapper, never()).insertLog(any());
        verify(approvalMapper, never()).insertStockLog(any());
    }

    @Test
    void 확인_목록이_없거나_비어_있어도_출고_전_요청이_있으면_409다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "REQUESTED")));

        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", null, STAFF_ID));
        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(), STAFF_ID));
        verify(approvalMapper, never()).updateRequestStatus(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 목록에_이_사건과_상관없는_번호가_섞여_있어도_잠근_요청만_취소한다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "REQUESTED")));

        service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", java.util.Arrays.asList(1L, 999L, null), STAFF_ID);

        verify(approvalMapper, times(1)).updateRequestStatus(anyLong(), anyString(), anyString(), any());
        verify(approvalMapper).updateRequestStatus(1L, "REQUESTED", "CANCELLED", null);
    }

    // ================= 사건 잠금 / 실패 처리 =================

    @Test
    void 사건을_잠근_뒤_상태가_달라졌으면_409이고_요청을_잠그지_않는다() {
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("CLOSED"));

        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(), STAFF_ID));
        verify(closureMapper, never()).lockOpenRequests(anyLong());
    }

    @Test
    void 없는_사건이면_400이다() {
        when(requestMapper.lockIncident(999L)).thenReturn(null);

        assertThrows(IllegalArgumentException.class,
                () -> service.cancelOpenRequestsForClose(999L, "RECOVERING", List.of(), STAFF_ID));
        assertThrows(IllegalArgumentException.class,
                () -> service.cancelOpenRequestsForClose(null, "RECOVERING", List.of(), STAFF_ID));
        verify(closureMapper, never()).lockOpenRequests(anyLong());
    }

    @Test
    void 요청_상태_UPDATE가_0행이면_409이고_재고를_건드리지_않는다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "APPROVED")));
        when(approvalMapper.updateRequestStatus(1L, "APPROVED", "CANCELLED", null)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID));
        verify(adminMapper, never()).lockStock(anyLong());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 가용_복구가_0행이면_409이고_이력을_남기지_않는다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "APPROVED")));
        when(adminMapper.lockStock(200L)).thenReturn(stock(200L, 10, 4));
        when(approvalMapper.releaseStock(200L, 3)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID));
        verify(approvalMapper, never()).insertStockLog(any());
        verify(closureMapper, never()).countOpenRequests(anyLong());
    }

    @Test
    void 재고가_없으면_400이다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "APPROVED")));
        when(adminMapper.lockStock(200L)).thenReturn(null);

        assertThrows(IllegalArgumentException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID));
    }

    @Test
    void 정리한_뒤에도_출고_전_요청이_남아_있으면_409다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "REQUESTED")));
        when(closureMapper.countOpenRequests(INCIDENT_ID)).thenReturn(1);

        assertThrows(IllegalStateException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID));
    }

    @Test
    void 이력_저장이_실패하면_예외가_그대로_올라간다() {
        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(1L, 200L, 3, "REQUESTED")));
        doThrow(new RuntimeException("요청 이력 INSERT 실패")).when(requestMapper).insertLog(any(ResourceLog.class));

        assertThrows(RuntimeException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(1L), STAFF_ID));

        when(closureMapper.lockOpenRequests(INCIDENT_ID)).thenReturn(List.of(open(2L, 200L, 3, "APPROVED")));
        when(adminMapper.lockStock(200L)).thenReturn(stock(200L, 10, 4));
        org.mockito.Mockito.reset(requestMapper);
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("RECOVERING"));
        doThrow(new RuntimeException("재고 이력 INSERT 실패")).when(approvalMapper).insertStockLog(any(ResourceStockLog.class));
        assertThrows(RuntimeException.class,
                () -> service.cancelOpenRequestsForClose(INCIDENT_ID, "RECOVERING", List.of(2L), STAFF_ID));
    }

    // ================= 종료 전 확인 목록 =================

    @Test
    void 담당자는_확인_목록과_출고_후_미반납_건수를_볼_수_있다() {
        List<ResourceRequest> rows = List.of(open(1L, 200L, 3, "APPROVED"));
        when(closureMapper.findOpenRequests(INCIDENT_ID)).thenReturn(rows);
        when(closureMapper.countDispatched(INCIDENT_ID)).thenReturn(2);

        ClosurePreviewResponse result = service.getClosurePreview(STAFF_ID, INCIDENT_ID);

        assertSame(rows, result.openRequests());
        assertEquals(2, result.dispatchedCount());
        // 조회는 아무것도 잠그지 않는다
        verify(requestMapper, never()).lockIncident(anyLong());
        verify(closureMapper, never()).lockOpenRequests(anyLong());
    }

    @Test
    void 담당자가_아닌_STAFF와_다른_역할은_확인_목록을_볼_수_없다() {
        assertThrows(AccessDeniedException.class, () -> service.getClosurePreview(OTHER_STAFF_ID, INCIDENT_ID));
        assertThrows(AccessDeniedException.class, () -> service.getClosurePreview(USER_ID, INCIDENT_ID));
        assertThrows(AccessDeniedException.class, () -> service.getClosurePreview(ADMIN_ID, INCIDENT_ID));
        verify(closureMapper, never()).findOpenRequests(anyLong());
    }

    @Test
    void 확인_목록은_없는_사건이나_없는_조회자면_400이다() {
        when(incidentMapper.findById(999L)).thenReturn(null);
        when(memberMapper.findById(8L)).thenReturn(null);
        when(memberMapper.findById(4L)).thenReturn(member("STAFF", "Y"));

        assertThrows(IllegalArgumentException.class, () -> service.getClosurePreview(STAFF_ID, 999L));
        assertThrows(IllegalArgumentException.class, () -> service.getClosurePreview(STAFF_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.getClosurePreview(8L, INCIDENT_ID));
        assertThrows(IllegalArgumentException.class, () -> service.getClosurePreview(4L, INCIDENT_ID));
        assertThrows(IllegalArgumentException.class, () -> service.getClosurePreview(null, INCIDENT_ID));
        verify(closureMapper, never()).findOpenRequests(anyLong());
    }

    // ================= 트랜잭션 =================

    @Test
    void 종료_정리는_쓰기_트랜잭션이고_확인_목록은_읽기_전용이다() {
        List<Method> methods = Arrays.stream(ResourceClosureService.class.getDeclaredMethods())
                .filter(method -> method.getName().equals("cancelOpenRequestsForClose")
                        || method.getName().equals("getClosurePreview"))
                .toList();
        assertEquals(2, methods.size());
        for (Method method : methods) {
            Transactional annotation = method.getAnnotation(Transactional.class);
            assertTrue(annotation != null, method.getName() + "에 @Transactional이 없습니다.");
            assertEquals(method.getName().equals("getClosurePreview"), annotation.readOnly(), method.getName());
        }
    }

    // ================= 도우미 =================

    private Incident incident(String status) {
        Incident incident = new Incident();
        incident.setIncidentId(INCIDENT_ID);
        incident.setStatus(status);
        incident.setAssignedStaffId(STAFF_ID);
        return incident;
    }

    private Member member(String role, String withdrawn) {
        Member member = new Member();
        member.setRole(role);
        member.setIsWithdrawn(withdrawn);
        return member;
    }

    private ResourceRequest open(long requestId, long stockId, int quantity, String status) {
        ResourceRequest request = new ResourceRequest();
        request.setRequestId(requestId);
        request.setIncidentId(INCIDENT_ID);
        request.setStockId(stockId);
        request.setQuantity(quantity);
        request.setStatus(status);
        return request;
    }

    private ResourceStock stock(long stockId, int totalQty, int availableQty) {
        ResourceStock stock = new ResourceStock();
        stock.setStockId(stockId);
        stock.setTotalQty(totalQty);
        stock.setAvailableQty(availableQty);
        stock.setStatus("ACTIVE");
        return stock;
    }
}
