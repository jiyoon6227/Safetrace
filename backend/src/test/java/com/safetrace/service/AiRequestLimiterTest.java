package com.safetrace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiRequestLimiterTest {

    private static final long MINUTE = 60_000L;
    private static final String IP = "203.0.113.10";

    private final AtomicLong now = new AtomicLong(1_000_000L);
    private AiRequestLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new AiRequestLimiter(now::get);
    }

    @Test
    void 챗봇은_1분에_10회까지만_쓸_수_있다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(1L, IP);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.acquireChat(1L, IP));
        assertTrue(e.getMessage().contains("AI 요청이 너무 많습니다"));
        assertEquals(60, e.getRetryAfterSeconds());
    }

    @Test
    void 브리핑도_1분에_10회까지만_쓸_수_있다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireBriefing(null, IP);
        }

        assertThrows(TooManyRequestsException.class, () -> limiter.acquireBriefing(null, IP));
    }

    @Test
    void 챗봇과_브리핑은_횟수를_따로_센다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(1L, IP);
        }

        assertDoesNotThrow(() -> limiter.acquireBriefing(1L, IP));
    }

    @Test
    void 한도를_넘긴_요청은_횟수를_더_올리지_않고_1분이_지나면_풀린다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(1L, IP);
        }
        for (int i = 0; i < 5; i++) {
            assertThrows(TooManyRequestsException.class, () -> limiter.acquireChat(1L, IP));
        }

        now.addAndGet(MINUTE);

        assertDoesNotThrow(() -> limiter.acquireChat(1L, IP));
    }

    @Test
    void 남은_대기시간은_시간이_지날수록_줄어든다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(1L, IP);
        }
        now.addAndGet(45_000L);

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.acquireChat(1L, IP));
        assertEquals(15, e.getRetryAfterSeconds());
        assertTrue(e.getMessage().contains("15초"));
    }

    @Test
    void 로그인한_회원은_회원별로_센다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(1L, IP);
        }

        // 같은 IP라도 다른 회원은 따로 센다
        assertDoesNotThrow(() -> limiter.acquireChat(2L, IP));
    }

    @Test
    void 비로그인은_IP별로_센다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(null, IP);
        }

        assertThrows(TooManyRequestsException.class, () -> limiter.acquireChat(null, IP));
        assertDoesNotThrow(() -> limiter.acquireChat(null, "203.0.113.11"));
    }

    @Test
    void 회원_번호와_같은_글자의_IP가_서로의_횟수를_차지하지_않는다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireChat(null, "1");
        }

        assertDoesNotThrow(() -> limiter.acquireChat(1L, IP));
    }

    @Test
    void IP를_알_수_없거나_아주_길어도_동작한다() {
        assertDoesNotThrow(() -> limiter.acquireChat(null, null));
        assertDoesNotThrow(() -> limiter.acquireChat(null, "x".repeat(5000)));
    }
}
