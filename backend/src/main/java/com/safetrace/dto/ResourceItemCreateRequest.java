package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// 품목 등록 body (ADMIN). 같은 이름이 이미 있으면 서비스가 409로 거절한다.
public record ResourceItemCreateRequest(
        @NotBlank(message = "품목명을 입력해주세요.")
        @Size(max = 50, message = "품목명은 50자 이하로 입력해주세요.") String name,
        @NotBlank(message = "분류를 선택해주세요.") String category,
        @NotBlank(message = "단위를 입력해주세요.")
        @Size(max = 10, message = "단위는 10자 이하로 입력해주세요.") String unit,
        @NotBlank(message = "반납형 여부를 선택해주세요.")
        @Pattern(regexp = "[YN]", message = "반납형 여부는 Y 또는 N이어야 합니다.") String returnable,
        @Size(max = 200, message = "설명은 200자 이하로 입력해주세요.") String description
) {
}
