package com.safetrace.dto;

import com.safetrace.domain.Incident;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

// 사건 등록 요청 (담당자·상태는 서버에서 결정)
public record IncidentCreateRequest(
        @NotBlank(message = "사건 제목을 입력해주세요.") String title,
        @NotBlank(message = "재난 유형을 선택해주세요.") String disasterType,
        @NotBlank(message = "위험도를 선택해주세요.")
        @Pattern(regexp = "LOW|MEDIUM|HIGH", message = "위험도는 LOW, MEDIUM, HIGH 중 하나여야 합니다.") String severity,
        @NotBlank(message = "발생 지역을 입력해주세요.") String region,
        @NotNull(message = "주소 검색으로 위치를 먼저 확인해주세요.") Double latitude,
        @NotNull(message = "주소 검색으로 위치를 먼저 확인해주세요.") Double longitude,
        String photoUrl,
        Long sourceReportId
) {
    public Incident toIncident() {
        Incident incident = new Incident();
        incident.setTitle(title);
        incident.setDisasterType(disasterType);
        incident.setSeverity(severity);
        incident.setRegion(region);
        incident.setLatitude(latitude);
        incident.setLongitude(longitude);
        incident.setPhotoUrl(photoUrl);
        incident.setSourceReportId(sourceReportId);
        return incident;
    }
}
