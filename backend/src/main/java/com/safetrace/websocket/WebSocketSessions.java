package com.safetrace.websocket;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Collection;

final class WebSocketSessions {

    private WebSocketSessions() {
    }

    // 해당 회원이 연 연결을 모두 닫는다 (접속 때 JwtWebSocketHandshakeInterceptor가 세션에 넣어 둔 memberId 기준)
    static void closeAllOf(Collection<WebSocketSession> sessions, Long memberId) {
        for (WebSocketSession session : sessions) {
            if (!session.isOpen() || !memberId.equals(session.getAttributes().get("memberId"))) {
                continue;
            }
            try {
                session.close(CloseStatus.POLICY_VIOLATION.withReason("세션이 종료되었습니다."));
            } catch (IOException e) {
                System.err.println("WebSocket 연결 종료 실패: " + e.getMessage());
            }
        }
    }
}
