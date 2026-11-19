package com.safetrace.config;

import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.service.WebSocketTicketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// WebSocket 접속 주소에는 JWT가 아니라 1회용 티켓만 실린다 (접속 로그에 JWT가 남지 않게)
class JwtWebSocketHandshakeInterceptorTest {

    private MemberMapper memberMapper;
    private WebSocketTicketService ticketService;
    private JwtWebSocketHandshakeInterceptor interceptor;
    private MockHttpServletResponse servletResponse;
    private final Map<String, Object> attributes = new HashMap<>();

    @BeforeEach
    void setUp() {
        memberMapper = mock(MemberMapper.class);
        ticketService = new WebSocketTicketService();
        interceptor = new JwtWebSocketHandshakeInterceptor(ticketService, memberMapper);
        servletResponse = new MockHttpServletResponse();
    }

    private Member member(String role, String withdrawn) {
        Member member = new Member();
        member.setMemberId(7L);
        member.setRole(role);
        member.setIsWithdrawn(withdrawn);
        return member;
    }

    private boolean handshake(String param, String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (param != null) {
            request.setParameter(param, value);
        }
        return interceptor.beforeHandshake(
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(servletResponse),
                mock(WebSocketHandler.class),
                attributes);
    }

    @Test
    void 유효한_티켓이면_회원ID와_권한을_세션에_저장하고_접속을_허용한다() {
        when(memberMapper.findById(7L)).thenReturn(member("STAFF", "N"));

        assertTrue(handshake("ticket", ticketService.issue(7L)));

        assertEquals(7L, attributes.get("memberId"));
        assertEquals("STAFF", attributes.get("role"));
    }

    @Test
    void 티켓은_한_번만_쓸_수_있다() {
        when(memberMapper.findById(7L)).thenReturn(member("USER", "N"));
        String ticket = ticketService.issue(7L);

        assertTrue(handshake("ticket", ticket));
        attributes.clear();

        assertFalse(handshake("ticket", ticket));
        assertEquals(401, servletResponse.getStatus());
        assertTrue(attributes.isEmpty());
    }

    @Test
    void 티켓이_없거나_모르는_값이면_401로_거절한다() {
        assertFalse(handshake(null, null));
        assertEquals(401, servletResponse.getStatus());

        assertFalse(handshake("ticket", "not-issued"));
        assertFalse(handshake("ticket", ""));
        assertTrue(attributes.isEmpty());
    }

    @Test
    void 예전_방식의_token_파라미터는_JWT가_맞아도_받아주지_않는다() {
        when(memberMapper.findById(7L)).thenReturn(member("USER", "N"));
        JwtTokenProvider provider = new JwtTokenProvider("test-secret-key-for-jwt-unit-tests-0123456789", 3_600_000L, 43_200_000L);
        String jwt = provider.generateToken(7L, "USER", "이서연", java.time.LocalDateTime.of(2026, 1, 1, 9, 0), 0L);

        assertFalse(handshake("token", jwt));

        assertEquals(401, servletResponse.getStatus());
        assertTrue(attributes.isEmpty());
    }

    @Test
    void 티켓을_받은_뒤_탈퇴했거나_사라진_회원은_거절한다() {
        when(memberMapper.findById(7L)).thenReturn(member("USER", "Y"));
        assertFalse(handshake("ticket", ticketService.issue(7L)));

        when(memberMapper.findById(7L)).thenReturn(null);
        assertFalse(handshake("ticket", ticketService.issue(7L)));

        assertTrue(attributes.isEmpty());
    }

    @Test
    void 서블릿_요청이_아니면_거절한다() {
        ServerHttpRequest notServlet = mock(ServerHttpRequest.class);

        assertFalse(interceptor.beforeHandshake(notServlet, new ServletServerHttpResponse(servletResponse),
                mock(WebSocketHandler.class), attributes));
        assertEquals(401, servletResponse.getStatus());
    }
}
