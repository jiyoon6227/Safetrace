package com.safetrace.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 추가 입고 body (ADMIN)
public record ResourceStockReceiveRequest(
        @NotNull(message = "입고 수량을 입력해주세요.")
        @Min(value = 1, message = "입고 수량은 1 이상이어야 합니다.")
        @Max(value = 99_999_999, message = "입고 수량이 너무 큽니다.") Integer quantity,
        @Size(max = 500, message = "메모는 500자 이하로 입력해주세요.") String memo
) {
}
