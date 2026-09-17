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
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class WeatherAlertService {

    private static final String BASE_URL =
            "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";

    private static final String[] WEATHER_TYPES = {
            "강풍", "호우", "한파", "건조", "폭풍해일", "풍랑",
            "태풍", "대설", "황사", "폭염", "지진해일"
    };

    private final String serviceKey;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    // 기존 공공데이터포털 키 그대로 사용
    public WeatherAlertService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // EnvironmentController 기존 시그니처 유지
    public Map<String, Object> getWeatherAlerts(int ignoredLookbackDays) {
        if (serviceKey == null || serviceKey.isBlank()) {
            return unavailable("공공데이터포털 인증키가 설정되지 않았습니다.");
        }

        String url = BASE_URL
                + "?ServiceKey=" + URLEncoder.encode(serviceKey, StandardCharsets.UTF_8)
                + "&pageNo=1"
                + "&numOfRows=1000"
                + "&dataType=JSON";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(7))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return unavailable("기상특보 서버 응답 오류: HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());

            // data.go.kr 인증/호출량 오류는 response 구조가 아닐 수 있어서 같이 검사
            if (root.has("OpenAPI_ServiceResponse")) {
                String error = root.path("OpenAPI_ServiceResponse")
                        .path("cmmMsgHeader")
                        .path("errMsg")
                        .asText("공공데이터포털 호출 오류");
                return unavailable(error);
            }

            JsonNode apiResponse = root.path("response");
            String resultCode = apiResponse.path("header").path("resultCode").asText("");
            String resultMsg = apiResponse.path("header").path("resultMsg").asText("");

            if (!("00".equals(resultCode) || "0".equals(resultCode))) {
                return unavailable("기상특보 API 오류: " + resultCode + " " + resultMsg);
            }

            JsonNode itemNode = apiResponse.path("body").path("items").path("item");
            List<JsonNode> items = toList(itemNode);

            // getPwnStatus는 '현재 특보현황'이므로 반환된 항목을 모두 현재 발효중으로 취급
            LinkedHashMap<String, Map<String, Object>> dedup = new LinkedHashMap<>();

            for (JsonNode item : items) {
                String region = firstText(item,
                        "areaName", "areaNm", "regName", "regNm",
                        "pwnArea", "warnArea", "wrnArea", "pwnRegNm", "region");

                String type = firstText(item,
                        "warnVar", "wrnType", "pwnType", "pwnNm", "wrnNm", "type");

                String level = firstText(item,
                        "warnStress", "wrnLevel", "pwnLevel", "level");

                String announcedAt = firstText(item,
                        "tmFc", "announceTime", "announcedAt", "tm", "tmEf");

                // 명세 필드명이 바뀌거나 다른 이름으로 내려오는 경우 값 자체를 탐색해서 보완
                if (region.isBlank()) region = detectRegion(item);
                if (type.isBlank()) type = detectWeatherType(item);
                if (level.isBlank()) level = detectLevel(item);

                String rawText = flattenText(item);

                // 특보현황 API는 한 항목의 지역 필드에 여러 구역을 쉼표로 묶어서 내려줄 수 있다.
                // 예: "남해동부안쪽먼바다, 남해동부바깥먼바다, ..."
                // 이를 그대로 두면 여러 구역이 1개 구역으로 집계되므로 구역별로 분리한다.
                if (region.isBlank()) region = "전국";
                List<String> regions = splitRegions(region);
                if (regions.isEmpty()) regions = List.of(region);

                for (String regionName : regions) {
                    String title = buildTitle(type, level, regionName, rawText);

                    Map<String, Object> alert = new LinkedHashMap<>();
                    alert.put("region", regionName);
                    alert.put("regionParent", parentRegion(regionName));
                    alert.put("type", type);
                    alert.put("level", level);
                    alert.put("title", title);
                    alert.put("announcedAt", announcedAt);

                    String key = regionName + "|" + type + "|" + level;
                    dedup.putIfAbsent(key, alert);
                }
            }

            List<Map<String, Object>> active = new ArrayList<>(dedup.values());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("available", true);
            result.put("activeRegionCount", active.stream()
                    .map(a -> String.valueOf(a.get("region")))
                    .distinct()
                    .count());
            result.put("active", active);
            result.put("recentlyCleared", List.of());
            return result;

        } catch (HttpTimeoutException e) {
            return unavailable("기상특보 조회 시간이 초과되었습니다.");
        } catch (IOException e) {
            return unavailable("기상특보 응답을 읽지 못했습니다.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return unavailable("기상특보 조회가 중단되었습니다.");
        } catch (Exception e) {
            return unavailable("기상특보 조회 중 오류가 발생했습니다.");
        }
    }

    private List<JsonNode> toList(JsonNode node) {
        List<JsonNode> result = new ArrayList<>();
        if (node == null || node.isMissingNode() || node.isNull()) return result;
        if (node.isArray()) node.forEach(result::add);
        else if (node.isObject()) result.add(node);
        return result;
    }

    private String firstText(JsonNode item, String... names) {
        for (String name : names) {
            JsonNode value = item.get(name);
            if (value != null && !value.isNull()) {
                String text = value.asText("").trim();
                if (!text.isBlank()) return text;
            }
        }
        return "";
    }

    private String detectWeatherType(JsonNode item) {
        String all = flattenText(item);
        for (String type : WEATHER_TYPES) {
            if (all.contains(type)) return type;
        }
        return "";
    }

    private String detectLevel(JsonNode item) {
        String all = flattenText(item);
        if (all.contains("경보")) return "경보";
        if (all.contains("주의보")) return "주의보";
        return "";
    }

    private String detectRegion(JsonNode item) {
        Iterator<Map.Entry<String, JsonNode>> fields = item.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            if (!field.getValue().isValueNode()) continue;
            String value = field.getValue().asText("").trim();
            if (looksLikeRegion(value)) return value;
        }
        return "";
    }

    private boolean looksLikeRegion(String value) {
        if (value == null || value.isBlank()) return false;
        return value.contains("특별시") || value.contains("광역시") || value.contains("특별자치")
                || value.contains("경기도") || value.contains("강원") || value.contains("충청")
                || value.contains("전라") || value.contains("경상") || value.contains("제주")
                || value.contains("앞바다") || value.contains("먼바다") || value.contains("해역");
    }

    private String flattenText(JsonNode item) {
        StringBuilder sb = new StringBuilder();
        Iterator<Map.Entry<String, JsonNode>> fields = item.fields();
        while (fields.hasNext()) {
            JsonNode value = fields.next().getValue();
            if (value.isValueNode()) {
                String text = value.asText("").trim();
                if (!text.isBlank()) sb.append(text).append(' ');
            }
        }
        return sb.toString().replaceAll("\\s+", " ").trim();
    }

    private List<String> splitRegions(String rawRegion) {
        if (rawRegion == null || rawRegion.isBlank()) return List.of();

        List<String> result = new ArrayList<>();
        String[] parts = rawRegion.split("\\s*[,;/\\n]+\\s*");
        for (String part : parts) {
            String value = part == null ? "" : part.trim();
            if (!value.isBlank() && !result.contains(value)) {
                result.add(value);
            }
        }
        return result;
    }

    private String buildTitle(String type, String level, String region, String rawText) {
        String warning = (type + level).trim();
        if (!warning.isBlank() && !region.isBlank()) return region + " " + warning;
        if (!warning.isBlank()) return warning;
        if (!rawText.isBlank()) return rawText.length() > 80 ? rawText.substring(0, 80) + "…" : rawText;
        return "발효 중인 기상특보";
    }

    private String parentRegion(String region) {
        if (region == null) return "";
        if (region.contains("서울")) return "서울";
        if (region.contains("부산")) return "부산";
        if (region.contains("대구")) return "대구";
        if (region.contains("인천")) return "인천";
        if (region.contains("광주")) return "광주";
        if (region.contains("대전")) return "대전";
        if (region.contains("울산")) return "울산";
        if (region.contains("세종")) return "세종";
        if (region.contains("경기")) return "경기";
        if (region.contains("강원")) return "강원";
        if (region.contains("충북") || region.contains("충청북")) return "충북";
        if (region.contains("충남") || region.contains("충청남")) return "충남";
        if (region.contains("전북") || region.contains("전라북")) return "전북";
        if (region.contains("전남") || region.contains("전라남")) return "전남";
        if (region.contains("경북") || region.contains("경상북")) return "경북";
        if (region.contains("경남") || region.contains("경상남")) return "경남";
        if (region.contains("제주")) return "제주";
        return region;
    }

    private Map<String, Object> unavailable(String message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", false);
        result.put("activeRegionCount", 0);
        result.put("active", List.of());
        result.put("recentlyCleared", List.of());
        result.put("message", message);
        return result;
    }
}
