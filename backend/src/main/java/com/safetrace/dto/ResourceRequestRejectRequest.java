package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 요청 반려 body (ADMIN). 반려 사유는 필수.
public record ResourceRequestRejectRequest(
        @NotBlank(message = "반려 사유를 입력해주세요.")
        @Size(max = 500, message = "반려 사유는 500자 이하로 입력해주세요.") String reason
) {
}
