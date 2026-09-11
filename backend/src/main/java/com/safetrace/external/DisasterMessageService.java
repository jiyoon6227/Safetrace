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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 행정안전부_긴급재난문자(재난안전데이터공유플랫폼, safetydata.go.kr) 호출.
 * 다른 API들과 달리 data.go.kr이 아니라 별도 플랫폼(safetydata.go.kr)이고, URL 형식도 다름.
 * 응답 JSON 포맷(header/body가 response로 한 번 더 안 감싸이는 형태)은 문서/실제 응답으로
 * 완전히 확인된 게 아니라서, 혹시 몰라 body가 배열이 아닌 경우까지 방어적으로 처리해둠.
 */
@Service
public class DisasterMessageService {

    private static final String BASE_URL = "https://www.safetydata.go.kr/V2/api/DSSP-IF-00247";

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DisasterMessageService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // rgnNm - "대전광역시 동구"처럼 시도+시군구 형태의 지역명
    public List<Map<String, Object>> getRecentMessages(String rgnNm, int limit) {
        String url = String.format(
                "%s?serviceKey=%s&numOfRows=%d&pageNo=1&returnType=json&rgnNm=%s",
                BASE_URL, URLEncoder.encode(serviceKey, StandardCharsets.UTF_8), limit,
                URLEncoder.encode(rgnNm, StandardCharsets.UTF_8));

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            JsonNode root = objectMapper.readTree(response.body());

            // 이 플랫폼은 data.go.kr과 달리 "response" 래퍼 없이 header/body가 최상위에 바로 있는 것으로 보임
            JsonNode header = root.has("header") ? root.path("header") : root.path("response").path("header");
            String resultCode = header.path("resultCode").asText("");
            if (!resultCode.isEmpty() && !"00".equals(resultCode)) {
                return List.of();
            }

            JsonNode bodyNode = root.has("body") ? root.path("body") : root.path("response").path("body");
            JsonNode items = bodyNode.isArray() ? bodyNode : bodyNode.path("items").path("item");
            if (!items.isArray()) {
                items = bodyNode.path("items");
            }

            List<Map<String, Object>> messages = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode item : items) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("message", item.path("MSG_CN").asText(""));
                    m.put("region", item.path("RCPTN_RGN_NM").asText(""));
                    m.put("disasterType", item.path("DST_SE_NM").asText(""));
                    m.put("emergencyLevel", item.path("EMRG_STEP_NM").asText(""));
                    m.put("createdAt", item.path("CRT_DT").asText(""));
                    messages.add(m);
                }
            }
            return messages;
        } catch (HttpTimeoutException e) {
            return List.of();
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return List.of();
        }
    }
}