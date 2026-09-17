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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 제보 상태 변경을 시민 메인/마이페이지/담당자 화면에 실시간 broadcast 한다.
 * eventType: REPORT_CREATED / REPORT_REVIEWING / REPORT_LINKED / REPORT_REJECTED
 */
@Component
@RequiredArgsConstructor
public class ReportWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    public void broadcastReportCreated(Report report) {
        broadcast("REPORT_CREATED", report);
    }

    public void broadcastReportReviewing(Report report) {
        broadcast("REPORT_REVIEWING", report);
    }

    public void broadcastReportLinked(Report report) {
        broadcast("REPORT_LINKED", report);
    }

    public void broadcastReportRejected(Report report) {
        broadcast("REPORT_REJECTED", report);
    }

    private void broadcast(String eventType, Report report) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "eventType", eventType,
                    "report", report
            ));
            TextMessage message = new TextMessage(json);

            for (WebSocketSession session : sessions.values()) {
                if (session.isOpen()) {
                    session.sendMessage(message);
                }
            }
        } catch (IOException e) {
            System.err.println("Report WebSocket broadcast 실패: " + e.getMessage());
        }
    }
}
