package com.safetrace.controller;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.domain.Report;
import com.safetrace.dto.DashboardStatsResponse;
import com.safetrace.dto.IncidentCreateRequest;
import com.safetrace.dto.IncidentLogPublicResponse;
import com.safetrace.dto.IncidentPublicResponse;
import com.safetrace.dto.IncidentStatusChangeRequest;
import com.safetrace.dto.TypeMonthlyCount;
import com.safetrace.service.IncidentService;
import com.safetrace.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final ReportService reportService;

    // JwtAuthenticationFilter가 principal에 넣은 memberId
    private Long currentMemberId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    // 비로그인 요청이면 authentication이 null
    private boolean isStaff(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_STAFF".equals(authority.getAuthority()));
    }

    private List<?> toResponse(List<Incident> incidents, Authentication authentication) {
        return isStaff(authentication) ? incidents : incidents.stream().map(IncidentPublicResponse::from).toList();
    }

    // STAFF 전용 - 새 Incident 등록
    // 생성자를 담당자로 자동 배정
    @PostMapping
    @PreAuthorize("hasRole('STAFF')")
    public Incident create(@RequestBody @Valid IncidentCreateRequest request, Authentication authentication) {
        Incident incident = request.toIncident();
        incident.setAssignedStaffId(currentMemberId(authentication));
        return incidentService.createIncident(incident);
    }

    // 시민 화면 - 내 관심지역의 진행중인 Incident 목록
    @GetMapping("/region/{region}")
    public List<?> getByRegion(@PathVariable String region, Authentication authentication) {
        return toResponse(incidentService.getActiveIncidentsByRegion(region), authentication);
    }

    // 시민 화면 - 관심지역 좌표 기준 근처(기본 반경 5km) 진행중인 Incident 목록
    // region 문자열 완전일치(getByRegion) 대신, 관심지역에 저장된 실제 좌표로 조회할 때 사용
    @GetMapping("/nearby")
    public List<?> getNearby(@RequestParam double lat,
                             @RequestParam double lng,
                             @RequestParam(defaultValue = "5") double radiusKm,
                             Authentication authentication) {
        return toResponse(incidentService.getActiveIncidentsNearby(lat, lng, radiusKm), authentication);
    }

    // STAFF 전용 - 전체 Incident 목록 (대시보드용)
    @GetMapping
    @PreAuthorize("hasRole('STAFF')")
    public List<Incident> getAll() {
        return incidentService.getAllIncidents();
    }

    // 시민 화면 - "내 제보 추적" 타임라인
    @GetMapping("/{incidentId}/timeline")
    public List<?> getTimeline(@PathVariable Long incidentId, Authentication authentication) {
        List<IncidentLog> logs = incidentService.getTimeline(incidentId);
        return isStaff(authentication) ? logs : logs.stream().map(IncidentLogPublicResponse::from).toList();
    }

    // STAFF 전용 - 대시보드 카드/내 업무/지도 칩/최근 7일 통계
    // now는 화면 기준 현재 시각 (서버 시간대와 어긋나지 않게). 예: /api/incidents/stats/dashboard?now=2026-11-11T14:30:00
    @GetMapping("/stats/dashboard")
    @PreAuthorize("hasRole('STAFF')")
    public DashboardStatsResponse getDashboardStats(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime now,
            Authentication authentication) {
        return incidentService.getDashboardStats(now, currentMemberId(authentication));
    }

    // STAFF 전용 - 대시보드 사건 유형별 통계 (선택 월 + 전월). 예: /api/incidents/stats/types?month=2026-11
    @GetMapping("/stats/types")
    @PreAuthorize("hasRole('STAFF')")
    public List<TypeMonthlyCount> getMonthlyTypeStats(@RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return incidentService.getMonthlyTypeStats(month);
    }

    // 시민 화면 - 내 제보가 연결된 사건의 현재 진행 상태 확인 (뱃지/모달용)
    @GetMapping("/{incidentId}")
    public Object getOne(@PathVariable Long incidentId, Authentication authentication) {
        Incident incident = incidentService.getIncidentById(incidentId);
        return isStaff(authentication) ? incident : IncidentPublicResponse.from(incident);
    }

    // STAFF 전용 - 이 Incident에 묶인 제보 목록 (사건 상세 패널의 "연결된 제보")
    @GetMapping("/{incidentId}/reports")
    @PreAuthorize("hasRole('STAFF')")
    public List<Report> getLinkedReports(@PathVariable Long incidentId) {
        return reportService.getReportsByIncidentId(incidentId);
    }

    // STAFF 전용 - 사건 상세정보 수정 (제목/유형/위험도/위치)
    // STATUS·담당자는 전용 API(assign, status)에서만 변경
    @PatchMapping("/{incidentId}")
    @PreAuthorize("hasRole('STAFF')")
    public Incident updateDetails(@PathVariable Long incidentId,
                                  @RequestBody Incident incident,
                                  Authentication authentication) {
        Long staffId = currentMemberId(authentication);
        return incidentService.updateIncidentDetails(incidentId, incident, staffId);
    }

    // STAFF 전용 - "내가 담당하기": 담당자가 없는 사건을 로그인한 본인에게 배정
    @PatchMapping("/{incidentId}/assign")
    @PreAuthorize("hasRole('STAFF')")
    public Incident assign(@PathVariable Long incidentId, Authentication authentication) {
    Long staffId = currentMemberId(authentication);
    return incidentService.assignStaff(incidentId, staffId);
    }

    // STAFF 전용 - 상태 전이 (Workflow 핵심 API)
    // body 예시: { "status": "RESPONDING", "memo": "현장 도착, 도로 통제 시작" }
    @PatchMapping("/{incidentId}/status")
    @PreAuthorize("hasRole('STAFF')")
    public Incident changeStatus(@PathVariable Long incidentId,
                                  @RequestBody @Valid IncidentStatusChangeRequest request,
                                  Authentication authentication) {
        Long staffId = currentMemberId(authentication);
        return incidentService.changeStatus(incidentId, request.status(), request.memo(), staffId);
    }

    // STAFF 전용 - 관련 있을 만한 기존 Incident 후보 조회 (중복탐지)
    @GetMapping("/related")
    @PreAuthorize("hasRole('STAFF')")
    public List<Incident> findRelated(@RequestParam String disasterType,
                                       @RequestParam double lat,
                                       @RequestParam double lng) {
        return incidentService.findRelatedIncidents(disasterType, lat, lng);
    }

    // STAFF 전용 - 현장 사진 추가 (등록 순서대로 SF_INCIDENT_PHOTO에 쌓임. 최대 5장)
    // body 예시: { "photoUrl": "/uploads/xxx.jpg" }
    @PostMapping("/{incidentId}/photos")
    @PreAuthorize("hasRole('STAFF')")
    public Incident addPhoto(@PathVariable Long incidentId,
                             @RequestBody Map<String, String> body,
                             Authentication authentication) {
        Long staffId = currentMemberId(authentication);
        return incidentService.addIncidentPhoto(incidentId, body.get("photoUrl"), staffId);
    }

    // STAFF 전용 - 등록된 현장 사진 전체 목록 (0번째 = 대표)
    @GetMapping("/{incidentId}/photos")
    @PreAuthorize("hasRole('STAFF')")
    public List<String> getPhotos(@PathVariable Long incidentId) {
        return incidentService.getPhotoUrls(incidentId);
    }
}