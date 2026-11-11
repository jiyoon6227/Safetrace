package com.safetrace.dto;

import com.safetrace.domain.ResourceReturn;

import java.util.List;

// 반납 확인함 한 페이지 + 조건에 맞는 전체 건수
public record ResourceReturnPageResponse(List<ResourceReturn> items, long total, int page, int size) {
}
