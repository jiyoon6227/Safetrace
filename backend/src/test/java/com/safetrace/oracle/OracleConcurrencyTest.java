package com.safetrace.oracle;

import com.safetrace.dto.ResourceLossRequest;
import com.safetrace.dto.ResourceRequestRejectRequest;
import com.safetrace.dto.ResourceReturnApplyRequest;
import com.safetrace.oracle.OracleConcurrency.Outcome;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static com.safetrace.oracle.OracleConcurrency.assertOnlyBusinessErrors;
import static com.safetrace.oracle.OracleConcurrency.count;
import static com.safetrace.oracle.OracleConcurrency.runTogether;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * [실제 Oracle] 같은 순간에 여러 스레드가 같은 자원을 건드릴 때의 결과를 확인한다.
 * 각 시나리오가 끝나면 재고 점검(가용 + 예약·출고 중 = 총보유량, 재고 이력 연속성)을 실제 DB 값으로 한다.
 * 락 대기 초과(ORA-30006)·교착(ORA-00060) 같은 예상 밖 예외가 나면 실패한다.
 */
class OracleConcurrencyTest extends OracleIntegrationTestBase {

    private Callable<Object> task(Callable<?> call) {
        return call::call;
    }

    @Test
    void 가용_재고보다_많은_요청을_동시에_승인하면_가용이_허용하는_만큼만_승인된다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        List<Long> requestIds = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            requestIds.add(createRequest(staff, incident, stock, 3));
        }

        List<Callable<Object>> tasks = new ArrayList<>();
        for (Long id : requestIds) {
            tasks.add(task(() -> approvalService.approve(admin, id)));
        }
        List<Outcome> outcomes = runTogether(tasks);

        assertOnlyBusinessErrors(outcomes);
        assertEquals(3, count(outcomes, Outcome::ok), "10개 중 3개씩이면 3건만 승인되어야 합니다.");
        assertEquals(2, count(outcomes, Outcome::conflict));
        assertEquals(1, availableQty(stock));
        assertStockConsistent();
    }

    @Test
    void 재고가_딱_맞는_요청_세_건을_동시에_승인하면_한_건만_승인된다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 5, 5);
        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            long requestId = createRequest(staff, incident, stock, 3);
            tasks.add(task(() -> approvalService.approve(admin, requestId)));
        }

        List<Outcome> outcomes = runTogether(tasks);

        assertOnlyBusinessErrors(outcomes);
        assertEquals(1, count(outcomes, Outcome::ok));
        assertEquals(2, count(outcomes, Outcome::conflict));
        assertEquals(2, availableQty(stock));
        assertStockConsistent();
    }

    @Test
    void 같은_요청을_여러_관리자가_동시에_승인하면_한_번만_반영된다() throws Exception {
        long staff = fx.member("STAFF");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createRequest(staff, incident, stock, 4);
        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            long admin = fx.member("ADMIN");
            tasks.add(task(() -> approvalService.approve(admin, requestId)));
        }

        List<Outcome> outcomes = runTogether(tasks);

        assertOnlyBusinessErrors(outcomes);
        assertEquals(1, count(outcomes, Outcome::ok));
        assertEquals(4, count(outcomes, Outcome::conflict));
        assertEquals(6, availableQty(stock));
        assertEquals(1, logCount(requestId, "APPROVE"));
        assertEquals(1, stockLogCount(stock));
        assertStockConsistent();
    }

    @Test
    void 승인과_반려가_동시에_오면_하나만_처리된다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createRequest(staff, incident, stock, 4);

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> approvalService.approve(admin, requestId)),
                task(() -> approvalService.reject(admin, requestId, new ResourceRequestRejectRequest("동시성 반려")))));

        assertOnlyBusinessErrors(outcomes);
        assertEquals(1, count(outcomes, Outcome::ok));
        assertEquals(1, count(outcomes, Outcome::conflict));
        String status = requestStatus(requestId);
        assertTrue(status.equals("APPROVED") || status.equals("REJECTED"), "최종 상태: " + status);
        assertEquals("APPROVED".equals(status) ? 6 : 10, availableQty(stock));
        assertStockConsistent();
    }

    @Test
    void 승인과_요청자_취소가_동시에_와도_최종_재고가_원래대로_돌아온다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createRequest(staff, incident, stock, 4);

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> approvalService.approve(admin, requestId)),
                task(() -> approvalService.cancel(staff, requestId))));

        assertOnlyBusinessErrors(outcomes);
        // 취소는 승인 전·후 어느 쪽이든 성공한다. 승인이 취소보다 늦으면 승인만 거절된다.
        assertTrue(outcomes.get(1).ok(), "취소는 성공해야 합니다: " + outcomes.get(1).message());
        assertEquals("CANCELLED", requestStatus(requestId));
        assertEquals(10, availableQty(stock));
        assertStockConsistent();
    }

    @Test
    void 같은_요청을_동시에_출고하면_한_번만_출고된다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(false, 10, 10);   // 소모품: 출고하면 총보유량이 줄어든다
        long requestId = createApproved(staff, admin, incident, stock, 4);
        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tasks.add(task(() -> fulfillmentService.dispatch(admin, requestId)));
        }

        List<Outcome> outcomes = runTogether(tasks);

        assertOnlyBusinessErrors(outcomes);
        assertEquals(1, count(outcomes, Outcome::ok));
        assertEquals("COMPLETED", requestStatus(requestId));
        assertEquals(6, totalQty(stock), "소모품 출고는 총보유량을 한 번만 줄여야 합니다.");
        assertEquals(6, availableQty(stock));
        assertEquals(1, logCount(requestId, "DISPATCH"));
        assertStockConsistent();
    }

    @Test
    void 승인된_요청의_취소와_출고가_동시에_오면_이긴_쪽_결과로만_남는다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createApproved(staff, admin, incident, stock, 4);

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> approvalService.cancel(staff, requestId)),
                task(() -> fulfillmentService.dispatch(admin, requestId))));

        assertOnlyBusinessErrors(outcomes);
        assertEquals(1, count(outcomes, Outcome::ok));
        String status = requestStatus(requestId);
        if ("CANCELLED".equals(status)) {
            assertEquals(10, availableQty(stock));
        } else {
            assertEquals("DISPATCHED", status);
            assertEquals(6, availableQty(stock));
        }
        assertStockConsistent();
    }

    @Test
    void 반납_확인_세_건을_동시에_처리하면_모두_반영되고_정산된다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createDispatched(staff, admin, incident, stock, 6);
        List<Callable<Object>> tasks = new ArrayList<>();
        for (int qty : new int[]{1, 2, 3}) {   // 수량을 다르게 해서 중복 신청 방지에 걸리지 않게 한다
            long returnId = fulfillmentService.applyReturn(staff, requestId, new ResourceReturnApplyRequest(qty, null)).getReturnId();
            tasks.add(task(() -> fulfillmentService.confirmReturn(admin, returnId)));
        }

        List<Outcome> outcomes = runTogether(tasks);

        assertOnlyBusinessErrors(outcomes);
        assertEquals(3, count(outcomes, Outcome::ok));
        assertEquals("SETTLED", requestStatus(requestId));
        assertEquals(10, availableQty(stock));
        assertEquals(10, totalQty(stock));
        assertStockConsistent();
    }

    @Test
    void 반납_확인과_손실_확정이_동시에_와도_수량이_어긋나지_않는다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RESPONDING");
        long stock = fx.stock(true, 10, 10);
        long requestId = createDispatched(staff, admin, incident, stock, 5);
        long returnId = fulfillmentService.applyReturn(staff, requestId, new ResourceReturnApplyRequest(3, null)).getReturnId();

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> fulfillmentService.confirmReturn(admin, returnId)),
                task(() -> fulfillmentService.confirmLoss(admin, requestId, new ResourceLossRequest(2, "동시성 손실", 0)))));

        assertOnlyBusinessErrors(outcomes);
        assertTrue(outcomes.get(0).ok(), "반납 확인은 성공해야 합니다: " + outcomes.get(0).message());
        // 손실이 먼저면 둘 다 성공해 정산되고, 반납이 먼저면 손실은 "처리 완료 수량 불일치"로 거절된다.
        if (outcomes.get(1).ok()) {
            assertEquals("SETTLED", requestStatus(requestId));
            assertEquals(8, totalQty(stock));
            assertEquals(8, availableQty(stock));
        } else {
            assertEquals("DISPATCHED", requestStatus(requestId));
            assertEquals(10, totalQty(stock));
            assertEquals(8, availableQty(stock));
        }
        assertStockConsistent();
    }

    @Test
    void 사건_종료와_새_요청_생성이_동시에_오면_한쪽만_성공한다() throws Exception {
        long staff = fx.member("STAFF");
        long incident = fx.incident(staff, "RECOVERING");
        long stock = fx.stock(true, 10, 10);
        long existing = createRequest(staff, incident, stock, 2);

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> incidentService.changeStatus(incident, "CLOSED", "동시성 종료", staff, List.of(existing))),
                task(() -> createRequest(staff, incident, stock, 3))));

        assertOnlyBusinessErrors(outcomes);
        assertEquals(1, count(outcomes, Outcome::ok), "종료와 새 요청 중 한쪽만 성공해야 합니다.");
        if (outcomes.get(0).ok()) {
            assertEquals("CLOSED", incidentStatus(incident));
            assertEquals(0, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM SF_RESOURCE_REQUEST WHERE INCIDENT_ID = ? AND STATUS IN ('REQUESTED','APPROVED')",
                    Integer.class, incident), "종료된 사건에 출고 전 요청이 남으면 안 됩니다.");
        } else {
            assertEquals("RECOVERING", incidentStatus(incident));
            assertEquals("REQUESTED", requestStatus(existing));
        }
        assertStockConsistent();
    }

    @Test
    void 사건_종료와_승인이_동시에_와도_재고가_원래대로_돌아온다() throws Exception {
        long staff = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incident = fx.incident(staff, "RECOVERING");
        long stock = fx.stock(true, 5, 5);
        long requestId = createRequest(staff, incident, stock, 3);

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> incidentService.changeStatus(incident, "CLOSED", "동시성 종료", staff, List.of(requestId))),
                task(() -> approvalService.approve(admin, requestId))));

        assertOnlyBusinessErrors(outcomes);
        assertTrue(outcomes.get(0).ok(), "종료는 성공해야 합니다: " + outcomes.get(0).message());
        assertEquals("CLOSED", incidentStatus(incident));
        assertEquals("CANCELLED", requestStatus(requestId));
        assertEquals(5, availableQty(stock));
        assertStockConsistent();
    }

    @Test
    void 같은_재고를_쓰는_두_사건을_동시에_종료해도_교착없이_모두_종료된다() throws Exception {
        long staffA = fx.member("STAFF");
        long staffB = fx.member("STAFF");
        long admin = fx.member("ADMIN");
        long incidentA = fx.incident(staffA, "RECOVERING");
        long incidentB = fx.incident(staffB, "RECOVERING");
        long stock1 = fx.stock(true, 20, 20);
        long stock2 = fx.stock(true, 20, 20);
        // 두 사건이 같은 두 재고에 승인 요청을 갖는다. 요청은 서로 반대 순서로 만든다.
        List<Long> idsA = List.of(
                createApproved(staffA, admin, incidentA, stock1, 2),
                createApproved(staffA, admin, incidentA, stock2, 2));
        List<Long> idsB = List.of(
                createApproved(staffB, admin, incidentB, stock2, 3),
                createApproved(staffB, admin, incidentB, stock1, 3));

        List<Outcome> outcomes = runTogether(List.of(
                task(() -> incidentService.changeStatus(incidentA, "CLOSED", "동시성 종료 A", staffA, idsA)),
                task(() -> incidentService.changeStatus(incidentB, "CLOSED", "동시성 종료 B", staffB, idsB))));

        assertOnlyBusinessErrors(outcomes);
        assertEquals(2, count(outcomes, Outcome::ok), "재고 잠금 순서가 같아 둘 다 성공해야 합니다: "
                + outcomes.stream().map(Outcome::message).toList());
        assertEquals("CLOSED", incidentStatus(incidentA));
        assertEquals("CLOSED", incidentStatus(incidentB));
        assertEquals(20, availableQty(stock1));
        assertEquals(20, availableQty(stock2));
        assertStockConsistent();
    }
}
