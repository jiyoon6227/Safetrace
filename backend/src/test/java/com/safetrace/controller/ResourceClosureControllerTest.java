package com.safetrace.controller;

import com.safetrace.service.ResourceClosureService;
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

// @PreAuthorize 권한 규칙과 "조회자 ID는 로그인 정보에서만 가져온다"를 확인한다 (DB·Spring 없이)
class ResourceClosureControllerTest {

    private ResourceClosureService service;
    private ResourceClosureController controller;

    @BeforeEach
    void setUp() {
        service = mock(ResourceClosureService.class);
        ProxyFactory factory = new ProxyFactory(new ResourceClosureController(service));
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        controller = (ResourceClosureController) factory.getProxy();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_확인_목록을_볼_수_없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThrows(AccessDeniedException.class, () -> controller.getClosurePreview(1L, auth("STAFF", 10L)));
        verifyNoInteractions(service);
    }

    @Test
    void 시민USER와_ADMIN은_확인_목록을_볼_수_없다() {
        login("USER", 7L);
        assertThrows(AccessDeniedException.class, () -> controller.getClosurePreview(1L, auth("USER", 7L)));

        login("ADMIN", 9L);
        assertThrows(AccessDeniedException.class, () -> controller.getClosurePreview(1L, auth("ADMIN", 9L)));
        verifyNoInteractions(service);
    }

    @Test
    void STAFF는_로그인_정보의_ID로_확인_목록을_조회한다() {
        login("STAFF", 10L);

        controller.getClosurePreview(50L, auth("STAFF", 10L));

        // 조회자 ID는 요청 값이 아니라 토큰의 memberId로 전달된다 (담당자 본인인지는 서비스가 다시 확인한다)
        verify(service).getClosurePreview(10L, 50L);
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
