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
    private Long incidentId;     // 연결된 Incident (없으면 null)
    private String status;
    private String rejectReason; // 반려 사유 (status가 REJECTED일 때만 값 있음)
    private String reporterPhone; // 이 제보 접수 시 남긴 연락처
    private String photoUrl; // 대표(0번째) 사진 - SF_REPORT_PHOTO 조회 시 상관서브쿼리로 채워짐. 실제 저장은 그 테이블에만 함
    private java.util.List<String> additionalPhotoUrls; // 2~5번째 사진 - 등록 요청 시에만 사용, 이미 업로드된 URL 목록
    private LocalDateTime createdAt;
}