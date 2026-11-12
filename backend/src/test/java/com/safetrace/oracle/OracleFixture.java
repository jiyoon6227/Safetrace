package com.safetrace.oracle;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 테스트가 만든 행만 추적해서 지운다. 이름에는 IT_ 표시와 무작위 값을 붙인다.
 * 테스트 전용 계정 안에서만 쓰지만, 시드 데이터(staff, admin 등)는 건드리지 않는다.
 */
final class OracleFixture {

    private final JdbcTemplate jdbc;
    private final String tag = UUID.randomUUID().toString().substring(0, 8);
    private final List<Long> memberIds = new ArrayList<>();
    private final List<Long> incidentIds = new ArrayList<>();
    private final List<Long> itemIds = new ArrayList<>();
    private final List<Long> stockIds = new ArrayList<>();
    private final List<Long> departmentIds = new ArrayList<>();
    private Long departmentId;
    private int reasonCounter;

    OracleFixture(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private long next(String sequence) {
        return jdbc.queryForObject("SELECT " + sequence + ".NEXTVAL FROM DUAL", Long.class);
    }

    long member(String role) {
        long id = next("SEQ_SF_MEMBER");
        jdbc.update("INSERT INTO SF_MEMBER (MEMBER_ID, LOGIN_ID, PASSWORD, NAME, ROLE) VALUES (?, ?, ?, ?, ?)",
                id, "IT_" + tag + "_" + id, "not-a-real-password", "IT_" + role + "_" + id, role);
        memberIds.add(id);
        return id;
    }

    long incident(long staffId, String status) {
        long id = next("SEQ_SF_INCIDENT");
        jdbc.update("INSERT INTO SF_INCIDENT (INCIDENT_ID, TITLE, DISASTER_TYPE, SEVERITY, STATUS, REGION, ASSIGNED_STAFF_ID) "
                        + "VALUES (?, ?, '침수', 'HIGH', ?, '대전광역시 유성구', ?)",
                id, "IT_사건_" + tag + "_" + id, status, staffId);
        incidentIds.add(id);
        return id;
    }

    private long department() {
        if (departmentId == null) {
            departmentId = next("SEQ_SF_DEPARTMENT");
            jdbc.update("INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME) VALUES (?, ?)",
                    departmentId, "IT_부서_" + tag);
            departmentIds.add(departmentId);
        }
        return departmentId;
    }

    /** 새 품목 + 그 품목의 재고 1건. 같은 (부서, 품목)은 한 번만 만들 수 있어서 재고마다 품목을 새로 만든다. */
    long stock(boolean returnable, int total, int available) {
        long itemId = next("SEQ_SF_RESOURCE_ITEM");
        jdbc.update("INSERT INTO SF_RESOURCE_ITEM (ITEM_ID, NAME, CATEGORY, UNIT, RETURNABLE) VALUES (?, ?, 'DRAINAGE', '개', ?)",
                itemId, "IT_품목_" + tag + "_" + itemId, returnable ? "Y" : "N");
        itemIds.add(itemId);

        long stockId = next("SEQ_SF_RESOURCE_STOCK");
        jdbc.update("INSERT INTO SF_RESOURCE_STOCK (STOCK_ID, DEPARTMENT_ID, ITEM_ID, TOTAL_QTY, AVAILABLE_QTY) VALUES (?, ?, ?, ?, ?)",
                stockId, department(), itemId, total, available);
        stockIds.add(stockId);
        return stockId;
    }

    /** 같은 내용 중복 요청(더블클릭) 방지에 걸리지 않도록 매번 다른 사유를 만든다. */
    String uniqueReason() {
        return "IT 사유 " + tag + "-" + (++reasonCounter);
    }

    List<Long> stockIds() {
        return List.copyOf(stockIds);
    }

    List<Long> incidentIds() {
        return List.copyOf(incidentIds);
    }

    /** 이 픽스처가 만든 행만 자식 → 부모 순서로 지운다. */
    void cleanup() {
        if (incidentIds.isEmpty() && stockIds.isEmpty() && memberIds.isEmpty()
                && itemIds.isEmpty() && departmentIds.isEmpty()) {
            return;
        }
        List<Long> requestIds = new ArrayList<>();
        if (!incidentIds.isEmpty()) {
            requestIds.addAll(jdbc.queryForList(
                    "SELECT REQUEST_ID FROM SF_RESOURCE_REQUEST WHERE INCIDENT_ID IN (" + in(incidentIds) + ")", Long.class));
        }
        if (!stockIds.isEmpty()) {
            for (Long id : jdbc.queryForList(
                    "SELECT REQUEST_ID FROM SF_RESOURCE_REQUEST WHERE STOCK_ID IN (" + in(stockIds) + ")", Long.class)) {
                if (!requestIds.contains(id)) {
                    requestIds.add(id);
                }
            }
        }
        if (!requestIds.isEmpty()) {
            String requests = in(requestIds);
            jdbc.update("DELETE FROM SF_RESOURCE_LOG WHERE REQUEST_ID IN (" + requests + ")");
            jdbc.update("DELETE FROM SF_RESOURCE_STOCK_LOG WHERE REQUEST_ID IN (" + requests + ")");
            jdbc.update("DELETE FROM SF_RESOURCE_RETURN WHERE REQUEST_ID IN (" + requests + ")");
        }
        if (!stockIds.isEmpty()) {
            jdbc.update("DELETE FROM SF_RESOURCE_STOCK_LOG WHERE STOCK_ID IN (" + in(stockIds) + ")");
        }
        if (!requestIds.isEmpty()) {
            jdbc.update("DELETE FROM SF_RESOURCE_REQUEST WHERE REQUEST_ID IN (" + in(requestIds) + ")");
        }
        if (!incidentIds.isEmpty()) {
            String incidents = in(incidentIds);
            jdbc.update("DELETE FROM SF_NOTIFICATION WHERE INCIDENT_ID IN (" + incidents + ")");
            jdbc.update("DELETE FROM SF_INCIDENT_LOG WHERE INCIDENT_ID IN (" + incidents + ")");
            jdbc.update("DELETE FROM SF_INCIDENT WHERE INCIDENT_ID IN (" + incidents + ")");
        }
        if (!stockIds.isEmpty()) {
            jdbc.update("DELETE FROM SF_RESOURCE_STOCK WHERE STOCK_ID IN (" + in(stockIds) + ")");
        }
        if (!itemIds.isEmpty()) {
            jdbc.update("DELETE FROM SF_RESOURCE_ITEM WHERE ITEM_ID IN (" + in(itemIds) + ")");
        }
        if (!memberIds.isEmpty()) {
            jdbc.update("DELETE FROM SF_MEMBER WHERE MEMBER_ID IN (" + in(memberIds) + ")");
        }
        if (!departmentIds.isEmpty()) {
            jdbc.update("DELETE FROM SF_DEPARTMENT WHERE DEPARTMENT_ID IN (" + in(departmentIds) + ")");
        }
        memberIds.clear();
        incidentIds.clear();
        itemIds.clear();
        stockIds.clear();
        departmentIds.clear();
        departmentId = null;
    }

    private static String in(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }
}
