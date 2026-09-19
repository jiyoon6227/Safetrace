package com.safetrace.config;

import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.time.ZoneId;
import java.util.Map;

/**
 * 브라우저 WebSocket은 일반 fetch처럼 Authorization 헤더를 직접 넣을 수 없어서
 * 연결 URL의 ?token=... 값을 받아 JWT를 검증한다.
 *
 * 검증 성공 시 memberId / role을 WebSocketSession attributes에 저장하고,
 * 각 Handler가 해당 사용자에게 필요한 이벤트만 골라 보낼 수 있게 한다.
 */
@Component
@RequiredArgsConstructor
public class JwtWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
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

        String token = servletRequest.getServletRequest().getParameter("token");
        if (token == null || token.isBlank() || !jwtTokenProvider.validateToken(token)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        try {
            Long memberId = jwtTokenProvider.getMemberId(token);
            Member member = memberMapper.findById(memberId);

            boolean isSameMemberInstance = member != null
                    && member.getCreatedAt() != null
                    && member.getCreatedAt()
                    .atZone(ZoneId.systemDefault())
                    .toInstant()
                    .toEpochMilli() == jwtTokenProvider.getCreatedAtEpochMs(token);

            if (!isSameMemberInstance || "Y".equals(member.getIsWithdrawn())) {
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
