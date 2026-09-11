package com.safetrace.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
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
 * 기상청_단기예보 조회서비스의 "초단기실황조회(getUltraSrtNcst)"를 호출한다.
 * 관측값이라 예보와 달리 "지금 실제로 이런 날씨다"를 보여줄 때 씀.
 */
@Service
public class WeatherService {

    private static final String BASE_URL =
            "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WeatherService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // PTY(강수형태) 코드 -> 한글 라벨
    private static final Map<String, String> PTY_LABEL = Map.of(
            "0", "맑음",
            "1", "비",
            "2", "비/눈",
            "3", "눈",
            "5", "빗방울",
            "6", "빗방울눈날림",
            "7", "눈날림"
    );

    public Map<String, Object> getCurrentWeather(double lat, double lng) {
        KmaGridConverter.Grid grid = KmaGridConverter.toGrid(lat, lng);

        // 초단기실황은 매시 40분에 그 시각 값이 확정됨. 40분 이전이면 전 시간 값을 써야
        // "아직 안 만들어진 시각"을 요청해서 빈 응답을 받는 걸 피할 수 있음.
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime baseDateTime = now.getMinute() < 40 ? now.minusHours(1) : now;
        String baseDate = baseDateTime.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String baseTime = baseDateTime.format(DateTimeFormatter.ofPattern("HH")) + "00";

        String url = String.format(
                "%s?serviceKey=%s&numOfRows=10&pageNo=1&dataType=JSON&base_date=%s&base_time=%s&nx=%d&ny=%d",
                BASE_URL, java.net.URLEncoder.encode(serviceKey, StandardCharsets.UTF_8), baseDate, baseTime, grid.nx(), grid.ny());

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
                return Map.of("available", false, "message", header.path("resultMsg").asText("날씨 정보를 가져오지 못했습니다."));
            }

            JsonNode items = root.path("response").path("body").path("items").path("item");
            Map<String, String> values = new HashMap<>();
            for (JsonNode item : items) {
                values.put(item.path("category").asText(), item.path("obsrValue").asText());
            }

            Map<String, Object> result = new HashMap<>();
            result.put("available", true);
            result.put("temperature", values.get("T1H"));   // 기온(℃)
            result.put("humidity", values.get("REH"));       // 습도(%)
            result.put("windSpeed", values.get("WSD"));       // 풍속(m/s)
            String pty = values.getOrDefault("PTY", "0");
            result.put("precipitationType", PTY_LABEL.getOrDefault(pty, "맑음"));
            result.put("hourlyRainfall", values.get("RN1"));  // 1시간 강수량(mm), "강수없음"일 수 있음
            result.put("baseDate", baseDate);
            result.put("baseTime", baseTime);
            return result;
        } catch (HttpTimeoutException e) {
            return Map.of("available", false, "message", "날씨 서버 응답이 지연되고 있습니다.");
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return Map.of("available", false, "message", "날씨 정보를 가져오지 못했습니다.");
        }
    }
}