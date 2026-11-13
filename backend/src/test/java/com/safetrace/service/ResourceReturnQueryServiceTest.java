package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceReturn;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceReturnPageResponse;
import com.safetrace.dto.ResourceStatusCount;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceFulfillmentMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 조회 권한과 페이지 계산만 확인한다. 실제 SQL(조인·페이징)은 Oracle 테스트 단계에서 확인한다.
class ResourceReturnQueryServiceTest {

    private static final long ADMIN_ID = 9L;
    private static final long OWNER_ID = 5L;
    private static final long OTHER_ID = 6L;
    private static final long USER_ID = 7L;
    private static final long REQUEST_ID = 100L;

    private ResourceFulfillmentMapper fulfillmentMapper;
    private ResourceRequestMapper requestMapper;
    private MemberMapper memberMapper;
    private ResourceReturnQueryService service;

    @BeforeEach
    void setUp() {
        fulfillmentMapper = mock(ResourceFulfillmentMapper.class);
        requestMapper = mock(ResourceRequestMapper.class);
        memberMapper = mock(MemberMapper.class);
        service = new ResourceReturnQueryService(fulfillmentMapper, requestMapper, memberMapper);

        when(memberMapper.findById(ADMIN_ID)).thenReturn(member(ADMIN_ID, "ADMIN", "N"));
        when(memberMapper.findById(OWNER_ID)).thenReturn(member(OWNER_ID, "STAFF", "N"));
        when(memberMapper.findById(OTHER_ID)).thenReturn(member(OTHER_ID, "STAFF", "N"));
        when(memberMapper.findById(USER_ID)).thenReturn(member(USER_ID, "USER", "N"));
        ResourceRequest request = new ResourceRequest();
        request.setRequestId(REQUEST_ID);
        request.setRequesterId(OWNER_ID);
        when(requestMapper.findById(REQUEST_ID)).thenReturn(request);
    }

    // ================= 요청별 반납 신청 목록 =================

    @Test
    void 요청자_본인과_ADMIN은_반납_신청_목록을_볼_수_있다() {
        List<ResourceReturn> rows = List.of(new ResourceReturn());
        when(fulfillmentMapper.findReturnsByRequest(REQUEST_ID)).thenReturn(rows);

        assertSame(rows, service.getReturnApplications(OWNER_ID, REQUEST_ID));
        assertSame(rows, service.getReturnApplications(ADMIN_ID, REQUEST_ID));
    }

    @Test
    void 다른_STAFF와_시민은_볼_수_없다() {
        assertThrows(AccessDeniedException.class, () -> service.getReturnApplications(OTHER_ID, REQUEST_ID));
        assertThrows(AccessDeniedException.class, () -> service.getReturnApplications(USER_ID, REQUEST_ID));
        verify(fulfillmentMapper, never()).findReturnsByRequest(anyLong());
    }

    @Test
    void 없는_요청이나_없는_조회자는_400이다() {
        when(requestMapper.findById(999L)).thenReturn(null);
        when(memberMapper.findById(8L)).thenReturn(null);
        when(memberMapper.findById(4L)).thenReturn(member(4L, "ADMIN", "Y"));

        assertThrows(IllegalArgumentException.class, () -> service.getReturnApplications(ADMIN_ID, 999L));
        assertThrows(IllegalArgumentException.class, () -> service.getReturnApplications(8L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.getReturnApplications(4L, REQUEST_ID));
        assertThrows(IllegalArgumentException.class, () -> service.getReturnApplications(null, REQUEST_ID));
        verify(fulfillmentMapper, never()).findReturnsByRequest(anyLong());
    }

    // ================= ADMIN 반납 확인함 =================

    @Test
    void 확인함은_ADMIN만_볼_수_있다() {
        assertThrows(AccessDeniedException.class, () -> service.getReturnInbox(OWNER_ID, null, null, null));
        assertThrows(AccessDeniedException.class, () -> service.getReturnInbox(USER_ID, null, null, null));
        verify(fulfillmentMapper, never()).countReturns(any());
    }

    @Test
    void 상태를_주지_않으면_대기중만_첫_페이지_10건으로_조회한다() {
        List<ResourceReturn> rows = List.of(new ResourceReturn(), new ResourceReturn());
        when(fulfillmentMapper.countReturns("PENDING")).thenReturn(2L);
        when(fulfillmentMapper.findReturns("PENDING", 0, 10)).thenReturn(rows);

        ResourceReturnPageResponse result = service.getReturnInbox(ADMIN_ID, null, null, null);

        assertSame(rows, result.items());
        assertEquals(2L, result.total());
        assertEquals(1, result.page());
        assertEquals(10, result.size());
    }

    @Test
    void ALL이면_상태_조건_없이_조회하고_소문자도_받는다() {
        when(fulfillmentMapper.countReturns(null)).thenReturn(1L);
        when(fulfillmentMapper.findReturns(null, 0, 10)).thenReturn(List.of(new ResourceReturn()));
        service.getReturnInbox(ADMIN_ID, "ALL", 1, 10);
        verify(fulfillmentMapper).findReturns(null, 0, 10);

        when(fulfillmentMapper.countReturns("CONFIRMED")).thenReturn(0L);
        service.getReturnInbox(ADMIN_ID, " confirmed ", 1, 10);
        verify(fulfillmentMapper).countReturns("CONFIRMED");
    }

    @Test
    void 올바르지_않은_상태는_400이다() {
        assertThrows(IllegalArgumentException.class, () -> service.getReturnInbox(ADMIN_ID, "DONE", 1, 10));
        verify(fulfillmentMapper, never()).countReturns(any());
    }

    @Test
    void 페이지와_크기는_범위로_보정하고_행_범위를_계산한다() {
        when(fulfillmentMapper.countReturns("PENDING")).thenReturn(500L);

        // 3페이지, 20건 → 20 ~ 60 (시작 포함 끝 미포함이 아니라 서비스가 넘기는 offset, end 값)
        service.getReturnInbox(ADMIN_ID, "PENDING", 3, 20);
        verify(fulfillmentMapper).findReturns("PENDING", 40, 60);

        // 0·음수 페이지는 1로, 너무 큰 크기는 50으로, 0 크기는 1로
        ResourceReturnPageResponse low = service.getReturnInbox(ADMIN_ID, "PENDING", 0, 0);
        assertEquals(1, low.page());
        assertEquals(1, low.size());
        ResourceReturnPageResponse high = service.getReturnInbox(ADMIN_ID, "PENDING", -5, 999);
        assertEquals(1, high.page());
        assertEquals(50, high.size());
        ResourceReturnPageResponse far = service.getReturnInbox(ADMIN_ID, "PENDING", 99999, 10);
        assertEquals(ResourceReturnQueryService.MAX_PAGE, far.page());
    }

    @Test
    void 결과가_없으면_목록_조회_없이_빈_목록을_돌려준다() {
        when(fulfillmentMapper.countReturns("PENDING")).thenReturn(0L);

        ResourceReturnPageResponse result = service.getReturnInbox(ADMIN_ID, null, null, null);

        assertTrue(result.items().isEmpty());
        assertEquals(0L, result.total());
        verify(fulfillmentMapper, never()).findReturns(any(), anyInt(), anyInt());
    }

    @Test
    void 조회_메서드는_읽기_전용_트랜잭션이다() {
        List<String> names = List.of("getReturnApplications", "getReturnInbox", "getReturnSummary");
        List<Method> found = Arrays.stream(ResourceReturnQueryService.class.getDeclaredMethods())
                .filter(method -> names.contains(method.getName()))
                .toList();
        for (Method method : found) {
            assertTrue(isReadOnly(method), method.getName() + "은 readOnly 트랜잭션이어야 합니다.");
        }
        assertEquals(names.size(), found.size());
    }

    @Test
    void 반납_현황은_ADMIN만_볼_수_있다() {
        assertThrows(AccessDeniedException.class, () -> service.getReturnSummary(OWNER_ID));
        assertThrows(AccessDeniedException.class, () -> service.getReturnSummary(USER_ID));
        verify(fulfillmentMapper, never()).countReturnsByStatus();
    }

    @Test
    void 반납_현황은_없는_상태를_0으로_채우고_합계를_낸다() {
        when(fulfillmentMapper.countReturnsByStatus()).thenReturn(List.of(count("CONFIRMED", 3), count("PENDING", 2)));

        ResourceRequestSummaryResponse result = service.getReturnSummary(ADMIN_ID);

        assertEquals(5L, result.total());
        assertEquals(List.of("PENDING", "CONFIRMED", "REJECTED"), List.copyOf(result.counts().keySet()));
        assertEquals(2L, result.counts().get("PENDING"));
        assertEquals(3L, result.counts().get("CONFIRMED"));
        assertEquals(0L, result.counts().get("REJECTED"));
    }

    private ResourceStatusCount count(String status, long value) {
        ResourceStatusCount row = new ResourceStatusCount();
        row.setStatus(status);
        row.setRequestCount(value);
        return row;
    }

    private boolean isReadOnly(Method method) {
        Transactional annotation = method.getAnnotation(Transactional.class);
        return annotation != null && annotation.readOnly();
    }

    private Member member(long id, String role, String withdrawn) {
        Member member = new Member();
        member.setMemberId(id);
        member.setRole(role);
        member.setIsWithdrawn(withdrawn);
        return member;
    }
}
