package com.safetrace.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 손실 확정 body (ADMIN). expectedProcessedQty는 화면이 보고 있는 "처리 완료 수량(반납 + 손실)"이다.
// 그 사이 다른 처리가 있었다면 값이 달라져 409가 되고, 같은 입력이 두 번 반영되는 것도 막는다.
public record ResourceLossRequest(
        @NotNull(message = "손실 수량을 입력해주세요.")
        @Min(value = 1, message = "손실 수량은 1 이상이어야 합니다.") Integer lostQty,
        @NotBlank(message = "손실 사유를 입력해주세요.")
        @Size(max = 500, message = "손실 사유는 500자 이하로 입력해주세요.") String reason,
        @NotNull(message = "처리 완료 수량(expectedProcessedQty)이 없습니다.")
        @Min(value = 0, message = "처리 완료 수량은 0 이상이어야 합니다.") Integer expectedProcessedQty
) {
}
