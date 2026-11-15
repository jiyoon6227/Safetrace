package com.safetrace.controller;

import com.safetrace.dto.StatisticsReportResponse;
import com.safetrace.service.StatisticsReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/incidents/stats")
@RequiredArgsConstructor
public class StatisticsReportController {

    private final StatisticsReportService statisticsReportService;

    // STAFF 통계 보고서 - 기간/지역/유형 조건으로 서버에서 집계
    @GetMapping("/report")
    @PreAuthorize("hasRole('STAFF')")
    public StatisticsReportResponse report(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "ALL") String region,
            @RequestParam(defaultValue = "ALL") String type) {
        return statisticsReportService.build(from, to, region, type);
    }
}
