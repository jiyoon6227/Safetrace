package com.safetrace.mapper;

import com.safetrace.domain.Incident;
import com.safetrace.domain.IncidentLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface IncidentMapper {

    // Incident 생성 (성공 시 incidentId가 파라미터 객체에 자동으로 채워짐)
    int insertIncident(Incident incident);

    Incident findById(@Param("incidentId") Long incidentId);

    List<Incident> findAll();

    // 시민 화면 - 관심지역 기준 활성 Incident 목록
    List<Incident> findActiveByRegion(@Param("region") String region);

    // 관심지역 좌표 기준 "근처 최근 재난" 조회용 - 활성 Incident 전체를 가져와서
    // 서비스 레이어에서 위경도로 거리 필터링(하버사인)함
    List<Incident> findAllActive();

    // 사건 상세정보 수정 (제목/유형/위험도/위치/현장사진) - STATUS/담당자는 별도 API(전용 워크플로우)에서만 변경
    int updateDetails(Incident incident);

    // 상태 변경 (Workflow 전이 시 사용)
    int updateStatus(@Param("incidentId") Long incidentId,
                      @Param("status") String status);

    // 담당자 배정
    int assignStaff(@Param("incidentId") Long incidentId,
                     @Param("staffId") Long staffId);

    // 종료 처리 (종료사유 필수)
    int closeIncident(@Param("incidentId") Long incidentId,
                       @Param("closeReason") String closeReason);

    // 상태변경 이력 저장
    int insertLog(IncidentLog log);

    // 특정 Incident의 전체 Timeline 조회 (시민 화면 "내 제보 추적"에 사용)
    List<IncidentLog> findLogsByIncidentId(@Param("incidentId") Long incidentId);

    // 대시보드 "오늘 해결 완료" 카드용 - 특정 날짜에 CLOSED로 바뀐 건수.
    // UPDATED_AT을 직접 세면 종료 후 다른 항목(제목 등)을 고쳤을 때도 갱신되어 잘못 잡히므로,
    // 상태변경 이력(언제 CLOSED가 됐는지만 기록되고 이후 수정에 영향 안 받음)을 기준으로 셈
    int countClosedOn(@Param("date") java.time.LocalDate date);

    // 중복탐지용: 같은 재난유형 + 최근 N분 이내 발생한 Incident 후보 조회
    // 실제 거리 계산(하버사인 공식)은 서비스 로직에서 위경도로 계산
    List<Incident> findRecentByType(@Param("disasterType") String disasterType,
                                     @Param("minutesAgo") int minutesAgo);

    // 대표(0번째)~5번째 현장 사진 저장 - sortOrder는 0부터
    int insertPhoto(@Param("incidentId") Long incidentId, @Param("photoUrl") String photoUrl, @Param("sortOrder") int sortOrder);

    // 사건에 등록된 사진 전체 목록 조회 (0번째 = 대표)
    List<String> findPhotoUrlsByIncidentId(@Param("incidentId") Long incidentId);
}