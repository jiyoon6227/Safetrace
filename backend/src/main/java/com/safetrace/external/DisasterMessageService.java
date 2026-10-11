package com.safetrace.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 행정안전부_긴급재난문자(재난안전데이터공유플랫폼, safetydata.go.kr) 호출.
 *
 * 중요:
 * - 마이페이지: 최근 48시간 문자만 조회
 * - 안전·재난 소식 더보기: 사용자가 선택한 기간의 문자 조회
 *
 * 외부 API의 crtDt 파라미터(조회 시작일자)를 사용해 필요한 날짜부터 가져오고,
 * pageNo를 증가시키며 페이지네이션 처리한다.
 */
@Service
public class DisasterMessageService {

    private static final Logger log = LoggerFactory.getLogger(DisasterMessageService.class);

    private static final String BASE_URL = "https://www.safetydata.go.kr/V2/api/DSSP-IF-00247";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    // 한 번에 너무 크게 요청하지 않고 페이지 단위로 안전하게 가져온다.
    private static final int PAGE_SIZE = 100;

    // 무한 반복 방지용 페이지 상한 (48시간·선택 기간 조회는 수 페이지 이내)
    // (쿼터 초과 시 지역 fallback 3단계와 겹친 호출 급증 방지)
    private static final int MAX_PAGES = 5;

    private static final DateTimeFormatter API_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMdd");

    private static final DateTimeFormatter MESSAGE_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final Pattern BRACKET_ORG_PATTERN = Pattern.compile("\\[([^\\]]{1,40})\\]");

    private final String serviceKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 캐시 키:
     * 지역명|조회시작일
     *
     * 예)
     * 부산광역시 서구|20260910
     */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(
            List<Map<String, Object>> sortedData,
            Instant fetchedAt
    ) {
        boolean isExpired() {
            return Instant.now().isAfter(fetchedAt.plus(CACHE_TTL));
        }
    }

    /**
     * 조회 결과 없음과 호출 실패(쿼터 초과/인증 오류/타임아웃 등) 구분용 예외.
     * 발생 시 빈 결과 캐시 금지, 지역 fallback 재시도 즉시 중단 (실패 1회당 쿼터 3~4배 소모 방지)
     */
    public static final class DisasterMessageApiException extends RuntimeException {
        public DisasterMessageApiException(String message) {
            super(message);
        }
    }

    public DisasterMessageService(
            @Value("${safetydata.service-key}") String serviceKey
    ) {
        this.serviceKey = serviceKey;
    }

    /**
     * 공공정보 대시보드용.
     * 지역 조건을 주지 않고 전국 최근 48시간 재난문자를 최신순으로 반환한다.
     */
    public List<Map<String, Object>> getRecentMessagesNationwide(int limit) {
        int safeLimit = Math.max(1, limit);
        LocalDateTime cutoff = LocalDateTime.now().minusHours(48);

        List<Map<String, Object>> messages =
                getMessagesFromDate("", cutoff.toLocalDate());

        List<Map<String, Object>> recent = messages.stream()
                .filter(message -> {
                    LocalDateTime createdAt =
                            parseCrtDt((String) message.get("createdAt"));
                    return !createdAt.equals(LocalDateTime.MIN)
                            && !createdAt.isBefore(cutoff);
                })
                .limit(safeLimit)
                .toList();

        return new ArrayList<>(recent);
    }

    public List<Map<String, Object>> getRecentMessages(
            String rgnNm,
            int limit
    ) {
        int safeLimit = Math.max(1, limit);

        LocalDateTime cutoff = LocalDateTime.now().minusHours(48);

        /*
         * API는 날짜 단위 시작일(crtDt)을 받으므로
         * 48시간 전 날짜부터 데이터를 가져온 뒤 정확한 시간은 아래에서 다시 필터링한다.
         */
        List<Map<String, Object>> messages =
                getMessagesFromDate(rgnNm, cutoff.toLocalDate());

        List<Map<String, Object>> recent = messages.stream()
                .filter(message -> {
                    LocalDateTime createdAt =
                            parseCrtDt((String) message.get("createdAt"));

                    return !createdAt.equals(LocalDateTime.MIN)
                            && !createdAt.isBefore(cutoff);
                })
                .limit(safeLimit)
                .toList();

        return new ArrayList<>(recent);
    }

    /**
     * 안전·재난 소식 더보기 페이지용.
     * 사용자가 선택한 시작일 00:00:00 ~ 종료일 23:59:59 범위만 반환한다.
     */
    public List<Map<String, Object>> getMessagesByPeriod(
            String rgnNm,
            LocalDate startDate,
            LocalDate endDate,
            int limit
    ) {
        if (startDate == null
                || endDate == null
                || startDate.isAfter(endDate)) {
            return List.of();
        }

        int safeLimit = Math.max(1, limit);

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(LocalTime.MAX);

        /*
         * 외부 API에는 시작일만 넘기고,
         * 종료일은 우리 서버에서 정확하게 잘라낸다.
         */
        List<Map<String, Object>> messages =
                getMessagesFromDate(rgnNm, startDate);

        List<Map<String, Object>> filtered = messages.stream()
                .filter(message -> {
                    LocalDateTime createdAt =
                            parseCrtDt((String) message.get("createdAt"));

                    if (createdAt.equals(LocalDateTime.MIN)) {
                        return false;
                    }

                    return !createdAt.isBefore(start)
                            && !createdAt.isAfter(end);
                })
                .limit(safeLimit)
                .toList();

        return new ArrayList<>(filtered);
    }

    /**
     * 지정한 날짜부터 현재까지의 해당 지역 재난문자를 가져온다.
     * 같은 지역 + 같은 시작일은 30분 동안 캐시한다.
     */
    private List<Map<String, Object>> getMessagesFromDate(
            String rgnNm,
            LocalDate startDate
    ) {
        String normalizedRegion = rgnNm == null ? "" : rgnNm.trim();

        if (startDate == null) {
            return List.of();
        }

        String cacheKey = (normalizedRegion.isBlank() ? "__NATIONWIDE__" : normalizedRegion)
                + "|"
                + startDate.format(API_DATE_FORMAT);

        CacheEntry cached = cache.get(cacheKey);

        if (cached != null && !cached.isExpired()) {
            return cached.sortedData();
        }

        List<Map<String, Object>> sorted =
                fetchAllPagesAndSort(normalizedRegion, startDate);

        cache.put(
                cacheKey,
                new CacheEntry(sorted, Instant.now())
        );

        return sorted;
    }

    /**
     * crtDt 이후 데이터를 pageNo=1, 2, 3 ... 순서로 전체 조회.
     */
    private List<Map<String, Object>> fetchAllPagesAndSort(
            String rgnNm,
            LocalDate startDate
    ) {
        List<Map<String, Object>> allMessages = new ArrayList<>();

        /*
         * 같은 페이지가 반복 반환되거나 중복 데이터가 섞여도
         * 중복으로 화면에 나오지 않도록 식별값을 저장한다.
         */
        Set<String> seenKeys = new HashSet<>();

        for (int pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
            List<Map<String, Object>> page =
                    fetchPage(rgnNm, startDate, pageNo, PAGE_SIZE);

            if (page.isEmpty()) {
                break;
            }

            int addedCount = 0;

            for (Map<String, Object> message : page) {
                String uniqueKey = buildUniqueKey(message);

                if (seenKeys.add(uniqueKey)) {
                    allMessages.add(message);
                    addedCount++;
                }
            }

            /*
             * 새 데이터가 하나도 없다면 API가 같은 페이지를 반복 반환하는 상황일 수 있으므로 종료.
             */
            if (addedCount == 0) {
                break;
            }

            /*
             * 페이지 크기보다 적게 왔다면 마지막 페이지라고 판단한다.
             */
            if (page.size() < PAGE_SIZE) {
                break;
            }
        }

        // 화면에서는 최신 문자가 먼저 보여야 하므로 최종적으로 최신순 정렬.
        allMessages.sort(
                Comparator.comparing(
                        (Map<String, Object> message) ->
                                parseCrtDt((String) message.get("createdAt")),
                        Comparator.reverseOrder()
                )
        );

        return allMessages;
    }

    /**
     * 외부 API 한 페이지 호출.
     */
    private List<Map<String, Object>> fetchPage(
            String rgnNm,
            LocalDate startDate,
            int pageNo,
            int numOfRows
    ) {
        StringBuilder urlBuilder = new StringBuilder(String.format(
                "%s?serviceKey=%s&pageNo=%d&numOfRows=%d&returnType=json&crtDt=%s",
                BASE_URL,
                URLEncoder.encode(serviceKey, StandardCharsets.UTF_8),
                pageNo,
                numOfRows,
                startDate.format(API_DATE_FORMAT)
        ));

        if (rgnNm != null && !rgnNm.isBlank()) {
            urlBuilder.append("&rgnNm=")
                    .append(URLEncoder.encode(rgnNm, StandardCharsets.UTF_8));
        }

        String url = urlBuilder.toString();

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );

            if (response.statusCode() < 200
                    || response.statusCode() >= 300) {
                log.warn("[DisasterMessage] HTTP {} 응답: region={}, url={}",
                        response.statusCode(), rgnNm, url);
                throw new DisasterMessageApiException("HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());

            JsonNode header = root.has("header")
                    ? root.path("header")
                    : root.path("response").path("header");

            String resultCode = header.path("resultCode").asText("");

            if (!resultCode.isEmpty() && !"00".equals(resultCode)) {
                log.warn("[DisasterMessage] resultCode={}, resultMsg={}, region={}, url={}",
                        resultCode, header.path("resultMsg").asText(), rgnNm, url);

                // "03"(NODATA)은 조회 자체는 성공했고 그 기간·지역에 문자가 없다는 뜻.
                // 그 외(22=쿼터초과, 30=키오류 등)는 호출 자체가 실패한 것이므로 구분해서 던진다.
                if ("03".equals(resultCode)) {
                    return List.of();
                }

                throw new DisasterMessageApiException(
                        "resultCode=" + resultCode + " " + header.path("resultMsg").asText());
            }

            JsonNode bodyNode = root.has("body")
                    ? root.path("body")
                    : root.path("response").path("body");

            JsonNode items = extractItems(bodyNode);

            if (!items.isArray()) {
                return List.of();
            }

            List<Map<String, Object>> messages = new ArrayList<>();

            for (JsonNode item : items) {
                Map<String, Object> message = new HashMap<>();

                // SN도 저장해 중복 제거에 활용한다.
                message.put("sn", item.path("SN").asText(""));
                String messageText = item.path("MSG_CN").asText("");

                message.put("message", messageText);
                message.put("region", item.path("RCPTN_RGN_NM").asText(""));
                message.put("disasterType", item.path("DST_SE_NM").asText(""));
                message.put("emergencyLevel", item.path("EMRG_STEP_NM").asText(""));
                message.put("createdAt", item.path("CRT_DT").asText(""));

                // DSSP-IF-00247 응답에는 발송기관 전용 필드가 없어서,
                // 문자 원문에 [기관명] 표기가 있는 경우에만 보조 정보로 추출한다.
                message.put("senderOrg", extractSenderOrg(messageText));

                messages.add(message);
            }

            return messages;

        } catch (HttpTimeoutException e) {
            log.warn("[DisasterMessage] 타임아웃: region={}, url={}", rgnNm, url);
            throw new DisasterMessageApiException("타임아웃");

        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }

            log.warn("[DisasterMessage] 호출 실패: region={}, 원인={}: {}", rgnNm,
                    e.getClass().getName(), e.getMessage(), e);
            throw new DisasterMessageApiException(e.getClass().getSimpleName());
        }
    }

    /**
     * API 응답 구조가
     * body 배열 / body.items / body.items.item
     * 중 어느 형태로 와도 처리한다.
     */
    private JsonNode extractItems(JsonNode bodyNode) {
        if (bodyNode == null || bodyNode.isMissingNode()) {
            return objectMapper.createArrayNode();
        }

        if (bodyNode.isArray()) {
            return bodyNode;
        }

        JsonNode itemsNode = bodyNode.path("items");

        if (itemsNode.isArray()) {
            return itemsNode;
        }

        JsonNode itemNode = itemsNode.path("item");

        if (itemNode.isArray()) {
            return itemNode;
        }

        /*
         * 데이터가 1건일 때 객체 하나로 오는 경우도 방어적으로 처리.
         */
        if (itemNode.isObject()) {
            return objectMapper.createArrayNode().add(itemNode);
        }

        return objectMapper.createArrayNode();
    }


    private String extractSenderOrg(String messageText) {
        if (messageText == null || messageText.isBlank()) {
            return "";
        }

        Matcher matcher = BRACKET_ORG_PATTERN.matcher(messageText);

        while (matcher.find()) {
            String candidate = matcher.group(1).trim();
            if (candidate.isBlank()
                    || candidate.matches("안전안내문자|긴급재난문자|위급재난문자|재난문자|주의|경보")) {
                continue;
            }

            if (candidate.matches(".*(시청|군청|구청|도청|광역시|특별시|특별자치시|특별자치도|기상청|행정안전부|소방|경찰|환경부|산림청|홍수통제소|공사|공단|본부|센터|청|부|처|시|군|구)$")) {
                return candidate;
            }
        }

        return "";
    }

    /**
     * 중복 제거용 키.
     * SN이 있으면 SN을 우선 사용하고,
     * 없으면 생성일시 + 지역 + 메시지 내용 조합을 사용한다.
     */
    private String buildUniqueKey(Map<String, Object> message) {
        String sn = String.valueOf(message.getOrDefault("sn", ""));

        if (!sn.isBlank()) {
            return "SN:" + sn;
        }

        return String.valueOf(message.getOrDefault("createdAt", ""))
                + "|"
                + String.valueOf(message.getOrDefault("region", ""))
                + "|"
                + String.valueOf(message.getOrDefault("message", ""));
    }

    /**
     * CRT_DT가 "2026/09/10 10:23:00"처럼 슬래시로 올 수도 있어
     * 하이픈으로 맞춘 뒤 파싱한다.
     */
    private LocalDateTime parseCrtDt(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDateTime.MIN;
        }

        try {
            String normalized = raw.trim().replace("/", "-");

            return LocalDateTime.parse(
                    normalized,
                    MESSAGE_DATE_FORMAT
            );
        } catch (Exception e) {
            return LocalDateTime.MIN;
        }
    }
}