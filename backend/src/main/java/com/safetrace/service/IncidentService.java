package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.domain.IncidentStatus;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.websocket.IncidentWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentMapper incidentMapper;
    private final IncidentWebSocketHandler webSocketHandler;

    // 중복탐지 기준값 (기술서에 "왜 이 값을 썼는지" 설명할 수 있어야 함)
    private static final double DUPLICATE_RADIUS_METERS = 500.0;
    private static final int DUPLICATE_TIME_WINDOW_MINUTES = 30;

    /**
     * 새 Incident 생성.
     * 생성과 동시에 STAFF 상황판에 WebSocket으로 실시간 전파한다.
     */
    @Transactional
    public Incident createIncident(Incident incident) {
        incidentMapper.insertIncident(incident);

        IncidentLog log = new IncidentLog();
        log.setIncidentId(incident.getIncidentId());
        log.setPrevStatus(null);
        log.setNewStatus(IncidentStatus.RECEIVED.name());
        log.setMemo("Incident 최초 생성");
        incidentMapper.insertLog(log);

        webSocketHandler.broadcastIncidentCreated(incident);
        return incidentMapper.findById(incident.getIncidentId());
    }

    /**
     * 상태 전이. Workflow 업무규칙을 여기서 강제한다.
     *  - 담당자 미배정 시 RESPONDING(대응중) 전환 불가
     *  - 단계를 건너뛸 수 없음 (IncidentStatus.canTransitionTo에서 검증)
     *  - CLOSED 전환 시 조치내역(memo) 필수
     */
    @Transactional
    public Incident changeStatus(Long incidentId, String targetStatusStr, String memo, Long staffId) {
        Incident incident = incidentMapper.findById(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }

        IncidentStatus current = IncidentStatus.valueOf(incident.getStatus());
        IncidentStatus target = IncidentStatus.valueOf(targetStatusStr);

        if (!current.canTransitionTo(target)) {
            throw new IllegalStateException(
                String.format("%s 상태에서 %s(으)로 바로 전환할 수 없습니다.", current.getLabel(), target.getLabel())
            );
        }

        if (target == IncidentStatus.RESPONDING && incident.getAssignedStaffId() == null) {
            throw new IllegalStateException("담당자가 배정되지 않아 대응중으로 전환할 수 없습니다.");
        }

        if (target == IncidentStatus.CLOSED && (memo == null || memo.isBlank())) {
            throw new IllegalStateException("종료 처리에는 조치내역(종료사유)이 필요합니다.");
        }

        if (target == IncidentStatus.CLOSED) {
            incidentMapper.closeIncident(incidentId, memo);
        } else {
            incidentMapper.updateStatus(incidentId, target.name());
        }

        IncidentLog log = new IncidentLog();
        log.setIncidentId(incidentId);
        log.setPrevStatus(current.name());
        log.setNewStatus(target.name());
        log.setMemo(memo);
        log.setChangedBy(staffId);
        incidentMapper.insertLog(log);

        Incident updated = incidentMapper.findById(incidentId);

        // 담당자 상황판 + 관심지역 시민 화면 양쪽에 실시간 반영
        webSocketHandler.broadcastStatusChanged(updated, memo);

        return updated;
    }

    @Transactional
    public Incident assignStaff(Long incidentId, Long staffId) {
        incidentMapper.assignStaff(incidentId, staffId);
        Incident updated = incidentMapper.findById(incidentId);
        webSocketHandler.broadcastStaffAssigned(updated);
        return updated;
    }

    // 시민 화면 - 내 제보가 연결된 사건의 현재 상태 확인용 (타임라인처럼 공개 API로 열어둠)
    public Incident getIncidentById(Long incidentId) {
        Incident incident = incidentMapper.findById(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }
        return incident;
    }

    public List<IncidentLog> getTimeline(Long incidentId) {
        return incidentMapper.findLogsByIncidentId(incidentId);
    }

    public List<Incident> getActiveIncidentsByRegion(String region) {
        return incidentMapper.findActiveByRegion(region);
    }

    // 관심지역 "현재 상황" 패널용 - 등록된 관심지역 좌표 기준 반경 이내의 활성 Incident들
    public List<Incident> getActiveIncidentsNearby(double lat, double lng, double radiusKm) {
        double radiusMeters = radiusKm * 1000;
        return incidentMapper.findAllActive().stream()
                .filter(inc -> inc.getLatitude() != null && inc.getLongitude() != null)
                .filter(inc -> calculateDistanceMeters(lat, lng, inc.getLatitude(), inc.getLongitude()) <= radiusMeters)
                .collect(Collectors.toList());
    }

    // STAFF 대시보드 - 전체 Incident 목록
    public List<Incident> getAllIncidents() {
        return incidentMapper.findAll();
    }

    /**
     * 시민제보와 관련 있을 가능성이 있는 기존 Incident를 찾는다.
     * 조건: 같은 재난유형 + 최근 N분 이내 + 반경 500m 이내
     * AI 없이 위경도 거리계산(하버사인 공식) + 자바 로직만으로 구현.
     */
    public List<Incident> findRelatedIncidents(String disasterType, double reportLat, double reportLng) {
        List<Incident> candidates = incidentMapper.findRecentByType(disasterType, DUPLICATE_TIME_WINDOW_MINUTES);

        return candidates.stream()
                .filter(inc -> calculateDistanceMeters(
                        reportLat, reportLng, inc.getLatitude(), inc.getLongitude()) <= DUPLICATE_RADIUS_METERS)
                .collect(Collectors.toList());
    }

    /**
     * 하버사인 공식으로 두 좌표 사이의 실제 거리(m)를 계산한다.
     * 위경도는 구면 좌표라 단순 유클리드 거리로는 오차가 크기 때문에 이 공식을 사용.
     */
    private double calculateDistanceMeters(double lat1, double lng1, double lat2, double lng2) {
        final double EARTH_RADIUS_M = 6371000;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_M * c;
    }
}