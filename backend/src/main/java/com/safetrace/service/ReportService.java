package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Report;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.ReportMapper;
import com.safetrace.websocket.ReportWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportMapper reportMapper;
    private final IncidentMapper incidentMapper;
    private final ReportWebSocketHandler reportWebSocketHandler;

    // 제보 사진은 최대 5장까지 - 전부 SF_REPORT_PHOTO 한 테이블에서만 관리
    private static final int MAX_PHOTOS = 5;

    // 시민이 현장제보를 등록
    @Transactional
    public Report createReport(Report report, Long memberId) {
        report.setMemberId(memberId);
        reportMapper.insert(report);

        // 사진은 컬럼이 아니라 SF_REPORT_PHOTO에만 저장 - photoUrl이 0번째(대표), additionalPhotoUrls가 이어서 쌓임
        List<String> photos = new java.util.ArrayList<>();
        if (report.getPhotoUrl() != null && !report.getPhotoUrl().isBlank()) {
            photos.add(report.getPhotoUrl());
        }
        if (report.getAdditionalPhotoUrls() != null) {
            report.getAdditionalPhotoUrls().stream()
                    .filter(url -> url != null && !url.isBlank())
                    .forEach(photos::add);
        }
        photos = photos.stream().limit(MAX_PHOTOS).toList();
        for (int i = 0; i < photos.size(); i++) {
            reportMapper.insertPhoto(report.getReportId(), photos.get(i), i);
        }

        Report created = reportMapper.findById(report.getReportId());
        broadcastAfterCommit(() -> reportWebSocketHandler.broadcastReportCreated(created));
        return created;
    }

    public Report getById(Long reportId) {
        return getReportOrThrow(reportId);
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
        Report report = getReportOrThrow(reportId);

        if (incidentId == null) {
            throw new IllegalArgumentException("연결할 사건을 선택해주세요.");
        }

        // 접수/검토중인 제보만 사건으로 연결할 수 있다.
        // 이미 LINKED/REJECTED 된 제보를 API 직접 호출로 다시 변경하는 것을 차단한다.
        requireProcessableReport(report, "사건 연결");

        Incident incident = incidentMapper.findById(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 사건입니다: " + incidentId);
        }
        if ("CLOSED".equals(incident.getStatus())) {
            throw new IllegalStateException("종료된 사건에는 새 제보를 연결할 수 없습니다.");
        }

        int affected = reportMapper.linkIncident(reportId, incidentId);
        if (affected != 1) {
            throw new IllegalStateException("이미 다른 담당자가 처리한 제보입니다. 목록을 새로고침해주세요.");
        }

        Report updated = reportMapper.findById(reportId);
        broadcastAfterCommit(() -> reportWebSocketHandler.broadcastReportLinked(updated));
        return updated;
    }

    // 담당자가 제보를 검토 중으로 표시
    @Transactional
    public Report markReviewing(Long reportId) {
        Report report = getReportOrThrow(reportId);

        if (!"RECEIVED".equals(report.getStatus()) || report.getIncidentId() != null) {
            throw new IllegalStateException("접수 상태의 미처리 제보만 검토중으로 변경할 수 있습니다.");
        }

        int affected = reportMapper.markReviewing(reportId);
        if (affected != 1) {
            throw new IllegalStateException("이미 다른 담당자가 처리한 제보입니다. 목록을 새로고침해주세요.");
        }

        Report updated = reportMapper.findById(reportId);
        broadcastAfterCommit(() -> reportWebSocketHandler.broadcastReportReviewing(updated));
        return updated;
    }

    // 담당자가 제보를 반려 - 원본 제보는 삭제하지 않고 상태와 사유만 남김
    @Transactional
    public Report reject(Long reportId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("반려 사유를 입력해주세요.");
        }

        Report report = getReportOrThrow(reportId);
        requireProcessableReport(report, "반려");

        int affected = reportMapper.reject(reportId, reason.trim());
        if (affected != 1) {
            throw new IllegalStateException("이미 다른 담당자가 처리한 제보입니다. 목록을 새로고침해주세요.");
        }

        Report updated = reportMapper.findById(reportId);
        broadcastAfterCommit(() -> reportWebSocketHandler.broadcastReportRejected(updated));
        return updated;
    }

    private Report getReportOrThrow(Long reportId) {
        if (reportId == null) {
            throw new IllegalArgumentException("제보 번호가 없습니다.");
        }

        Report report = reportMapper.findById(reportId);
        if (report == null) {
            throw new IllegalArgumentException("존재하지 않는 제보입니다: " + reportId);
        }
        return report;
    }

    /**
     * 아직 최종 처리되지 않은 제보만 사건 연결/반려할 수 있다.
     * UI에서 버튼을 숨기는 것만으로는 API 직접 호출을 막을 수 없으므로 서버에서 강제한다.
     */
    private void requireProcessableReport(Report report, String actionName) {
        boolean allowedStatus =
                "RECEIVED".equals(report.getStatus())
                || "REVIEWING".equals(report.getStatus());

        if (!allowedStatus || report.getIncidentId() != null) {
            throw new IllegalStateException(
                    "이미 처리된 제보는 " + actionName + " 처리할 수 없습니다."
            );
        }
    }

    private void broadcastAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    // STAFF 사건 상세 화면 - 이 Incident에 묶인 제보들
    public List<Report> getReportsByIncidentId(Long incidentId) {
        return reportMapper.findByIncidentId(incidentId);
    }

    // 제보 상세 - 등록된 사진 전체 목록 (0번째 = 대표)
    public List<String> getPhotoUrls(Long reportId) {
        return reportMapper.findPhotoUrlsByReportId(reportId);
    }
}