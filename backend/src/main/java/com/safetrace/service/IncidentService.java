package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.domain.IncidentStatus;
import com.safetrace.domain.Member;
import com.safetrace.dto.DailyCount;
import com.safetrace.dto.DailyIncidentStat;
import com.safetrace.dto.DashboardStatsResponse;
import com.safetrace.dto.TypeMonthlyCount;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.util.GeoUtils;
import com.safetrace.util.TransactionUtils;
import com.safetrace.websocket.IncidentWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentMapper incidentMapper;
    private final MemberMapper memberMapper;
    private final IncidentWebSocketHandler webSocketHandler;
    private final NotificationService notificationService;

    // 중복 제보 판단 기준: 반경 500m, 30분 이내
    private static final double DUPLICATE_RADIUS_METERS = 500.0;
    private static final int DUPLICATE_TIME_WINDOW_MINUTES = 30;

    // 대표(0번째) 포함 현장 사진은 최대 5장 - 전부 SF_INCIDENT_PHOTO 한 테이블에서만 관리
    private static final int MAX_PHOTOS = 5;

    // 대시보드 통계 기준
    private static final int LONG_PENDING_DAYS = 3;   // 3일 이상 상태 변경 없으면 장기 미처리
    private static final int DAILY_STAT_DAYS = 7;     // 일별 사건 현황은 오늘 포함 최근 7일
    private static final String OTHER_DISASTER_TYPE = "기타";
    // 유형별 통계 표시 순서 (화면 제보 유형 목록과 동일)
    private static final List<String> DASHBOARD_DISASTER_TYPES =
            List.of("침수", "화재", "산사태", "강풍", "폭염", "한파", OTHER_DISASTER_TYPE);

    /**
     * 새 Incident 생성.
     * 생성과 동시에 STAFF 상황판에 WebSocket으로 실시간 전파하고,
     * 대표 관심지역이 근처(반경 3km)인 회원들에게 "재난 알림"을 만든다.
     */
    @Transactional
    public Incident createIncident(Incident incident) {
        if (incident == null) {
            throw new IllegalArgumentException("사건 정보가 없습니다.");
        }

        if (incident.getAssignedStaffId() == null) {
            throw new IllegalArgumentException("사건 생성 시 담당자 정보가 필요합니다.");
        }

        requireActiveStaff(incident.getAssignedStaffId(), "사건 담당자");

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

        // 알림 DB 저장 후 broadcast (신호 수신 직후 조회 시 알림 존재 보장)
        notificationService.notifyNearbyMembersOfNewIncident(created);
        TransactionUtils.runAfterCommit(() -> webSocketHandler.broadcastIncidentCreated(created));

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

        if (targetStatusStr == null || targetStatusStr.isBlank()) {
            throw new IllegalArgumentException("변경할 사건 상태를 입력해주세요.");
        }

        // 컨트롤러에서 STAFF 권한을 막고 있어도 서비스 계층에서도 한 번 더 검증한다.
        // 탈퇴/권한변경 직후의 오래된 토큰 등으로 상태 변경이 시도되는 경우를 방어한다.
        requireActiveStaff(staffId, "상태 변경 담당자");

        IncidentStatus current;
        IncidentStatus target;
        try {
            current = IncidentStatus.valueOf(incident.getStatus());
            target = IncidentStatus.valueOf(targetStatusStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("올바르지 않은 사건 상태입니다.");
        }

        if (!current.canTransitionTo(target)) {
            throw new IllegalStateException(
                String.format("%s 상태에서 %s(으)로 바로 전환할 수 없습니다.", current.getLabel(), target.getLabel())
            );
        }

        // 담당자가 배정된 사건만 상태를 바꿀 수 있다
        if (incident.getAssignedStaffId() == null) {
            throw new IllegalStateException("담당자가 배정되지 않아 상태를 전환할 수 없습니다. 먼저 담당자를 배정해주세요.");
        }

        // 사건 상태는 배정된 담당자 본인만 변경할 수 있다
        if (!staffId.equals(incident.getAssignedStaffId())) {
            throw new AccessDeniedException("이 사건의 담당자만 상태를 변경할 수 있습니다.");
        }

        if (target == IncidentStatus.CLOSED && (memo == null || memo.isBlank())) {
            throw new IllegalStateException("종료 처리에는 조치내역(종료사유)이 필요합니다.");
        }

        // 읽은 시점의 상태(current)가 아직 그대로일 때만 변경 (같은 요청 중복 방지)
        int affected;
        if (target == IncidentStatus.CLOSED) {
            affected = incidentMapper.closeIncident(incidentId, current.name(), memo);
        } else {
            affected = incidentMapper.updateStatus(incidentId, current.name(), target.name());
        }

        if (affected != 1) {
            throw new IllegalStateException("이미 처리된 요청입니다. 새로고침 후 다시 확인해주세요.");
        }

        IncidentLog log = new IncidentLog();
        log.setIncidentId(incidentId);
        log.setPrevStatus(current.name());
        log.setNewStatus(target.name());
        log.setMemo(memo);
        log.setChangedBy(staffId);
        incidentMapper.insertLog(log);

        Incident updated = incidentMapper.findById(incidentId);

        // 알림 DB 저장 후 broadcast
        notificationService.notifyReportersOfStatusChange(updated, current.getLabel(), target.getLabel());
        // 담당자 상황판 + 관심지역 시민 화면 양쪽에 실시간 반영
        TransactionUtils.runAfterCommit(() -> webSocketHandler.broadcastStatusChanged(updated, memo));

        return updated;
    }

    /**
     * 사건 상세정보 수정 (제목/유형/위험도/위치).
     * STATUS·담당자는 전용 워크플로우(changeStatus/assignStaff)에서만 변경.
     */
    @Transactional
    public Incident updateIncidentDetails(Long incidentId, Incident incident, Long staffId) {
        Incident existing = incidentMapper.findById(incidentId);
        if (existing == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }

        requireAssignedStaff(existing, staffId, "사건 정보를 수정");

        incident.setIncidentId(incidentId);
        incidentMapper.updateDetails(incident);

        Incident updated = incidentMapper.findById(incidentId);
        TransactionUtils.runAfterCommit(() -> webSocketHandler.broadcastIncidentUpdated(updated));
        return updated;
    }

    @Transactional
    public Incident assignStaff(Long incidentId, Long staffId) {
    Incident incident = incidentMapper.findById(incidentId);
    if (incident == null) {
        throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
    }

    // 담당자 인계 기능이 없으므로, 담당자가 비어 있는 사건만 배정할 수 있다
    if (incident.getAssignedStaffId() != null) {
        throw new IllegalStateException("이미 담당자가 배정된 사건입니다.");
    }

    requireActiveStaff(staffId, "배정할 담당자");

    int affected = incidentMapper.assignStaff(incidentId, staffId);
    if (affected != 1) {
        throw new IllegalStateException("다른 담당자가 먼저 배정되었습니다. 새로고침 후 확인해주세요.");
    }

        Incident updated = incidentMapper.findById(incidentId);
        TransactionUtils.runAfterCommit(() -> webSocketHandler.broadcastStaffAssigned(updated));
        return updated;
    }

    /**
     * 사건 생성/배정/상태변경에 사용하는 STAFF 검증.
     * MEMBER_ID만 존재한다고 담당자로 인정하지 않고,
     * 현재 미탈퇴 상태이며 ROLE=STAFF인 회원만 허용한다.
     */
    private Member requireActiveStaff(Long memberId, String targetLabel) {
        if (memberId == null) {
            throw new IllegalArgumentException(targetLabel + " 정보가 없습니다.");
        }

        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException(targetLabel + "가 존재하지 않습니다.");
        }

        if ("Y".equals(member.getIsWithdrawn())) {
            throw new IllegalArgumentException(targetLabel + "는 탈퇴한 회원입니다.");
        }

        if (!"STAFF".equals(member.getRole())) {
            throw new IllegalArgumentException(targetLabel + "는 STAFF 계정이어야 합니다.");
        }

        return member;
    }

    // 배정된 담당자 본인만 허용 (사건 수정·현장 사진 추가용)
    private void requireAssignedStaff(Incident incident, Long staffId, String action) {
        if (incident.getAssignedStaffId() == null) {
            throw new IllegalStateException("담당자가 배정되지 않은 사건입니다. 먼저 담당자를 배정해주세요.");
        }

        if (!incident.getAssignedStaffId().equals(staffId)) {
            throw new AccessDeniedException("이 사건의 담당자만 " + action + "할 수 있습니다.");
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

    /**
     * 관제 대시보드 통계.
     * 서버 시간대와 어긋나지 않도록 "오늘"은 화면에서 보낸 현재 시각(now) 기준으로 잡는다.
     */
    public DashboardStatsResponse getDashboardStats(LocalDateTime now, Long staffId) {
        LocalDate today = now.toLocalDate();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime tomorrowStart = today.plusDays(1).atStartOfDay();
        LocalDateTime yesterdayStart = today.minusDays(1).atStartOfDay();
        LocalDateTime longPendingBefore = now.minusDays(LONG_PENDING_DAYS);

        DashboardStatsResponse stats = incidentMapper.selectDashboardSummary(
                staffId, todayStart, tomorrowStart, yesterdayStart, longPendingBefore);
        if (stats == null) {
            stats = new DashboardStatsResponse();
        }
        stats.setDaily(buildDailyStats(today));
        return stats;
    }

    // 오늘 포함 최근 7일 - GROUP BY 결과에 없는 날은 0건으로 채움
    private List<DailyIncidentStat> buildDailyStats(LocalDate today) {
        LocalDate from = today.minusDays(DAILY_STAT_DAYS - 1);
        LocalDateTime fromStart = from.atStartOfDay();
        LocalDateTime toEnd = today.plusDays(1).atStartOfDay();

        Map<String, Integer> created = toCountMap(incidentMapper.countCreatedByDay(fromStart, toEnd));
        Map<String, Integer> closed = toCountMap(incidentMapper.countClosedByDay(fromStart, toEnd));

        List<DailyIncidentStat> daily = new ArrayList<>();
        for (int i = 0; i < DAILY_STAT_DAYS; i++) {
            String date = from.plusDays(i).toString();
            daily.add(new DailyIncidentStat(date, created.getOrDefault(date, 0), closed.getOrDefault(date, 0)));
        }
        return daily;
    }

    private Map<String, Integer> toCountMap(List<DailyCount> rows) {
        Map<String, Integer> map = new HashMap<>();
        for (DailyCount row : rows) {
            map.put(row.getStatDate(), row.getCnt());
        }
        return map;
    }

    /**
     * 대시보드 "사건 유형별 통계" - 선택 월과 전월 건수.
     * 고정 유형 7개를 항상 같은 순서로 내려주고, 목록에 없는 유형은 "기타"로 합친다.
     */
    public List<TypeMonthlyCount> getMonthlyTypeStats(YearMonth month) {
        LocalDateTime monthStart = month.atDay(1).atStartOfDay();
        LocalDateTime prevMonthStart = month.minusMonths(1).atDay(1).atStartOfDay();
        LocalDateTime nextMonthStart = month.plusMonths(1).atDay(1).atStartOfDay();

        Map<String, TypeMonthlyCount> byType = new LinkedHashMap<>();
        for (String type : DASHBOARD_DISASTER_TYPES) {
            byType.put(type, new TypeMonthlyCount(type, 0, 0));
        }

        for (TypeMonthlyCount row : incidentMapper.countByTypeForMonth(prevMonthStart, monthStart, nextMonthStart)) {
            String type = byType.containsKey(row.getDisasterType()) ? row.getDisasterType() : OTHER_DISASTER_TYPE;
            TypeMonthlyCount target = byType.get(type);
            target.setCurrentCount(target.getCurrentCount() + row.getCurrentCount());
            target.setPrevCount(target.getPrevCount() + row.getPrevCount());
        }
        return new ArrayList<>(byType.values());
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
    public Incident addIncidentPhoto(Long incidentId, String photoUrl, Long staffId) {
        Incident incident = incidentMapper.findById(incidentId);
        if (incident == null) {
            throw new IllegalArgumentException("존재하지 않는 Incident 입니다: " + incidentId);
        }

        requireAssignedStaff(incident, staffId, "현장 사진을 추가");

        List<String> existing = incidentMapper.findPhotoUrlsByIncidentId(incidentId);
        if (existing.size() >= MAX_PHOTOS) {
            throw new IllegalStateException("현장 사진은 최대 " + MAX_PHOTOS + "장까지 첨부할 수 있습니다.");
        }
        incidentMapper.insertPhoto(incidentId, photoUrl, existing.size());

        Incident updated = incidentMapper.findById(incidentId);
        TransactionUtils.runAfterCommit(() -> webSocketHandler.broadcastIncidentUpdated(updated));
        return updated;
    }

    // 사건 상세패널 - 등록된 현장 사진 전체 목록 (0번째 = 대표)
    public List<String> getPhotoUrls(Long incidentId) {
        return incidentMapper.findPhotoUrlsByIncidentId(incidentId);
    }

    /**
     * 시민제보와 관련 있을 가능성이 있는 기존 Incident를 찾는다.
     * 조건: 같은 재난유형 + 최근 N분 이내 + 반경 500m 이내
     */
    public List<Incident> findRelatedIncidents(String disasterType, double reportLat, double reportLng) {
        List<Incident> candidates = incidentMapper.findRecentByType(disasterType, DUPLICATE_TIME_WINDOW_MINUTES);

        return candidates.stream()
                .filter(inc -> inc.getLatitude() != null && inc.getLongitude() != null)
                .filter(inc -> GeoUtils.distanceMeters(
                        reportLat, reportLng, inc.getLatitude(), inc.getLongitude()) <= DUPLICATE_RADIUS_METERS)
                .collect(Collectors.toList());
    }
}