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
import java.util.HashMap;
import java.util.Map;

/**
 * 한국환경공단_에어코리아_대기오염정보의 "시도별 실시간 측정정보 조회(getCtprvnRltmMesureDnsty)"를 호출한다.
 * 측정소 단위가 아니라 시/도 단위 평균을 쓰는 이유: 관심지역 좌표를 측정소 좌표와 직접 매칭하려면
 * 좌표계 변환(TM)까지 필요해서 범위가 커짐. 시/도 단위면 카카오 지오코딩 결과의 행정구역명을
 * 그대로 재사용할 수 있어 훨씬 단순함.
 */
@Service
public class AirQualityService {

    private static final String BASE_URL =
            "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AirQualityService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // 카카오 지오코딩이 주는 시도 전체명칭 -> 에어코리아 API가 요구하는 시도 약칭
    private static final Map<String, String> SIDO_NAME_MAP = Map.ofEntries(
            Map.entry("서울특별시", "서울"), Map.entry("부산광역시", "부산"), Map.entry("대구광역시", "대구"),
            Map.entry("인천광역시", "인천"), Map.entry("광주광역시", "광주"), Map.entry("대전광역시", "대전"),
            Map.entry("울산광역시", "울산"), Map.entry("세종특별자치시", "세종"), Map.entry("경기도", "경기"),
            Map.entry("강원특별자치도", "강원"), Map.entry("강원도", "강원"), Map.entry("충청북도", "충북"),
            Map.entry("충청남도", "충남"), Map.entry("전북특별자치도", "전북"), Map.entry("전라북도", "전북"),
            Map.entry("전라남도", "전남"), Map.entry("경상북도", "경북"), Map.entry("경상남도", "경남"),
            Map.entry("제주특별자치도", "제주")
    );

    public static String toSidoShortName(String fullSidoName) {
        return SIDO_NAME_MAP.get(fullSidoName);
    }

    public Map<String, Object> getAirQuality(String sidoFullName) {
        String sido = toSidoShortName(sidoFullName);
        if (sido == null) {
            return Map.of("available", false, "message", "대기질 조회를 지원하지 않는 지역입니다: " + sidoFullName);
        }

        String url = String.format(
                "%s?serviceKey=%s&returnType=json&numOfRows=100&pageNo=1&sidoName=%s&ver=1.0",
                BASE_URL, URLEncoder.encode(serviceKey, StandardCharsets.UTF_8), URLEncoder.encode(sido, StandardCharsets.UTF_8));

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
                return Map.of("available", false, "message", header.path("resultMsg").asText("대기질 정보를 가져오지 못했습니다."));
            }

            // 이 API가 JSON에서도 XML처럼 items.item으로 감싸서 줄 수도, items를 바로 배열로 줄 수도 있어서
            // 실제 어떤 형태로 오는지 로그로 확인하고 둘 다 대응함
            JsonNode itemsNode = root.path("response").path("body").path("items");
            JsonNode items = itemsNode.isArray() ? itemsNode : itemsNode.path("item");
            double pm10Sum = 0, pm25Sum = 0;
            int pm10Count = 0, pm25Count = 0;
            for (JsonNode item : items) {
                Double pm10 = parseDoubleOrNull(item.path("pm10Value").asText(null));
                Double pm25 = parseDoubleOrNull(item.path("pm25Value").asText(null));
                if (pm10 != null) { pm10Sum += pm10; pm10Count++; }
                if (pm25 != null) { pm25Sum += pm25; pm25Count++; }
            }

            if (pm10Count == 0 && pm25Count == 0) {
                return Map.of("available", false, "message", "측정 가능한 대기질 데이터가 없습니다.");
            }

            Integer pm10Avg = pm10Count > 0 ? (int) Math.round(pm10Sum / pm10Count) : null;
            Integer pm25Avg = pm25Count > 0 ? (int) Math.round(pm25Sum / pm25Count) : null;

            Map<String, Object> result = new HashMap<>();
            result.put("available", true);
            result.put("pm10", pm10Avg);
            result.put("pm25", pm25Avg);
            result.put("pm10Grade", pm10Avg != null ? gradePm10(pm10Avg) : null);
            result.put("pm25Grade", pm25Avg != null ? gradePm25(pm25Avg) : null);
            return result;
        } catch (HttpTimeoutException e) {
            return Map.of("available", false, "message", "대기질 서버 응답이 지연되고 있습니다.");
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return Map.of("available", false, "message", "대기질 정보를 가져오지 못했습니다.");
        }
    }

    private Double parseDoubleOrNull(String s) {
        if (s == null || s.isBlank() || "-".equals(s) || "null".equalsIgnoreCase(s)) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // 환경부 대기환경 기준 등급 구간 (미세먼지/초미세먼지 각각 공식 4단계 기준)
    private String gradePm10(int value) {
        if (value <= 30) return "좋음";
        if (value <= 80) return "보통";
        if (value <= 150) return "나쁨";
        return "매우나쁨";
    }

    private String gradePm25(int value) {
        if (value <= 15) return "좋음";
        if (value <= 35) return "보통";
        if (value <= 75) return "나쁨";
        return "매우나쁨";
    }
}