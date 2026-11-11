package com.safetrace.controller;

import com.safetrace.service.ResourceQueryService;
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

// @PreAuthorize 권한 규칙만 확인한다 (DB·Spring 없이)
class ResourceControllerTest {

    private ResourceQueryService service;
    private ResourceController controller;
    private DepartmentController departmentController;

    @BeforeEach
    void setUp() {
        service = mock(ResourceQueryService.class);
        controller = secured(new ResourceController(service), ResourceController.class);
        departmentController = secured(new DepartmentController(service), DepartmentController.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_자원_API를_쓸수없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThrows(AccessDeniedException.class, () -> controller.getItems());
        assertThrows(AccessDeniedException.class, () -> departmentController.getDepartments());
    }

    @Test
    void 시민USER는_자원_API를_쓸수없다() {
        login("USER");

        assertThrows(AccessDeniedException.class, () -> controller.getItems());
        assertThrows(AccessDeniedException.class, () -> controller.getStocks(null, null, null, false, auth("USER")));
        assertThrows(AccessDeniedException.class, () -> controller.getStockLogs(1L, null));
        assertThrows(AccessDeniedException.class, () -> departmentController.getDepartments());
    }

    @Test
    void STAFF는_조회는_가능하지만_재고_이력은_볼수없다() {
        login("STAFF");

        controller.getItems();
        controller.getStocks(null, null, null, false, auth("STAFF"));
        departmentController.getDepartments();

        verify(service).getItems();
        verify(service).getStocks(null, null, null, false, false);
        verify(service).getDepartments();
        assertThrows(AccessDeniedException.class, () -> controller.getStockLogs(1L, null));
    }

    @Test
    void ADMIN은_조회와_재고_이력_모두_가능하다() {
        login("ADMIN");

        controller.getItems();
        controller.getStocks(null, null, null, true, auth("ADMIN"));
        controller.getStockLogs(1L, 10);
        departmentController.getDepartments();

        verify(service).getStocks(null, null, null, true, true);
        verify(service).getStockLogs(1L, 10);
    }

    // @PreAuthorize가 실제로 적용되는 프록시 (IncidentControllerTest와 같은 방식)
    @SuppressWarnings("unchecked")
    private <T> T secured(T target, Class<T> type) {
        ProxyFactory proxyFactory = new ProxyFactory(target);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        return (T) proxyFactory.getProxy();
    }

    private void login(String role) {
        SecurityContextHolder.getContext().setAuthentication(auth(role));
    }

    private Authentication auth(String role) {
        return new UsernamePasswordAuthenticationToken(1L, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
}
