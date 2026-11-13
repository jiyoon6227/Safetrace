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

    // 확인 대기 중인 반납 신청 수량 합계 (조인 결과)
    private Integer pendingReturnQty;

    // 조회한 사람 기준으로 서비스가 채우는 값 - 화면이 버튼을 보일지, 반납 수량 기본값을 얼마로 할지 서버 판단을 그대로 쓴다
    private boolean canArrive;              // 도착 확인 버튼
    private boolean canApplyReturn;         // 반납 신청 버튼
    private int applicableReturnQty;        // 지금 새로 신청할 수 있는 반납 수량
}
