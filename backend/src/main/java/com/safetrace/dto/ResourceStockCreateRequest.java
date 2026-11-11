package com.safetrace.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// 부서별 최초 재고 등록 body (ADMIN). 같은 부서·품목 재고가 이미 있으면 서비스가 409로 거절한다.
public record ResourceStockCreateRequest(
        @NotNull(message = "부서를 선택해주세요.") Long departmentId,
        @NotNull(message = "품목을 선택해주세요.") Long itemId,
        @NotNull(message = "수량을 입력해주세요.")
        @Min(value = 1, message = "수량은 1 이상이어야 합니다.")
        @Max(value = 99_999_999, message = "수량이 너무 큽니다.") Integer quantity,
        @Size(max = 500, message = "메모는 500자 이하로 입력해주세요.") String memo
) {
}
