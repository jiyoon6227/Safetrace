package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

// 부서별 품목 재고 - SF_RESOURCE_STOCK (부서·품목 이름은 조인 결과, 조회 전용)
@Data
public class ResourceStock {
    private Long stockId;
    private Long departmentId;
    private String departmentName;
    private Long itemId;
    private String itemName;
    private String category;
    private String unit;
    private String returnable;
    private Integer totalQty;       // 총보유량
    private Integer availableQty;   // 지금 바로 요청·배정할 수 있는 수량
    private String status;          // ACTIVE / INACTIVE
    private LocalDateTime updatedAt;
}
