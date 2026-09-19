package com.safetrace.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safetrace.domain.SafetyCheck;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 안전확인 WebSocket.
 *
 * 과거에는 SafetyCheck 전체 객체(이메일 응답용 token 포함)를 모든 접속자에게 broadcast 했지만,
 * 지금은 JWT handshake에서 확인된 사용자 중 요청자/대상자에게만 최소 정보만 전송한다.
 */
@Component
@RequiredArgsConstructor
public class SafetyCheckWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        send(session, Map.of("eventType", "SOCKET_CONNECTED"));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    public void broadcastRequested(SafetyCheck check) {
        sendToRelatedMembers("SAFETY_CHECK_REQUESTED", check);
    }

    public void broadcastResponded(SafetyCheck check) {
        sendToRelatedMembers("SAFETY_CHECK_RESPONDED", check);
    }

    private void sendToRelatedMembers(String eventType, SafetyCheck check) {
        Map<String, Object> safeCheck = new LinkedHashMap<>();
        safeCheck.put("checkId", check.getCheckId());
        safeCheck.put("requesterId", check.getRequesterId());
        safeCheck.put("targetMemberId", check.getTargetMemberId());
        safeCheck.put("incidentId", check.getIncidentId());
        safeCheck.put("status", check.getStatus());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType);
        payload.put("safetyCheck", safeCheck);

        for (WebSocketSession session : sessions.values()) {
            Long connectedMemberId = sessionMemberId(session);
            boolean related = connectedMemberId != null
                    && (connectedMemberId.equals(check.getRequesterId())
                    || connectedMemberId.equals(check.getTargetMemberId()));

            if (related) {
                send(session, payload);
            }
        }
    }

    private Long sessionMemberId(WebSocketSession session) {
        Object value = session.getAttributes().get("memberId");
        return value instanceof Long ? (Long) value : null;
    }

    private void send(WebSocketSession session, Object payload) {
        if (!session.isOpen()) return;

        try {
            String json = objectMapper.writeValueAsString(payload);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            System.err.println("SafetyCheck WebSocket 전송 실패: " + e.getMessage());
        }
    }
}
