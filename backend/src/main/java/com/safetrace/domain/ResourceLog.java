package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

// 자원 요청 처리 이력 - SF_RESOURCE_LOG (처리자 이름은 조인 결과, 조회 전용)
@Data
public class ResourceLog {
    private Long logId;
    private Long requestId;
    private String prevStatus;          // 생성 시 null
    private String newStatus;
    private String action;              // CREATE / APPROVE / REJECT / CANCEL / CANCEL_BY_CLOSE / DISPATCH / ARRIVE / SETTLE
    private String memo;
    private Long changedBy;
    private String changedByName;
    private LocalDateTime changedAt;
}
