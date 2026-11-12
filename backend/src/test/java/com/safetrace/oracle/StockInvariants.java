package com.safetrace.oracle;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 재고 점검 쿼리. 시나리오가 끝날 때마다 실제 Oracle의 값으로 확인한다.
 *  1) 가용 + (승인 수량 + 출고 후 미정산 수량) = 총보유량, 0 <= 가용 <= 총보유량
 *  2) 재고 이력 연속성: 재고별로 LOG_ID 순서에서 앞 이력의 "후" 값 = 다음 이력의 "전" 값, 마지막 "후" 값 = 현재 값
 */
final class StockInvariants {

    private StockInvariants() {
    }

    static List<String> findProblems(JdbcTemplate jdbc, Collection<Long> stockIds) {
        List<String> problems = new ArrayList<>();
        if (stockIds.isEmpty()) {
            return problems;
        }
        String in = stockIds.stream().map(String::valueOf).collect(Collectors.joining(","));

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT s.STOCK_ID, s.TOTAL_QTY, s.AVAILABLE_QTY, "
                        + "       NVL(SUM(CASE r.STATUS WHEN 'APPROVED' THEN r.QUANTITY "
                        + "                             WHEN 'DISPATCHED' THEN r.QUANTITY - r.RETURNED_QTY - r.LOST_QTY "
                        + "                             ELSE 0 END), 0) AS HELD "
                        + "FROM SF_RESOURCE_STOCK s LEFT JOIN SF_RESOURCE_REQUEST r ON r.STOCK_ID = s.STOCK_ID "
                        + "WHERE s.STOCK_ID IN (" + in + ") "
                        + "GROUP BY s.STOCK_ID, s.TOTAL_QTY, s.AVAILABLE_QTY ORDER BY s.STOCK_ID");
        Map<Long, int[]> current = new HashMap<>();
        for (Map<String, Object> row : rows) {
            long stockId = number(row, "STOCK_ID");
            int total = (int) number(row, "TOTAL_QTY");
            int available = (int) number(row, "AVAILABLE_QTY");
            int held = (int) number(row, "HELD");
            current.put(stockId, new int[]{total, available});
            if (available < 0 || available > total) {
                problems.add("재고 " + stockId + ": 가용 " + available + "이(가) 0~총보유량(" + total + ") 범위를 벗어남");
            }
            if (available + held != total) {
                problems.add("재고 " + stockId + ": 가용 " + available + " + 예약·출고 중 " + held + " != 총보유량 " + total);
            }
        }

        List<Map<String, Object>> logs = jdbc.queryForList(
                "SELECT STOCK_ID, LOG_ID, ACTION, TOTAL_BEFORE, TOTAL_AFTER, AVAILABLE_BEFORE, AVAILABLE_AFTER "
                        + "FROM SF_RESOURCE_STOCK_LOG WHERE STOCK_ID IN (" + in + ") ORDER BY STOCK_ID, LOG_ID");
        Map<Long, int[]> lastAfter = new HashMap<>();
        for (Map<String, Object> log : logs) {
            long stockId = number(log, "STOCK_ID");
            int totalBefore = (int) number(log, "TOTAL_BEFORE");
            int availableBefore = (int) number(log, "AVAILABLE_BEFORE");
            int[] previous = lastAfter.get(stockId);
            if (previous != null && (previous[0] != totalBefore || previous[1] != availableBefore)) {
                problems.add("재고 " + stockId + ": 이력 " + number(log, "LOG_ID") + "(" + log.get("ACTION")
                        + ")의 전 값(" + totalBefore + "/" + availableBefore + ")이 앞 이력의 후 값("
                        + previous[0] + "/" + previous[1] + ")과 이어지지 않음");
            }
            lastAfter.put(stockId, new int[]{(int) number(log, "TOTAL_AFTER"), (int) number(log, "AVAILABLE_AFTER")});
        }
        for (Map.Entry<Long, int[]> entry : lastAfter.entrySet()) {
            int[] now = current.get(entry.getKey());
            int[] last = entry.getValue();
            if (now != null && (now[0] != last[0] || now[1] != last[1])) {
                problems.add("재고 " + entry.getKey() + ": 마지막 이력의 후 값(" + last[0] + "/" + last[1]
                        + ")이 현재 값(" + now[0] + "/" + now[1] + ")과 다름");
            }
        }
        return problems;
    }

    static void assertConsistent(JdbcTemplate jdbc, Collection<Long> stockIds) {
        List<String> problems = findProblems(jdbc, stockIds);
        assertTrue(problems.isEmpty(), "재고 점검에서 어긋난 항목이 있습니다: " + problems);
    }

    private static long number(Map<String, Object> row, String column) {
        return ((Number) row.get(column)).longValue();
    }
}
