package com.safetrace.dto;

import lombok.Data;

// 날짜별 GROUP BY 조회 결과 한 줄 (statDate: YYYY-MM-DD)
@Data
public class DailyCount {
    private String statDate;
    private int cnt;
}
