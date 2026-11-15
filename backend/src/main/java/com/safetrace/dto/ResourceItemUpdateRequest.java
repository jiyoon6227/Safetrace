package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 품목 수정 body (ADMIN). 이름·분류·설명만 바꿀 수 있다.
// unit·returnable은 기존 재고·요청의 해석을 바꾸므로 받지 않는다: 값이 들어오면 서비스가 400으로 거절한다 (조용히 무시하지 않는다).
public record ResourceItemUpdateRequest(
        @NotBlank(message = "품목명을 입력해주세요.")
        @Size(max = 50, message = "품목명은 50자 이하로 입력해주세요.") String name,
        @NotBlank(message = "분류를 선택해주세요.") String category,
        @Size(max = 200, message = "설명은 200자 이하로 입력해주세요.") String description,
        String unit,
        String returnable
) {
}
