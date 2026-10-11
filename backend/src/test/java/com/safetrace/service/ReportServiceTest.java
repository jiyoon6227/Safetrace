package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Report;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.ReportMapper;
import com.safetrace.websocket.ReportWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    @Test
    void 제보_작성자_본인은_사진목록을_볼수_있다() {
        Report report = new Report();
        report.setReportId(1L);
        report.setMemberId(5L);

        when(reportMapper.findById(1L)).thenReturn(report);
        when(reportMapper.findPhotoUrlsByReportId(1L)).thenReturn(List.of("/uploads/a.jpg", "/uploads/b.jpg"));

        assertEquals(List.of("/uploads/a.jpg", "/uploads/b.jpg"), reportService.getPhotoUrls(1L, 5L, false));
    }

    @Test
    void STAFF는_다른사람의_제보사진도_볼수_있다() {
        Report report = new Report();
        report.setReportId(1L);
        report.setMemberId(5L);

        when(reportMapper.findById(1L)).thenReturn(report);
        when(reportMapper.findPhotoUrlsByReportId(1L)).thenReturn(List.of("/uploads/a.jpg"));

        assertEquals(List.of("/uploads/a.jpg"), reportService.getPhotoUrls(1L, 99L, true));
    }

    @Test
    void 다른_시민은_제보사진을_볼수_없다() {
        Report report = new Report();
        report.setReportId(1L);
        report.setMemberId(5L);

        when(reportMapper.findById(1L)).thenReturn(report);

        assertThrows(
                AccessDeniedException.class,
                () -> reportService.getPhotoUrls(1L, 20L, false)
        );

        verify(reportMapper, never()).findPhotoUrlsByReportId(anyLong());
    }
}
