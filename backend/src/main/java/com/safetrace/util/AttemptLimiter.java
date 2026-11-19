package com.safetrace.util;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/**
 * 키(아이디, IP, 이메일 등)별 시도 횟수 제한기. 고정 시간창 방식이다.
 * <p>
 * - "확인하기 전에 먼저 횟수를 차감"하는 방식이라, 동시에 요청을 여러 개 보내도 한도 이상 통과할 수 없다.
 *   (카운트 증가와 한도 비교가 ConcurrentHashMap.compute 안에서 한 번에 처리된다)
 * - 시간창이 끝난 항목은 주기적으로 지우고, 키 개수에 상한을 둬서 메모리가 무한정 늘지 않는다.
 * - 외부 저장소(Redis 등) 없이 서버 메모리만 쓴다. 서버 1대 + 재시작 시 초기화되는 구조를 전제로 한 단순 구현이다.
 */
public class AttemptLimiter {

    private record Window(long startMs, int count) {}

    private final int maxAttempts;
    private final long windowMs;
    private final int maxKeys;
    private final LongSupplier clockMs;

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong lastPurgeMs;

    public AttemptLimiter(int maxAttempts, long windowMs, int maxKeys) {
        this(maxAttempts, windowMs, maxKeys, () -> System.nanoTime() / 1_000_000L);
    }

    // 테스트에서 시간을 직접 움직일 수 있게 시계를 주입받는 생성자
    public AttemptLimiter(int maxAttempts, long windowMs, int maxKeys, LongSupplier clockMs) {
        if (maxAttempts < 1 || windowMs < 1 || maxKeys < 1) {
            throw new IllegalArgumentException("제한 설정 값이 올바르지 않습니다.");
        }
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.maxKeys = maxKeys;
        this.clockMs = clockMs;
        this.lastPurgeMs = new AtomicLong(clockMs.getAsLong());
    }

    /**
     * 시도 1회를 먼저 차감한다. 한도 안이면 true, 한도를 넘었으면 false(이때 횟수는 더 올리지 않는다).
     * 키가 너무 많이 쌓여 새 키를 받을 수 없는 경우에도 false(안전한 쪽으로 막음).
     */
    public boolean tryAcquire(String key) {
        long now = clockMs.getAsLong();
        purgeIfDue(now);

        // 새 키를 넣기 전에 상한 확인 (이미 있는 키는 상한과 무관하게 계속 계산)
        if (windows.size() >= maxKeys && !windows.containsKey(key)) {
            purgeExpired(now);
            if (windows.size() >= maxKeys) {
                return false;
            }
        }

        AtomicBoolean allowed = new AtomicBoolean(false);
        windows.compute(key, (k, w) -> {
            if (w == null || now - w.startMs() >= windowMs) {
                allowed.set(true);
                return new Window(now, 1);
            }
            if (w.count() >= maxAttempts) {
                return w; // 한도 초과: 그대로 둔다 (시간창이 끝나야 풀림)
            }
            allowed.set(true);
            return new Window(w.startMs(), w.count() + 1);
        });
        return allowed.get();
    }

    /** 성공했을 때 해당 키의 실패 횟수를 지운다. */
    public void reset(String key) {
        windows.remove(key);
    }

    /** 제한이 풀릴 때까지 남은 시간(초, 올림). 제한 중이 아니면 0. */
    public long retryAfterSeconds(String key) {
        Window w = windows.get(key);
        if (w == null) {
            return 0;
        }
        long now = clockMs.getAsLong();
        long remainMs = windowMs - (now - w.startMs());
        if (remainMs <= 0 || w.count() < maxAttempts) {
            return 0;
        }
        return (remainMs + 999) / 1000;
    }

    /** 현재 보관 중인 키 개수 (테스트·점검용) */
    public int size() {
        return windows.size();
    }

    // 시간창이 지난 항목은 한 번도 다시 안 오는 키가 많을 수 있으므로 시간창마다 한 번씩 정리한다.
    private void purgeIfDue(long now) {
        long last = lastPurgeMs.get();
        if (now - last >= windowMs && lastPurgeMs.compareAndSet(last, now)) {
            purgeExpired(now);
        }
    }

    private void purgeExpired(long now) {
        windows.entrySet().removeIf(e -> now - e.getValue().startMs() >= windowMs);
    }
}
