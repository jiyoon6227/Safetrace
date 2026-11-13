package com.safetrace.controller;

import com.safetrace.dto.ResourceRequestCreateRequest;
import com.safetrace.service.ResourceRequestService;
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

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

// @PreAuthorize 권한 규칙과 "요청자 ID는 로그인 정보에서만 가져온다"를 확인한다 (DB·Spring 없이)
class ResourceRequestControllerTest {

    private static final ResourceRequestCreateRequest BODY =
            new ResourceRequestCreateRequest(1L, 2L, 3, "사유", null);

    private ResourceRequestService service;
    private ResourceRequestController controller;

    @BeforeEach
    void setUp() {
        service = mock(ResourceRequestService.class);
        ProxyFactory factory = new ProxyFactory(new ResourceRequestController(service));
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        controller = (ResourceRequestController) factory.getProxy();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_자원_요청_API를_쓸수없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThrows(AccessDeniedException.class, () -> controller.create(BODY, auth("STAFF", 5L)));
        assertThrows(AccessDeniedException.class,
                () -> controller.getRequests(null, null, null, null, null, auth("STAFF", 5L)));
        assertThrows(AccessDeniedException.class, () -> controller.getRequest(1L, auth("STAFF", 5L)));
        assertThrows(AccessDeniedException.class, () -> controller.getRequestLogs(1L, auth("STAFF", 5L)));
        assertThrows(AccessDeniedException.class,
                () -> controller.getRequestSummary(null, null, auth("STAFF", 5L)));
    }

    @Test
    void 시민USER는_자원_요청_API를_쓸수없다() {
        login("USER", 5L);

        assertThrows(AccessDeniedException.class, () -> controller.create(BODY, auth("USER", 5L)));
        assertThrows(AccessDeniedException.class,
                () -> controller.getRequests(null, null, null, null, null, auth("USER", 5L)));
        assertThrows(AccessDeniedException.class, () -> controller.getRequest(1L, auth("USER", 5L)));
        assertThrows(AccessDeniedException.class, () -> controller.getRequestLogs(1L, auth("USER", 5L)));
        assertThrows(AccessDeniedException.class,
                () -> controller.getRequestSummary(null, null, auth("USER", 5L)));
    }

    @Test
    void ADMIN은_조회만_가능하고_요청은_만들수_없다() {
        login("ADMIN", 9L);

        assertThrows(AccessDeniedException.class, () -> controller.create(BODY, auth("ADMIN", 9L)));
        verify(service, never()).createRequest(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        controller.getRequests("REQUESTED", 3L, null, 1, 10, auth("ADMIN", 9L));
        controller.getRequest(1L, auth("ADMIN", 9L));
        controller.getRequestLogs(1L, auth("ADMIN", 9L));
        controller.getRequestTimeline(1L, auth("ADMIN", 9L));
        controller.getRequestSummary(3L, "발전기", auth("ADMIN", 9L));

        verify(service).getRequestSummary(9L, 3L, "발전기");
        verify(service).getRequests(9L, "REQUESTED", 3L, null, 1, 10);
        verify(service).getRequest(9L, 1L);
        verify(service).getRequestLogs(9L, 1L);
        verify(service).getRequestTimeline(9L, 1L);
    }

    @Test
    void STAFF는_로그인_정보의_ID로_요청을_만든다() {
        login("STAFF", 5L);

        controller.create(BODY, auth("STAFF", 5L));

        // body에는 요청자 ID가 없고, 서비스에는 토큰의 memberId가 전달된다
        verify(service).createRequest(5L, BODY);
    }

    @Test
    void STAFF는_조회_API를_쓸수_있다() {
        login("STAFF", 5L);

        controller.getRequests(null, null, null, null, null, auth("STAFF", 5L));
        controller.getRequest(7L, auth("STAFF", 5L));
        controller.getRequestLogs(7L, auth("STAFF", 5L));
        controller.getRequestTimeline(7L, auth("STAFF", 5L));
        controller.getRequestSummary(null, null, auth("STAFF", 5L));

        verify(service).getRequestSummary(5L, null, null);
        verify(service).getRequests(5L, null, null, null, null, null);
        verify(service).getRequest(5L, 7L);
        verify(service).getRequestLogs(5L, 7L);
        verify(service).getRequestTimeline(5L, 7L);
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
