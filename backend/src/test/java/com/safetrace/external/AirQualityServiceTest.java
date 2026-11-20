package com.safetrace.external;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AirQualityServiceTest {

    private static final List<String> SIDOS = List.of(
            "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
            "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
            "경상북도", "경상남도", "제주특별자치도"
    );

    private static Map<String, Object> ok(String sido) {
        Map<String, Object> data = new HashMap<>();
        data.put("available", true);
        data.put("pm10", 20 + sido.length());
        data.put("pm25", 10 + sido.length());
        data.put("pm10Grade", "좋음");
        data.put("pm25Grade", "좋음");
        return data;
    }

    private static Map<String, Object> failed() {
        return Map.of("available", false, "message", "대기질 서버 응답이 지연되고 있습니다.");
    }

    // 외부 API 호출만 가짜로 바꾼 서비스. (시도, 해당 시도의 몇 번째 호출인지) -> 응답
    private static class StubService extends AirQualityService {
        final Map<String, AtomicInteger> callsBySido = new ConcurrentHashMap<>();
        final AtomicInteger totalCalls = new AtomicInteger();
        final AtomicInteger running = new AtomicInteger();
        final AtomicInteger maxRunning = new AtomicInteger();
        final BiFunction<String, Integer, Map<String, Object>> responder;
        final long delayMillis;

        StubService(BiFunction<String, Integer, Map<String, Object>> responder, long delayMillis) {
            super("test-key");
            this.responder = responder;
            this.delayMillis = delayMillis;
        }

        @Override
        Map<String, Object> fetchFromExternalApi(String sidoFullName) {
            int nth = callsBySido.computeIfAbsent(sidoFullName, k -> new AtomicInteger()).incrementAndGet();
            totalCalls.incrementAndGet();
            int now = running.incrementAndGet();
            maxRunning.accumulateAndGet(now, Math::max);
            try {
                if (delayMillis > 0) Thread.sleep(delayMillis);
                return responder.apply(sidoFullName, nth);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return failed();
            } finally {
                running.decrementAndGet();
            }
        }

        int calls(String sido) {
            AtomicInteger count = callsBySido.get(sido);
            return count == null ? 0 : count.get();
        }
    }

    @Test
    void 한_번_호출로_17개_시도_결과를_시도별_조회와_같은_값으로_반환한다() {
        StubService service = new StubService((sido, nth) -> ok(sido), 0);

        Map<String, Map<String, Object>> result = service.getAllAirQuality();

        assertEquals(17, result.size());
        assertEquals(SIDOS, new ArrayList<>(result.keySet()));
        for (String sido : SIDOS) {
            assertEquals(ok(sido), result.get(sido));
            assertEquals(service.getAirQuality(sido), result.get(sido));
        }
        assertEquals(17, service.totalCalls.get());
    }

    @Test
    void 캐시가_유효하면_다시_호출해도_외부_API를_부르지_않는다() {
        StubService service = new StubService((sido, nth) -> ok(sido), 0);

        Map<String, Map<String, Object>> first = service.getAllAirQuality();
        Map<String, Map<String, Object>> second = service.getAllAirQuality();

        assertEquals(17, service.totalCalls.get());
        assertEquals(first, second);
    }

    @Test
    void 시도별_조회로_이미_캐시된_시도는_전국_조회에서_다시_부르지_않는다() {
        StubService service = new StubService((sido, nth) -> ok(sido), 0);
        service.getAirQuality("서울특별시");
        service.getAirQuality("대전광역시");

        service.getAllAirQuality();

        assertEquals(1, service.calls("서울특별시"));
        assertEquals(1, service.calls("대전광역시"));
        assertEquals(17, service.totalCalls.get());
    }

    @Test
    void 외부_API_동시_요청은_4개를_넘지_않는다() {
        StubService service = new StubService((sido, nth) -> ok(sido), 40);

        service.getAllAirQuality();

        assertTrue(service.maxRunning.get() <= 4, "max=" + service.maxRunning.get());
        assertTrue(service.maxRunning.get() >= 2, "max=" + service.maxRunning.get());
    }

    @Test
    void 일부_시도가_실패해도_나머지_시도는_정상_반환하고_실패한_시도만_한_번_재시도한다() {
        StubService service = new StubService(
                (sido, nth) -> "서울특별시".equals(sido) ? failed() : ok(sido), 0);

        Map<String, Map<String, Object>> result = service.getAllAirQuality();

        assertEquals(17, result.size());
        assertFalse(Boolean.TRUE.equals(result.get("서울특별시").get("available")));
        assertEquals(2, service.calls("서울특별시"));
        for (String sido : SIDOS) {
            if ("서울특별시".equals(sido)) continue;
            assertEquals(ok(sido), result.get(sido));
            assertEquals(1, service.calls(sido));
        }
    }

    @Test
    void 처음_실패했다가_재시도에서_성공하면_성공값을_반환한다() {
        StubService service = new StubService(
                (sido, nth) -> "부산광역시".equals(sido) && nth == 1 ? failed() : ok(sido), 0);

        Map<String, Map<String, Object>> result = service.getAllAirQuality();

        assertEquals(ok("부산광역시"), result.get("부산광역시"));
        assertEquals(2, service.calls("부산광역시"));
        assertEquals(18, service.totalCalls.get());
    }

    @Test
    void 실패한_시도는_캐시에_남지_않아_쿨다운이_지나면_다시_시도한다() {
        StubService service = new StubService(
                (sido, nth) -> "대구광역시".equals(sido) && nth <= 2 ? failed() : ok(sido), 0);
        service.failureCooldown = Duration.ZERO;

        Map<String, Map<String, Object>> first = service.getAllAirQuality();
        Map<String, Map<String, Object>> second = service.getAllAirQuality();

        assertFalse(Boolean.TRUE.equals(first.get("대구광역시").get("available")));
        assertEquals(ok("대구광역시"), second.get("대구광역시"));
        assertEquals(3, service.calls("대구광역시"));
        assertEquals(1, service.calls("서울특별시"));
    }

    @Test
    void 조회_중_예외가_나도_해당_시도만_조회불가로_처리한다() {
        StubService service = new StubService((sido, nth) -> {
            if ("대전광역시".equals(sido)) throw new IllegalStateException("boom");
            return ok(sido);
        }, 0);

        Map<String, Map<String, Object>> result = service.getAllAirQuality();

        assertEquals(17, result.size());
        assertFalse(Boolean.TRUE.equals(result.get("대전광역시").get("available")));
        assertEquals(ok("서울특별시"), result.get("서울특별시"));
    }

    @Test
    void 동시에_여러_요청이_와도_같은_시도를_중복_조회하지_않는다() throws Exception {
        StubService service = new StubService((sido, nth) -> ok(sido), 30);
        List<Map<String, Map<String, Object>>> results = new ArrayList<>();
        List<Thread> threads = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Thread thread = new Thread(() -> {
                Map<String, Map<String, Object>> result = service.getAllAirQuality();
                synchronized (results) {
                    results.add(result);
                }
            });
            threads.add(thread);
            thread.start();
        }
        for (Thread thread : threads) thread.join();

        assertEquals(3, results.size());
        assertEquals(17, service.totalCalls.get());
        assertEquals(results.get(0), results.get(1));
        assertEquals(results.get(1), results.get(2));
    }

    @SuppressWarnings("unchecked")
    private static void putExpired(AirQualityService service, String sido, Map<String, Object> data) throws Exception {
        Class<?> entryClass = Class.forName("com.safetrace.external.AirQualityService$CacheEntry");
        var constructor = entryClass.getDeclaredConstructors()[0];
        constructor.setAccessible(true);
        Field cacheField = AirQualityService.class.getDeclaredField("cache");
        cacheField.setAccessible(true);
        ((Map<String, Object>) cacheField.get(service)).put(sido, constructor.newInstance(data, 0L));
    }

    private static boolean isAvailable(Map<String, Object> data) {
        return Boolean.TRUE.equals(data.get("available"));
    }

    @Test
    void 실패한_시도는_쿨다운_동안_외부_API를_다시_부르지_않는다() {
        StubService service = new StubService(
                (sido, nth) -> "서울특별시".equals(sido) ? failed() : ok(sido), 0);

        service.getAllAirQuality();
        Map<String, Map<String, Object>> second = service.getAllAirQuality();

        assertEquals(2, service.calls("서울특별시"));
        assertEquals(1, service.calls("부산광역시"));
        assertFalse(isAvailable(second.get("서울특별시")));
        assertEquals(ok("부산광역시"), second.get("부산광역시"));
    }

    @Test
    void 전체_장애면_재시도하지_않고_이후_요청도_외부_API를_부르지_않는다() {
        StubService service = new StubService((sido, nth) -> failed(), 0);

        Map<String, Map<String, Object>> first = service.getAllAirQuality();
        Map<String, Map<String, Object>> second = service.getAllAirQuality();

        assertEquals(17, service.totalCalls.get());
        assertEquals(17, first.size());
        assertEquals(17, second.size());
        for (String sido : SIDOS) {
            assertFalse(isAvailable(first.get(sido)));
            assertFalse(isAvailable(second.get(sido)));
        }
    }

    @Test
    void 만료된_캐시가_있는_시도가_실패하면_stale로_표시하고_나머지는_정상_반환한다() throws Exception {
        StubService service = new StubService(
                (sido, nth) -> "서울특별시".equals(sido) ? failed() : ok(sido), 0);
        putExpired(service, "서울특별시", ok("서울특별시"));

        Map<String, Map<String, Object>> result = service.getAllAirQuality();

        Map<String, Object> expected = new HashMap<>(ok("서울특별시"));
        expected.put("stale", true);
        assertEquals(expected, result.get("서울특별시"));
        for (String sido : SIDOS) {
            if ("서울특별시".equals(sido)) continue;
            assertEquals(ok(sido), result.get(sido));
        }
    }

    @Test
    void 절반_넘는_시도가_실패하면_재시도하지_않고_절반_이하면_재시도한다() {
        StubService many = new StubService(
                (sido, nth) -> SIDOS.indexOf(sido) < 9 ? failed() : ok(sido), 0);
        StubService few = new StubService(
                (sido, nth) -> SIDOS.indexOf(sido) < 8 ? failed() : ok(sido), 0);

        many.getAllAirQuality();
        few.getAllAirQuality();

        assertEquals(17, many.totalCalls.get());
        assertEquals(25, few.totalCalls.get());
    }

    @Test
    void 남은_시간_안에_끝낼_수_없으면_재시도하지_않는다() {
        StubService service = new StubService(
                (sido, nth) -> "서울특별시".equals(sido) ? failed() : ok(sido), 0);
        service.nationwideTimeout = Duration.ofSeconds(3);

        Map<String, Map<String, Object>> result = service.getAllAirQuality();

        assertEquals(1, service.calls("서울특별시"));
        assertFalse(isAvailable(result.get("서울특별시")));
        assertEquals(ok("대전광역시"), result.get("대전광역시"));
    }

    @Test
    void 제한_시간이_지나면_조회를_중단하고_백그라운드_요청이_남지_않는다() throws Exception {
        StubService service = new StubService((sido, nth) -> ok(sido), 30_000);
        service.nationwideTimeout = Duration.ofSeconds(1);

        long start = System.nanoTime();
        Map<String, Map<String, Object>> result = service.getAllAirQuality();
        long elapsedMillis = (System.nanoTime() - start) / 1_000_000;

        assertTrue(elapsedMillis < 2500, "elapsed=" + elapsedMillis);
        assertEquals(17, result.size());
        for (String sido : SIDOS) {
            assertFalse(isAvailable(result.get(sido)));
        }
        Thread.sleep(300);
        int callsAfterReturn = service.totalCalls.get();
        assertEquals(0, service.running.get());
        assertTrue(callsAfterReturn <= 4, "calls=" + callsAfterReturn);
        Thread.sleep(300);
        assertEquals(callsAfterReturn, service.totalCalls.get());
    }

    @Test
    void 락_대기_시간이_지나면_외부_API를_부르지_않고_캐시_값만_반환한다() throws Exception {
        StubService service = new StubService((sido, nth) -> ok(sido), 30_000);
        service.nationwideTimeout = Duration.ofSeconds(2);
        Thread holder = new Thread(service::getAllAirQuality);
        holder.start();
        Thread.sleep(200);
        int callsBeforeWaiter = service.totalCalls.get();

        long start = System.nanoTime();
        Map<String, Map<String, Object>> result = service.getAllAirQuality();
        long elapsedMillis = (System.nanoTime() - start) / 1_000_000;
        int callsAfterWaiter = service.totalCalls.get();
        holder.join();

        assertTrue(elapsedMillis >= 800 && elapsedMillis < 1800, "elapsed=" + elapsedMillis);
        assertEquals(callsBeforeWaiter, callsAfterWaiter);
        assertEquals(17, result.size());
        for (String sido : SIDOS) {
            assertFalse(isAvailable(result.get(sido)));
        }
    }

    @Test
    void 전체_장애에서_여러_요청이_동시에_와도_외부_API_호출은_한_번씩만_나간다() throws Exception {
        StubService service = new StubService((sido, nth) -> failed(), 20);
        List<Map<String, Map<String, Object>>> results = new ArrayList<>();
        List<Thread> threads = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Thread thread = new Thread(() -> {
                Map<String, Map<String, Object>> result = service.getAllAirQuality();
                synchronized (results) {
                    results.add(result);
                }
            });
            threads.add(thread);
            thread.start();
        }
        for (Thread thread : threads) thread.join();

        assertEquals(10, results.size());
        assertEquals(17, service.totalCalls.get());
        for (Map<String, Map<String, Object>> result : results) {
            assertEquals(17, result.size());
            assertFalse(isAvailable(result.get("서울특별시")));
        }
    }
}
