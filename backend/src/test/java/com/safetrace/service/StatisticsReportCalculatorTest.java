package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Report;
import com.safetrace.dto.StatisticsReportResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StatisticsReportCalculatorTest {

    private static Incident incident(String type, String status, String severity, String region, LocalDateTime created, LocalDateTime updated) {
        Incident i = new Incident();
        i.setDisasterType(type);
        i.setStatus(status);
        i.setSeverity(severity);
        i.setRegion(region);
        i.setCreatedAt(created);
        i.setUpdatedAt(updated);
        return i;
    }

    @Test
    void 기간_지역_유형_조건으로_집계한다() {
        LocalDateTime t = LocalDateTime.of(2026, 11, 10, 9, 0);
        List<Incident> incidents = List.of(
                incident("화재", "CLOSED", "HIGH", "서울특별시 강남구", t, t.plusHours(2)),
                incident("화재", "RECEIVED", "LOW", "서울특별시 마포구", t, t),
                incident("침수", "CLOSED", "LOW", "부산광역시 해운대구", t, t.plusMinutes(30)),
                incident("화재", "CLOSED", "LOW", "서울특별시 강남구", t.minusDays(40), t.minusDays(40).plusHours(1)));
        Report report = new Report();
        report.setDisasterType("화재");
        report.setAddress("서울특별시 강남구");
        report.setCreatedAt(t);

        StatisticsReportResponse r = StatisticsReportCalculator.build(incidents, List.of(report),
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 15), "서울", "화재");

        assertThat(r.current().total()).isEqualTo(2);
        assertThat(r.current().closed()).isEqualTo(1);
        assertThat(r.current().high()).isEqualTo(1);
        assertThat(r.current().reports()).isEqualTo(1);
        assertThat(r.current().avgCloseHours()).isEqualTo(2.0);
        assertThat(r.durations().get(1).value()).isEqualTo(1); // 1~3시간 구간
        assertThat(r.regionOptions()).contains("부산", "서울");
    }

    @Test
    void 종료시각이_접수보다_빠르면_평균_처리시간에서_제외한다() {
        LocalDateTime t = LocalDateTime.of(2026, 11, 10, 9, 0);
        StatisticsReportResponse r = StatisticsReportCalculator.build(
                List.of(incident("화재", "CLOSED", "LOW", "서울특별시", t, t.minusHours(1))), List.of(),
                LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 10), "ALL", "ALL");
        assertThat(r.current().avgCloseHours()).isNull();
    }
}
