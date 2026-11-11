package com.safetrace.dto;

import com.safetrace.domain.ResourceRequest;

import java.util.List;

// 사건 종료 전 확인 목록: 종료하면 취소될 출고 전 요청과, 종료 뒤에도 미반납으로 남는 출고 건수
public record ClosurePreviewResponse(List<ResourceRequest> openRequests, int dispatchedCount) {
}
