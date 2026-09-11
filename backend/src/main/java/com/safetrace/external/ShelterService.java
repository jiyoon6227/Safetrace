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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 행정안전부_민방위대피시설 조회서비스 호출.
 * 이 API는 좌표/반경 검색을 지원하지 않고 "도로명주소 LIKE 검색"만 가능해서,
 * 시/군/구 이름으로 넉넉히 가져온 다음 여기서 좌표 기준 거리를 직접 계산해 가까운 순으로 정렬함.
 */
@Service
public class ShelterService {

    private static final String BASE_URL = "https://apis.data.go.kr/1741000/civil_defense_shelter_info/info";

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ShelterService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    public List<Map<String, Object>> getNearbyShelters(String guName, double lat, double lng, int limit) {
        String url = String.format(
                "%s?serviceKey=%s&pageNo=1&numOfRows=100&returnType=json&cond[ROAD_NM_WHOL_ADDR::LIKE]=%s",
                BASE_URL,
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                URLEncoder.encode(guName, StandardCharsets.UTF_8));

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode header = root.path("response").path("header");
            if (!"0".equals(header.path("resultCode").asText())) {
                return List.of();
            }

            JsonNode items = root.path("response").path("body").path("items").path("item");
            List<Map<String, Object>> shelters = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode item : items) {
                    Double shelterLat = parseDoubleOrNull(item.path("LAT_EPSG4326").asText(null));
                    Double shelterLng = parseDoubleOrNull(item.path("LOT_EPST4326").asText(null));
                    if (shelterLat == null || shelterLng == null) continue;
                    if (!"사용중".equals(item.path("OPER_STTS").asText())) continue;

                    double distanceM = haversineMeters(lat, lng, shelterLat, shelterLng);

                    Map<String, Object> shelter = new java.util.HashMap<>();
                    shelter.put("name", item.path("FCLT_NM").asText(""));
                    shelter.put("address", item.path("ROAD_NM_WHOL_ADDR").asText(item.path("LCTN_WHOL_ADDR").asText("")));
                    shelter.put("capacity", item.path("MAX_ACTC_PERNE").asText(""));
                    shelter.put("floorType", item.path("FCLTLOC_GRND_UDGD").asText(""));
                    shelter.put("latitude", shelterLat);
                    shelter.put("longitude", shelterLng);
                    shelter.put("distanceM", Math.round(distanceM));
                    shelters.add(shelter);
                }
            }

            shelters.sort(Comparator.comparingDouble(s -> ((Number) s.get("distanceM")).doubleValue()));
            return shelters.size() > limit ? shelters.subList(0, limit) : shelters;
        } catch (HttpTimeoutException e) {
            return List.of();
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return List.of();
        }
    }

    private Double parseDoubleOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // 하버사인 공식 - 두 좌표 사이 직선거리(미터)
    private double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double earthRadiusM = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusM * c;
    }
}