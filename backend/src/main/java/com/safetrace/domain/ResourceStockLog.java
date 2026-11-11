package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

// 재고 변경 이력 - SF_RESOURCE_STOCK_LOG (변경자 이름은 조인 결과, 조회 전용)
@Data
public class ResourceStockLog {
    private Long logId;
    private Long stockId;
    private String action;
    private Integer totalBefore;
    private Integer totalAfter;
    private Integer availableBefore;
    private Integer availableAfter;
    private Long requestId;
    private String reason;
    private Long changedBy;
    private String changedByName;
    private LocalDateTime changedAt;
}
