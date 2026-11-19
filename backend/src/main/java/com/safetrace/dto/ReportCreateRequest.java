package com.safetrace.dto;

import com.safetrace.domain.Report;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

// 제보 등록 요청 (제보자·상태는 서버에서 결정)
// 길이 상한은 SF_REPORT 컬럼 크기, 재난 유형은 제보 화면의 선택지와 같다. 사진 URL은 ReportService에서 확인한다.
public record ReportCreateRequest(
        @NotBlank(message = "재난 유형을 선택해주세요.")
        @Pattern(regexp = "침수|화재|산사태|강풍|폭염|한파|기타", message = "재난 유형이 올바르지 않습니다.") String disasterType,
        @NotBlank(message = "현장 상황을 간단히 입력해주세요.")
        @Size(max = 1000, message = "현장 상황은 1000자 이하로 입력해주세요.") String content,
        @NotNull(message = "위치를 먼저 확인해주세요.")
        @DecimalMin(value = "-90.0", message = "위치 정보가 올바르지 않습니다.")
        @DecimalMax(value = "90.0", message = "위치 정보가 올바르지 않습니다.") Double latitude,
        @NotNull(message = "위치를 먼저 확인해주세요.")
        @DecimalMin(value = "-180.0", message = "위치 정보가 올바르지 않습니다.")
        @DecimalMax(value = "180.0", message = "위치 정보가 올바르지 않습니다.") Double longitude,
        @Size(max = 300, message = "주소는 300자 이하로 입력해주세요.") String address,
        @Pattern(regexp = "^(0\\d{1,2}-?\\d{3,4}-?\\d{4})?$", message = "연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)") String reporterPhone,
        String photoUrl,
        @Size(max = 5, message = "사진은 최대 5장까지 첨부할 수 있습니다.") List<String> additionalPhotoUrls
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
