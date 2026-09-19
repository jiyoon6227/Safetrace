package com.safetrace.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safetrace.domain.Report;
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
 * 제보 상태 변경 WebSocket.
 *
 * 제보 전체 객체에는 주소/좌표/연락처 등이 포함되므로 그대로 전체 broadcast 하지 않는다.
 * JWT로 확인된 제보 작성자와 STAFF에게만 상태 갱신에 필요한 최소 필드만 보낸다.
 */
@Component
@RequiredArgsConstructor
public class ReportWebSocketHandler extends TextWebSocketHandler {

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

    public void broadcastReportCreated(Report report) {
        sendReportEvent("REPORT_CREATED", report);
    }

    public void broadcastReportReviewing(Report report) {
        sendReportEvent("REPORT_REVIEWING", report);
    }

    public void broadcastReportLinked(Report report) {
        sendReportEvent("REPORT_LINKED", report);
    }

    public void broadcastReportRejected(Report report) {
        sendReportEvent("REPORT_REJECTED", report);
    }

    private void sendReportEvent(String eventType, Report report) {
        Map<String, Object> safeReport = new LinkedHashMap<>();
        safeReport.put("reportId", report.getReportId());
        safeReport.put("memberId", report.getMemberId());
        safeReport.put("status", report.getStatus());
        safeReport.put("incidentId", report.getIncidentId());
        safeReport.put("rejectReason", report.getRejectReason());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType);
        payload.put("report", safeReport);

        for (WebSocketSession session : sessions.values()) {
            Long connectedMemberId = sessionMemberId(session);
            String role = sessionRole(session);

            boolean isOwner = connectedMemberId != null && connectedMemberId.equals(report.getMemberId());
            boolean isStaff = "STAFF".equals(role);

            if (isOwner || isStaff) {
                send(session, payload);
            }
        }
    }

    private Long sessionMemberId(WebSocketSession session) {
        Object value = session.getAttributes().get("memberId");
        return value instanceof Long ? (Long) value : null;
    }

    private String sessionRole(WebSocketSession session) {
        Object value = session.getAttributes().get("role");
        return value instanceof String ? (String) value : null;
    }

    private void send(WebSocketSession session, Object payload) {
        if (!session.isOpen()) return;

        try {
            String json = objectMapper.writeValueAsString(payload);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            System.err.println("Report WebSocket 전송 실패: " + e.getMessage());
        }
    }
}
