package com.safetrace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthAttemptLimiterTest {

    private static final long MINUTE = 60_000L;
    private static final String IP = "203.0.113.10";

    private final AtomicLong now = new AtomicLong(1_000_000L);
    private AuthAttemptLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new AuthAttemptLimiter(now::get);
    }

    @Test
    void 같은_아이디와_IP는_10분에_5회까지만_시도할_수_있다() {
        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin("user1", IP);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("user1", IP));
        assertTrue(e.getMessage().contains("로그인 시도가 너무 많습니다"));
        assertEquals(600, e.getRetryAfterSeconds());
    }

    @Test
    void 대기시간은_분_단위로_안내한다() {
        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin("user1", IP);
        }
        now.addAndGet(3 * MINUTE + 1_000); // 3분 1초 지남 -> 남은 6분 59초 -> 7분

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("user1", IP));
        assertTrue(e.getMessage().contains("7분"));
    }

    @Test
    void 열분이_지나면_다시_시도할_수_있다() {
        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin("user1", IP);
        }
        now.addAndGet(10 * MINUTE);

        assertDoesNotThrow(() -> limiter.acquireLogin("user1", IP));
    }

    @Test
    void 로그인에_성공하면_그_아이디의_실패_횟수가_초기화된다() {
        for (int i = 0; i < 4; i++) {
            limiter.acquireLogin("user1", IP);
        }
        limiter.resetLogin("user1", IP);

        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin("user1", IP);
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("user1", IP));
    }

    @Test
    void 다른_IP의_시도는_그_아이디를_막지_않는다() {
        // 공격자가 IP A에서 실패를 쌓아도, 정상 사용자(IP B)는 같은 아이디로 로그인할 수 있다
        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin("user1", "198.51.100.1");
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("user1", "198.51.100.1"));

        assertDoesNotThrow(() -> limiter.acquireLogin("user1", "203.0.113.77"));
    }

    @Test
    void 같은_IP에서_다른_아이디도_각각_센다() {
        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin("user1", IP);
        }

        assertDoesNotThrow(() -> limiter.acquireLogin("user2", IP));
    }

    @Test
    void 아이디_대소문자와_앞뒤_공백만_바꿔서_제한을_피할_수_없다() {
        limiter.acquireLogin("User1", IP);
        limiter.acquireLogin("USER1", IP);
        limiter.acquireLogin(" user1 ", IP);
        limiter.acquireLogin("user1", IP);
        limiter.acquireLogin("uSeR1", IP);

        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("user1", IP));
    }

    @Test
    void 한_IP가_아이디를_바꿔가며_시도해도_10분에_50회까지만_가능하다() {
        for (int i = 0; i < 50; i++) {
            limiter.acquireLogin("user" + i, IP); // 아이디마다 1회씩 -> 아이디 제한에는 안 걸림
        }

        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("another", IP));
        assertDoesNotThrow(() -> limiter.acquireLogin("another", "198.51.100.2"));
    }

    @Test
    void 로그인에_성공해도_IP_전체_횟수는_돌려주지_않는다() {
        for (int i = 0; i < 50; i++) {
            limiter.acquireLogin("mine", IP);
            limiter.resetLogin("mine", IP); // 내 계정으로 성공했다고 가정
        }

        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin("victim", IP));
    }

    @Test
    void 매우_긴_아이디도_키_길이가_잘려서_처리된다() {
        String longId = "a".repeat(10_000);

        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin(longId, IP);
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin(longId, IP));
    }

    @Test
    void 아이디가_null이어도_예외없이_센다() {
        for (int i = 0; i < 5; i++) {
            limiter.acquireLogin(null, IP);
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.acquireLogin(null, IP));
    }

    @Test
    void 동시에_로그인을_시도해도_한도를_넘게_통과하지_못한다() throws Exception {
        int threads = 40;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger passed = new AtomicInteger();

        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                try {
                    limiter.acquireLogin("user1", IP);
                    passed.incrementAndGet();
                } catch (TooManyRequestsException ignored) {
                    // 차단된 요청
                }
            });
        }
        ready.await();
        go.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));

        assertEquals(5, passed.get());
    }

    @Test
    void 인증메일은_같은_IP에서_1시간에_10회까지만_요청할_수_있다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireMail(IP);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.acquireMail(IP));
        assertTrue(e.getMessage().contains("인증메일 요청이 너무 많습니다"));
        assertDoesNotThrow(() -> limiter.acquireMail("198.51.100.3"));

        now.addAndGet(60 * MINUTE);
        assertDoesNotThrow(() -> limiter.acquireMail(IP));
    }

    @Test
    void 로그인_횟수와_메일_횟수는_서로_영향을_주지_않는다() {
        for (int i = 0; i < 10; i++) {
            limiter.acquireMail(IP);
        }

        assertDoesNotThrow(() -> limiter.acquireLogin("user1", IP));
    }
}
