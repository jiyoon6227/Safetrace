package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

// 부서 간 자원 요청 - SF_RESOURCE_REQUEST (사건·부서·품목·요청자 이름은 조인 결과, 조회 전용)
@Data
public class ResourceRequest {
    private Long requestId;
    private Long incidentId;
    private String incidentTitle;
    private Long stockId;
    private Long departmentId;          // 자원을 보유한 부서 (재고를 통해 알 수 있음)
    private String departmentName;
    private Long itemId;
    private String itemName;
    private String category;
    private String unit;
    private String returnable;          // Y(반납형) / N(소모품)
    private Long requesterId;
    private String requesterName;
    private String requesterDepartmentName;
    private Integer quantity;
    private String status;              // REQUESTED / APPROVED / REJECTED / CANCELLED / DISPATCHED / SETTLED / COMPLETED
    private String reason;
    private LocalDateTime neededAt;
    private String rejectReason;
    private Integer returnedQty;
    private Integer lostQty;
    private LocalDateTime arrivedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
