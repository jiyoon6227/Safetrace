package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;

// 안전확인 응답 요청 (SAFE/HELP 값 검증은 서비스에서 처리)
public record SafetyCheckRespondRequest(
        @NotBlank(message = "응답 상태를 선택해주세요.") String status
) {
}
