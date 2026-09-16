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


    /**
     * 전국 등록 민방위대피시설 총 건수를 반환한다.
     * 목록 전체를 내려받지 않고 numOfRows=1로 요청한 뒤 응답의 totalCount만 사용한다.
     */
    public Map<String, Object> getNationwideSummary() {
        String url = String.format(
                "%s?serviceKey=%s&pageNo=1&numOfRows=1&returnType=json",
                BASE_URL,
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8));

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode header = root.path("response").path("header");
            String resultCode = header.path("resultCode").asText("");
            if (!("0".equals(resultCode) || "00".equals(resultCode))) {
                return Map.of("available", false);
            }

            JsonNode body = root.path("response").path("body");
            long totalCount = body.path("totalCount").asLong(-1L);
            if (totalCount < 0) {
                return Map.of("available", false);
            }

            return Map.of(
                    "available", true,
                    "totalCount", totalCount
            );
        } catch (HttpTimeoutException e) {
            return Map.of("available", false);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return Map.of("available", false);
        }
    }

    /**
     * 공공정보 '대피시설 전체보기' 모달용 검색.
     * 공공데이터 원본 API의 페이지네이션을 그대로 사용하고,
     * 지역/시설명 조건이 있으면 서버에서 조건 검색한다.
     */
    public Map<String, Object> searchShelters(String region, String keyword, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 100));

        StringBuilder url = new StringBuilder(String.format(
                "%s?serviceKey=%s&pageNo=%d&numOfRows=%d&returnType=json",
                BASE_URL,
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                safePage,
                safeSize));

        // 운영 중인 시설만 조회해서 화면의 '대피시설' 의미와 맞춘다.
        url.append("&cond[OPER_STTS::EQ]=")
                .append(URLEncoder.encode("사용중", StandardCharsets.UTF_8));

        if (region != null && !region.isBlank()) {
            url.append("&cond[ROAD_NM_WHOL_ADDR::LIKE]=")
                    .append(URLEncoder.encode(region.trim(), StandardCharsets.UTF_8));
        }
        if (keyword != null && !keyword.isBlank()) {
            url.append("&cond[FCLT_NM::LIKE]=")
                    .append(URLEncoder.encode(keyword.trim(), StandardCharsets.UTF_8));
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url.toString()))
                    .timeout(Duration.ofSeconds(7))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode header = root.path("response").path("header");
            String resultCode = header.path("resultCode").asText("");
            if (!("0".equals(resultCode) || "00".equals(resultCode))) {
                return Map.of(
                        "available", false,
                        "page", safePage,
                        "size", safeSize,
                        "totalCount", 0,
                        "items", List.of()
                );
            }

            JsonNode body = root.path("response").path("body");
            long totalCount = body.path("totalCount").asLong(0L);
            JsonNode itemsNode = body.path("items").path("item");
            List<Map<String, Object>> items = new ArrayList<>();

            if (itemsNode.isArray()) {
                for (JsonNode item : itemsNode) {
                    Map<String, Object> shelter = new java.util.HashMap<>();
                    String address = item.path("ROAD_NM_WHOL_ADDR")
                            .asText(item.path("LCTN_WHOL_ADDR").asText(""));
                    shelter.put("name", item.path("FCLT_NM").asText(""));
                    shelter.put("region", extractRegionLabel(address));
                    shelter.put("address", address);
                    shelter.put("capacity", item.path("MAX_ACTC_PERNE").asText(""));
                    shelter.put("floorType", item.path("FCLTLOC_GRND_UDGD").asText(""));
                    shelter.put("latitude", parseDoubleOrNull(item.path("LAT_EPSG4326").asText(null)));
                    shelter.put("longitude", parseDoubleOrNull(item.path("LOT_EPST4326").asText(null)));
                    items.add(shelter);
                }
            }

            return Map.of(
                    "available", true,
                    "page", safePage,
                    "size", safeSize,
                    "totalCount", totalCount,
                    "items", items
            );
        } catch (HttpTimeoutException e) {
            return Map.of(
                    "available", false,
                    "page", safePage,
                    "size", safeSize,
                    "totalCount", 0,
                    "items", List.of()
            );
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return Map.of(
                    "available", false,
                    "page", safePage,
                    "size", safeSize,
                    "totalCount", 0,
                    "items", List.of()
            );
        }
    }

    private String extractRegionLabel(String address) {
        if (address == null || address.isBlank()) return "-";
        String first = address.trim().split("\\s+")[0];
        return switch (first) {
            case "서울특별시" -> "서울";
            case "부산광역시" -> "부산";
            case "대구광역시" -> "대구";
            case "인천광역시" -> "인천";
            case "광주광역시" -> "광주";
            case "대전광역시" -> "대전";
            case "울산광역시" -> "울산";
            case "세종특별자치시" -> "세종";
            case "경기도" -> "경기";
            case "강원특별자치도", "강원도" -> "강원";
            case "충청북도" -> "충북";
            case "충청남도" -> "충남";
            case "전북특별자치도", "전라북도" -> "전북";
            case "전라남도" -> "전남";
            case "경상북도" -> "경북";
            case "경상남도" -> "경남";
            case "제주특별자치도" -> "제주";
            default -> first;
        };
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