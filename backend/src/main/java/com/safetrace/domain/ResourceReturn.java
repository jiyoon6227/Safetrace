package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

// 반납 신청 - SF_RESOURCE_RETURN (신청자·처리자 이름과 요청·품목 정보는 조인 결과, 조회 전용)
@Data
public class ResourceReturn {
    private Long returnId;
    private Long requestId;
    private Integer appliedQty;         // STAFF가 실제로 돌려보낼 수량으로 신청한 값
    private String status;              // PENDING / CONFIRMED / REJECTED
    private String applyMemo;
    private Long applicantId;
    private String applicantName;
    private LocalDateTime appliedAt;
    private Long processedBy;
    private String processedByName;
    private LocalDateTime processedAt;
    private String rejectReason;

    // 아래는 확인함 화면을 위한 요청·품목 정보 (조인 결과)
    private Long incidentId;
    private String incidentTitle;
    private String itemName;
    private String unit;
    private String departmentName;      // 자원을 보유한 부서
    private Integer requestQuantity;    // 요청 수량
    private String requestStatus;       // DISPATCHED / SETTLED
    private Integer returnedQty;        // 요청의 누적 반납 수량
    private Integer lostQty;            // 요청의 누적 손실 수량
}
