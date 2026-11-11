package com.safetrace.mapper;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import com.safetrace.dto.DailyCount;
import com.safetrace.dto.DashboardStatsResponse;
import com.safetrace.dto.IncidentSearchCondition;
import com.safetrace.dto.IncidentStatusCounts;
import com.safetrace.dto.TypeMonthlyCount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface IncidentMapper {

    // Incident 생성 (성공 시 incidentId가 파라미터 객체에 자동으로 채워짐)
    int insertIncident(Incident incident);

    Incident findById(@Param("incidentId") Long incidentId);

    // 전체 목록 (대시보드 지도용) - 접수 순번(incidentRank) 포함
    List<Incident> findAll();

    // 사건 관리 목록 한 페이지 (검색어/상태/유형/지역/위험도/기간 + 정렬 + 페이징)
    List<Incident> searchIncidents(IncidentSearchCondition condition);

    // 상태 탭/카드 건수 - 상태 조건만 빼고 나머지 조건 적용
    IncidentStatusCounts countIncidentsByStatus(IncidentSearchCondition condition);

    // 해당 사건이 검색어 조건에 맞으면 1, 아니면 0 (q가 null이면 존재 여부만 확인)
    int countKeywordMatch(@Param("q") String q, @Param("selectedId") Long selectedId);

    // 시민 화면 - 관심지역 기준 활성 Incident 목록
    List<Incident> findActiveByRegion(@Param("region") String region);

    // 관심지역 좌표 기준 "근처 최근 재난" 조회용 - 활성 Incident 전체를 가져와서
    // 서비스 레이어에서 위경도로 거리 필터링(하버사인)함
    List<Incident> findAllActive();

    // 사건 상세정보 수정 (제목/유형/위험도/위치) - STATUS/담당자는 별도 API에서만 변경
    int updateDetails(Incident incident);

    // 상태 변경 (Workflow 전이 시 사용)
    int updateStatus(@Param("incidentId") Long incidentId,
                     @Param("currentStatus") String currentStatus,
                     @Param("newStatus") String newStatus);

    // 담당자 배정
    int assignStaff(@Param("incidentId") Long incidentId,
                     @Param("staffId") Long staffId);

    // 종료 처리 (종료사유 필수)
    int closeIncident(@Param("incidentId") Long incidentId,
                      @Param("currentStatus") String currentStatus,
                      @Param("closeReason") String closeReason);

    // 상태변경 이력 저장
    int insertLog(IncidentLog log);

    // 특정 Incident의 전체 Timeline 조회 (시민 화면 "내 제보 추적"에 사용)
    List<IncidentLog> findLogsByIncidentId(@Param("incidentId") Long incidentId);

    // 대시보드 상단 카드/내 업무/지도 칩 건수를 한 번에 집계 (daily는 비어 있음)
    DashboardStatsResponse selectDashboardSummary(@Param("staffId") Long staffId,
                                                  @Param("todayStart") LocalDateTime todayStart,
                                                  @Param("tomorrowStart") LocalDateTime tomorrowStart,
                                                  @Param("yesterdayStart") LocalDateTime yesterdayStart,
                                                  @Param("longPendingBefore") LocalDateTime longPendingBefore);

    // 기간 내 날짜별 사건 접수(생성) 건수 - 0건인 날은 결과에 없음
    List<DailyCount> countCreatedByDay(@Param("fromStart") LocalDateTime fromStart,
                                       @Param("toEnd") LocalDateTime toEnd);

    // 기간 내 날짜별 처리완료 건수 - UPDATED_AT 대신 상태변경 이력 기준 (종료 후 다른 항목 수정 시 오집계 방지)
    List<DailyCount> countClosedByDay(@Param("fromStart") LocalDateTime fromStart,
                                      @Param("toEnd") LocalDateTime toEnd);

    // 재난유형별 선택 월 / 전월 생성 건수 - 유형 분류(기타 합치기)는 서비스에서 처리
    List<TypeMonthlyCount> countByTypeForMonth(@Param("prevMonthStart") LocalDateTime prevMonthStart,
                                               @Param("monthStart") LocalDateTime monthStart,
                                               @Param("nextMonthStart") LocalDateTime nextMonthStart);

    // 중복탐지용: 같은 재난유형 + 최근 N분 이내 발생한 Incident 후보 조회
    // 실제 거리 계산(하버사인 공식)은 서비스 로직에서 위경도로 계산
    List<Incident> findRecentByType(@Param("disasterType") String disasterType,
                                     @Param("minutesAgo") int minutesAgo);

    // 대표(0번째)~5번째 현장 사진 저장 - sortOrder는 0부터
    int insertPhoto(@Param("incidentId") Long incidentId, @Param("photoUrl") String photoUrl, @Param("sortOrder") int sortOrder);

    // 사건에 등록된 사진 전체 목록 조회 (0번째 = 대표)
    List<String> findPhotoUrlsByIncidentId(@Param("incidentId") Long incidentId);
}