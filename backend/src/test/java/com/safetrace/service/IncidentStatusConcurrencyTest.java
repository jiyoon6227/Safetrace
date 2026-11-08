package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.domain.Member;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class IncidentStatusConcurrencyTest {

    @Autowired
    private IncidentService incidentService;

    @Autowired
    private IncidentMapper incidentMapper;

    @Autowired
    private MemberMapper memberMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long staffId;
    private Long incidentId;

    @BeforeEach
    void setUp() {
        Member staff = memberMapper.findByLoginId("staff");
        assertNotNull(staff, "schema.sql의 staff 계정이 없습니다.");
        staffId = staff.getMemberId();

        Incident incident = new Incident();
        incident.setTitle("동시성 테스트 사건");
        incident.setDisasterType("침수");
        incident.setSeverity("HIGH");
        incident.setRegion("대전광역시 유성구");
        incident.setLatitude(36.3504);
        incident.setLongitude(127.3845);
        incident.setAssignedStaffId(staffId);
        incidentMapper.insertIncident(incident);
        incidentId = incident.getIncidentId();

        incidentMapper.updateStatus(incidentId, "RECEIVED", "CONFIRMING");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM SF_NOTIFICATION WHERE INCIDENT_ID = ?", incidentId);
        jdbcTemplate.update("DELETE FROM SF_INCIDENT_LOG WHERE INCIDENT_ID = ?", incidentId);
        jdbcTemplate.update("DELETE FROM SF_INCIDENT WHERE INCIDENT_ID = ?", incidentId);
    }

    @Test
    void 같은_사건을_동시에_대응중으로_바꾸면_1건만_성공한다() throws Exception {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch ready = new CountDownLatch(threadCount);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger rejectedCount = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    ready.countDown();
                    start.await();   // 10개가 같이 출발하도록 대기
                    incidentService.changeStatus(incidentId, "RESPONDING", "현장 출동", staffId);
                    successCount.incrementAndGet();
                } catch (IllegalStateException e) {
                    rejectedCount.incrementAndGet();
                } catch (Exception e) {
                    System.out.println("예상 밖 예외: " + e);
                } finally {
                    done.countDown();
                }
            });
        }

        ready.await();
        start.countDown();
        boolean finished = done.await(30, TimeUnit.SECONDS);
        executor.shutdownNow();

        assertTrue(finished, "30초 안에 끝나지 않았습니다.");

        Incident result = incidentMapper.findById(incidentId);
        List<IncidentLog> logs = incidentMapper.findLogsByIncidentId(incidentId);
        long respondingLogCount = logs.stream()
                .filter(log -> "RESPONDING".equals(log.getNewStatus()))
                .count();

        System.out.println("동시 요청 " + threadCount + "건 → 성공 " + successCount.get()
                + "건, 거절 " + rejectedCount.get() + "건, 이력 " + respondingLogCount + "건");

        assertEquals(1, successCount.get());
        assertEquals(threadCount - 1, rejectedCount.get());
        assertEquals("RESPONDING", result.getStatus());
        assertEquals(1, respondingLogCount);
    }
}
