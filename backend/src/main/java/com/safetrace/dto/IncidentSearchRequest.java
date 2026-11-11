package com.safetrace.dto;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

// 사건 관리 목록 검색 요청 (화면 쿼리스트링 그대로). "ALL"/빈 값은 조건 없음으로 처리
public record IncidentSearchRequest(
        String q,
        String status,
        String type,
        String region,
        String severity,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        String sort,
        Integer page,
        Integer size,
        Long selectedId
) {
}
