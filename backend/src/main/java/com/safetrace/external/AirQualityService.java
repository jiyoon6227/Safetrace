package com.safetrace.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 한국환경공단_에어코리아_대기오염정보의 "시도별 실시간 측정정보 조회(getCtprvnRltmMesureDnsty)"를 호출한다.
 * 측정소 단위가 아니라 시/도 단위 평균을 쓰는 이유: 관심지역 좌표를 측정소 좌표와 직접 매칭하려면
 * 좌표계 변환(TM)까지 필요해서 범위가 커짐. 시/도 단위면 카카오 지오코딩 결과의 행정구역명을
 * 그대로 재사용할 수 있어 훨씬 단순함.
 */
@Service
public class AirQualityService {

    private static final Logger log = LoggerFactory.getLogger(AirQualityService.class);

    private static final String BASE_URL =
            "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 프론트(PublicInfoTab)의 sessionStorage 캐시 TTL(10분)과 맞춰둠.
    // 외부 API가 느린 게 제일 큰 병목이라, 시도별로 여기서 한 번 캐싱해두면
    // 프론트 배치 조회가 매번 실제 API를 안 타고 즉시 응답을 받아온다.
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(Map<String, Object> data, long fetchedAtMillis) {
        boolean isFresh() {
            return System.currentTimeMillis() - fetchedAtMillis < CACHE_TTL.toMillis();
        }
    }

    public AirQualityService(@Value("${publicdata.service-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    // 프론트(constants.js SIDO_CENTER)와 동일한 17개 시도 전체명칭.
    // 서버 기동 시 + 주기적으로 이 목록을 미리 조회해서 캐시를 채워둔다 -
    // 그래야 "이번에 처음 접속한 사람"이 느린 외부 API 비용을 대신 떠안는 일이 없어짐.
    private static final List<String> ALL_SIDO_FULL_NAMES = List.of(
            "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
            "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
            "경상북도", "경상남도", "제주특별자치도"
    );

    private final ScheduledExecutorService prewarmScheduler = Executors.newSingleThreadScheduledExecutor();

    @PostConstruct
    public void startPrewarming() {
        // TODO: 오늘 트래픽 한도(일일 500건)를 이 스케줄러 혼자 다 써버려서 일단 꺼둠.
        // 개발 중 서버를 자주 껐다 켰다 하면 그때마다 0초 지연으로 17개를 또 쏘고,
        // 거기에 8분 주기 자동 갱신까지 겹쳐서 하루 한도를 순식간에 넘겨버림.
        // 실제 배포해서 서버를 계속 띄워둘 때만 다시 켜는 걸로.
        // prewarmScheduler.scheduleAtFixedRate(this::refreshAllSido, 0, 8, TimeUnit.MINUTES);
    }

    @PreDestroy
    public void stopPrewarming() {
        prewarmScheduler.shutdownNow();
    }

    private void refreshAllSido() {
        for (String sido : ALL_SIDO_FULL_NAMES) {
            try {
                getAirQuality(sido); // 캐시에 없거나 만료된 것만 실제로 외부 API를 탐(getAirQuality 내부 캐시 로직 재사용)
            } catch (Exception e) {
                // 한 지역 실패해도 나머지는 계속 진행 - 다음 주기(8분 뒤)에 다시 시도됨
            }
            try {
                // 17개를 한꺼번에 쏘지 않고 살짝 텀을 줘서, 사용자 쪽 프론트 배치 조회와 겹쳐도
                // 외부 API의 짧은 시간당 요청 제한에 같이 걸리는 걸 피한다.
                Thread.sleep(300);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
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
        CacheEntry cached = cache.get(sidoFullName);
        if (cached != null && cached.isFresh()) {
            return cached.data();
        }

        Map<String, Object> fresh = fetchFromExternalApi(sidoFullName);

        if (Boolean.TRUE.equals(fresh.get("available"))) {
            cache.put(sidoFullName, new CacheEntry(fresh, System.currentTimeMillis()));
            return fresh;
        }

        // 이번 호출은 실패/데이터없음이지만, 이전에 성공했던 값이 있으면(만료됐더라도)
        // 그걸 그대로 돌려줘서 화면이 "-"로 비는 것보다 낫게 만든다.
        if (cached != null) {
            return cached.data();
        }
        return fresh;
    }

    private Map<String, Object> fetchFromExternalApi(String sidoFullName) {
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
                log.warn("[AirQuality] resultCode!=00: sido={}, resultCode={}, resultMsg={}, rawBody={}",
                        sidoFullName, header.path("resultCode").asText(), header.path("resultMsg").asText(), response.body());
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
                log.warn("[AirQuality] 측정값 없음: sido={}, itemCount={}, rawBody={}", sidoFullName, items.size(), response.body());
                return Map.of("available", false, "message", "측정 가능한 대기질 데이터가 없습니다.");
            }

            Integer pm10Avg = pm10Count > 0 ? (int) Math.round(pm10Sum / pm10Count) : null;
            Integer pm25Avg = pm25Count > 0 ? (int) Math.round(pm25Sum / pm25Count) : null;

            log.info("[AirQuality] 조회 성공: sido={}, 측정소 {}건, pm10Avg={}, pm25Avg={}",
                    sidoFullName, items.size(), pm10Avg, pm25Avg);

            Map<String, Object> result = new HashMap<>();
            result.put("available", true);
            result.put("pm10", pm10Avg);
            result.put("pm25", pm25Avg);
            result.put("pm10Grade", pm10Avg != null ? gradePm10(pm10Avg) : null);
            result.put("pm25Grade", pm25Avg != null ? gradePm25(pm25Avg) : null);
            return result;
        } catch (HttpTimeoutException e) {
            log.warn("[AirQuality] 타임아웃: sido={}", sidoFullName, e);
            return Map.of("available", false, "message", "대기질 서버 응답이 지연되고 있습니다.");
        } catch (IOException | InterruptedException e) {
            log.warn("[AirQuality] 외부 API 호출 실패: sido={}, 원인={}: {}", sidoFullName,
                    e.getClass().getName(), e.getMessage(), e);
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