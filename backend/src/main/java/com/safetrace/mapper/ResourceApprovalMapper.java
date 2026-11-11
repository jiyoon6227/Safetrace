package com.safetrace.mapper;

import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceStockLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// 요청 승인·반려·취소 전용 매퍼 (요청 행 잠금, 상태 조건부 변경, 재고 예약·복구, 요청으로 생긴 재고 이력).
// 출고·반납·손실 처리(ResourceFulfillmentService)도 요청 행 잠금·상태 변경·가용 복구·재고 이력 INSERT를 그대로 쓴다.
// 재고 행 잠금은 ResourceAdminMapper.lockStock, 요청 이력 INSERT·조회는 ResourceRequestMapper를 그대로 쓴다.
@Mapper
public interface ResourceApprovalMapper {

    // 요청 행을 잠그고 읽는다 (최대 3초 대기, 넘으면 락 예외). 조인 없이 이 테이블만 읽는다.
    // 채워지는 값: requestId, incidentId, stockId, requesterId, quantity, status, returnedQty, lostQty, arrivedAt
    ResourceRequest lockRequest(@Param("requestId") Long requestId);

    // 요청 상태 변경: 지금 상태가 expectedStatus일 때만 newStatus로 바꾼다. rejectReason은 반려일 때만 값이 있다.
    // 영향 받은 행이 0이면 다른 처리가 먼저 바꾼 것이다.
    int updateRequestStatus(@Param("requestId") Long requestId,
                            @Param("expectedStatus") String expectedStatus,
                            @Param("newStatus") String newStatus,
                            @Param("rejectReason") String rejectReason);

    // 사건 상태만 잠금 없이 읽는다 (승인 때 "종료된 사건의 요청인지" 확인용). 사건 행은 잠그지 않는다.
    String findIncidentStatus(@Param("incidentId") Long incidentId);

    // 예약(승인): 사용 중(ACTIVE)이고 가용 수량이 충분할 때만 가용을 줄인다. 총보유량은 그대로.
    int reserveStock(@Param("stockId") Long stockId, @Param("quantity") int quantity);

    // 복구(승인 후 취소): 가용을 늘린다. 총보유량을 넘게 되면 반영하지 않는다. 사용 중지 재고도 복구할 수 있다.
    int releaseStock(@Param("stockId") Long stockId, @Param("quantity") int quantity);

    // 요청으로 생긴 재고 변경 이력(RESERVE / RELEASE). REQUEST_ID가 반드시 있어야 한다.
    int insertStockLog(ResourceStockLog log);
}
