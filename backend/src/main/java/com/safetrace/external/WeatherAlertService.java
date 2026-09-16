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
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 기상청_기상특보 조회서비스(data.go.kr 15000415) 연동.
 *
 * 주의: data.go.kr에 활용신청하면 받는 "OpenAPI활용가이드" 문서에 실제 오퍼레이션명
 * (getWthrWrnList 등)과 응답 필드가 정확히 나와있으니, 신청 후 그 문서 기준으로
 * BASE_URL 끝의 오퍼레이션명만 다시 확인해서 맞춰줘야 함. 여기서는 활용신청 페이지에
 * 공개된 요청/응답 파라미터(title, stnId, tmFc, fromTmFc, toTmFc)만 가지고 짰음.
 *
 * title 필드가 자유 텍스트로 "○○지역 폭염주의보 발표", "○○지역 호우주의보 해제"처럼
 * 내려오기 때문에, "해제"가 title에 포함되어 있는지로 발표/해제를 구분함.
 */
@Service
public class WeatherAlertService {

    private static final String BASE_URL =
            "https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList";

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WeatherAlertService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    /**
     * 최근 며칠(기본 3일) 안에 발표된 특보 목록을 가져와서 현재 발효 중인 것과
     * 최근 해제된 것으로 나눠서 돌려준다. 프론트에서 빈 상태(특보 없음) 처리하기 쉽게
     * 두 리스트를 항상 따로 준다.
     */
    public Map<String, Object> getWeatherAlerts(int lookbackDays) {
        LocalDate today = LocalDate.now();
        String fromTmFc = today.minusDays(lookbackDays).format(DATE_FORMAT);
        String toTmFc = today.format(DATE_FORMAT);

        String url = String.format(
                "%s?serviceKey=%s&pageNo=1&numOfRows=100&dataType=JSON&fromTmFc=%s&toTmFc=%s",
                BASE_URL, URLEncoder.encode(serviceKey, StandardCharsets.UTF_8), fromTmFc, toTmFc);

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
                return Map.of(
                        "available", false,
                        "message", header.path("resultMsg").asText("특보 정보를 가져오지 못했습니다."),
                        "active", List.of(),
                        "recentlyCleared", List.of()
                );
            }

            JsonNode itemsNode = root.path("response").path("body").path("items");
            JsonNode items = itemsNode.isArray() ? itemsNode : itemsNode.path("item");

            List<Map<String, Object>> active = new ArrayList<>();
            List<Map<String, Object>> recentlyCleared = new ArrayList<>();

            for (JsonNode item : items) {
                String title = item.path("title").asText("");
                String tmFc = item.path("tmFc").asText("");
                Map<String, Object> entry = new HashMap<>();
                entry.put("title", title);
                entry.put("stnId", item.path("stnId").asText(""));
                entry.put("announcedAt", tmFc);

                if (title.contains("해제")) {
                    recentlyCleared.add(entry);
                } else {
                    active.add(entry);
                }
            }

            // 최신순으로 정렬(tmFc가 yyyyMMddHHmm 형식이라 문자열 비교로도 최신순 정렬됨)
            active.sort((a, b) -> ((String) b.get("announcedAt")).compareTo((String) a.get("announcedAt")));
            recentlyCleared.sort((a, b) -> ((String) b.get("announcedAt")).compareTo((String) a.get("announcedAt")));

            Map<String, Object> result = new HashMap<>();
            result.put("available", true);
            result.put("active", active);
            result.put("recentlyCleared", recentlyCleared.size() > 5 ? recentlyCleared.subList(0, 5) : recentlyCleared);
            return result;
        } catch (HttpTimeoutException e) {
            return Map.of("available", false, "message", "특보 서버 응답이 지연되고 있습니다.", "active", List.of(), "recentlyCleared", List.of());
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return Map.of("available", false, "message", "특보 정보를 가져오지 못했습니다.", "active", List.of(), "recentlyCleared", List.of());
        }
    }
}