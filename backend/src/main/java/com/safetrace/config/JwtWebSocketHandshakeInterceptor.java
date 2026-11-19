package com.safetrace.config;

import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.service.WebSocketTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * 브라우저 WebSocket은 일반 fetch처럼 Authorization 헤더를 직접 넣을 수 없다.
 * JWT를 접속 주소에 실으면 접속 로그에 남기 때문에, /api/ws/ticket으로 받은 1회용 티켓(30초 유효)을
 * 연결 URL의 ?ticket=... 로 받아 확인한다.
 *
 * 검증 성공 시 memberId / role을 WebSocketSession attributes에 저장하고,
 * 각 Handler가 해당 사용자에게 필요한 이벤트만 골라 보낼 수 있게 한다.
 */
@Component
@RequiredArgsConstructor
public class JwtWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final WebSocketTicketService webSocketTicketService;
    private final MemberMapper memberMapper;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        Long memberId = webSocketTicketService.consume(servletRequest.getServletRequest().getParameter("ticket"));
        if (memberId == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        try {
            // 티켓을 받은 뒤 탈퇴했을 수 있으므로 회원 상태는 한 번 더 확인
            Member member = memberMapper.findById(memberId);

            if (member == null || "Y".equals(member.getIsWithdrawn())) {
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return false;
            }

            attributes.put("memberId", memberId);
            attributes.put("role", member.getRole());
            return true;
        } catch (Exception e) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // 별도 후처리 없음
    }
}
