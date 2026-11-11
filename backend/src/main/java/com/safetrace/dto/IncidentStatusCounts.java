package com.safetrace.dto;

import lombok.Data;

// 사건 관리 상태 탭/카드 건수 - 상태 필터만 빼고 나머지 조건을 적용한 결과
@Data
public class IncidentStatusCounts {
    private int total;
    private int receivedCount;
    private int confirmingCount;
    private int respondingCount;
    private int recoveringCount;
    private int closedCount;

    // 상태 값에 해당하는 건수 (status가 null이면 전체)
    public int countOf(String status) {
        if (status == null) return total;
        return switch (status) {
            case "RECEIVED" -> receivedCount;
            case "CONFIRMING" -> confirmingCount;
            case "RESPONDING" -> respondingCount;
            case "RECOVERING" -> recoveringCount;
            case "CLOSED" -> closedCount;
            default -> 0;
        };
    }
}
