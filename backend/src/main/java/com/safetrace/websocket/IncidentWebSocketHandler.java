package com.safetrace.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safetrace.domain.Incident;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 접속한 모든 클라이언트(STAFF 상황판 + 시민 화면)에게
 * Incident 변경사항을 실시간으로 broadcast 한다.
 * 세션을 Map으로 관리해서 연결이 끊기면 정리(cleanup)하는 구조.
 */
@Component
@RequiredArgsConstructor
public class IncidentWebSocketHandler extends TextWebSocketHandler {

    // new ObjectMapper()를 직접 만들면 LocalDateTime(createdAt 등) 직렬화 방법을
    // 몰라서 broadcast가 매번 조용히 실패함. 스프링이 이미 날짜 타입까지
    // 처리하도록 구성해둔 ObjectMapper 빈을 그대로 주입받아 씀.
    private final ObjectMapper objectMapper;

    // 세션ID -> 세션 객체. 동시 접속자 관리용
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    public void broadcastIncidentCreated(Incident incident) {
        broadcast(Map.of(
                "eventType", "INCIDENT_CREATED",
                "incident", incident
        ));
    }

    public void broadcastStatusChanged(Incident incident, String memo) {
        broadcast(Map.of(
                "eventType", "STATUS_CHANGED",
                "incident", incident,
                "memo", memo == null ? "" : memo
        ));
    }

    public void broadcastStaffAssigned(Incident incident) {
        broadcast(Map.of(
                "eventType", "STAFF_ASSIGNED",
                "incident", incident
        ));
    }

    public void broadcastIncidentUpdated(Incident incident) {
        broadcast(Map.of(
                "eventType", "INCIDENT_UPDATED",
                "incident", incident
        ));
    }

    private void broadcast(Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            TextMessage message = new TextMessage(json);

            for (WebSocketSession session : sessions.values()) {
                if (session.isOpen()) {
                    session.sendMessage(message);
                }
            }
        } catch (IOException e) {
            // 실무에서는 로깅 프레임워크로 대체. 지금은 최소 처리
            System.err.println("WebSocket broadcast 실패: " + e.getMessage());
        }
    }
}