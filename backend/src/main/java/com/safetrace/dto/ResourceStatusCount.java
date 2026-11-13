package com.safetrace.dto;

import lombok.Data;

// 요청 상태별 건수 한 줄 (GROUP BY 결과)
@Data
public class ResourceStatusCount {
    private String status;
    private long requestCount;
}
