package com.safetrace.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safetrace.util.LogSanitizer;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

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

    private static final Duration EXTERNAL_TIMEOUT = Duration.ofSeconds(5);

    private final String serviceKey;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(EXTERNAL_TIMEOUT)
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 캐시 TTL: 프론트(PublicInfoTab) sessionStorage TTL 10분과 동일 (외부 API 지연 대비)
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

    // 프론트(constants.js SIDO_CENTER)와 동일한 17개 시도 (캐시 예열 대상)
    private static final List<String> ALL_SIDO_FULL_NAMES = List.of(
            "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
            "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
            "경상북도", "경상남도", "제주특별자치도"
    );

    private final ScheduledExecutorService prewarmScheduler = Executors.newSingleThreadScheduledExecutor();

    @PostConstruct
    public void startPrewarming() {
        // TODO: 일일 트래픽 한도(500건) 초과로 비활성화, 상시 운영 배포 시 재활성화
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
                // 한 지역 실패 시에도 나머지 지역 계속 조회
            }
            try {
                // 외부 API 단시간 요청 제한 회피용 간격
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

        // 실패·데이터 없음 시 이전 성공값 반환 (만료 여부 무관)
        if (cached != null) {
            return cached.data();
        }
        return fresh;
    }

    // 전국 조회: 외부 API 동시 요청 수 / 실패 시 재시도 대기 / 실패한 시도의 재조회 금지 시간
    private static final int NATIONWIDE_CONCURRENCY = 4;
    private static final long NATIONWIDE_RETRY_DELAY_MILLIS = 700;
    private final ReentrantLock nationwideLock = new ReentrantLock();
    private final Map<String, Long> failedAtMillis = new ConcurrentHashMap<>();

    // 전국 조회 전체 제한 시간 / 실패한 시도를 다시 외부 API로 조회하지 않는 시간 (테스트에서 줄여 쓰려고 패키지 공개)
    Duration nationwideTimeout = Duration.ofSeconds(20);
    Duration failureCooldown = Duration.ofMinutes(5);

    /**
     * 17개 시도 대기질을 한 번에 반환한다. 시도별 캐시(getAirQuality)를 그대로 쓰고,
     * 전체 조회 시간은 nationwideTimeout 안으로 제한하며 외부 API 동시 요청은 4개로 제한한다.
     * 실패한 시도는 남은 시간 안에 끝낼 수 있고 일부 시도만 실패했을 때만 한 번 재시도한다.
     * 실패한 시도는 failureCooldown 동안 외부 API를 다시 부르지 않고 캐시 값을 쓰며,
     * 만료된 캐시 값은 stale=true로 표시한다. 다른 요청이 조회 중이면 제한 시간의 절반까지만
     * 기다렸다가 캐시 값만 반환한다.
     */
    public Map<String, Map<String, Object>> getAllAirQuality() {
        long deadlineNanos = System.nanoTime() + nationwideTimeout.toNanos();
        if (!acquireNationwideLock()) {
            log.warn("[AirQuality] 전국 조회 대기 시간 초과, 캐시 값만 반환");
            return readCachedOnly();
        }
        try {
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            Set<String> failedNow = ConcurrentHashMap.newKeySet();
            fetchSidos(ALL_SIDO_FULL_NAMES, deadlineNanos, failedNow, result);

            List<String> failed = ALL_SIDO_FULL_NAMES.stream().filter(failedNow::contains).toList();
            if (shouldRetry(failed.size(), deadlineNanos)) {
                try {
                    Thread.sleep(NATIONWIDE_RETRY_DELAY_MILLIS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return result;
                }
                fetchSidos(failed, deadlineNanos, failedNow, result);
            }
            return result;
        } finally {
            nationwideLock.unlock();
        }
    }

    private boolean acquireNationwideLock() {
        try {
            return nationwideLock.tryLock(nationwideTimeout.toNanos() / 2, TimeUnit.NANOSECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    // 대부분 실패했으면 외부 API 장애로 보고 재시도하지 않고, 남은 시간 안에 끝날 수 없어도 재시도하지 않는다.
    private boolean shouldRetry(int failedCount, long deadlineNanos) {
        if (failedCount == 0 || failedCount * 2 > ALL_SIDO_FULL_NAMES.size()) {
            return false;
        }
        int rounds = (failedCount + NATIONWIDE_CONCURRENCY - 1) / NATIONWIDE_CONCURRENCY;
        long expectedNanos = rounds * EXTERNAL_TIMEOUT.toNanos() + TimeUnit.MILLISECONDS.toNanos(NATIONWIDE_RETRY_DELAY_MILLIS);
        return expectedNanos <= deadlineNanos - System.nanoTime();
    }

    private void fetchSidos(List<String> sidos, long deadlineNanos, Set<String> failedNow, Map<String, Map<String, Object>> result) {
        long remainingNanos = deadlineNanos - System.nanoTime();
        if (remainingNanos <= 0) {
            sidos.forEach(sido -> result.put(sido, cachedOrFailure(sido)));
            return;
        }

        ExecutorService executor = Executors.newFixedThreadPool(NATIONWIDE_CONCURRENCY);
        try {
            List<Callable<Map<String, Object>>> tasks = sidos.stream()
                    .map(sido -> (Callable<Map<String, Object>>) () -> loadSido(sido, failedNow))
                    .toList();
            // 제한 시간이 지나면 끝나지 않은 조회는 취소(중단)되어 백그라운드에 남지 않는다.
            List<Future<Map<String, Object>>> futures = executor.invokeAll(tasks, remainingNanos, TimeUnit.NANOSECONDS);
            for (int i = 0; i < sidos.size(); i++) {
                String sido = sidos.get(i);
                try {
                    result.put(sido, futures.get(i).get());
                } catch (CancellationException e) {
                    log.warn("[AirQuality] 전국 조회 제한 시간 초과: sido={}", sido);
                    markFailed(sido, failedNow);
                    result.put(sido, cachedOrFailure(sido));
                } catch (ExecutionException e) {
                    log.warn("[AirQuality] 전국 조회 중 실패: sido={}, 원인={}", sido, LogSanitizer.describe(e.getCause()));
                    markFailed(sido, failedNow);
                    result.put(sido, cachedOrFailure(sido));
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            sidos.forEach(sido -> result.putIfAbsent(sido, cachedOrFailure(sido)));
        } finally {
            executor.shutdownNow();
        }
    }

    // 캐시가 유효하면 그대로, 최근에 실패한 시도는 외부 API를 부르지 않고 캐시 값을 쓴다.
    // 이번 요청에서 이미 실패한 시도(재시도)는 쿨다운과 상관없이 한 번 더 조회한다.
    private Map<String, Object> loadSido(String sido, Set<String> failedNow) {
        CacheEntry cached = cache.get(sido);
        if (cached != null && cached.isFresh()) {
            return cached.data();
        }
        if (!failedNow.contains(sido) && isInFailureCooldown(sido)) {
            return cachedOrFailure(sido);
        }

        Map<String, Object> data = getAirQuality(sido);
        CacheEntry latest = cache.get(sido);
        if (latest != null && latest.isFresh()) {
            return data;
        }
        markFailed(sido, failedNow);
        return isAvailable(data) ? cachedOrFailure(sido) : data;
    }

    private void markFailed(String sido, Set<String> failedNow) {
        failedAtMillis.put(sido, System.currentTimeMillis());
        failedNow.add(sido);
    }

    private boolean isInFailureCooldown(String sido) {
        Long failedAt = failedAtMillis.get(sido);
        return failedAt != null && System.currentTimeMillis() - failedAt < failureCooldown.toMillis();
    }

    // 캐시 값만 사용: 만료된 값은 stale=true로 표시하고, 캐시가 없으면 조회 불가로 응답
    private Map<String, Object> cachedOrFailure(String sido) {
        CacheEntry cached = cache.get(sido);
        if (cached == null) {
            return Map.of("available", false, "message", "대기질 정보를 가져오지 못했습니다.");
        }
        if (cached.isFresh()) {
            return cached.data();
        }
        Map<String, Object> stale = new HashMap<>(cached.data());
        stale.put("stale", true);
        return stale;
    }

    private Map<String, Map<String, Object>> readCachedOnly() {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        ALL_SIDO_FULL_NAMES.forEach(sido -> result.put(sido, cachedOrFailure(sido)));
        return result;
    }

    private boolean isAvailable(Map<String, Object> data) {
        return data != null && Boolean.TRUE.equals(data.get("available"));
    }

    Map<String, Object> fetchFromExternalApi(String sidoFullName) {
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
                    .timeout(EXTERNAL_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode header = root.path("response").path("header");
            if (!"00".equals(header.path("resultCode").asText())) {
                log.warn("[AirQuality] resultCode!=00: sido={}, resultCode={}, resultMsg={}, rawBody={}",
                        sidoFullName, header.path("resultCode").asText(), header.path("resultMsg").asText(),
                        LogSanitizer.mask(response.body()));
                return Map.of("available", false, "message", header.path("resultMsg").asText("대기질 정보를 가져오지 못했습니다."));
            }

            // items.item 래핑 / items 배열 두 형태 모두 처리
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
                log.warn("[AirQuality] 측정값 없음: sido={}, itemCount={}, rawBody={}", sidoFullName, items.size(), LogSanitizer.mask(response.body()));
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
            log.warn("[AirQuality] 타임아웃: sido={}, 원인={}", sidoFullName, LogSanitizer.describe(e));
            return Map.of("available", false, "message", "대기질 서버 응답이 지연되고 있습니다.");
        } catch (IOException | InterruptedException e) {
            log.warn("[AirQuality] 외부 API 호출 실패: sido={}, 원인={}", sidoFullName, LogSanitizer.describe(e));
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