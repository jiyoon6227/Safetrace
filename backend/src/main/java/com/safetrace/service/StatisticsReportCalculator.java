package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Report;
import com.safetrace.dto.StatisticsReportResponse;
import com.safetrace.dto.StatisticsReportResponse.Bucket;
import com.safetrace.dto.StatisticsReportResponse.Count;
import com.safetrace.dto.StatisticsReportResponse.DayCount;
import com.safetrace.dto.StatisticsReportResponse.RegionDetail;
import com.safetrace.dto.StatisticsReportResponse.Summary;
import com.safetrace.dto.StatisticsReportResponse.TypeDetail;

import java.text.Collator;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/**
 * 통계 보고서 집계. DB 없이 목록만 받아 계산하므로 단위 테스트로 바로 검증한다.
 * 집계 기준(기간 포함 범위, 지역 표기, 평균 처리시간 등)은 통계 화면이 예전에 브라우저에서 계산하던 것과 같다.
 */
public final class StatisticsReportCalculator {

    public static final String ALL = "ALL";
    private static final String NO_REGION = "미지정";
    private static final String NO_TYPE = "기타";
    private static final double HOUR_MS = 3_600_000.0;
    private static final List<String> STATUS_ORDER = List.of("RECEIVED", "CONFIRMING", "RESPONDING", "RECOVERING", "CLOSED");
    private static final String[] WEEKDAYS = {"일", "월", "화", "수", "목", "금", "토"};
    private static final Map<String, String> REGION_SHORT = Map.ofEntries(
            Map.entry("서울특별시", "서울"), Map.entry("부산광역시", "부산"), Map.entry("대구광역시", "대구"),
            Map.entry("인천광역시", "인천"), Map.entry("광주광역시", "광주"), Map.entry("대전광역시", "대전"),
            Map.entry("울산광역시", "울산"), Map.entry("세종특별자치시", "세종"), Map.entry("경기도", "경기"),
            Map.entry("강원특별자치도", "강원"), Map.entry("강원도", "강원"), Map.entry("충청북도", "충북"),
            Map.entry("충청남도", "충남"), Map.entry("전북특별자치도", "전북"), Map.entry("전라북도", "전북"),
            Map.entry("전라남도", "전남"), Map.entry("경상북도", "경북"), Map.entry("경상남도", "경남"),
            Map.entry("제주특별자치도", "제주"));
    // 종료 사건 처리시간 구간 (시간 단위, 이상 ~ 미만)
    private static final String[] DURATION_LABELS = {"1시간 이내", "1~3시간", "3~6시간", "6~12시간", "12시간 이상"};
    private static final double[] DURATION_MIN = {0, 1, 3, 6, 12};
    private static final double[] DURATION_MAX = {1, 3, 6, 12, Double.POSITIVE_INFINITY};

    private StatisticsReportCalculator() {
    }

    // 사건·제보 공통으로 쓰는 집계용 한 행 (제보는 status·severity·updatedAt이 없고 지역 자리에 주소가 들어간다)
    private record Row(String type, String status, String severity, String region, LocalDateTime createdAt, LocalDateTime updatedAt) {
        String typeOrEtc() {
            return empty(type) ? NO_TYPE : type;
        }

        String regionLabel() {
            String raw = (empty(region) ? "" : region).strip();
            if (raw.isEmpty()) return NO_REGION;
            String first = raw.split("(?U)\\s+")[0];
            return REGION_SHORT.getOrDefault(first, first);
        }

        boolean closed() {
            return "CLOSED".equals(status);
        }

        boolean high() {
            return "HIGH".equals(severity);
        }

        LocalDate day() {
            return createdAt.toLocalDate();
        }
    }

    public static StatisticsReportResponse build(List<Incident> incidentList, List<Report> reportList,
                                                 LocalDate from, LocalDate to, String region, String type) {
        List<Row> incidents = incidentList.stream()
                .map(i -> new Row(i.getDisasterType(), i.getStatus(), i.getSeverity(), i.getRegion(), i.getCreatedAt(), i.getUpdatedAt()))
                .toList();
        List<Row> reports = reportList.stream()
                .map(r -> new Row(r.getDisasterType(), null, null, r.getAddress(), r.getCreatedAt(), null))
                .toList();

        long days = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate previousTo = from.minusDays(1);
        LocalDate previousFrom = previousTo.minusDays(days - 1);

        List<Row> current = within(incidents, from, to, region, type);
        List<Row> previous = within(incidents, previousFrom, previousTo, region, type);
        List<Count> types = groupCount(current, Row::typeOrEtc);
        List<Count> regions = groupCount(current, Row::regionLabel);
        Map<String, Integer> previousTypes = toMap(groupCount(previous, Row::typeOrEtc));
        Map<String, Integer> previousRegions = toMap(groupCount(previous, Row::regionLabel));

        List<TypeDetail> typeDetails = types.stream().map(t -> {
            List<Row> rows = current.stream().filter(r -> r.typeOrEtc().equals(t.label())).toList();
            List<Count> byRegion = groupCount(rows, Row::regionLabel);
            return new TypeDetail(t.label(), t.value(), count(rows, Row::high), count(rows, Row::closed), avgCloseHours(rows),
                    byRegion.isEmpty() ? "-" : byRegion.get(0).label(), previousTypes.getOrDefault(t.label(), 0));
        }).toList();
        List<RegionDetail> regionDetails = regions.stream().map(g -> {
            List<Row> rows = current.stream().filter(r -> r.regionLabel().equals(g.label())).toList();
            return new RegionDetail(g.label(), g.value(), count(rows, Row::high), count(rows, Row::closed), previousRegions.getOrDefault(g.label(), 0));
        }).toList();

        Collator korean = Collator.getInstance(Locale.KOREAN);
        List<String> regionOptions = Stream.concat(incidents.stream(), reports.stream())
                .map(Row::regionLabel).filter(label -> !NO_REGION.equals(label)).distinct().sorted(korean).toList();
        List<String> typeOptions = Stream.concat(incidents.stream(), reports.stream())
                .map(Row::type).filter(t -> !empty(t)).distinct().sorted(korean).toList();

        return new StatisticsReportResponse(
                regionOptions, typeOptions,
                summary(current, within(reports, from, to, region, type).size()),
                summary(previous, within(reports, previousFrom, previousTo, region, type).size()),
                trend(current, from, to), types, regions,
                STATUS_ORDER.stream().map(s -> new Count(s, count(current, r -> s.equals(r.status())))).toList(),
                durations(current),
                daily(incidents, to, region, type), daily(incidents, to.minusDays(7), region, type),
                typeDetails, regionDetails);
    }

    // 자바스크립트의 빈 문자열·null 판정과 같게 본다 (공백만 있는 값은 값으로 취급)
    private static boolean empty(String value) {
        return value == null || value.isEmpty();
    }

    // 접수일이 기간(양 끝 날짜 포함)에 들고 지역·유형 필터에 맞는 행만 남긴다 (순서 유지)
    private static List<Row> within(List<Row> rows, LocalDate from, LocalDate to, String region, String type) {
        return rows.stream()
                .filter(r -> r.createdAt() != null && !r.day().isBefore(from) && !r.day().isAfter(to))
                .filter(r -> ALL.equals(type) || type.equals(r.type()))
                .filter(r -> ALL.equals(region) || region.equals(r.regionLabel()))
                .toList();
    }

    private static int count(List<Row> rows, Predicate<Row> test) {
        return (int) rows.stream().filter(test).count();
    }

    private static Map<String, Integer> toMap(List<Count> counts) {
        Map<String, Integer> map = new LinkedHashMap<>();
        counts.forEach(c -> map.put(c.label(), c.value()));
        return map;
    }

    private static Summary summary(List<Row> rows, int reports) {
        return new Summary(rows.size(), count(rows, Row::closed), count(rows, Row::high), avgCloseHours(rows), reports);
    }

    // 종료 사건의 접수→최종 수정 평균 시간(시간). 종료 사건이 없으면 null
    private static Double avgCloseHours(List<Row> rows) {
        List<Double> hours = rows.stream()
                .filter(r -> r.closed() && r.createdAt() != null && r.updatedAt() != null && !r.updatedAt().isBefore(r.createdAt()))
                .map(r -> Duration.between(r.createdAt(), r.updatedAt()).toMillis() / HOUR_MS)
                .toList();
        return hours.isEmpty() ? null : hours.stream().mapToDouble(Double::doubleValue).sum() / hours.size();
    }

    // 키별 건수 (많은 순, 같으면 먼저 나온 순)
    private static List<Count> groupCount(List<Row> rows, Function<Row, String> key) {
        Map<String, Integer> map = new LinkedHashMap<>();
        rows.forEach(r -> map.merge(key.apply(r), 1, Integer::sum));
        return map.entrySet().stream()
                .map(e -> new Count(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(Count::value).reversed())
                .toList();
    }

    private static List<Count> durations(List<Row> rows) {
        List<Double> hours = rows.stream()
                .filter(r -> r.closed() && r.createdAt() != null && r.updatedAt() != null)
                .map(r -> Duration.between(r.createdAt(), r.updatedAt()).toMillis() / HOUR_MS)
                .toList();
        return IntStream.range(0, DURATION_LABELS.length)
                .mapToObj(i -> new Count(DURATION_LABELS[i], (int) hours.stream().filter(h -> h >= DURATION_MIN[i] && h < DURATION_MAX[i]).count()))
                .toList();
    }

    // 기간이 120일을 넘으면 월, 45일을 넘으면 주(7일), 아니면 일 단위로 묶는다
    private static List<Bucket> trend(List<Row> rows, LocalDate from, LocalDate to) {
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        boolean monthly = days > 120;
        boolean weekly = !monthly && days > 45;

        List<String> keys = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        for (LocalDate cursor = from; !cursor.isAfter(to); ) {
            String key = monthly ? YearMonth.from(cursor).toString() : cursor.toString();
            if (!keys.contains(key)) {
                keys.add(key);
                labels.add(monthly ? cursor.getMonthValue() + "월" : cursor.getMonthValue() + "." + cursor.getDayOfMonth());
            }
            cursor = monthly ? cursor.withDayOfMonth(1).plusMonths(1) : cursor.plusDays(weekly ? 7 : 1);
        }

        int[] totals = new int[keys.size()];
        List<Map<String, Integer>> byType = keys.stream().map(k -> (Map<String, Integer>) new LinkedHashMap<String, Integer>()).toList();
        for (Row row : rows) {
            LocalDate day = row.day();
            int index;
            if (monthly) index = Math.max(0, keys.indexOf(YearMonth.from(day).toString()));
            else if (weekly) index = (int) Math.min(keys.size() - 1, Math.max(0, ChronoUnit.DAYS.between(from, day) / 7));
            else index = Math.max(0, keys.indexOf(day.toString()));
            totals[index]++;
            byType.get(index).merge(row.typeOrEtc(), 1, Integer::sum);
        }
        return IntStream.range(0, keys.size()).mapToObj(i -> new Bucket(keys.get(i), labels.get(i), totals[i], byType.get(i))).toList();
    }

    // end 날짜까지 7일의 일별 건수
    private static List<DayCount> daily(List<Row> incidents, LocalDate end, String region, String type) {
        LocalDate start = end.minusDays(6);
        List<Row> rows = within(incidents, start, end, region, type);
        return IntStream.range(0, 7).mapToObj(i -> {
            LocalDate day = start.plusDays(i);
            return new DayCount(day.toString(), day.getMonthValue() + "." + day.getDayOfMonth(),
                    String.format("%d.%02d.%02d", day.getYear(), day.getMonthValue(), day.getDayOfMonth()),
                    WEEKDAYS[day.getDayOfWeek().getValue() % 7], count(rows, r -> r.day().equals(day)));
        }).toList();
    }
}
