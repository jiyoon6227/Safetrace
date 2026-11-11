package com.safetrace.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

// 자원 요청 생성 body. 요청자는 로그인 정보에서 가져오므로 받지 않는다. 업무 규칙(재고·사건 상태 등)은 서비스에서 검증한다.
public record ResourceRequestCreateRequest(
        @NotNull(message = "사건을 선택해주세요.") Long incidentId,
        @NotNull(message = "요청할 재고를 선택해주세요.") Long stockId,
        @NotNull(message = "요청 수량을 입력해주세요.")
        @Min(value = 1, message = "요청 수량은 1 이상이어야 합니다.")
        @Max(value = 99_999_999, message = "요청 수량이 너무 큽니다.") Integer quantity,
        @NotBlank(message = "요청 사유를 입력해주세요.")
        @Size(max = 500, message = "요청 사유는 500자 이하로 입력해주세요.") String reason,
        LocalDateTime neededAt
) {
}
