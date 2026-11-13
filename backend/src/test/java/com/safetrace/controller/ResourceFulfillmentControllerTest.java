package com.safetrace.controller;

import com.safetrace.dto.ResourceLossRequest;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.dto.ResourceReturnApplyRequest;
import com.safetrace.service.ResourceFulfillmentService;
import com.safetrace.service.ResourceReturnQueryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

// @PreAuthorize 권한 규칙과 "처리자 ID는 로그인 정보에서만 가져온다"를 확인한다 (DB·Spring 없이)
class ResourceFulfillmentControllerTest {

    private static final ResourceReturnApplyRequest APPLY = new ResourceReturnApplyRequest(1, "메모");
    private static final ResourceRequestRejectRequest REJECT = new ResourceRequestRejectRequest("사유");
    private static final ResourceLossRequest LOSS = new ResourceLossRequest(1, "분실", 0);

    private ResourceFulfillmentService service;
    private ResourceReturnQueryService queryService;
    private ResourceFulfillmentController controller;

    @BeforeEach
    void setUp() {
        service = mock(ResourceFulfillmentService.class);
        queryService = mock(ResourceReturnQueryService.class);
        ProxyFactory factory = new ProxyFactory(new ResourceFulfillmentController(service, queryService));
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        controller = (ResourceFulfillmentController) factory.getProxy();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_어떤_처리도_할_수_없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        Authentication authentication = auth("ADMIN", 9L);

        assertAllDenied(authentication);
        verifyNoInteractions(service, queryService);
    }

    @Test
    void 시민USER는_어떤_처리도_할_수_없다() {
        login("USER", 7L);

        assertAllDenied(auth("USER", 7L));
        verifyNoInteractions(service, queryService);
    }

    @Test
    void STAFF는_도착확인_반납신청_반납신청목록만_할_수_있다() {
        login("STAFF", 5L);
        Authentication staff = auth("STAFF", 5L);

        // ADMIN 전용 기능은 모두 403
        assertThrows(AccessDeniedException.class, () -> controller.dispatch(1L, staff));
        assertThrows(AccessDeniedException.class, () -> controller.getReturnInbox(null, null, null, staff));
        assertThrows(AccessDeniedException.class, () -> controller.getReturnSummary(staff));
        assertThrows(AccessDeniedException.class, () -> controller.confirmReturn(1L, staff));
        assertThrows(AccessDeniedException.class, () -> controller.rejectReturn(1L, REJECT, staff));
        assertThrows(AccessDeniedException.class, () -> controller.confirmLoss(1L, LOSS, staff));
        verifyNoInteractions(service, queryService);

        // 허용된 기능은 로그인 정보의 ID로 서비스에 전달된다
        controller.arrive(1L, staff);
        controller.applyReturn(2L, APPLY, staff);
        controller.getReturnApplications(3L, staff);
        verify(service).arrive(5L, 1L);
        verify(service).applyReturn(5L, 2L, APPLY);
        verify(queryService).getReturnApplications(5L, 3L);
    }

    @Test
    void ADMIN은_반납_신청만_할_수_없고_나머지는_로그인_정보의_ID로_처리한다() {
        login("ADMIN", 9L);
        Authentication admin = auth("ADMIN", 9L);

        // 반납 신청은 요청자 본인(STAFF)만
        assertThrows(AccessDeniedException.class, () -> controller.applyReturn(1L, APPLY, admin));
        verifyNoInteractions(service, queryService);

        controller.dispatch(1L, admin);
        controller.arrive(2L, admin);
        controller.getReturnApplications(3L, admin);
        controller.getReturnInbox("PENDING", 2, 20, admin);
        controller.getReturnSummary(admin);
        controller.confirmReturn(4L, admin);
        controller.rejectReturn(5L, REJECT, admin);
        controller.confirmLoss(6L, LOSS, admin);

        // 처리자 ID는 body가 아니라 토큰의 memberId로 전달된다
        verify(service).dispatch(9L, 1L);
        verify(service).arrive(9L, 2L);
        verify(queryService).getReturnApplications(9L, 3L);
        verify(queryService).getReturnInbox(9L, "PENDING", 2, 20);
        verify(queryService).getReturnSummary(9L);
        verify(service).confirmReturn(9L, 4L);
        verify(service).rejectReturn(9L, 5L, REJECT);
        verify(service).confirmLoss(9L, 6L, LOSS);
    }

    // 모든 엔드포인트가 접근 거부되는지 한꺼번에 확인한다
    private void assertAllDenied(Authentication authentication) {
        List<Consumer<Authentication>> calls = List.of(
                a -> controller.dispatch(1L, a),
                a -> controller.arrive(1L, a),
                a -> controller.applyReturn(1L, APPLY, a),
                a -> controller.getReturnApplications(1L, a),
                a -> controller.getReturnInbox(null, null, null, a),
                a -> controller.getReturnSummary(a),
                a -> controller.confirmReturn(1L, a),
                a -> controller.rejectReturn(1L, REJECT, a),
                a -> controller.confirmLoss(1L, LOSS, a));
        for (Consumer<Authentication> call : calls) {
            assertThrows(AccessDeniedException.class, () -> call.accept(authentication));
        }
    }

    private void login(String role, long memberId) {
        SecurityContextHolder.getContext().setAuthentication(auth(role, memberId));
    }

    // 운영의 JwtAuthenticationFilter처럼 principal에 memberId(Long)를 넣는다
    private Authentication auth(String role, long memberId) {
        return new UsernamePasswordAuthenticationToken(
                memberId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
}
