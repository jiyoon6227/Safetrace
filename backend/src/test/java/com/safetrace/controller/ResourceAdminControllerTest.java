package com.safetrace.controller;

import com.safetrace.dto.ResourceItemCreateRequest;
import com.safetrace.dto.ResourceStockAdjustRequest;
import com.safetrace.dto.ResourceStockCreateRequest;
import com.safetrace.dto.ResourceStockReasonRequest;
import com.safetrace.dto.ResourceStockReceiveRequest;
import com.safetrace.service.ResourceAdminService;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;

// @PreAuthorize 권한 규칙과 "처리자 ID는 로그인 정보에서만 가져온다"를 확인한다 (DB·Spring 없이)
class ResourceAdminControllerTest {

    private static final ResourceItemCreateRequest ITEM = new ResourceItemCreateRequest("양수기", "DRAINAGE", "대", "Y", null);
    private static final ResourceStockCreateRequest STOCK = new ResourceStockCreateRequest(1L, 2L, 5, null);
    private static final ResourceStockReceiveRequest RECEIVE = new ResourceStockReceiveRequest(3, null);
    private static final ResourceStockAdjustRequest ADJUST = new ResourceStockAdjustRequest(-1, "사유");
    private static final ResourceStockReasonRequest REASON = new ResourceStockReasonRequest("사유");

    private ResourceAdminService service;
    private ResourceAdminController controller;

    @BeforeEach
    void setUp() {
        service = mock(ResourceAdminService.class);
        ProxyFactory factory = new ProxyFactory(new ResourceAdminController(service));
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        controller = (ResourceAdminController) factory.getProxy();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_재고_관리_API를_쓸수없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertAllDenied(auth("ADMIN", 9L));
        verifyNoInteractions(service);
    }

    @Test
    void STAFF와_시민USER는_재고_관리_API를_쓸수없다() {
        for (String role : List.of("STAFF", "USER")) {
            login(role, 5L);
            assertAllDenied(auth(role, 5L));
        }
        verifyNoInteractions(service);
    }

    @Test
    void ADMIN은_로그인_정보의_ID로_재고를_관리한다() {
        login("ADMIN", 9L);
        Authentication admin = auth("ADMIN", 9L);

        controller.registerItem(ITEM, admin);
        controller.registerStock(STOCK, admin);
        controller.receive(7L, RECEIVE, admin);
        controller.adjust(7L, ADJUST, admin);
        controller.deactivate(7L, REASON, admin);
        controller.reactivate(7L, REASON, admin);

        // body에는 처리자 ID가 없고, 서비스에는 토큰의 memberId가 전달된다
        verify(service).registerItem(9L, ITEM);
        verify(service).registerStock(9L, STOCK);
        verify(service).receive(9L, 7L, RECEIVE);
        verify(service).adjust(9L, 7L, ADJUST);
        verify(service).deactivate(9L, 7L, REASON);
        verify(service).reactivate(9L, 7L, REASON);
    }

    private void assertAllDenied(Authentication authentication) {
        assertThrows(AccessDeniedException.class, () -> controller.registerItem(ITEM, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.registerStock(STOCK, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.receive(7L, RECEIVE, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.adjust(7L, ADJUST, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.deactivate(7L, REASON, authentication));
        assertThrows(AccessDeniedException.class, () -> controller.reactivate(7L, REASON, authentication));
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
