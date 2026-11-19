package com.safetrace.service;

import com.safetrace.util.AttemptLimiter;
import org.springframework.stereotype.Component;

import java.util.function.LongSupplier;

/**
 * AI 브리핑·챗봇 요청 횟수 제한 (서버 메모리 기준, API별로 1분에 10회).
 * 로그인 없이도 쓸 수 있는 API라서 로그인했으면 회원 기준, 아니면 접속 IP 기준으로 센다.
 */
@Component
public class AiRequestLimiter {

    private static final long ONE_MINUTE_MS = 60 * 1000L;
    private static final int MAX_PER_MINUTE = 10;
    private static final int MAX_KEYS = 10_000;
    private static final int MAX_KEY_LENGTH = 100; // IP 값이 키가 되므로 길이 제한

    private final AttemptLimiter chat;
    private final AttemptLimiter briefing;

    public AiRequestLimiter() {
        this(() -> System.nanoTime() / 1_000_000L);
    }

    // 테스트에서 시계를 주입하기 위한 생성자
    AiRequestLimiter(LongSupplier clockMs) {
        this.chat = new AttemptLimiter(MAX_PER_MINUTE, ONE_MINUTE_MS, MAX_KEYS, clockMs);
        this.briefing = new AttemptLimiter(MAX_PER_MINUTE, ONE_MINUTE_MS, MAX_KEYS, clockMs);
    }

    /** 챗봇 요청 1회 차감. memberId가 null이면 ip로 센다. 한도를 넘으면 TooManyRequestsException. */
    public void acquireChat(Long memberId, String ip) {
        acquire(chat, memberId, ip);
    }

    /** 브리핑 요청 1회 차감. */
    public void acquireBriefing(Long memberId, String ip) {
        acquire(briefing, memberId, ip);
    }

    private static void acquire(AttemptLimiter limiter, Long memberId, String ip) {
        String key = key(memberId, ip);
        if (!limiter.tryAcquire(key)) {
            long wait = limiter.retryAfterSeconds(key);
            throw new TooManyRequestsException("AI 요청이 너무 많습니다. " + Math.max(1, wait) + "초 후 다시 시도해주세요.", wait);
        }
    }

    private static String key(Long memberId, String ip) {
        if (memberId != null) {
            return "member:" + memberId;
        }
        String value = ip == null ? "unknown" : ip.trim();
        return "ip:" + (value.length() <= MAX_KEY_LENGTH ? value : value.substring(0, MAX_KEY_LENGTH));
    }
}
