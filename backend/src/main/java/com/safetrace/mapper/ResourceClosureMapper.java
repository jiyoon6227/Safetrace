package com.safetrace.mapper;

import com.safetrace.domain.ResourceRequest;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

// 사건 종료 연동 전용 매퍼 (출고 전 요청 잠금·조회, 출고 후 미반납 건수).
// 요청 상태 변경·가용 복구·이력 INSERT는 ResourceApprovalMapper, 사건 행 잠금과 요청 이력은 ResourceRequestMapper,
// 재고 행 잠금은 ResourceAdminMapper를 그대로 쓴다.
@Mapper
public interface ResourceClosureMapper {

    // 그 사건의 출고 전(REQUESTED·APPROVED) 요청 전부를 REQUEST_ID 오름차순으로 잠그고 읽는다 (최대 3초 대기, 넘으면 락 예외).
    // 조인 없이 요청 테이블만 읽는다. 채워지는 값: requestId, stockId, requesterId, quantity, status
    List<ResourceRequest> lockOpenRequests(@Param("incidentId") Long incidentId);

    // 그 사건에 남은 출고 전 요청 수 (취소를 끝낸 뒤 0인지 마지막으로 확인한다)
    int countOpenRequests(@Param("incidentId") Long incidentId);

    // 종료 확인 화면용 목록: 출고 전 요청 + 요청자·재고 부서·품목 이름 (잠그지 않는다)
    List<ResourceRequest> findOpenRequests(@Param("incidentId") Long incidentId);

    // 출고되어 아직 정산이 끝나지 않은 요청 수 (종료 후에도 미반납으로 남는 건수)
    int countDispatched(@Param("incidentId") Long incidentId);
}
