package com.safetrace.dto;

import com.safetrace.domain.Report;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

// 제보 등록 요청 (제보자·상태는 서버에서 결정)
public record ReportCreateRequest(
        @NotBlank(message = "재난 유형을 선택해주세요.") String disasterType,
        @NotBlank(message = "현장 상황을 간단히 입력해주세요.") String content,
        @NotNull(message = "위치를 먼저 확인해주세요.") Double latitude,
        @NotNull(message = "위치를 먼저 확인해주세요.") Double longitude,
        String address,
        String reporterPhone,
        String photoUrl,
        List<String> additionalPhotoUrls
) {
    public Report toReport() {
        Report report = new Report();
        report.setDisasterType(disasterType);
        report.setContent(content);
        report.setLatitude(latitude);
        report.setLongitude(longitude);
        report.setAddress(address);
        report.setReporterPhone(reporterPhone);
        report.setPhotoUrl(photoUrl);
        report.setAdditionalPhotoUrls(additionalPhotoUrls);
        return report;
    }
}
