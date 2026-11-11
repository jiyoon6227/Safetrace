package com.safetrace.controller;

import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.service.ResourceApprovalService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

// @PreAuthorize 권한 규칙과 "처리자 ID는 로그인 정보에서만 가져온다"를 확인한다 (DB·Spring 없이)
class ResourceApprovalControllerTest {

    private static final ResourceRequestRejectRequest REJECT = new ResourceRequestRejectRequest("사유");

    private ResourceApprovalService service;
    private ResourceApprovalController controller;

    @BeforeEach
    void setUp() {
        service = mock(ResourceApprovalService.class);
        ProxyFactory factory = new ProxyFactory(new ResourceApprovalController(service));
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        controller = (ResourceApprovalController) factory.getProxy();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_승인_반려_취소를_할_수_없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        Authentication authentication = auth("ADMIN", 9L);

        assertThrows(AccessDeniedException.class, () -> controller.approve(1L, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.reject(1L, REJECT, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.cancel(1L, authentication));
        verifyNoInteractions(service);
    }

    @Test
    void 시민USER는_승인_반려_취소를_할_수_없다() {
        login("USER", 7L);
        Authentication authentication = auth("USER", 7L);

        assertThrows(AccessDeniedException.class, () -> controller.approve(1L, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.reject(1L, REJECT, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.cancel(1L, authentication));
        verifyNoInteractions(service);
    }

    @Test
    void STAFF는_취소만_할_수_있고_승인과_반려는_403이다() {
        login("STAFF", 5L);
        Authentication staff = auth("STAFF", 5L);

        assertThrows(AccessDeniedException.class, () -> controller.approve(1L, staff));
        assertThrows(AccessDeniedException.class, () -> controller.reject(1L, REJECT, staff));

        controller.cancel(1L, staff);
        verify(service).cancel(5L, 1L);
    }

    @Test
    void ADMIN은_로그인_정보의_ID로_승인_반려_취소를_한다() {
        login("ADMIN", 9L);
        Authentication admin = auth("ADMIN", 9L);

        controller.approve(1L, admin);
        controller.reject(2L, REJECT, admin);
        controller.cancel(3L, admin);

        // 처리자 ID는 body가 아니라 토큰의 memberId로 서비스에 전달된다
        verify(service).approve(9L, 1L);
        verify(service).reject(9L, 2L, REJECT);
        verify(service).cancel(9L, 3L);
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
