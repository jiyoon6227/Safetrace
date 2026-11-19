package com.safetrace.service;

import com.safetrace.util.AttemptLimiter;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.function.LongSupplier;

/**
 * 로그인 시도와 인증메일 발송을 IP·아이디 기준으로 제한한다 (모두 서버 메모리, 외부 저장소 없음).
 * <p>
 * 로그인: 아이디+IP 조합 10분에 5회, IP 전체 10분에 50회.
 *   - 아이디만으로 막으면 남이 일부러 실패를 쌓아 본인 로그인을 막을 수 있어서(계정 잠금 악용) IP와 묶어서 센다.
 *   - 성공하면 그 아이디+IP 조합의 횟수는 지운다. IP 전체 횟수는 지우지 않는다(성공 계정을 섞어 우회하는 것 방지).
 * 인증메일: IP당 1시간에 10회. (이메일 주소별 제한은 EmailVerificationService가 맡는다)
 */
@Component
public class AuthAttemptLimiter {

    private static final long TEN_MINUTES_MS = 10 * 60 * 1000L;
    private static final long ONE_HOUR_MS = 60 * 60 * 1000L;
    private static final int MAX_KEYS = 10_000;
    private static final int MAX_KEY_LENGTH = 100; // 사용자가 보낸 값이 키가 되므로 길이를 잘라 메모리 낭비를 막는다

    private final AttemptLimiter loginById;
    private final AttemptLimiter loginByIp;
    private final AttemptLimiter mailByIp;

    public AuthAttemptLimiter() {
        this(() -> System.nanoTime() / 1_000_000L);
    }

    // 테스트에서 시계를 주입하기 위한 생성자
    AuthAttemptLimiter(LongSupplier clockMs) {
        this.loginById = new AttemptLimiter(5, TEN_MINUTES_MS, MAX_KEYS, clockMs);
        this.loginByIp = new AttemptLimiter(50, TEN_MINUTES_MS, MAX_KEYS, clockMs);
        this.mailByIp = new AttemptLimiter(10, ONE_HOUR_MS, MAX_KEYS, clockMs);
    }

    /** 로그인 시도 1회를 먼저 차감한다. 한도를 넘으면 TooManyRequestsException. 비밀번호 확인 전에 호출해야 한다. */
    public void acquireLogin(String loginId, String ip) {
        String ipKey = ipKey(ip);
        if (!loginByIp.tryAcquire(ipKey)) {
            throw loginBlocked(loginByIp.retryAfterSeconds(ipKey));
        }
        String idKey = loginKey(loginId, ip);
        if (!loginById.tryAcquire(idKey)) {
            throw loginBlocked(loginById.retryAfterSeconds(idKey));
        }
    }

    /** 로그인에 성공했을 때 호출: 그 아이디+IP 조합의 실패 횟수를 지운다. */
    public void resetLogin(String loginId, String ip) {
        loginById.reset(loginKey(loginId, ip));
    }

    /** 인증메일(회원가입 인증·비밀번호 찾기·아이디 찾기) 발송 요청 1회를 IP 기준으로 차감한다. */
    public void acquireMail(String ip) {
        String ipKey = ipKey(ip);
        if (!mailByIp.tryAcquire(ipKey)) {
            long wait = mailByIp.retryAfterSeconds(ipKey);
            throw new TooManyRequestsException(
                    "인증메일 요청이 너무 많습니다. " + toMinutes(wait) + "분 후 다시 시도해주세요.", wait);
        }
    }

    private TooManyRequestsException loginBlocked(long waitSeconds) {
        return new TooManyRequestsException(
                "로그인 시도가 너무 많습니다. " + toMinutes(waitSeconds) + "분 후 다시 시도해주세요.", waitSeconds);
    }

    private static long toMinutes(long seconds) {
        return Math.max(1, (seconds + 59) / 60);
    }

    private static String loginKey(String loginId, String ip) {
        return normalize(loginId) + "|" + ipKey(ip);
    }

    private static String ipKey(String ip) {
        return ip == null ? "unknown" : cut(ip.trim());
    }

    private static String normalize(String value) {
        return value == null ? "" : cut(value.trim().toLowerCase(Locale.ROOT));
    }

    private static String cut(String value) {
        return value.length() <= MAX_KEY_LENGTH ? value : value.substring(0, MAX_KEY_LENGTH);
    }
}
