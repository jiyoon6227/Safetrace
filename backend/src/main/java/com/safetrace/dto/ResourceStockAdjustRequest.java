package com.safetrace.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 수량 조정 body (ADMIN). delta는 늘리면 +, 줄이면 -. 0은 서비스에서 거절한다. 사유는 필수.
public record ResourceStockAdjustRequest(
        @NotNull(message = "조정 수량을 입력해주세요.")
        @Min(value = -99_999_999, message = "조정 수량이 너무 큽니다.")
        @Max(value = 99_999_999, message = "조정 수량이 너무 큽니다.") Integer delta,
        @NotBlank(message = "조정 사유를 입력해주세요.")
        @Size(max = 500, message = "사유는 500자 이하로 입력해주세요.") String reason
) {
}
