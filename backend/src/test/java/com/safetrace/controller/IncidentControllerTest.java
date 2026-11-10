package com.safetrace.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.dto.IncidentLogPublicResponse;
import com.safetrace.dto.IncidentPublicResponse;
import com.safetrace.service.IncidentService;
import com.safetrace.service.ReportService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IncidentControllerTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private IncidentService incidentService;
    private IncidentController incidentController;

    private Incident incident;
    private IncidentLog log;

    @BeforeEach
    void setUp() {
        incidentService = mock(IncidentService.class);
        incidentController = new IncidentController(incidentService, mock(ReportService.class));

        incident = incident();
        log = log();

        when(incidentService.getIncidentById(1L)).thenReturn(incident);
        when(incidentService.getTimeline(1L)).thenReturn(List.of(log));
        when(incidentService.getActiveIncidentsByRegion("서울")).thenReturn(List.of(incident));
        when(incidentService.getActiveIncidentsNearby(37.5, 127.0, 5)).thenReturn(List.of(incident));
        when(incidentService.findRelatedIncidents("침수", 37.5, 127.0)).thenReturn(List.of(incident));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 비로그인은_관련사건을_조회할수없다() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThrows(AccessDeniedException.class, () -> securedController().findRelated("침수", 37.5, 127.0));
    }

    @Test
    void USER는_관련사건을_조회할수없다() {
        SecurityContextHolder.getContext().setAuthentication(user());

        assertThrows(AccessDeniedException.class, () -> securedController().findRelated("침수", 37.5, 127.0));
    }

    @Test
    void STAFF는_관련사건을_조회할수있다() {
        SecurityContextHolder.getContext().setAuthentication(staff());

        assertSame(incident, securedController().findRelated("침수", 37.5, 127.0).get(0));
    }

    @Test
    void 비로그인_사건조회는_공개용응답을_반환한다() {
        assertPublicIncident(incidentController.getOne(1L, null));
    }

    @Test
    void USER_사건조회는_공개용응답을_반환한다() {
        assertPublicIncident(incidentController.getOne(1L, user()));
    }

    @Test
    void STAFF_사건조회는_기존_Incident를_반환한다() {
        assertSame(incident, incidentController.getOne(1L, staff()));
    }

    @Test
    void 비로그인_타임라인은_공개용응답을_반환한다() {
        assertPublicLog(incidentController.getTimeline(1L, null));
    }

    @Test
    void USER_타임라인은_공개용응답을_반환한다() {
        assertPublicLog(incidentController.getTimeline(1L, user()));
    }

    @Test
    void STAFF_타임라인은_기존_IncidentLog를_반환한다() {
        assertSame(log, incidentController.getTimeline(1L, staff()).get(0));
    }

    @Test
    void 비로그인_지역조회는_공개용응답을_반환한다() {
        assertPublicIncident(incidentController.getByRegion("서울", null).get(0));
    }

    @Test
    void USER_지역조회는_공개용응답을_반환한다() {
        assertPublicIncident(incidentController.getByRegion("서울", user()).get(0));
    }

    @Test
    void STAFF_지역조회는_기존_Incident를_반환한다() {
        assertSame(incident, incidentController.getByRegion("서울", staff()).get(0));
    }

    @Test
    void 비로그인_근처조회는_공개용응답을_반환한다() {
        assertPublicIncident(incidentController.getNearby(37.5, 127.0, 5, null).get(0));
    }

    @Test
    void USER_근처조회는_공개용응답을_반환한다() {
        assertPublicIncident(incidentController.getNearby(37.5, 127.0, 5, user()).get(0));
    }

    @Test
    void STAFF_근처조회는_기존_Incident를_반환한다() {
        assertSame(incident, incidentController.getNearby(37.5, 127.0, 5, staff()).get(0));
    }

    // @PreAuthorize가 실제로 적용되는 프록시
    private IncidentController securedController() {
        ProxyFactory proxyFactory = new ProxyFactory(incidentController);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        return (IncidentController) proxyFactory.getProxy();
    }

    private void assertPublicIncident(Object response) {
        assertInstanceOf(IncidentPublicResponse.class, response);

        JsonNode json = objectMapper.valueToTree(response);
        assertEquals(1L, json.get("incidentId").asLong());
        assertEquals("도로 침수", json.get("title").asText());
        assertEquals("RESPONDING", json.get("status").asText());
        assertFalse(json.has("assignedStaffId"));
        assertFalse(json.has("assignedStaffName"));
        assertFalse(json.has("sourceReportId"));
        assertFalse(json.has("closeReason"));
    }

    private void assertPublicLog(List<?> response) {
        assertEquals(1, response.size());
        assertInstanceOf(IncidentLogPublicResponse.class, response.get(0));

        JsonNode json = objectMapper.valueToTree(response.get(0));
        assertEquals(100L, json.get("logId").asLong());
        assertEquals("RECEIVED", json.get("prevStatus").asText());
        assertEquals("RESPONDING", json.get("newStatus").asText());
        assertEquals("도로 통제 완료", json.get("memo").asText());
        assertTrue(json.has("changedAt"));
        assertFalse(json.has("changedBy"));
    }

    private Authentication user() {
        return new UsernamePasswordAuthenticationToken(2L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private Authentication staff() {
        return new UsernamePasswordAuthenticationToken(10L, null, List.of(new SimpleGrantedAuthority("ROLE_STAFF")));
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

    private IncidentLog log() {
        IncidentLog log = new IncidentLog();
        log.setLogId(100L);
        log.setIncidentId(1L);
        log.setPrevStatus("RECEIVED");
        log.setNewStatus("RESPONDING");
        log.setMemo("도로 통제 완료");
        log.setChangedBy(10L);
        log.setChangedAt(LocalDateTime.of(2026, 9, 13, 10, 0));
        return log;
    }
}
