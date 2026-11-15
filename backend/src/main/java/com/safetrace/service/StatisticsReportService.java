package com.safetrace.service;

import com.safetrace.dto.StatisticsReportResponse;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.ReportMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class StatisticsReportService {

    private final IncidentMapper incidentMapper;
    private final ReportMapper reportMapper;

    @Transactional(readOnly = true)
    public StatisticsReportResponse build(LocalDate from, LocalDate to, String region, String type) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("조회 기간을 확인해 주세요.");
        }
        return StatisticsReportCalculator.build(incidentMapper.findStatRows(), reportMapper.findUnlinkedStatRows(), from, to, region, type);
    }
}
