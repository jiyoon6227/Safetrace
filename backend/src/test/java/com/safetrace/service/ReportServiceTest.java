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

    // ---- 제보 등록 사진 주소 검증 ----------------------------------------------

    private Report reportWithPhotos(String photoUrl, List<String> additionalPhotoUrls) {
        Report report = new Report();
        report.setDisasterType("침수");
        report.setContent("도로가 잠겼어요");
        report.setPhotoUrl(photoUrl);
        report.setAdditionalPhotoUrls(additionalPhotoUrls);
        return report;
    }

    @Test
    void 제보_등록은_업로드한_사진_주소를_대표_사진부터_순서대로_저장한다() {
        Report report = reportWithPhotos("/uploads/a.jpg", List.of("/uploads/b.png", "/uploads/c.webp"));

        reportService.createReport(report, 5L);

        assertEquals(5L, report.getMemberId());
        verify(reportMapper).insert(report);
        verify(reportMapper).insertPhoto(any(), eq("/uploads/a.jpg"), eq(0));
        verify(reportMapper).insertPhoto(any(), eq("/uploads/b.png"), eq(1));
        verify(reportMapper).insertPhoto(any(), eq("/uploads/c.webp"), eq(2));
    }

    @Test
    void 사진_없이도_제보를_등록할_수_있다() {
        reportService.createReport(reportWithPhotos(null, null), 5L);
        reportService.createReport(reportWithPhotos("", List.of("", " ")), 5L);

        verify(reportMapper, times(2)).insert(any(Report.class));
        verify(reportMapper, never()).insertPhoto(any(), anyString(), anyInt());
    }

    @Test
    void 사진은_5장까지만_저장한다() {
        Report report = reportWithPhotos("/uploads/1.jpg",
                List.of("/uploads/2.jpg", "/uploads/3.jpg", "/uploads/4.jpg", "/uploads/5.jpg", "/uploads/6.jpg"));

        reportService.createReport(report, 5L);

        verify(reportMapper, times(5)).insertPhoto(any(), anyString(), anyInt());
        verify(reportMapper, never()).insertPhoto(any(), eq("/uploads/6.jpg"), anyInt());
    }

    @Test
    void 외부_주소나_스크립트_주소가_들어간_제보는_저장하지_않는다() {
        String[] invalid = {
                "http://evil.example/x.jpg",
                "javascript:alert(1)",
                "data:text/html;base64,PHNjcmlwdD4=",
                "/uploads/../../etc/passwd.jpg",
                "/uploads/x.jpg\" onerror=\"alert(1)",
                "/api/uploads/x.jpg",
                "/uploads/x.exe",
        };
        for (String url : invalid) {
            assertThrows(IllegalArgumentException.class,
                    () -> reportService.createReport(reportWithPhotos(url, null), 5L));
            assertThrows(IllegalArgumentException.class,
                    () -> reportService.createReport(reportWithPhotos(null, List.of("/uploads/ok.jpg", url)), 5L));
        }

        verify(reportMapper, never()).insert(any(Report.class));
        verify(reportMapper, never()).insertPhoto(any(), anyString(), anyInt());
    }

    @Test
    void 사진_5장을_넘는_위치에_숨긴_잘못된_주소도_검사한다() {
        Report report = reportWithPhotos("/uploads/1.jpg",
                List.of("/uploads/2.jpg", "/uploads/3.jpg", "/uploads/4.jpg", "/uploads/5.jpg", "http://evil.example/6.jpg"));

        assertThrows(IllegalArgumentException.class, () -> reportService.createReport(report, 5L));

        verify(reportMapper, never()).insert(any(Report.class));
    }
}
