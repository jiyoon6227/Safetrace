package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

// ADMIN 재고 관리 화면용 재고 한 줄 (조회 전용). STAFF 재고 조회(ResourceStock)의 응답 계약은 그대로 두고, 예약·출고 중 수량만 더한다.
@Data
public class ResourceStockAdminView {
    private Long stockId;
    private Long departmentId;
    private String departmentName;
    private Long itemId;
    private String itemName;
    private String itemDescription;
    private String category;
    private String unit;
    private String returnable;      // Y(반납형) / N(소모품)
    private Integer totalQty;       // 총보유량 = 가용 + 예약 + 출고 중
    private Integer availableQty;   // 지금 바로 요청·배정할 수 있는 수량
    private Integer reservedQty;    // 예약: 승인(APPROVED)됐지만 아직 출고 전인 요청 수량의 합
    private Integer dispatchedQty;  // 출고 중: 출고(DISPATCHED)됐고 아직 반납·손실로 정산되지 않은 수량의 합
    private String status;          // ACTIVE / INACTIVE
    private LocalDateTime updatedAt;
    private Boolean qtyConsistent;  // 총보유량 − 가용 == 예약 + 출고 중 인지 서버가 확인한 결과 (false면 데이터 점검 필요)
}
