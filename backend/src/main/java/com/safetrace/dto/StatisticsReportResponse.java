package com.safetrace.dto;

import java.util.List;
import java.util.Map;

// 통계 보고서 화면 응답 - 선택한 기간·지역·유형 기준 집계. 비율·증감률 같은 표시용 계산은 화면에서 한다.
public record StatisticsReportResponse(
        List<String> regionOptions,   // 지역 선택 목록 (필터와 무관하게 전체 사건·제보 기준)
        List<String> typeOptions,     // 재난 유형 선택 목록
        Summary current,              // 선택 기간
        Summary previous,             // 같은 길이의 직전 기간
        List<Bucket> trend,           // 기간 길이에 따라 일/주/월 단위 건수 (values는 유형별 건수)
        List<Count> types,            // 유형별 건수 (많은 순)
        List<Count> regions,          // 지역별 건수 (많은 순)
        List<Count> statuses,         // 상태별 건수 (접수→종료 순)
        List<Count> durations,        // 종료 사건 처리시간 구간별 건수
        List<DayCount> compareCurrent,   // 선택 종료일 기준 최근 7일
        List<DayCount> comparePrevious,  // 그 직전 7일
        List<TypeDetail> typeDetails,
        List<RegionDetail> regionDetails
) {
    // avgCloseHours: 종료 사건이 없으면 null
    public record Summary(int total, int closed, int high, Double avgCloseHours, int reports) {
    }

    public record Count(String label, int value) {
    }

    public record Bucket(String key, String label, int value, Map<String, Integer> values) {
    }

    public record DayCount(String dateKey, String label, String fullDate, String weekday, int value) {
    }

    public record TypeDetail(String label, int value, int high, int closed, Double avgCloseHours, String topRegion, int previousValue) {
    }

    public record RegionDetail(String label, int value, int high, int closed, int previousValue) {
    }
}
