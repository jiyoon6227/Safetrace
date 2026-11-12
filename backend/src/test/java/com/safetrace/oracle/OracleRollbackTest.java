package com.safetrace.oracle;

import com.safetrace.dto.ResourceLossRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * [실제 Oracle] 처리 도중 실패하면 앞에서 바꾼 것까지 모두 되돌아가는지 확인한다.
 * 실패는 재고 값을 일부러 어긋나게 만들어(가용 = 총보유량) 자연스럽게 일으킨다.
 * (복구·감소 UPDATE의 조건이 0행이 되어 IllegalStateException이 난다. DB 구조는 바꾸지 않는다.)
 */
class OracleRollbackTest extends OracleIntegrationTestBase {

    /** 가용을 총보유량과 같게 만든다. CK_SF_RES_STOCK_AVAILABLE(가용 <= 총)은 통과하지만 복구·감소 조건은 실패한다. */
    private void corruptAvailableToTotal(long stockId) {
        jdbc.update("UPDATE SF_RESOURCE_STOCK SET AVAILABLE_QTY = TOTAL_QTY WHERE STOCK_ID = ?", stockId);
    }

    @Test
    void 종료_중_재고_복구가_실패하면_요청과_사건_상태가_그대로_남는다() {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RECOVERING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createApproved(staff, admin, incident, stock, 4);
        corruptAvailableToTotal(stock);

        assertThrows(IllegalStateException.class,
                () -> incidentService.changeStatus(incident, "CLOSED", "롤백 확인", staff, List.of(requestId)));

        assertEquals("RECOVERING", incidentStatus(incident));
        assertEquals("APPROVED", requestStatus(requestId));
        assertEquals(0, logCount(requestId, "CANCEL_BY_CLOSE"));
        assertEquals(10, availableQty(stock));
    }

    @Test
    void 요청_두_건_중_두번째_재고_복구가_실패하면_첫번째_취소와_복구도_취소된다() {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RECOVERING");
        long good = fx.stock(true, 10, 10);
        long bad = fx.stock(true, 10, 10);
        long first = createApproved(staff, admin, incident, good, 2);
        long second = createApproved(staff, admin, incident, bad, 3);
        corruptAvailableToTotal(bad);
        int goodAvailableBefore = availableQty(good);
        int goodLogsBefore = stockLogCount(good);

        assertThrows(IllegalStateException.class,
                () -> incidentService.changeStatus(incident, "CLOSED", "부분 취소 롤백 확인", staff, List.of(first, second)));

        assertEquals("RECOVERING", incidentStatus(incident));
        assertEquals("APPROVED", requestStatus(first), "정상 재고의 요청 취소도 되돌아가야 합니다.");
        assertEquals("APPROVED", requestStatus(second));
        assertEquals(goodAvailableBefore, availableQty(good), "정상 재고의 복구도 되돌아가야 합니다.");
        assertEquals(goodLogsBefore, stockLogCount(good));
        assertEquals(0, logCount(first, "CANCEL_BY_CLOSE"));
    }

    @Test
    void 확인_목록_없이_종료하면_거절되고_아무것도_바뀌지_않는다() {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RECOVERING");
        long stock = fx.stock(true, 10, 10);
        long approved = createApproved(staff, admin, incident, stock, 4);
        long requested = createRequest(staff, incident, stock, 2);

        assertThrows(IllegalStateException.class,
                () -> incidentService.changeStatus(incident, "CLOSED", "목록 없음", staff, null));
        assertThrows(IllegalStateException.class,
                () -> incidentService.changeStatus(incident, "CLOSED", "일부만 확인", staff, List.of(approved)));

        assertEquals("RECOVERING", incidentStatus(incident));
        assertEquals("APPROVED", requestStatus(approved));
        assertEquals("REQUESTED", requestStatus(requested));
        assertEquals(6, availableQty(stock));
        assertStockConsistent();
    }

    @Test
    void 소모품_출고_중_총보유량_감소가_실패하면_요청_상태가_그대로_남는다() {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(false, 5, 5);
        long requestId = createApproved(staff, admin, incident, stock, 3);
        corruptAvailableToTotal(stock);

        assertThrows(IllegalStateException.class, () -> fulfillmentService.dispatch(admin, requestId));

        assertEquals("APPROVED", requestStatus(requestId), "실패 뒤에도 승인 상태가 그대로여야 합니다.");
        assertEquals(0, logCount(requestId, "DISPATCH"));
        assertEquals(5, totalQty(stock));
    }

    @Test
    void 손실_확정_중_총보유량_감소가_실패하면_요청의_손실_수량이_그대로_남는다() {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 6, 6);
        long requestId = createDispatched(staff, admin, incident, stock, 4);
        corruptAvailableToTotal(stock);

        assertThrows(IllegalStateException.class,
                () -> fulfillmentService.confirmLoss(admin, requestId, new ResourceLossRequest(2, "롤백 확인", 0)));

        assertEquals("DISPATCHED", requestStatus(requestId));
        assertEquals(0, jdbc.queryForObject("SELECT LOST_QTY FROM SF_RESOURCE_REQUEST WHERE REQUEST_ID = ?", Integer.class, requestId),
                "요청의 손실 수량 변경이 되돌아가야 합니다.");
        assertEquals(0, logCount(requestId, "LOSS"));
        assertEquals(6, totalQty(stock));
    }
}
