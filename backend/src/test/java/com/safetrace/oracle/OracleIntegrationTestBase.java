package com.safetrace.oracle;

import com.safetrace.domain.ResourceRequest;
import com.safetrace.dto.ResourceRequestCreateRequest;
import com.safetrace.service.IncidentService;
import com.safetrace.service.ResourceApprovalService;
import com.safetrace.service.ResourceFulfillmentService;
import com.safetrace.service.ResourceRequestService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 실제 Oracle(테스트 전용 계정)에 붙는 통합 테스트의 공통 뼈대.
 *  - SAFETRACE_TEST_DB_PASSWORD 환경변수가 없으면 테스트 전체를 건너뛴다.
 *  - 접속 정보는 아래 properties로 테스트 계정 쪽으로 못 박는다(개발 DB 설정이 섞여 들어오지 않게).
 *  - 접속 계정 이름이 _TEST로 끝나는지 (1) 시작 전 OracleTestGuard (2) 접속 직후 SELECT USER 로 두 번 확인한다.
 */
@SpringBootTest(properties = {
        "spring.datasource.driver-class-name=oracle.jdbc.OracleDriver",
        "spring.datasource.url=${SAFETRACE_TEST_DB_URL:jdbc:oracle:thin:@//localhost:1521/XEPDB1}",
        "spring.datasource.username=${SAFETRACE_TEST_DB_USERNAME:safetrace_test}",
        "spring.datasource.password=${SAFETRACE_TEST_DB_PASSWORD}"
})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = OracleTestGuard.PASSWORD_ENV, matches = ".+")
@ExtendWith(OracleTestGuard.class)
abstract class OracleIntegrationTestBase {

    @Autowired
    protected JdbcTemplate jdbc;
    @Autowired
    protected ResourceRequestService requestService;
    @Autowired
    protected ResourceApprovalService approvalService;
    @Autowired
    protected ResourceFulfillmentService fulfillmentService;
    @Autowired
    protected IncidentService incidentService;

    protected OracleFixture fx;

    @BeforeEach
    void connectToTestAccountOnly() {
        String user = jdbc.queryForObject("SELECT USER FROM DUAL", String.class);
        assertTrue(user != null && user.toUpperCase(Locale.ROOT).endsWith("_TEST"),
                "테스트 전용 계정이 아닌 곳에 접속했습니다: " + user + " (테스트를 중단합니다)");
        Integer tables = jdbc.queryForObject(
                "SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME IN ('SF_RESOURCE_REQUEST', 'SF_RESOURCE_RETURN', 'SF_RESOURCE_STOCK_LOG')",
                Integer.class);
        assertEquals(3, tables, "테스트 계정에 schema.sql이 아직 실행되지 않았습니다.");
        fx = new OracleFixture(jdbc);
    }

    @AfterEach
    void removeOwnRows() {
        if (fx != null) {
            fx.cleanup();
        }
    }

    /** 담당 직원이 자원 요청 1건을 만든다. */
    protected long createRequest(long staffId, long incidentId, long stockId, int quantity) {
        ResourceRequest created = requestService.createRequest(staffId,
                new ResourceRequestCreateRequest(incidentId, stockId, quantity, fx.uniqueReason(), null));
        assertNotNull(created.getRequestId());
        return created.getRequestId();
    }

    protected long createApproved(long staffId, long adminId, long incidentId, long stockId, int quantity) {
        long requestId = createRequest(staffId, incidentId, stockId, quantity);
        approvalService.approve(adminId, requestId);
        return requestId;
    }

    protected long createDispatched(long staffId, long adminId, long incidentId, long stockId, int quantity) {
        long requestId = createApproved(staffId, adminId, incidentId, stockId, quantity);
        fulfillmentService.dispatch(adminId, requestId);
        return requestId;
    }

    protected String requestStatus(long requestId) {
        return jdbc.queryForObject("SELECT STATUS FROM SF_RESOURCE_REQUEST WHERE REQUEST_ID = ?", String.class, requestId);
    }

    protected String incidentStatus(long incidentId) {
        return jdbc.queryForObject("SELECT STATUS FROM SF_INCIDENT WHERE INCIDENT_ID = ?", String.class, incidentId);
    }

    protected int totalQty(long stockId) {
        return jdbc.queryForObject("SELECT TOTAL_QTY FROM SF_RESOURCE_STOCK WHERE STOCK_ID = ?", Integer.class, stockId);
    }

    protected int availableQty(long stockId) {
        return jdbc.queryForObject("SELECT AVAILABLE_QTY FROM SF_RESOURCE_STOCK WHERE STOCK_ID = ?", Integer.class, stockId);
    }

    protected int logCount(long requestId, String action) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM SF_RESOURCE_LOG WHERE REQUEST_ID = ? AND ACTION = ?",
                Integer.class, requestId, action);
    }

    protected int stockLogCount(long stockId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM SF_RESOURCE_STOCK_LOG WHERE STOCK_ID = ?", Integer.class, stockId);
    }

    protected void assertStockConsistent() {
        StockInvariants.assertConsistent(jdbc, fx.stockIds());
    }
}
