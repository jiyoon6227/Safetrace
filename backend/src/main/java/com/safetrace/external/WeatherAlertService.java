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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class WeatherAlertService {

    private static final String BASE_URL =
            "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";

    // 특보현황 통보문은 "o 풍랑주의보 : 구역, 구역(세부구역)" 형태로 유형·등급별 한 줄씩 나열된다.
    private static final Pattern STATUS_BULLET = Pattern.compile("(?:^|\\s)o\\s+");
    private static final Pattern STATUS_LINE = Pattern.compile("^([가-힣]+?)(주의보|경보)\\s*:\\s*(.*)$");
    private static final Pattern STATUS_MARK = Pattern.compile("(?:^|\\s)o\\s+[가-힣]+?(?:주의보|경보)\\s*:");

    private final String serviceKey;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    // 공공데이터포털 서비스 키
    public WeatherAlertService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // EnvironmentController 호환용 파라미터 (lookbackDays 미사용)
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
            List<Map<String, Object>> active = collectActiveAlerts(toList(itemNode));

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

    // getPwnStatus는 '현재 특보현황'이므로 발표시각이 가장 최근인 통보문만 현재 발효 중인 특보로 본다.
    List<Map<String, Object>> collectActiveAlerts(List<JsonNode> items) {
        String latest = "";
        for (JsonNode item : items) {
            String announcedAt = announcedAt(item);
            if (announcedAt.compareTo(latest) > 0) latest = announcedAt;
        }

        LinkedHashMap<String, Map<String, Object>> dedup = new LinkedHashMap<>();
        for (JsonNode item : items) {
            String announcedAt = announcedAt(item);
            if (!announcedAt.equals(latest)) continue;
            addStatusAlerts(statusText(item), announcedAt, dedup);
        }
        return new ArrayList<>(dedup.values());
    }

    private String announcedAt(JsonNode item) {
        return firstText(item, "tmFc", "announceTime", "announcedAt", "tm", "tmEf");
    }

    private String statusText(JsonNode item) {
        String text = firstText(item, "t6");
        if (!text.isBlank()) return text;

        Iterator<Map.Entry<String, JsonNode>> fields = item.fields();
        while (fields.hasNext()) {
            JsonNode value = fields.next().getValue();
            if (!value.isValueNode()) continue;
            String candidate = value.asText("").replaceAll("\\s+", " ").trim();
            if (STATUS_MARK.matcher(candidate).find()) return candidate;
        }
        return "";
    }

    private void addStatusAlerts(String statusText, String announcedAt, Map<String, Map<String, Object>> dedup) {
        String normalized = statusText.replaceAll("\\s+", " ").trim();

        for (String line : STATUS_BULLET.split(normalized)) {
            Matcher matcher = STATUS_LINE.matcher(line.trim());
            if (!matcher.matches()) continue;

            String type = matcher.group(1);
            String level = matcher.group(2);

            for (String zone : splitTopLevel(matcher.group(3))) {
                String parent = parentRegion(zone.contains("(") ? zone.substring(0, zone.indexOf('(')).trim() : zone);

                for (String regionName : expandZone(zone)) {
                    Map<String, Object> alert = new LinkedHashMap<>();
                    alert.put("region", regionName);
                    alert.put("regionParent", parent);
                    alert.put("type", type);
                    alert.put("level", level);
                    alert.put("title", regionName + " " + type + level);
                    alert.put("announcedAt", announcedAt);

                    dedup.putIfAbsent(regionName + "|" + type + "|" + level, alert);
                }
            }
        }
    }

    // 괄호 밖의 쉼표로만 구역을 나눈다. 예: "경기도(안산, 화성), 서해5도" -> "경기도(안산, 화성)", "서해5도"
    private List<String> splitTopLevel(String text) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int depth = 0;

        for (char ch : text.toCharArray()) {
            if (ch == '(') depth++;
            else if (ch == ')' && depth > 0) depth--;

            if (ch == ',' && depth == 0) {
                addIfNotBlank(result, current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        addIfNotBlank(result, current.toString());
        return result;
    }

    private void addIfNotBlank(List<String> list, String text) {
        String value = text.trim();
        if (!value.isBlank() && !list.contains(value)) list.add(value);
    }

    // "전북자치도(고창, 부안(위도면 제외))" -> "전북자치도 고창", "전북자치도 부안(위도면 제외)"
    // 괄호 안이 '제외'로 끝나는 경우는 제외 구역을 뺀 하나의 구역이므로 그대로 둔다.
    private List<String> expandZone(String zone) {
        int open = zone.indexOf('(');
        if (open <= 0 || !zone.endsWith(")") || !wrapsToEnd(zone, open)) return List.of(zone);

        String head = zone.substring(0, open).trim();
        String inner = zone.substring(open + 1, zone.length() - 1).trim();
        if (inner.isBlank() || inner.endsWith("제외")) return List.of(zone);

        List<String> result = new ArrayList<>();
        for (String child : splitTopLevel(inner)) {
            result.add(head + " " + child);
        }
        return result;
    }

    private boolean wrapsToEnd(String zone, int open) {
        int depth = 0;
        for (int i = open; i < zone.length(); i++) {
            char ch = zone.charAt(i);
            if (ch == '(') depth++;
            else if (ch == ')') depth--;
            if (depth == 0 && i < zone.length() - 1) return false;
        }
        return depth == 0;
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
