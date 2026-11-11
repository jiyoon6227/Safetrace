package com.safetrace.dto;

// 대시보드 일별 사건 현황 한 칸 (date: YYYY-MM-DD)
public record DailyIncidentStat(String date, int received, int resolved) {
}
