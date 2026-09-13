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
    private String photoUrl;       // 대표(0번째) 사진 - SF_INCIDENT_PHOTO 조회 시 상관서브쿼리로 채워짐. 실제 저장은 그 테이블에만 함
    private Long assignedStaffId;
    private String assignedStaffName; // 담당 직원 이름 (SF_MEMBER 조인 결과, STAFF 화면 표시용)
    private Long sourceReportId; // 이 사건을 처음 만든 제보 FK (직접 등록한 사건이면 null)
    private String closeReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}