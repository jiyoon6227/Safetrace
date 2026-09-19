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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Incident 변경사항 실시간 알림.
 * 접속 자체는 JwtWebSocketHandshakeInterceptor를 통과한 로그인 사용자만 가능하고,
 * WebSocket payload에는 화면 즉시 갱신에 필요한 필드만 넣는다.
 */
@Component
@RequiredArgsConstructor
public class IncidentWebSocketHandler extends TextWebSocketHandler {

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

    public void broadcastIncidentCreated(Incident incident) {
        broadcast("INCIDENT_CREATED", incident, null);
    }

    public void broadcastStatusChanged(Incident incident, String memo) {
        broadcast("STATUS_CHANGED", incident, memo == null ? "" : memo);
    }

    public void broadcastStaffAssigned(Incident incident) {
        broadcast("STAFF_ASSIGNED", incident, null);
    }

    public void broadcastIncidentUpdated(Incident incident) {
        broadcast("INCIDENT_UPDATED", incident, null);
    }

    private void broadcast(String eventType, Incident incident, String memo) {
        Map<String, Object> safeIncident = new LinkedHashMap<>();
        safeIncident.put("incidentId", incident.getIncidentId());
        safeIncident.put("title", incident.getTitle());
        safeIncident.put("disasterType", incident.getDisasterType());
        safeIncident.put("severity", incident.getSeverity());
        safeIncident.put("status", incident.getStatus());
        safeIncident.put("region", incident.getRegion());
        safeIncident.put("assignedStaffId", incident.getAssignedStaffId());
        safeIncident.put("assignedStaffName", incident.getAssignedStaffName());
        safeIncident.put("closeReason", incident.getCloseReason());
        safeIncident.put("updatedAt", incident.getUpdatedAt());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType);
        payload.put("incident", safeIncident);
        if (memo != null) {
            payload.put("memo", memo);
        }

        for (WebSocketSession session : sessions.values()) {
            send(session, payload);
        }
    }

    private void send(WebSocketSession session, Object payload) {
        if (!session.isOpen()) return;

        try {
            String json = objectMapper.writeValueAsString(payload);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            System.err.println("Incident WebSocket 전송 실패: " + e.getMessage());
        }
    }
}
