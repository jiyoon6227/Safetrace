package com.safetrace.service;

import com.safetrace.domain.Report;
import com.safetrace.mapper.ReportMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportMapper reportMapper;

    // 시민이 현장제보를 등록
    @Transactional
    public Report createReport(Report report, Long memberId) {
        report.setMemberId(memberId);
        reportMapper.insert(report);
        return reportMapper.findById(report.getReportId());
    }

    public Report getById(Long reportId) {
        Report report = reportMapper.findById(reportId);
        if (report == null) {
            throw new IllegalArgumentException("존재하지 않는 제보입니다: " + reportId);
        }
        return report;
    }

    // STAFF 제보 관리 탭 - 아직 사건에 연결되지 않은 제보 목록
    public List<Report> getUnlinkedReports() {
        return reportMapper.findUnlinked();
    }

    // STAFF 제보 관리 탭 - 사건전환 여부와 무관하게 전체 제보 목록 (원본 제보는 사건화 이후에도 이력으로 보존)
    public List<Report> getAllReports() {
        return reportMapper.findAll();
    }

    // 시민 화면 - 내가 등록한 제보 목록 (내 제보 추적)
    public List<Report> getMyReports(Long memberId) {
        return reportMapper.findByMemberId(memberId);
    }

    // 제보 병합의 실제 실행 단계: 후보로 찾은 Incident에 이 제보를 연결
    @Transactional
    public Report linkToIncident(Long reportId, Long incidentId) {
        reportMapper.linkIncident(reportId, incidentId);
        return reportMapper.findById(reportId);
    }

    // 담당자가 제보를 검토 중으로 표시
    @Transactional
    public Report markReviewing(Long reportId) {
        reportMapper.markReviewing(reportId);
        return reportMapper.findById(reportId);
    }

    // 담당자가 제보를 반려 - 원본 제보는 삭제하지 않고 상태와 사유만 남김
    @Transactional
    public Report reject(Long reportId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("반려 사유를 입력해주세요.");
        }
        reportMapper.reject(reportId, reason);
        return reportMapper.findById(reportId);
    }

    // STAFF 사건 상세 화면 - 이 Incident에 묶인 제보들
    public List<Report> getReportsByIncidentId(Long incidentId) {
        return reportMapper.findByIncidentId(incidentId);
    }
}