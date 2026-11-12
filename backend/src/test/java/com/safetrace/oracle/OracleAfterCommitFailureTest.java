package com.safetrace.oracle;

import com.safetrace.websocket.IncidentWebSocketHandler;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

/**
 * [실제 Oracle] 커밋 뒤에 실행되는 실시간 알림(WebSocket 전송)이 실패해도, 이미 커밋된 DB 결과는 그대로여야 한다.
 * WebSocket 핸들러만 가짜로 바꾸므로 별도의 스프링 컨텍스트로 실행된다(DB 접속 설정은 동일).
 */
class OracleAfterCommitFailureTest extends OracleIntegrationTestBase {

    @MockBean
    private IncidentWebSocketHandler webSocketHandler;

    @Test
    void 커밋_뒤_알림_전송이_실패해도_종료_결과는_DB에_남는다() {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RECOVERING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createApproved(staff, admin, incident, stock, 4);
        doThrow(new IllegalStateException("전송 실패(테스트)")).when(webSocketHandler)
                .broadcastStatusChanged(any(), anyString());

        try {
            incidentService.changeStatus(incident, "CLOSED", "커밋 뒤 실패 확인", staff, List.of(requestId));
        } catch (RuntimeException ignored) {
            // 커밋 뒤 예외가 호출자에게 전달되는지는 현재 동작을 따른다. 여기서는 DB 결과만 확인한다.
        }

        assertEquals("CLOSED", incidentStatus(incident));
        assertEquals("CANCELLED", requestStatus(requestId));
        assertEquals(10, availableQty(stock));
        assertStockConsistent();
    }
}
