package com.safetrace.mapper;

import com.safetrace.domain.Report;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ReportMapper {

    // 제보 등록 (성공 시 reportId가 파라미터 객체에 자동으로 채워짐)
    int insert(Report report);

    Report findById(@Param("reportId") Long reportId);

    // STAFF 화면 - 아직 어떤 Incident에도 연결 안 된 제보 목록 (제보 관리 탭에서 사용)
    List<Report> findUnlinked();

    // STAFF 화면 - 연결 여부와 무관하게 전체 제보 목록 (사건전환된 제보도 이력으로 계속 보여주기 위함)
    List<Report> findAll();

    // 시민 화면 - 내가 등록한 제보 목록 (내 제보 추적)
    List<Report> findByMemberId(@Param("memberId") Long memberId);

    // 제보를 특정 Incident에 연결 (제보 병합의 실제 실행 단계)
    int linkIncident(@Param("reportId") Long reportId, @Param("incidentId") Long incidentId);

    // 담당자가 이 제보를 검토 중으로 표시 (아직 사건화/반려 결정 전)
    int markReviewing(@Param("reportId") Long reportId);

    // 담당자가 이 제보를 반려 처리 (사유 필수) - 원본 데이터는 삭제하지 않고 상태만 REJECTED로 바꿈
    int reject(@Param("reportId") Long reportId, @Param("reason") String reason);

    // STAFF 화면 - 특정 Incident에 묶인 제보 목록 ("연결된 제보" 표시용)
    List<Report> findByIncidentId(@Param("incidentId") Long incidentId);

    // 대표(photoUrl) 제외 2~5번째 첨부사진 저장 - sortOrder는 0부터
    int insertPhoto(@Param("reportId") Long reportId, @Param("photoUrl") String photoUrl, @Param("sortOrder") int sortOrder);

    // 대표 제외 추가 첨부사진 목록 조회 (표시 순서대로)
    List<String> findPhotoUrlsByReportId(@Param("reportId") Long reportId);
}