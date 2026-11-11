package com.safetrace.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// 재난유형별 선택 월 / 전월 사건 수
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TypeMonthlyCount {
    private String disasterType;
    private int currentCount;
    private int prevCount;
}
