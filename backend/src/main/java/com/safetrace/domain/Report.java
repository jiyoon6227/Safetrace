package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Report {
    private Long reportId;
    private Long memberId;
    private String reporterName;  // 제보자 이름 (SF_MEMBER 조인 결과, STAFF 화면 표시용)
    private String disasterType;
    private String content;
    private Double latitude;
    private Double longitude;
    private String address; // 제보 접수 시 확정된 주소 문자열 (제보자가 직접 검색/자동확인한 값을 그대로 저장)
    private String photoUrl;
    private Long incidentId;     // 연결된 Incident (없으면 null)
    private String status;
    private String rejectReason; // 반려 사유 (status가 REJECTED일 때만 값 있음)
    private String reporterPhone; // 이 제보 접수 시 남긴 연락처
    private LocalDateTime createdAt;
}