package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Report;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.ReportMapper;
import com.safetrace.websocket.ReportWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ReportServiceTest {

    private ReportMapper reportMapper;
    private IncidentMapper incidentMapper;
    private ReportWebSocketHandler reportWebSocketHandler;

    private ReportService reportService;

    @BeforeEach
    void setUp() {
        reportMapper = mock(ReportMapper.class);
        incidentMapper = mock(IncidentMapper.class);
        reportWebSocketHandler = mock(ReportWebSocketHandler.class);

        reportService = new ReportService(
                reportMapper,
                incidentMapper,
                reportWebSocketHandler
        );
    }

    @Test
    void 다른담당자가_먼저처리한_제보는_중복연결을_막는다() {
        Report report = new Report();
        report.setReportId(1L);
        report.setStatus("RECEIVED");
        report.setIncidentId(null);

        Incident incident = new Incident();
        incident.setIncidentId(100L);
        incident.setStatus("RESPONDING");

        when(reportMapper.findById(1L)).thenReturn(report);
        when(incidentMapper.findById(100L)).thenReturn(incident);

        // UPDATE 결과가 0건이라는 것은 다른 담당자가 먼저 처리해
        // 현재 제보가 더 이상 처리 가능한 상태가 아니라는 의미
        when(reportMapper.linkIncident(1L, 100L)).thenReturn(0);

        assertThrows(
                IllegalStateException.class,
                () -> reportService.linkToIncident(1L, 100L)
        );

        verify(reportMapper).linkIncident(1L, 100L);
        verify(reportWebSocketHandler, never()).broadcastReportLinked(any());
    }
}
