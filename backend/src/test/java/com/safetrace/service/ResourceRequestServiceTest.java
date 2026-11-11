package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.dto.ResourceRequestCreateRequest;
import com.safetrace.dto.ResourceRequestPageResponse;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 업무 규칙만 확인한다 (잠금·SQL 동작은 Oracle 테스트 스키마가 준비된 뒤 통합 테스트로 확인)
class ResourceRequestServiceTest {

    private static final long STAFF_ID = 10L;
    private static final long MY_DEPT = 1L;
    private static final long OTHER_DEPT = 2L;
    private static final long INCIDENT_ID = 100L;
    private static final long STOCK_ID = 200L;

    private ResourceRequestMapper requestMapper;
    private MemberMapper memberMapper;
    private ResourceMapper resourceMapper;
    private ResourceRequestService service;

    @BeforeEach
    void setUp() {
        requestMapper = mock(ResourceRequestMapper.class);
        memberMapper = mock(MemberMapper.class);
        resourceMapper = mock(ResourceMapper.class);
        service = new ResourceRequestService(requestMapper, memberMapper, resourceMapper);

        when(memberMapper.findById(STAFF_ID)).thenReturn(member(STAFF_ID, "STAFF", MY_DEPT));
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("RESPONDING", STAFF_ID));
        when(resourceMapper.findStockById(STOCK_ID)).thenReturn(stock(OTHER_DEPT, 10, "ACTIVE"));
        when(requestMapper.countRecentSame(anyLong(), anyLong(), anyLong(), anyInt(), any(), anyInt())).thenReturn(0);
    }

    // ---------- 생성 ----------

    @Test
    void 정상_요청은_사건을_잠근_뒤_재고를_읽고_요청과_이력을_저장한다() {
        ResourceRequest saved = new ResourceRequest();
        when(requestMapper.findById(any())).thenReturn(saved);
        // insertRequest가 새 ID를 채워주는 것처럼 동작
        org.mockito.Mockito.doAnswer(invocation -> {
            ((ResourceRequest) invocation.getArgument(0)).setRequestId(500L);
            return 1;
        }).when(requestMapper).insertRequest(any(ResourceRequest.class));

        ResourceRequest result = service.createRequest(STAFF_ID, create(3, "  침수 지역 배수  ", null));

        assertSame(saved, result);
        InOrder order = inOrder(requestMapper, resourceMapper);
        order.verify(requestMapper).lockIncident(INCIDENT_ID);
        order.verify(resourceMapper).findStockById(STOCK_ID);
        order.verify(requestMapper).insertRequest(any(ResourceRequest.class));
        order.verify(requestMapper).insertLog(any(ResourceLog.class));

        ArgumentCaptor<ResourceRequest> requestCaptor = ArgumentCaptor.forClass(ResourceRequest.class);
        verify(requestMapper).insertRequest(requestCaptor.capture());
        ResourceRequest inserted = requestCaptor.getValue();
        assertEquals(INCIDENT_ID, inserted.getIncidentId());
        assertEquals(STOCK_ID, inserted.getStockId());
        assertEquals(STAFF_ID, inserted.getRequesterId());
        assertEquals(3, inserted.getQuantity());
        assertEquals("침수 지역 배수", inserted.getReason());

        ArgumentCaptor<ResourceLog> logCaptor = ArgumentCaptor.forClass(ResourceLog.class);
        verify(requestMapper).insertLog(logCaptor.capture());
        ResourceLog log = logCaptor.getValue();
        assertEquals(500L, log.getRequestId());
        assertNull(log.getPrevStatus());
        assertEquals("REQUESTED", log.getNewStatus());
        assertEquals("CREATE", log.getAction());
        assertEquals(STAFF_ID, log.getChangedBy());
    }

    @Test
    void 요청_생성은_정해진_조회와_저장만_하고_재고를_바꾸지_않는다() {
        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());

        service.createRequest(STAFF_ID, create(3, "사유", null));

        // 호출된 것이 아래뿐인지 확인한다. 재고는 잠금 없이 읽기만 하고(재고 매퍼에는 읽기 메서드만 호출) 바꾸지 않는다.
        verify(requestMapper).lockIncident(INCIDENT_ID);
        verify(resourceMapper).findStockById(STOCK_ID);
        verify(requestMapper).countRecentSame(INCIDENT_ID, STOCK_ID, STAFF_ID, 3, "사유", 10);
        verify(requestMapper).insertRequest(any(ResourceRequest.class));
        verify(requestMapper).insertLog(any(ResourceLog.class));
        verify(requestMapper).findById(any());
        org.mockito.Mockito.verifyNoMoreInteractions(requestMapper, resourceMapper);
    }

    @Test
    void 시민USER와_ADMIN은_요청을_만들_수_없다() {
        when(memberMapper.findById(11L)).thenReturn(member(11L, "USER", MY_DEPT));
        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));

        assertThrows(AccessDeniedException.class, () -> service.createRequest(11L, create(1, "사유", null)));
        assertThrows(AccessDeniedException.class, () -> service.createRequest(12L, create(1, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 탈퇴했거나_없는_회원은_요청을_만들_수_없다() {
        Member withdrawn = member(13L, "STAFF", MY_DEPT);
        withdrawn.setIsWithdrawn("Y");
        when(memberMapper.findById(13L)).thenReturn(withdrawn);

        assertThrows(IllegalArgumentException.class, () -> service.createRequest(13L, create(1, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(999L, create(1, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(null, create(1, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 소속_부서가_없는_STAFF도_요청할_수_있다() {
        when(memberMapper.findById(14L)).thenReturn(member(14L, "STAFF", null));
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("RESPONDING", 14L));
        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());

        service.createRequest(14L, create(1, "사유", null));

        verify(requestMapper).insertRequest(any(ResourceRequest.class));
    }

    @Test
    void 존재하지_않는_사건이면_거절한다() {
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(1, "사유", null)));
        verify(resourceMapper, never()).findStockById(any());
    }

    @Test
    void 종료된_사건에는_요청할_수_없다() {
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("CLOSED", STAFF_ID));

        assertThrows(IllegalStateException.class, () -> service.createRequest(STAFF_ID, create(1, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 담당자가_없는_사건에는_요청할_수_없다() {
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("RECEIVED", null));

        assertThrows(IllegalStateException.class, () -> service.createRequest(STAFF_ID, create(1, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 사건_담당자가_아닌_STAFF는_요청할_수_없다() {
        when(requestMapper.lockIncident(INCIDENT_ID)).thenReturn(incident("RESPONDING", 77L));

        assertThrows(AccessDeniedException.class, () -> service.createRequest(STAFF_ID, create(1, "사유", null)));
        verify(resourceMapper, never()).findStockById(any());
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 존재하지_않는_재고면_거절한다() {
        when(resourceMapper.findStockById(STOCK_ID)).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(1, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 사용_중지된_재고는_요청할_수_없다() {
        when(resourceMapper.findStockById(STOCK_ID)).thenReturn(stock(OTHER_DEPT, 10, "INACTIVE"));

        assertThrows(IllegalStateException.class, () -> service.createRequest(STAFF_ID, create(1, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
    }

    @Test
    void 같은_부서_재고도_요청할_수_있다() {
        // 승인은 ADMIN이 하므로 요청자 부서와 재고 부서가 같아도 자기 승인이 되지 않는다
        when(resourceMapper.findStockById(STOCK_ID)).thenReturn(stock(MY_DEPT, 10, "ACTIVE"));
        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());

        service.createRequest(STAFF_ID, create(1, "사유", null));

        verify(requestMapper).insertRequest(any(ResourceRequest.class));
        verify(requestMapper).insertLog(any(ResourceLog.class));
    }

    @Test
    void 요청_수량이_보유_총량을_넘으면_거절하고_같으면_허용한다() {
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(11, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());

        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());
        service.createRequest(STAFF_ID, create(10, "사유", null));
        verify(requestMapper).insertRequest(any(ResourceRequest.class));
    }

    @Test
    void 같은_내용의_요청이_방금_접수됐으면_더블클릭으로_보고_거절한다() {
        when(requestMapper.countRecentSame(INCIDENT_ID, STOCK_ID, STAFF_ID, 3, "사유", 10)).thenReturn(1);

        assertThrows(IllegalStateException.class, () -> service.createRequest(STAFF_ID, create(3, "사유", null)));
        verify(requestMapper, never()).insertRequest(any());
        verify(requestMapper, never()).insertLog(any());
    }

    @Test
    void 중복_판단은_공백을_뺀_사유로_하고_수량이나_사유가_다르면_다른_요청이다() {
        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());
        // 수량 3·사유 "사유"인 요청만 방금 접수된 상태
        when(requestMapper.countRecentSame(INCIDENT_ID, STOCK_ID, STAFF_ID, 3, "사유", 10)).thenReturn(1);

        // 사유 앞뒤 공백만 다른 같은 요청 → 중복
        assertThrows(IllegalStateException.class, () -> service.createRequest(STAFF_ID, create(3, "  사유 ", null)));
        // 수량이 다르면 정상적인 추가 요청
        service.createRequest(STAFF_ID, create(2, "사유", null));
        // 사유가 다르면 정상적인 추가 요청
        service.createRequest(STAFF_ID, create(3, "다른 사유", null));

        verify(requestMapper, org.mockito.Mockito.times(2)).insertRequest(any(ResourceRequest.class));
    }

    @Test
    void 입력값이_올바르지_않으면_사건을_잠그기_전에_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, null));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID,
                new ResourceRequestCreateRequest(null, STOCK_ID, 1, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID,
                new ResourceRequestCreateRequest(INCIDENT_ID, null, 1, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(0, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(-5, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID,
                new ResourceRequestCreateRequest(INCIDENT_ID, STOCK_ID, null, "사유", null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(1, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.createRequest(STAFF_ID, create(1, "   ", null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.createRequest(STAFF_ID, create(1, "가".repeat(501), null)));
        verify(requestMapper, never()).lockIncident(any());
    }

    @Test
    void 사유가_500자면_허용한다() {
        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());

        service.createRequest(STAFF_ID, create(1, "가".repeat(500), null));

        verify(requestMapper).insertRequest(any(ResourceRequest.class));
    }

    @Test
    void 필요_시각이_과거면_거절하고_미래거나_없으면_허용한다() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createRequest(STAFF_ID, create(1, "사유", LocalDateTime.now().minusHours(1))));
        verify(requestMapper, never()).insertRequest(any());

        when(requestMapper.findById(any())).thenReturn(new ResourceRequest());
        service.createRequest(STAFF_ID, create(1, "사유", LocalDateTime.now().plusHours(2)));
        service.createRequest(STAFF_ID, create(1, "사유", null));
        verify(requestMapper, org.mockito.Mockito.times(2)).insertRequest(any(ResourceRequest.class));
    }

    // ---------- 목록 ----------

    @Test
    void STAFF_조회는_내가_보낸_요청만이다() {
        when(requestMapper.countRequests(any(), any(), any())).thenReturn(1L);
        when(requestMapper.findRequests(any(), any(), any(), anyInt(), anyInt())).thenReturn(List.of(new ResourceRequest()));

        ResourceRequestPageResponse result = service.getRequests(STAFF_ID, null, null, null, null);

        verify(requestMapper).countRequests(STAFF_ID, null, null);
        verify(requestMapper).findRequests(STAFF_ID, null, null, 0, 10);
        assertEquals(1, result.total());
        assertEquals(1, result.page());
        assertEquals(10, result.size());
    }

    @Test
    void 소속_부서가_없는_STAFF도_내가_보낸_요청을_본다() {
        when(memberMapper.findById(14L)).thenReturn(member(14L, "STAFF", null));
        when(requestMapper.countRequests(any(), any(), any())).thenReturn(0L);

        service.getRequests(14L, null, null, null, null);

        verify(requestMapper).countRequests(14L, null, null);
    }

    @Test
    void ADMIN은_제한없이_전체를_조회한다() {
        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));
        when(requestMapper.countRequests(any(), any(), any())).thenReturn(0L);

        service.getRequests(12L, "approved", 100L, null, null);

        verify(requestMapper).countRequests(null, "APPROVED", 100L);
    }

    @Test
    void 시민USER는_목록을_볼_수_없다() {
        when(memberMapper.findById(11L)).thenReturn(member(11L, "USER", null));

        assertThrows(AccessDeniedException.class, () -> service.getRequests(11L, null, null, null, null));
        verify(requestMapper, never()).countRequests(any(), any(), any());
    }

    @Test
    void 올바르지_않은_상태는_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> service.getRequests(STAFF_ID, "DONE", null, null, null));
        verify(requestMapper, never()).countRequests(any(), any(), any());
    }

    @Test
    void 상태_ALL은_전체를_뜻한다() {
        when(requestMapper.countRequests(any(), any(), any())).thenReturn(0L);

        service.getRequests(STAFF_ID, "ALL", null, null, null);

        verify(requestMapper).countRequests(STAFF_ID, null, null);
    }

    @Test
    void 페이지와_크기는_범위로_보정한다() {
        when(requestMapper.countRequests(any(), any(), any())).thenReturn(1000L);
        when(requestMapper.findRequests(any(), any(), any(), anyInt(), anyInt())).thenReturn(List.of());

        ResourceRequestPageResponse tooSmall = service.getRequests(STAFF_ID, null, null, -3, 0);
        assertEquals(1, tooSmall.page());
        assertEquals(1, tooSmall.size());
        verify(requestMapper).findRequests(STAFF_ID, null, null, 0, 1);

        ResourceRequestPageResponse tooBig = service.getRequests(STAFF_ID, null, null, 3, 9999);
        assertEquals(50, tooBig.size());
        verify(requestMapper).findRequests(STAFF_ID, null, null, 100, 150);

        ResourceRequestPageResponse hugePage = service.getRequests(STAFF_ID, null, null, Integer.MAX_VALUE, 50);
        assertEquals(ResourceRequestService.MAX_PAGE, hugePage.page());
    }

    @Test
    void 조건에_맞는_요청이_없으면_목록_쿼리를_부르지_않는다() {
        when(requestMapper.countRequests(any(), any(), any())).thenReturn(0L);

        ResourceRequestPageResponse result = service.getRequests(STAFF_ID, null, null, null, null);

        assertTrue(result.items().isEmpty());
        verify(requestMapper, never()).findRequests(any(), any(), any(), anyInt(), anyInt());
    }

    // ---------- 상세·이력 ----------

    @Test
    void 요청한_본인과_ADMIN은_상세를_볼_수_있다() {
        ResourceRequest found = request(77L, STAFF_ID, OTHER_DEPT);
        when(requestMapper.findById(77L)).thenReturn(found);
        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));

        assertSame(found, service.getRequest(STAFF_ID, 77L));
        assertSame(found, service.getRequest(12L, 77L));
    }

    @Test
    void 다른_STAFF는_같은_부서여도_남의_요청을_볼_수_없다() {
        when(requestMapper.findById(77L)).thenReturn(request(77L, 55L, MY_DEPT));

        assertThrows(AccessDeniedException.class, () -> service.getRequest(STAFF_ID, 77L));
    }

    @Test
    void 없는_요청은_상세를_볼_수_없다() {
        when(requestMapper.findById(404L)).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.getRequest(STAFF_ID, 404L));
        verify(requestMapper, never()).findLogs(any());
    }

    @Test
    void 이력은_상세와_같은_권한으로만_볼_수_있다() {
        when(requestMapper.findById(77L)).thenReturn(request(77L, 55L, OTHER_DEPT));
        List<ResourceLog> logs = List.of(new ResourceLog());
        when(requestMapper.findLogs(77L)).thenReturn(logs);

        assertThrows(AccessDeniedException.class, () -> service.getRequestLogs(STAFF_ID, 77L));
        verify(requestMapper, never()).findLogs(any());

        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));
        assertSame(logs, service.getRequestLogs(12L, 77L));
    }

    // ---------- 도우미 ----------

    private ResourceRequestCreateRequest create(int quantity, String reason, LocalDateTime neededAt) {
        return new ResourceRequestCreateRequest(INCIDENT_ID, STOCK_ID, quantity, reason, neededAt);
    }

    private Member member(long id, String role, Long departmentId) {
        Member member = new Member();
        member.setMemberId(id);
        member.setRole(role);
        member.setDepartmentId(departmentId);
        member.setIsWithdrawn("N");
        return member;
    }

    private Incident incident(String status, Long assignedStaffId) {
        Incident incident = new Incident();
        incident.setIncidentId(INCIDENT_ID);
        incident.setStatus(status);
        incident.setAssignedStaffId(assignedStaffId);
        return incident;
    }

    private ResourceStock stock(long departmentId, int totalQty, String status) {
        ResourceStock stock = new ResourceStock();
        stock.setStockId(STOCK_ID);
        stock.setDepartmentId(departmentId);
        stock.setTotalQty(totalQty);
        stock.setAvailableQty(totalQty);
        stock.setStatus(status);
        return stock;
    }

    private ResourceRequest request(long requestId, long requesterId, long holderDepartmentId) {
        ResourceRequest request = new ResourceRequest();
        request.setRequestId(requestId);
        request.setRequesterId(requesterId);
        request.setDepartmentId(holderDepartmentId);
        return request;
    }
}
