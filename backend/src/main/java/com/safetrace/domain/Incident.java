package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Incident {
    private Long incidentId;
    private String title;
    private String disasterType;   // 침수 / 화재 / 산사태 등
    private String severity;       // LOW / MEDIUM / HIGH
    private String status;         // IncidentStatus.name() 문자열로 DB 저장
    private String region;
    private Double latitude;
    private Double longitude;
    private String photoUrl;       // STAFF가 직접 등록할 때 선택 첨부 (없으면 null)
    private Long assignedStaffId;
    private String closeReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}