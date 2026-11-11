package com.safetrace.dto;

import com.safetrace.domain.ResourceRequest;

import java.util.List;

// 자원 요청 목록 한 페이지 + 조건에 맞는 전체 건수
public record ResourceRequestPageResponse(List<ResourceRequest> items, long total, int page, int size) {
}
