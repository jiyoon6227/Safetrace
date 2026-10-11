package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;

// 사건 상태 변경 요청 (CLOSED 시 memo 필수 여부는 서비스에서 검증)
public record IncidentStatusChangeRequest(
        @NotBlank(message = "변경할 사건 상태를 입력해주세요.") String status,
        String memo
) {
}
