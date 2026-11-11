package com.safetrace.dto;

import lombok.Data;

import java.util.List;

// 관제 대시보드 통계 응답 - 상태별/업무 카드 건수는 매퍼가 채우고, daily는 서비스에서 채움
@Data
public class DashboardStatsResponse {
    private int total;
    private int receivedCount;
    private int confirmingCount;
    private int respondingCount;
    private int recoveringCount;
    private int closedCount;

    private int urgentCount;        // 진행중 + 위험도 HIGH
    private int myAssignedCount;    // 내가 담당하는 진행중 사건
    private int longPendingCount;   // 3일 이상 상태 변경 없는 진행중 사건

    // 카드 "전일 대비" - 해당 상태이면서 그날 수정된 사건 수
    private int receivedToday;
    private int receivedYesterday;
    private int confirmingToday;
    private int confirmingYesterday;
    private int respondingToday;
    private int respondingYesterday;
    private int recoveringToday;
    private int recoveringYesterday;

    // 최근 7일 일별 접수/처리완료 (0건인 날 포함, 오래된 날짜순)
    private List<DailyIncidentStat> daily;
}
