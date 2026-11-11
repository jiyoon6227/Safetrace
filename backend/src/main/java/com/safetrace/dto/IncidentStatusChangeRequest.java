package com.safetrace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

// 사건 상태 변경 요청 (CLOSED 시 memo 필수 여부는 서비스에서 검증)
// cancelRequestIds: 종료할 때 사용자가 화면에서 확인한 출고 전 자원 요청 번호 (선택, 출고 전 요청이 없으면 보내지 않아도 된다)
public record IncidentStatusChangeRequest(
        @NotBlank(message = "변경할 사건 상태를 입력해주세요.") String status,
        String memo,
        @Size(max = 200, message = "확인한 요청 목록이 너무 깁니다.") List<Long> cancelRequestIds
) {

    // 상태와 메모만 보내는 기존 호출이 그대로 동작하도록 유지한다
    public IncidentStatusChangeRequest(String status, String memo) {
        this(status, memo, null);
    }
}
