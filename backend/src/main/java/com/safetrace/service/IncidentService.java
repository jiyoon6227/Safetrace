package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.domain.IncidentStatus;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.util.GeoUtils;
import com.safetrace.websocket.IncidentWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentMapper incidentMapper;
    private final IncidentWebSocketHandler webSocketHandler;
    private final NotificationService notificationService;

    // 중복탐지 기준값 (기술서에 "왜 이 값을 썼는지" 설명할 수 있어야 함)
    private static final double DUPLICATE_RADIUS_METERS = 500.0;
    private static final int DUPLICATE_TIME_WINDOW_MINUTES = 30;

    // 대표(0번째) 포함 현장 사진은 최대 5장 - 전부 SF_INCIDENT_PHOTO 한 테이블에서만 관리
    private static final int MAX_PHOTOS = 5;

    /**
     * 새 Incident 생성.
     * 생성과 동시에 STAFF 상황판에 WebSocket으로 실시간 전파하고,
     * 대표 관심지역이 근처(반경 3km)인 회원들에게 "재난 알림"을 만든다.
     */
    @Transactional
    public Incident createIncident(Incident incident) {
        incidentMapper.insertIncident(incident);

        // 사진은 컬럼이 아니라 SF_INCIDENT_PHOTO에만 저장 - 생성 시 첨부했으면 0번째(대표)로 넣음
        if (incident.getPhotoUrl() != null && !incident.getPhotoUrl().isBlank()) {
            incidentMapper.insertPhoto(incident.getIncidentId(), incident.getPhotoUrl(), 0);
        }

        IncidentLog log = new IncidentLog();
        log.setIncidentId(incident.getIncidentId());
        log.setPrevStatus(null);
        log.setNewStatus(IncidentStatus.RECEIVED.name());
        log.setMemo("Incident 최초 생성");
        incidentMapper.insertLog(log);

        Incident created = incidentMapper.findById(incident.getIncidentId());

        // 알림을 먼저 DB에 저장한 뒤 broadcast를 보내야, 프론트가 이 신호를 받자마자
        // /api/notifications를 조회해도 이미 저장이 끝나있어서 확실하게 받아짐
        // (반대 순서면 아주 드물게 "신호는 왔는데 아직 저장 전"인 타이밍이 생길 수 있음)
        notificationService.notifyNearbyMembersOfNewIncident(created);
        broadcastAfterCommit(() -> webSocketHandler.broadcastIncidentCreated(created));

        return created;
    }

    /**
     * 상태 전이. Workflow 업무규칙을 여기서 강제한다.
     *  - 담당자 미배정 시 어떤 상태로도 전환 불가 (먼저 담당자 배정부터)
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

        // 예전엔 RESPONDING(대응중) 전환에만 담당자 배정을 요구했는데, 담당자 없이 확인중/수습중/종료까지
        // 다 진행돼버리는 게 실무상 이상해서(누가 처리했는지 책임 소재가 불명확해짐) 모든 전환에 적용하도록 확장.
        if (incident.getAssignedStaffId() == null) {
            throw new IllegalStateException("담당자가 배정되지 않아 상태를 전환할 수 없습니다. 먼저 담당자를 배정해주세요.");
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

        // 여기도 마찬가지로 알림 DB 저장을 broadcast보다 먼저 실행
        notificationService.notifyReportersOfStatusChange(updated, current.getLabel(), target.getLabel());
        // 담당자 상황판 + 관심지역 시민 화면 양쪽에 실시간 반영
        broadcastAfterCommit(() -> webSocketHandler.broadcastStatusChanged(updated, memo));

        return updated;
    }

    /**
     * 사건 상세정보 수정 (제목/유형/위험도/위치/현장사진).
     * STATUS와 담당자는 각자 전용 워크플로우(changeStatus/assignStaff)가 있으므로 여기서 건드리지 않음.
     * photoUrl을 새로 첨부하지 않는 수정이면, 프론트가 기존 photoUrl을 그대로 실어보내야
     * 기존 사진이 유지됨 (안 보내면 NULL로 덮어써짐).
     */
    @Transactional
    public Incident updateIncidentDetails(Long incidentId, Incident incident) {
        Incident existing = incidentMapper.findById(incidentId);
        if (existing == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }

        incident.setIncidentId(incidentId);
        incidentMapper.updateDetails(incident);

        Incident updated = incidentMapper.findById(incidentId);
        broadcastAfterCommit(() -> webSocketHandler.broadcastIncidentUpdated(updated));
        return updated;
    }

    @Transactional
    public Incident assignStaff(Long incidentId, Long staffId) {
        incidentMapper.assignStaff(incidentId, staffId);
        Incident updated = incidentMapper.findById(incidentId);
        broadcastAfterCommit(() -> webSocketHandler.broadcastStaffAssigned(updated));
        return updated;
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

    // 대시보드 "오늘 해결 완료" 카드용
    public int countClosedOn(java.time.LocalDate date) {
        return incidentMapper.countClosedOn(date);
    }

    public List<Incident> getActiveIncidentsByRegion(String region) {
        return incidentMapper.findActiveByRegion(region);
    }

    // 관심지역 "현재 상황" 패널용 - 등록된 관심지역 좌표 기준 반경 이내의 활성 Incident들
    public List<Incident> getActiveIncidentsNearby(double lat, double lng, double radiusKm) {
        double radiusMeters = radiusKm * 1000;
        return incidentMapper.findAllActive().stream()
                .filter(inc -> inc.getLatitude() != null && inc.getLongitude() != null)
                .filter(inc -> GeoUtils.distanceMeters(lat, lng, inc.getLatitude(), inc.getLongitude()) <= radiusMeters)
                .collect(Collectors.toList());
    }

    // STAFF 대시보드 - 전체 Incident 목록
    public List<Incident> getAllIncidents() {
        return incidentMapper.findAll();
    }

    /**
     * 사건 상세패널의 "현장 사진 추가" - 순서대로 SF_INCIDENT_PHOTO에 쌓기만 하면 됨
     * (대표/추가 구분 없이 0번째가 곧 대표). 최대 5장 제한.
     */
    @Transactional
    public Incident addIncidentPhoto(Long incidentId, String photoUrl) {
        Incident incident = incidentMapper.findById(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }

        List<String> existing = incidentMapper.findPhotoUrlsByIncidentId(incidentId);
        if (existing.size() >= MAX_PHOTOS) {
            throw new IllegalStateException("현장 사진은 최대 " + MAX_PHOTOS + "장까지 첨부할 수 있습니다.");
        }
        incidentMapper.insertPhoto(incidentId, photoUrl, existing.size());

        Incident updated = incidentMapper.findById(incidentId);
        broadcastAfterCommit(() -> webSocketHandler.broadcastIncidentUpdated(updated));
        return updated;
    }

    // 사건 상세패널 - 등록된 현장 사진 전체 목록 (0번째 = 대표)
    public List<String> getPhotoUrls(Long incidentId) {
        return incidentMapper.findPhotoUrlsByIncidentId(incidentId);
    }

    /**
     * 시민제보와 관련 있을 가능성이 있는 기존 Incident를 찾는다.
     * 조건: 같은 재난유형 + 최근 N분 이내 + 반경 500m 이내
     * AI 없이 위경도 거리계산(하버사인 공식) + 자바 로직만으로 구현.
     */
    public List<Incident> findRelatedIncidents(String disasterType, double reportLat, double reportLng) {
        List<Incident> candidates = incidentMapper.findRecentByType(disasterType, DUPLICATE_TIME_WINDOW_MINUTES);

        return candidates.stream()
                .filter(inc -> GeoUtils.distanceMeters(
                        reportLat, reportLng, inc.getLatitude(), inc.getLongitude()) <= DUPLICATE_RADIUS_METERS)
                .collect(Collectors.toList());
    }
}