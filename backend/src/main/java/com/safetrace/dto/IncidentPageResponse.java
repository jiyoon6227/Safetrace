package com.safetrace.dto;

import com.safetrace.domain.Incident;

import java.util.List;

// 사건 관리 목록 응답 - 현재 페이지 목록 + 조건에 맞는 전체 건수 + 상태별 건수
// selectedIncluded: 열려 있는 사건이 검색어 조건에 아직 맞는지 (selectedId 없으면 null)
public record IncidentPageResponse(
        List<Incident> content,
        int totalCount,
        IncidentStatusCounts statusCounts,
        Boolean selectedIncluded
) {
}
