package com.safetrace.util;

import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AttemptLimiterTest {

    private final AtomicLong now = new AtomicLong(1_000_000L);

    private AttemptLimiter limiter(int max, long windowMs, int maxKeys) {
        return new AttemptLimiter(max, windowMs, maxKeys, now::get);
    }

    @Test
    void 한도까지는_허용하고_넘으면_막는다() {
        AttemptLimiter limiter = limiter(3, 60_000, 100);

        assertTrue(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
    }

    @Test
    void 키마다_따로_센다() {
        AttemptLimiter limiter = limiter(1, 60_000, 100);

        assertTrue(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));
        assertTrue(limiter.tryAcquire("b"));
    }

    @Test
    void 시간창이_지나면_다시_허용한다() {
        AttemptLimiter limiter = limiter(2, 60_000, 100);
        limiter.tryAcquire("a");
        limiter.tryAcquire("a");
        assertFalse(limiter.tryAcquire("a"));

        now.addAndGet(59_999);
        assertFalse(limiter.tryAcquire("a"));

        now.addAndGet(1);
        assertTrue(limiter.tryAcquire("a"));
    }

    @Test
    void 차단된_뒤_계속_요청해도_차단시간이_늘어나지_않는다() {
        AttemptLimiter limiter = limiter(1, 60_000, 100);
        limiter.tryAcquire("a");

        now.addAndGet(30_000);
        assertFalse(limiter.tryAcquire("a"));
        assertFalse(limiter.tryAcquire("a"));

        now.addAndGet(30_000); // 처음 시도로부터 60초
        assertTrue(limiter.tryAcquire("a"));
    }

    @Test
    void reset하면_횟수가_초기화된다() {
        AttemptLimiter limiter = limiter(2, 60_000, 100);
        limiter.tryAcquire("a");
        limiter.tryAcquire("a");
        assertFalse(limiter.tryAcquire("a"));

        limiter.reset("a");

        assertTrue(limiter.tryAcquire("a"));
    }

    @Test
    void 남은_대기시간을_초단위로_올림해서_알려준다() {
        AttemptLimiter limiter = limiter(1, 60_000, 100);
        assertEquals(0, limiter.retryAfterSeconds("a"));

        limiter.tryAcquire("a");
        assertEquals(60, limiter.retryAfterSeconds("a"));

        now.addAndGet(10_500);
        assertEquals(50, limiter.retryAfterSeconds("a")); // 49.5초 -> 50초

        now.addAndGet(49_500);
        assertEquals(0, limiter.retryAfterSeconds("a"));
    }

    @Test
    void 한도에_도달하지_않았으면_대기시간은_0이다() {
        AttemptLimiter limiter = limiter(3, 60_000, 100);
        limiter.tryAcquire("a");

        assertEquals(0, limiter.retryAfterSeconds("a"));
    }

    @Test
    void 동시에_요청해도_한도를_넘게_통과하지_못한다() throws Exception {
        AttemptLimiter limiter = limiter(5, 60_000, 100);
        int threads = 64;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger allowed = new AtomicInteger();

        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                if (limiter.tryAcquire("same-key")) {
                    allowed.incrementAndGet();
                }
            });
        }
        ready.await();
        go.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));

        assertEquals(5, allowed.get());
    }

    @Test
    void 키_개수_상한에_도달하면_새_키는_막고_기존_키는_계속_센다() {
        AttemptLimiter limiter = limiter(2, 60_000, 3);
        assertTrue(limiter.tryAcquire("k1"));
        assertTrue(limiter.tryAcquire("k2"));
        assertTrue(limiter.tryAcquire("k3"));

        assertFalse(limiter.tryAcquire("k4"));   // 새 키는 받지 않는다
        assertEquals(3, limiter.size());          // 메모리가 더 늘지 않는다
        assertTrue(limiter.tryAcquire("k1"));    // 이미 있는 키는 계속 한도 안에서 처리
        assertFalse(limiter.tryAcquire("k1"));
    }

    @Test
    void 시간창이_지난_키는_정리되어_메모리가_늘지_않는다() {
        AttemptLimiter limiter = limiter(1, 60_000, 1_000);
        for (int i = 0; i < 500; i++) {
            limiter.tryAcquire("key-" + i);
        }
        assertEquals(500, limiter.size());

        now.addAndGet(60_000);
        limiter.tryAcquire("new-key"); // 시간창마다 한 번 정리가 돈다

        assertEquals(1, limiter.size());
    }

    @Test
    void 키가_가득_찼어도_만료된_키가_있으면_정리하고_받는다() {
        AttemptLimiter limiter = limiter(1, 60_000, 2);
        limiter.tryAcquire("k1");
        limiter.tryAcquire("k2");
        assertFalse(limiter.tryAcquire("k3"));

        now.addAndGet(60_000);

        assertTrue(limiter.tryAcquire("k3"));
    }

    @Test
    void 잘못된_설정은_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> new AttemptLimiter(0, 1000, 10));
        assertThrows(IllegalArgumentException.class, () -> new AttemptLimiter(1, 0, 10));
        assertThrows(IllegalArgumentException.class, () -> new AttemptLimiter(1, 1000, 0));
    }
}
