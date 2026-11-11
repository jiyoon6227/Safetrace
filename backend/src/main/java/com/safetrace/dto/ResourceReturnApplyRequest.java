package com.safetrace.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 반납 신청 body (요청자 STAFF). 신청해도 재고는 변하지 않고, ADMIN이 확인할 때만 반영된다.
public record ResourceReturnApplyRequest(
        @NotNull(message = "반납 수량을 입력해주세요.")
        @Min(value = 1, message = "반납 수량은 1 이상이어야 합니다.") Integer appliedQty,
        @Size(max = 500, message = "메모는 500자 이하로 입력해주세요.") String memo
) {
}
