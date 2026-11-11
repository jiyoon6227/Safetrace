package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 사용 중지·재개 body (ADMIN). 사유는 필수.
public record ResourceStockReasonRequest(
        @NotBlank(message = "사유를 입력해주세요.")
        @Size(max = 500, message = "사유는 500자 이하로 입력해주세요.") String reason
) {
}
