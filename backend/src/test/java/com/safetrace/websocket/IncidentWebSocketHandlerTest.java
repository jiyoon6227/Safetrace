package com.safetrace.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safetrace.domain.Incident;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IncidentWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private IncidentWebSocketHandler handler;
    private WebSocketSession staffSession;
    private WebSocketSession userSession;
    private WebSocketSession noRoleSession;

    @BeforeEach
    void setUp() {
        handler = new IncidentWebSocketHandler(objectMapper);

        staffSession = session("staff", Map.of("memberId", 10L, "role", "STAFF"));
        userSession = session("user", Map.of("memberId", 2L, "role", "USER"));
        noRoleSession = session("no-role", Map.of());

        // 접속 시 SOCKET_CONNECTED 전송 기록 제외
        clearInvocations(staffSession, userSession, noRoleSession);
    }

    @Test
    void STAFF_세션에는_담당자정보를_포함해_보낸다() throws Exception {
        handler.broadcastStatusChanged(incident(), "현장 도착");

        JsonNode payload = receivedPayload(staffSession);
        JsonNode incident = payload.get("incident");

        assertEquals("STATUS_CHANGED", payload.get("eventType").asText());
        assertEquals("현장 도착", payload.get("memo").asText());
        assertEquals(1L, incident.get("incidentId").asLong());
        assertEquals("RESPONDING", incident.get("status").asText());
        assertEquals(10L, incident.get("assignedStaffId").asLong());
        assertEquals("김담당", incident.get("assignedStaffName").asText());
        assertEquals("조치 완료", incident.get("closeReason").asText());
    }

    @Test
    void USER_세션에는_공개용_필드만_보낸다() throws Exception {
        handler.broadcastStatusChanged(incident(), "현장 도착");

        assertPublicPayload(receivedPayload(userSession));
    }

    @Test
    void 권한값이_없는_세션에는_공개용_필드만_보낸다() throws Exception {
        handler.broadcastStatusChanged(incident(), "현장 도착");

        assertPublicPayload(receivedPayload(noRoleSession));
    }

    @Test
    void 회원을_끊으면_그_회원의_연결만_닫는다() throws Exception {
        handler.disconnect(2L);

        verify(userSession).close(any(CloseStatus.class));
        verify(staffSession, never()).close(any(CloseStatus.class));
        verify(noRoleSession, never()).close(any(CloseStatus.class));
    }

    @Test
    void 이미_닫힌_연결은_다시_닫지_않는다() throws Exception {
        when(userSession.isOpen()).thenReturn(false);

        handler.disconnect(2L);

        verify(userSession, never()).close(any(CloseStatus.class));
    }

    private void assertPublicPayload(JsonNode payload) {
        JsonNode incident = payload.get("incident");

        assertEquals("STATUS_CHANGED", payload.get("eventType").asText());
        // 담당자가 적은 조치내역은 STAFF가 아닌 세션에는 보내지 않는다
        assertFalse(payload.has("memo"));
        assertFalse(payload.toString().contains("현장 도착"));
        assertEquals(1L, incident.get("incidentId").asLong());
        assertEquals("RESPONDING", incident.get("status").asText());

        List<String> fieldNames = new ArrayList<>();
        incident.fieldNames().forEachRemaining(fieldNames::add);
        assertEquals(11, fieldNames.size());
        assertTrue(fieldNames.containsAll(Set.of(
                "incidentId", "title", "disasterType", "severity", "status", "region",
                "latitude", "longitude", "photoUrl", "createdAt", "updatedAt"
        )));
        assertFalse(incident.has("assignedStaffId"));
        assertFalse(incident.has("assignedStaffName"));
        assertFalse(incident.has("sourceReportId"));
        assertFalse(incident.has("closeReason"));
    }

    private JsonNode receivedPayload(WebSocketSession session) throws Exception {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());
        return objectMapper.readTree(captor.getValue().getPayload());
    }

    private WebSocketSession session(String id, Map<String, Object> attributes) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        when(session.getAttributes()).thenReturn(attributes);
        handler.afterConnectionEstablished(session);
        return session;
    }

    private Incident incident() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setTitle("도로 침수");
        incident.setDisasterType("침수");
        incident.setSeverity("HIGH");
        incident.setStatus("RESPONDING");
        incident.setRegion("서울");
        incident.setLatitude(37.5);
        incident.setLongitude(127.0);
        incident.setAssignedStaffId(10L);
        incident.setAssignedStaffName("김담당");
        incident.setSourceReportId(50L);
        incident.setCloseReason("조치 완료");
        incident.setCreatedAt(LocalDateTime.of(2026, 9, 13, 9, 0));
        incident.setUpdatedAt(LocalDateTime.of(2026, 9, 13, 10, 0));
        return incident;
    }
}
