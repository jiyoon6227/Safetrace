package com.safetrace.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * 기상청_생활기상지수 조회서비스(LivingWthrIdxServiceV5)의 "자외선지수조회(getUVIdxV5)"를 호출한다.
 * 날씨/대기질 API와 호출 방식이 다름:
 *  - 좌표가 아니라 "지점코드"(시/도 단위 행정구역코드, areaNo) 기준
 *  - 하루 2회(06시/18시)만 발표되고, 그 발표시각 기준 h3~h75(3시간 간격) 예측값을 한 번에 통째로 줌
 *    -> "지금 값"이 따로 없어서, 지금 시각이 발표시각으로부터 몇 시간 지났는지 계산해
 *       가장 가까운 h값을 우리가 직접 골라야 함
 */
@Service
public class UvIndexService {

    private static final String BASE_URL =
            "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5/getUVIdxV5";

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UvIndexService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // 카카오 지오코딩이 주는 시/도 전체명칭 -> 생활기상지수 API가 요구하는 10자리 지점코드
    // (법정동코드의 시/도 2자리 + 0 8개. 예: 서울=11 -> 1100000000)
    private static final Map<String, String> AREA_NO_MAP = Map.ofEntries(
            Map.entry("서울특별시", "1100000000"), Map.entry("부산광역시", "2600000000"),
            Map.entry("대구광역시", "2700000000"), Map.entry("인천광역시", "2800000000"),
            Map.entry("광주광역시", "2900000000"), Map.entry("대전광역시", "3000000000"),
            Map.entry("울산광역시", "3100000000"), Map.entry("세종특별자치시", "3600000000"),
            Map.entry("경기도", "4100000000"),
            Map.entry("강원특별자치도", "5100000000"), Map.entry("강원도", "5100000000"),
            Map.entry("충청북도", "4300000000"), Map.entry("충청남도", "4400000000"),
            Map.entry("전북특별자치도", "5200000000"), Map.entry("전라북도", "5200000000"),
            Map.entry("전라남도", "4600000000"),
            Map.entry("경상북도", "4700000000"), Map.entry("경상남도", "4800000000"),
            Map.entry("제주특별자치도", "5000000000")
    );

    public Map<String, Object> getUvIndex(String sidoFullName) {
        String areaNo = AREA_NO_MAP.get(sidoFullName);
        if (areaNo == null) {
            return Map.of("available", false, "message", "자외선지수 조회를 지원하지 않는 지역입니다: " + sidoFullName);
        }

        // 발표 직후엔 아직 데이터가 안 만들어졌을 수 있어 30분 여유를 두고 계산
        // (WeatherService가 초단기실황에서 매시 40분 확정을 감안하는 것과 같은 이유)
        LocalDateTime now = LocalDateTime.now().minusMinutes(30);
        LocalDateTime today06 = now.toLocalDate().atTime(6, 0);
        LocalDateTime today18 = now.toLocalDate().atTime(18, 0);
        LocalDateTime baseDateTime;
        if (!now.isBefore(today18)) {
            baseDateTime = today18;
        } else if (!now.isBefore(today06)) {
            baseDateTime = today06;
        } else {
            baseDateTime = today18.minusDays(1);
        }
        String time = baseDateTime.format(DateTimeFormatter.ofPattern("yyyyMMddHH"));

        // 지금이 발표시각으로부터 몇 시간 지났는지를 3시간 단위로 반올림해서 h3~h75 중 하나 선택
        long hoursSinceBase = Duration.between(baseDateTime, now).toMinutes() / 60;
        int slot = (int) (Math.round(hoursSinceBase / 3.0) * 3);
        if (slot < 3) slot = 3;
        if (slot > 75) slot = 75;

        String url = String.format(
                "%s?serviceKey=%s&pageNo=1&numOfRows=10&dataType=JSON&areaNo=%s&time=%s",
                BASE_URL, URLEncoder.encode(serviceKey, StandardCharsets.UTF_8), areaNo, time);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode header = root.path("response").path("header");
            if (!"00".equals(header.path("resultCode").asText())) {
                return Map.of("available", false, "message", header.path("resultMsg").asText("자외선지수 정보를 가져오지 못했습니다."));
            }

            // 이 API도 다른 공공데이터처럼 items를 배열로 바로 줄 수도, items.item으로 감쌀 수도 있어서 둘 다 대응
            JsonNode itemsNode = root.path("response").path("body").path("items");
            JsonNode items = itemsNode.isArray() ? itemsNode : itemsNode.path("item");
            if (!items.isArray() || items.isEmpty()) {
                return Map.of("available", false, "message", "자외선지수 데이터가 없습니다.");
            }

            JsonNode item = items.get(0);
            Integer value = parseIntOrNull(item.path("h" + slot).asText(null));
            if (value == null) {
                return Map.of("available", false, "message", "자외선지수 데이터가 없습니다.");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("available", true);
            result.put("value", value);
            result.put("grade", grade(value));
            return result;
        } catch (HttpTimeoutException e) {
            return Map.of("available", false, "message", "자외선지수 서버 응답이 지연되고 있습니다.");
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return Map.of("available", false, "message", "자외선지수 정보를 가져오지 못했습니다.");
        }
    }

    // 기상청 자외선지수 4단계+위험 기준
    private String grade(int value) {
        if (value <= 2) return "낮음";
        if (value <= 5) return "보통";
        if (value <= 7) return "높음";
        if (value <= 10) return "매우높음";
        return "위험";
    }

    private Integer parseIntOrNull(String s) {
        if (s == null || s.isBlank() || "-".equals(s)) return null;
        try {
            return (int) Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}