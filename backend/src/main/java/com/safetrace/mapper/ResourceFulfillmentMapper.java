package com.safetrace.mapper;

import com.safetrace.domain.ResourceReturn;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

// 출고·도착 확인·반납 신청·반납 확인·손실 확정 전용 매퍼.
// 요청 행 잠금·상태 변경·가용 복구·재고 이력 INSERT는 ResourceApprovalMapper, 재고 행 잠금은 ResourceAdminMapper,
// 요청 이력 INSERT·조회는 ResourceRequestMapper를 그대로 쓴다.
@Mapper
public interface ResourceFulfillmentMapper {

    // 재고 품목이 반납형인지(Y) 소모품인지(N). 품목은 수정하지 않는 데이터라 잠그지 않고 읽는다. 재고가 없으면 null
    String findReturnable(@Param("stockId") Long stockId);

    // 총보유량 감소(소모품 출고·손실 확정). 감소 후에도 총보유량이 가용 이상일 때만 반영한다 (CK_SF_RES_STOCK_AVAILABLE의 앞단 방어)
    int reduceTotal(@Param("stockId") Long stockId, @Param("quantity") int quantity);

    // 도착 시각 기록: 출고 이후 상태이고 아직 기록이 없을 때만. 0행이면 이미 기록됐거나 출고 전이다.
    int markArrived(@Param("requestId") Long requestId);

    // 대기 중(PENDING) 반납 신청 수량의 합
    int sumPendingReturnQty(@Param("requestId") Long requestId);

    // 더블클릭 판단용: 같은 요청·신청자·수량의 대기 중 신청이 최근 withinSeconds초 안에 있는지 (DB 시각 기준)
    int countRecentSameReturn(@Param("requestId") Long requestId,
                              @Param("applicantId") Long applicantId,
                              @Param("appliedQty") int appliedQty,
                              @Param("withinSeconds") int withinSeconds);

    // 반납 신청 INSERT (PENDING). 성공 시 returnId가 채워진다.
    int insertReturn(ResourceReturn application);

    // 반납 신청 한 건 (조인). 잠그지 않는다. 없으면 null
    ResourceReturn findReturnById(@Param("returnId") Long returnId);

    // 신청 상태 변경: 지금 상태가 expectedStatus일 때만. 0행이면 이미 처리된 신청이다.
    int updateReturnStatus(@Param("returnId") Long returnId,
                           @Param("expectedStatus") String expectedStatus,
                           @Param("newStatus") String newStatus,
                           @Param("processedBy") Long processedBy,
                           @Param("rejectReason") String rejectReason);

    // 반납 확인: 요청의 누적 반납을 올리고, 남은 수량이 없어지면 SETTLED로 바꾼다. DISPATCHED이고 합이 요청 수량 이하일 때만.
    int applyReturnToRequest(@Param("requestId") Long requestId, @Param("quantity") int quantity);

    // 손실 확정: 요청의 누적 손실을 올린다. 화면이 본 처리 완료 수량(반납 + 손실)이 지금 값과 같을 때만.
    int applyLossToRequest(@Param("requestId") Long requestId,
                           @Param("lostQty") int lostQty,
                           @Param("expectedProcessedQty") int expectedProcessedQty);

    // 한 요청의 반납 신청 목록 (신청 시각 순)
    List<ResourceReturn> findReturnsByRequest(@Param("requestId") Long requestId);

    // 반납 확인함. status가 null이면 전체
    List<ResourceReturn> findReturns(@Param("status") String status,
                                     @Param("startRow") int startRow,
                                     @Param("endRow") int endRow);

    long countReturns(@Param("status") String status);
}
