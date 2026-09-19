package com.safetrace.controller;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Report;
import com.safetrace.service.IncidentService;
import com.safetrace.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final IncidentService incidentService;

    // 시민 - 현장제보 등록
    // body 예시: { "disasterType": "침수", "content": "도로에 물이 차고 있어요", "latitude": 36.35, "longitude": 127.38 }
    @PostMapping
    public Report create(@RequestBody Report report, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return reportService.createReport(report, memberId);
    }

    // STAFF 전용 - 아직 사건에 연결 안 된 제보 목록 (제보 관리 탭)
    @GetMapping
    @PreAuthorize("hasRole('STAFF')")
    public List<Report> getUnlinked() {
        return reportService.getUnlinkedReports();
    }

    // STAFF 전용 - 사건전환 여부와 무관하게 전체 제보 목록 (전환된 제보도 이력으로 계속 조회)
    @GetMapping("/all")
    @PreAuthorize("hasRole('STAFF')")
    public List<Report> getAll() {
        return reportService.getAllReports();
    }

    // 시민 전용 - 내가 등록한 제보 목록 (내 제보 추적 화면)
    // "/my"가 "/{reportId}" 계열 경로와 겹치지 않는지 확인: 현재 GET 단일조회 경로가 없어서 충돌 없음
    @GetMapping("/my")
    public List<Report> getMyReports(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return reportService.getMyReports(memberId);
    }

    // STAFF 전용 - 이 제보와 관련 있을 만한 기존 Incident 후보 조회 (중복탐지 재사용)
    @GetMapping("/{reportId}/candidates")
    @PreAuthorize("hasRole('STAFF')")
    public List<Incident> getCandidates(@PathVariable Long reportId) {
        Report report = reportService.getById(reportId);
        return incidentService.findRelatedIncidents(
                report.getDisasterType(), report.getLatitude(), report.getLongitude());
    }

    // STAFF 전용 - 제보를 실제로 특정 Incident에 연결 (제보 병합 실행)
    // body 예시: { "incidentId": 42 }
    @PatchMapping("/{reportId}/link")
    @PreAuthorize("hasRole('STAFF')")
    public Report link(@PathVariable Long reportId, @RequestBody Map<String, Long> body) {
        return reportService.linkToIncident(reportId, body.get("incidentId"));
    }

    // STAFF 전용 - 제보를 검토 중으로 표시
    @PatchMapping("/{reportId}/review")
    @PreAuthorize("hasRole('STAFF')")
    public Report review(@PathVariable Long reportId) {
        return reportService.markReviewing(reportId);
    }

    // STAFF 전용 - 제보 반려 (원본은 삭제하지 않고 상태/사유만 기록)
    // body 예시: { "reason": "중복 제보로 확인됨" }
    @PatchMapping("/{reportId}/reject")
    @PreAuthorize("hasRole('STAFF')")
    public Report reject(@PathVariable Long reportId, @RequestBody Map<String, String> body) {
        return reportService.reject(reportId, body.get("reason"));
    }

    // STAFF 전용 - 제보에 등록된 사진 전체 목록 (0번째 = 대표)
    @GetMapping("/{reportId}/photos")
    @PreAuthorize("hasRole('STAFF')")
    public List<String> getPhotos(@PathVariable Long reportId) {
        return reportService.getPhotoUrls(reportId);
    }
}