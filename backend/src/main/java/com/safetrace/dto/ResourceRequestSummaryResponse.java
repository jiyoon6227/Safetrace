package com.safetrace.dto;

import java.util.Map;

// 자원 요청 상태별 건수 - counts에는 모든 상태가 0건까지 들어 있다 (상태 필터만 뺀 나머지 조건 기준)
public record ResourceRequestSummaryResponse(long total, Map<String, Long> counts) {
}
