package com.safetrace.websocket;

import com.safetrace.service.WebSocketTicketService;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class WebSocketSessionRevokerTest {

    private final WebSocketTicketService tickets = mock(WebSocketTicketService.class);
    private final IncidentWebSocketHandler incidentHandler = mock(IncidentWebSocketHandler.class);
    private final SafetyCheckWebSocketHandler safetyCheckHandler = mock(SafetyCheckWebSocketHandler.class);
    private final ReportWebSocketHandler reportHandler = mock(ReportWebSocketHandler.class);

    @Test
    void 티켓을_먼저_지우고_세_종류의_연결을_모두_끊는다() {
        WebSocketSessionRevoker revoker = new WebSocketSessionRevoker(tickets, incidentHandler, safetyCheckHandler, reportHandler);

        revoker.revoke(7L);

        InOrder order = inOrder(tickets, incidentHandler, safetyCheckHandler, reportHandler);
        order.verify(tickets).revokeAll(7L);
        order.verify(incidentHandler).disconnect(7L);
        order.verify(safetyCheckHandler).disconnect(7L);
        order.verify(reportHandler).disconnect(7L);
    }

    @Test
    void 폐기한_뒤에는_받아_둔_티켓으로_접속할_수_없다() {
        WebSocketTicketService realTickets = new WebSocketTicketService();
        WebSocketSessionRevoker revoker = new WebSocketSessionRevoker(realTickets, incidentHandler, safetyCheckHandler, reportHandler);
        String mine = realTickets.issue(7L);
        String others = realTickets.issue(8L);

        revoker.revoke(7L);

        assertNull(realTickets.consume(mine));
        assertEquals(Long.valueOf(8L), realTickets.consume(others));
        verify(incidentHandler).disconnect(7L);
    }
}
