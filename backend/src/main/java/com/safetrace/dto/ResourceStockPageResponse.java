package com.safetrace.dto;

import com.safetrace.domain.ResourceStockAdminView;

import java.util.List;

// ADMIN 재고 목록 한 페이지 + 조건에 맞는 전체 건수
public record ResourceStockPageResponse(List<ResourceStockAdminView> items, long total, int page, int size) {
}
