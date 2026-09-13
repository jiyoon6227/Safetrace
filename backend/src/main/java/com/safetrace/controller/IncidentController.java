package com.safetrace.controller;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
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
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final ReportService reportService;

    // JwtAuthenticationFilter가 토큰에서 꺼낸 memberId를 principal로 넣어주기 때문에
    // 컨트롤러에서는 이렇게 꺼내 쓰면 "지금 로그인한 사람이 누구인지"를 알 수 있음
    private Long currentMemberId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    // STAFF 전용 - 새 Incident 등록
    // 생성한 담당자를 자동으로 배정 - 상태 변경 화면에서 따로 "담당자 지정" 안 해도
    // 사건이 만들어지는 시점에 이미 담당자가 붙어있게 하기 위함
    @PostMapping
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public Incident create(@RequestBody Incident incident, Authentication authentication) {
        incident.setAssignedStaffId(currentMemberId(authentication));
        return incidentService.createIncident(incident);
    }

    // 시민 화면 - 내 관심지역의 진행중인 Incident 목록
    @GetMapping("/region/{region}")
    public List<Incident> getByRegion(@PathVariable String region) {
        return incidentService.getActiveIncidentsByRegion(region);
    }

    // 시민 화면 - 관심지역 좌표 기준 근처(기본 반경 5km) 진행중인 Incident 목록
    // region 문자열 완전일치(getByRegion) 대신, 관심지역에 저장된 실제 좌표로 조회할 때 사용
    @GetMapping("/nearby")
    public List<Incident> getNearby(@RequestParam double lat,
                                     @RequestParam double lng,
                                     @RequestParam(defaultValue = "5") double radiusKm) {
        return incidentService.getActiveIncidentsNearby(lat, lng, radiusKm);
    }

    // STAFF 전용 - 전체 Incident 목록 (대시보드용)
    @GetMapping
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public List<Incident> getAll() {
        return incidentService.getAllIncidents();
    }

    // 시민 화면 - "내 제보 추적" 타임라인
    @GetMapping("/{incidentId}/timeline")
    public List<IncidentLog> getTimeline(@PathVariable Long incidentId) {
        return incidentService.getTimeline(incidentId);
    }

    // 시민 화면 - 내 제보가 연결된 사건의 현재 진행 상태 확인 (뱃지/모달용)
    @GetMapping("/{incidentId}")
    public Incident getOne(@PathVariable Long incidentId) {
        return incidentService.getIncidentById(incidentId);
    }

    // STAFF 전용 - 이 Incident에 묶인 제보 목록 (사건 상세 패널의 "연결된 제보")
    @GetMapping("/{incidentId}/reports")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public List<Report> getLinkedReports(@PathVariable Long incidentId) {
        return reportService.getReportsByIncidentId(incidentId);
    }

    // STAFF 전용 - 사건 상세정보 수정 (제목/유형/위험도/위치/현장사진)
    // STATUS/담당자는 여기서 안 바꿈 - 각자 전용 API(assign, status)를 써야 함
    @PatchMapping("/{incidentId}")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public Incident updateDetails(@PathVariable Long incidentId, @RequestBody Incident incident) {
        return incidentService.updateIncidentDetails(incidentId, incident);
    }

    // STAFF 전용 - 담당자 배정
    @PatchMapping("/{incidentId}/assign")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public Incident assign(@PathVariable Long incidentId, @RequestBody Map<String, Long> body) {
        return incidentService.assignStaff(incidentId, body.get("staffId"));
    }

    // STAFF 전용 - 상태 전이 (Workflow 핵심 API)
    // body 예시: { "status": "RESPONDING", "memo": "현장 도착, 도로 통제 시작" }
    @PatchMapping("/{incidentId}/status")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public Incident changeStatus(@PathVariable Long incidentId,
                                  @RequestBody Map<String, String> body,
                                  Authentication authentication) {
        Long staffId = currentMemberId(authentication); // 로그인한 담당자 ID를 그대로 사용 (예전엔 1L로 고정돼 있었음)
        return incidentService.changeStatus(incidentId, body.get("status"), body.get("memo"), staffId);
    }

    // 시민제보 접수 시 - 관련 있을 만한 기존 Incident 후보 조회 (중복탐지)
    @GetMapping("/related")
    public List<Incident> findRelated(@RequestParam String disasterType,
                                       @RequestParam double lat,
                                       @RequestParam double lng) {
        return incidentService.findRelatedIncidents(disasterType, lat, lng);
    }

    // STAFF 전용 - 현장 사진 추가 (등록 순서대로 SF_INCIDENT_PHOTO에 쌓임. 최대 5장)
    // body 예시: { "photoUrl": "/uploads/xxx.jpg" }
    @PostMapping("/{incidentId}/photos")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public Incident addPhoto(@PathVariable Long incidentId, @RequestBody Map<String, String> body) {
        return incidentService.addIncidentPhoto(incidentId, body.get("photoUrl"));
    }

    // STAFF 전용 - 등록된 현장 사진 전체 목록 (0번째 = 대표)
    @GetMapping("/{incidentId}/photos")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public List<String> getPhotos(@PathVariable Long incidentId) {
        return incidentService.getPhotoUrls(incidentId);
    }
}