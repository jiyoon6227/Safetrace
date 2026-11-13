package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStock;
import com.safetrace.dto.ResourceRequestCreateRequest;
import com.safetrace.dto.ResourceRequestPageResponse;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceStatusCount;
import com.safetrace.dto.ResourceTimelineStep;
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
import java.util.Map;

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
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(1L);
        when(requestMapper.findRequests(any(), any(), any(), any(), anyInt(), anyInt())).thenReturn(List.of(new ResourceRequest()));

        ResourceRequestPageResponse result = service.getRequests(STAFF_ID, null, null, null, null, null);

        verify(requestMapper).countRequests(STAFF_ID, null, null, null);
        verify(requestMapper).findRequests(STAFF_ID, null, null, null, 0, 10);
        assertEquals(1, result.total());
        assertEquals(1, result.page());
        assertEquals(10, result.size());
    }

    @Test
    void 소속_부서가_없는_STAFF도_내가_보낸_요청을_본다() {
        when(memberMapper.findById(14L)).thenReturn(member(14L, "STAFF", null));
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(0L);

        service.getRequests(14L, null, null, null, null, null);

        verify(requestMapper).countRequests(14L, null, null, null);
    }

    @Test
    void ADMIN은_제한없이_전체를_조회한다() {
        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(0L);

        service.getRequests(12L, "approved", 100L, null, null, null);

        verify(requestMapper).countRequests(null, "APPROVED", 100L, null);
    }

    @Test
    void 시민USER는_목록을_볼_수_없다() {
        when(memberMapper.findById(11L)).thenReturn(member(11L, "USER", null));

        assertThrows(AccessDeniedException.class, () -> service.getRequests(11L, null, null, null, null, null));
        verify(requestMapper, never()).countRequests(any(), any(), any(), any());
    }

    @Test
    void 올바르지_않은_상태는_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> service.getRequests(STAFF_ID, "DONE", null, null, null, null));
        verify(requestMapper, never()).countRequests(any(), any(), any(), any());
    }

    @Test
    void 상태_ALL은_전체를_뜻한다() {
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(0L);

        service.getRequests(STAFF_ID, "ALL", null, null, null, null);

        verify(requestMapper).countRequests(STAFF_ID, null, null, null);
    }

    @Test
    void 페이지와_크기는_범위로_보정한다() {
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(1000L);
        when(requestMapper.findRequests(any(), any(), any(), any(), anyInt(), anyInt())).thenReturn(List.of());

        ResourceRequestPageResponse tooSmall = service.getRequests(STAFF_ID, null, null, null, -3, 0);
        assertEquals(1, tooSmall.page());
        assertEquals(1, tooSmall.size());
        verify(requestMapper).findRequests(STAFF_ID, null, null, null, 0, 1);

        ResourceRequestPageResponse tooBig = service.getRequests(STAFF_ID, null, null, null, 3, 9999);
        assertEquals(50, tooBig.size());
        verify(requestMapper).findRequests(STAFF_ID, null, null, null, 100, 150);

        ResourceRequestPageResponse hugePage = service.getRequests(STAFF_ID, null, null, null, Integer.MAX_VALUE, 50);
        assertEquals(ResourceRequestService.MAX_PAGE, hugePage.page());
    }

    @Test
    void 조건에_맞는_요청이_없으면_목록_쿼리를_부르지_않는다() {
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(0L);

        ResourceRequestPageResponse result = service.getRequests(STAFF_ID, null, null, null, null, null);

        assertTrue(result.items().isEmpty());
        verify(requestMapper, never()).findRequests(any(), any(), any(), any(), anyInt(), anyInt());
    }

    // ---------- 검색어 · 상태별 건수 ----------

    @Test
    void 검색어는_다듬고_LIKE_특수문자를_이스케이프해서_넘긴다() {
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(0L);

        service.getRequests(STAFF_ID, null, null, "  발전기  ", null, null);
        verify(requestMapper).countRequests(STAFF_ID, null, null, "발전기");

        service.getRequests(STAFF_ID, null, null, "50%_a\\b", null, null);
        verify(requestMapper).countRequests(STAFF_ID, null, null, "50\\%\\_a\\\\b");
    }

    @Test
    void 빈_검색어는_조건없음이고_너무_긴_검색어는_50자로_자른다() {
        when(requestMapper.countRequests(any(), any(), any(), any())).thenReturn(0L);

        service.getRequests(STAFF_ID, null, null, "   ", null, null);
        verify(requestMapper).countRequests(STAFF_ID, null, null, null);

        service.getRequests(STAFF_ID, null, null, "가".repeat(80), null, null);
        verify(requestMapper).countRequests(STAFF_ID, null, null, "가".repeat(ResourceRequestService.MAX_KEYWORD_LENGTH));
    }

    @Test
    void 상태별_건수는_없는_상태도_0으로_채우고_정해진_순서로_준다() {
        when(requestMapper.countRequestsByStatus(STAFF_ID, 100L, "발전기"))
                .thenReturn(List.of(statusCount("DISPATCHED", 1), statusCount("REQUESTED", 2)));

        ResourceRequestSummaryResponse result = service.getRequestSummary(STAFF_ID, 100L, " 발전기 ");

        assertEquals(3, result.total());
        assertEquals(List.of("REQUESTED", "APPROVED", "DISPATCHED", "SETTLED", "COMPLETED", "REJECTED", "CANCELLED"),
                List.copyOf(result.counts().keySet()));
        assertEquals(Map.of("REQUESTED", 2L, "APPROVED", 0L, "DISPATCHED", 1L, "SETTLED", 0L,
                "COMPLETED", 0L, "REJECTED", 0L, "CANCELLED", 0L), result.counts());
    }

    @Test
    void 요청이_하나도_없으면_상태별_건수는_모두_0이다() {
        when(requestMapper.countRequestsByStatus(any(), any(), any())).thenReturn(List.of());

        ResourceRequestSummaryResponse result = service.getRequestSummary(STAFF_ID, null, null);

        assertEquals(0, result.total());
        assertEquals(7, result.counts().size());
        assertTrue(result.counts().values().stream().allMatch(count -> count == 0L));
    }

    @Test
    void ADMIN의_상태별_건수는_제한없이_전체이고_시민USER는_볼_수_없다() {
        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));
        when(requestMapper.countRequestsByStatus(any(), any(), any())).thenReturn(List.of());

        service.getRequestSummary(12L, null, null);
        verify(requestMapper).countRequestsByStatus(null, null, null);

        when(memberMapper.findById(11L)).thenReturn(member(11L, "USER", null));
        assertThrows(AccessDeniedException.class, () -> service.getRequestSummary(11L, null, null));
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

    // ---------- 버튼 가능 여부·반납 가능 수량·타임라인 (서버가 판단) ----------

    @Test
    void 출고된_반납형_내_요청은_도착확인과_반납신청이_모두_가능하고_반납가능수량을_계산한다() {
        ResourceRequest found = dispatched(77L, STAFF_ID, "Y");
        found.setQuantity(10);
        found.setReturnedQty(3);
        found.setLostQty(1);
        found.setPendingReturnQty(2);
        when(requestMapper.findById(77L)).thenReturn(found);

        ResourceRequest result = service.getRequest(STAFF_ID, 77L);

        assertTrue(result.isCanArrive());
        assertTrue(result.isCanApplyReturn());
        assertEquals(4, result.getApplicableReturnQty());
    }

    @Test
    void 반납가능수량은_음수가_되지_않고_값이_비어_있으면_0으로_본다() {
        ResourceRequest found = dispatched(77L, STAFF_ID, "Y");
        found.setQuantity(2);
        found.setPendingReturnQty(5);
        when(requestMapper.findById(77L)).thenReturn(found);
        assertEquals(0, service.getRequest(STAFF_ID, 77L).getApplicableReturnQty());

        ResourceRequest empty = dispatched(78L, STAFF_ID, "Y");
        empty.setQuantity(6);
        when(requestMapper.findById(78L)).thenReturn(empty);
        assertEquals(6, service.getRequest(STAFF_ID, 78L).getApplicableReturnQty());
    }

    @Test
    void 도착확인은_이미_했거나_출고_전이면_불가하고_정산_뒤에도_안_했으면_가능하다() {
        ResourceRequest arrived = dispatched(77L, STAFF_ID, "Y");
        arrived.setArrivedAt(LocalDateTime.now());
        ResourceRequest approved = dispatched(78L, STAFF_ID, "Y");
        approved.setStatus("APPROVED");
        ResourceRequest settled = dispatched(79L, STAFF_ID, "Y");
        settled.setStatus("SETTLED");
        when(requestMapper.findById(77L)).thenReturn(arrived);
        when(requestMapper.findById(78L)).thenReturn(approved);
        when(requestMapper.findById(79L)).thenReturn(settled);

        assertEquals(false, service.getRequest(STAFF_ID, 77L).isCanArrive());
        assertEquals(false, service.getRequest(STAFF_ID, 78L).isCanArrive());
        assertTrue(service.getRequest(STAFF_ID, 79L).isCanArrive());
        assertEquals(false, service.getRequest(STAFF_ID, 79L).isCanApplyReturn());
    }

    @Test
    void 소모품은_반납신청이_불가하고_도착확인만_가능하다() {
        ResourceRequest consumable = dispatched(77L, STAFF_ID, "N");
        consumable.setStatus("COMPLETED");
        when(requestMapper.findById(77L)).thenReturn(consumable);

        ResourceRequest result = service.getRequest(STAFF_ID, 77L);

        assertTrue(result.isCanArrive());
        assertEquals(false, result.isCanApplyReturn());
    }

    @Test
    void ADMIN이_볼_때는_도착확인과_반납신청_버튼이_모두_꺼진다() {
        when(requestMapper.findById(77L)).thenReturn(dispatched(77L, STAFF_ID, "Y"));
        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));

        ResourceRequest result = service.getRequest(12L, 77L);

        assertEquals(false, result.isCanArrive());
        assertEquals(false, result.isCanApplyReturn());
    }

    @Test
    void 목록의_모든_요청에_버튼_가능_여부가_채워진다() {
        when(requestMapper.countRequests(STAFF_ID, null, null, null)).thenReturn(1L);
        when(requestMapper.findRequests(STAFF_ID, null, null, null, 0, 10))
                .thenReturn(List.of(dispatched(77L, STAFF_ID, "Y")));

        ResourceRequest first = service.getRequests(STAFF_ID, null, null, null, null, null).items().get(0);

        assertTrue(first.isCanArrive());
        assertTrue(first.isCanApplyReturn());
    }

    @Test
    void 타임라인은_기록된_처리_뒤에_남은_단계를_붙이고_첫_단계를_현재로_표시한다() {
        ResourceRequest found = request(77L, STAFF_ID, OTHER_DEPT);
        found.setStatus("REQUESTED");
        when(requestMapper.findById(77L)).thenReturn(found);
        when(requestMapper.findLogs(77L)).thenReturn(List.of(log(1L, "CREATE", null)));

        List<ResourceTimelineStep> steps = service.getRequestTimeline(STAFF_ID, 77L);

        assertEquals(4, steps.size());
        assertEquals("요청 등록", steps.get(0).label());
        assertTrue(steps.get(0).done());
        assertEquals("승인", steps.get(1).label());
        assertTrue(steps.get(1).current());
        assertEquals("자원 관리자의 승인을 기다리고 있습니다.", steps.get(1).note());
        assertEquals("출고", steps.get(2).label());
        assertEquals(false, steps.get(2).current());
        assertEquals("도착 확인", steps.get(3).label());
        assertEquals(false, steps.get(3).current());
    }

    @Test
    void 타임라인은_출고된_반납형이면_도착확인과_반납신청이_남고_이미_한_단계는_빠진다() {
        ResourceRequest found = dispatched(77L, STAFF_ID, "Y");
        when(requestMapper.findById(77L)).thenReturn(found);
        when(requestMapper.findLogs(77L)).thenReturn(List.of(log(1L, "CREATE", null), log(2L, "DISPATCH", "출고함")));

        List<ResourceTimelineStep> steps = service.getRequestTimeline(STAFF_ID, 77L);

        assertEquals(List.of("요청 등록", "출고", "도착 확인", "반납 신청"),
                steps.stream().map(ResourceTimelineStep::label).toList());
        assertEquals("출고함", steps.get(1).note());
        assertTrue(steps.get(2).current());

        // 도착 확인·반납 신청이 이미 기록돼 있어도, 반납이 끝나지 않았으면 남은 수량 정산이 마지막에 남는다
        when(requestMapper.findLogs(77L)).thenReturn(List.of(log(1L, "CREATE", null), log(3L, "ARRIVE", null),
                log(4L, "RETURN_APPLY", null)));
        List<ResourceTimelineStep> applied = service.getRequestTimeline(STAFF_ID, 77L);
        assertEquals(4, applied.size());
        assertEquals("남은 수량 정산", applied.get(3).label());
        assertTrue(applied.get(3).current());
    }

    @Test
    void 타임라인은_일부만_반납된_출고_요청에_반납_진행과_남은_수량을_안내한다() {
        ResourceRequest found = dispatched(77L, STAFF_ID, "Y");
        found.setQuantity(2);
        found.setUnit("대");
        found.setReturnedQty(1);
        found.setLostQty(0);
        found.setPendingReturnQty(0);
        when(requestMapper.findById(77L)).thenReturn(found);
        when(requestMapper.findLogs(77L)).thenReturn(List.of(log(1L, "CREATE", null), log(3L, "ARRIVE", null),
                log(4L, "RETURN_APPLY", null), log(5L, "RETURN_CONFIRM", null)));

        ResourceTimelineStep last = service.getRequestTimeline(STAFF_ID, 77L).get(4);
        assertEquals("남은 수량 정산", last.label());
        assertEquals(false, last.done());
        assertTrue(last.note().contains("반납 1/2대"));
        assertTrue(last.note().contains("남은 1대"));

        // 남은 수량만큼 확인 대기 중이면 관리자 확인만 기다린다
        found.setPendingReturnQty(1);
        assertTrue(service.getRequestTimeline(STAFF_ID, 77L).get(4).note().contains("확인 대기 중인 반납 1대"));

        // 모두 처리돼 정산이 끝났으면(SETTLED) 남은 단계가 없다
        found.setStatus("SETTLED");
        found.setReturnedQty(2);
        found.setPendingReturnQty(0);
        assertEquals(4, service.getRequestTimeline(STAFF_ID, 77L).size());
    }

    @Test
    void 끝난_요청은_남은_단계가_없고_타임라인은_상세와_같은_권한이다() {
        ResourceRequest rejected = request(77L, 55L, OTHER_DEPT);
        rejected.setStatus("REJECTED");
        when(requestMapper.findById(77L)).thenReturn(rejected);
        when(requestMapper.findLogs(77L)).thenReturn(List.of(log(1L, "REJECT", "수량 부족")));

        assertThrows(AccessDeniedException.class, () -> service.getRequestTimeline(STAFF_ID, 77L));

        when(memberMapper.findById(12L)).thenReturn(member(12L, "ADMIN", null));
        List<ResourceTimelineStep> steps = service.getRequestTimeline(12L, 77L);
        assertEquals(1, steps.size());
        assertEquals("반려", steps.get(0).label());
    }

    // ---------- 도우미 ----------

    private ResourceRequest dispatched(long requestId, long requesterId, String returnable) {
        ResourceRequest request = request(requestId, requesterId, OTHER_DEPT);
        request.setStatus("DISPATCHED");
        request.setReturnable(returnable);
        request.setQuantity(1);
        return request;
    }

    private ResourceLog log(long logId, String action, String memo) {
        ResourceLog log = new ResourceLog();
        log.setLogId(logId);
        log.setAction(action);
        log.setMemo(memo);
        return log;
    }

    private ResourceRequestCreateRequest create(int quantity, String reason, LocalDateTime neededAt) {
        return new ResourceRequestCreateRequest(INCIDENT_ID, STOCK_ID, quantity, reason, neededAt);
    }

    private static ResourceStatusCount statusCount(String status, long count) {
        ResourceStatusCount row = new ResourceStatusCount();
        row.setStatus(status);
        row.setRequestCount(count);
        return row;
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
