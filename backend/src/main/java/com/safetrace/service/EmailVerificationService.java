package com.safetrace.service;

import com.safetrace.util.AttemptLimiter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongSupplier;

// 회원가입 / 비밀번호 찾기 시 이메일 인증코드 발급·검증.
// 별도 DB 테이블 없이 메모리(ConcurrentHashMap)에만 임시 보관 - 서버 재시작하면 초기화됨.
// 짧은 유효시간 동안만 쓰이는 휘발성 데이터라 DB까지 갈 필요는 없다고 판단.
//
// 보안 규칙
//  - 인증코드 유효시간 5분, 틀리면 5회째에서 그 코드는 폐기(새 코드를 받아야 함)
//  - 같은 이메일로 다시 발송하려면 60초 대기, 이메일 1개당 1시간에 5회까지만 발송
//  - 인증 완료 상태는 10분 동안만 유효하고, 가입/비밀번호 재설정에서 1번만 쓸 수 있음
//  - 위 상태 변경은 모두 ConcurrentHashMap.compute 안에서 처리해서, 동시에 요청을 여러 개 보내도 횟수 제한을 넘을 수 없음
//  - 만료된 항목은 주기적으로 지우고, 보관 개수에도 상한을 둠
@Service
public class EmailVerificationService {

    static final long CODE_TTL_MS = 5 * 60 * 1000L;
    static final long VERIFIED_TTL_MS = 10 * 60 * 1000L;
    static final long RESEND_COOLDOWN_MS = 60 * 1000L;
    static final long SEND_WINDOW_MS = 60 * 60 * 1000L;
    static final int MAX_SENDS_PER_WINDOW = 5;
    static final int MAX_FAILED_ATTEMPTS = 5;
    static final int MAX_ENTRIES = 10_000;
    // 이메일별 발송 횟수는 1시간 동안 기억해야 해서 코드 보관 상한보다 넉넉하게 잡는다
    static final int MAX_SEND_KEYS = 20_000;

    private final MailService mailService;
    private final LongSupplier clockMs;
    private final SecureRandom random = new SecureRandom();

    private final Map<String, CodeEntry> codes = new ConcurrentHashMap<>();
    // 인증 완료된 이메일 -> 완료 상태가 끝나는 시각
    private final Map<String, Long> verifiedUntil = new ConcurrentHashMap<>();
    private final AttemptLimiter sendLimiter;
    private final AtomicLong lastPurgeMs;

    @Autowired
    public EmailVerificationService(MailService mailService) {
        this(mailService, () -> System.nanoTime() / 1_000_000L);
    }

    // 테스트에서 시계를 주입하기 위한 생성자
    EmailVerificationService(MailService mailService, LongSupplier clockMs) {
        this.mailService = mailService;
        this.clockMs = clockMs;
        this.sendLimiter = new AttemptLimiter(MAX_SENDS_PER_WINDOW, SEND_WINDOW_MS, MAX_SEND_KEYS, clockMs);
        this.lastPurgeMs = new AtomicLong(clockMs.getAsLong());
    }

    public void sendCode(String email) {
        long now = clockMs.getAsLong();
        purgeIfDue(now);
        // 이미 한도까지 쌓였으면 새 이메일은 받지 않는다 (메모리 보호). 기존 이메일의 재발송은 계속 처리한다.
        if (codes.size() >= MAX_ENTRIES && !codes.containsKey(email)) {
            purgeExpired(now);
            if (codes.size() >= MAX_ENTRIES) {
                throw new TooManyRequestsException("요청이 많습니다. 잠시 후 다시 시도해주세요.", 60);
            }
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        CodeEntry fresh = new CodeEntry(code, now, now + CODE_TTL_MS, 0);

        // 재발송 대기시간 확인 + 이메일별 발송 횟수 차감 + 새 코드 저장을 한 번에 처리 (동시 요청 우회 방지)
        AtomicReference<TooManyRequestsException> rejected = new AtomicReference<>();
        codes.compute(email, (key, current) -> {
            if (current != null && now - current.sentAtMs() < RESEND_COOLDOWN_MS) {
                long wait = (RESEND_COOLDOWN_MS - (now - current.sentAtMs()) + 999) / 1000;
                rejected.set(new TooManyRequestsException(
                        "인증번호는 " + wait + "초 후에 다시 요청할 수 있습니다.", wait));
                return current;
            }
            String limitKey = limitKey(email);
            if (!sendLimiter.tryAcquire(limitKey)) {
                long wait = sendLimiter.retryAfterSeconds(limitKey);
                rejected.set(new TooManyRequestsException(
                        "인증메일 요청이 너무 많습니다. " + Math.max(1, (wait + 59) / 60) + "분 후 다시 시도해주세요.", wait));
                return current;
            }
            return fresh;
        });
        if (rejected.get() != null) {
            throw rejected.get();
        }

        verifiedUntil.remove(email); // 새 인증 시작 시 기존 인증 완료 상태 초기화
        try {
            mailService.sendVerificationCode(email, code);
        } catch (RuntimeException e) {
            // 메일이 안 나갔는데 60초를 기다리게 하지 않도록, 방금 저장한 코드를 되돌린다
            codes.remove(email, fresh);
            throw e;
        }
    }

    public boolean verifyCode(String email, String code) {
        if (email == null || code == null) {
            return false;
        }
        long now = clockMs.getAsLong();
        AtomicReference<Boolean> matched = new AtomicReference<>(false);

        // 만료 확인, 실패 횟수 증가, 5회 폐기, 성공 시 코드 제거가 한 번에 일어난다 (동시에 여러 번 찍어봐도 5회를 못 넘김)
        codes.computeIfPresent(email, (key, entry) -> {
            if (now >= entry.expiresAtMs()) {
                return null; // 만료
            }
            if (entry.failedAttempts() >= MAX_FAILED_ATTEMPTS) {
                return entry; // 이미 폐기된 코드. 재발송 대기시간 계산을 위해 항목만 남겨둠
            }
            if (sameCode(entry.code(), code)) {
                matched.set(true);
                return null; // 성공한 코드는 1회용
            }
            int failed = entry.failedAttempts() + 1;
            // 5회째 실패하면 코드 값을 지워서 더 이상 맞출 수 없게 만든다
            return new CodeEntry(failed >= MAX_FAILED_ATTEMPTS ? "" : entry.code(),
                    entry.sentAtMs(), entry.expiresAtMs(), failed);
        });

        if (matched.get()) {
            verifiedUntil.put(email, now + VERIFIED_TTL_MS);
            return true;
        }
        return false;
    }

    // 가입/비밀번호 재설정 직전에 인증된 이메일인지 확인용 (사용 처리는 하지 않음 - 쓸 때는 consumeVerified)
    public boolean isVerified(String email) {
        if (email == null) {
            return false;
        }
        Long until = verifiedUntil.get(email);
        return until != null && clockMs.getAsLong() < until;
    }

    // 인증 완료 상태를 1번만 쓰게 한다. 동시에 두 요청이 와도 한 쪽만 true를 받는다.
    public boolean consumeVerified(String email) {
        if (email == null) {
            return false;
        }
        Long until = verifiedUntil.remove(email);
        return until != null && clockMs.getAsLong() < until;
    }

    /**
     * 인증코드와 별개로 메일을 보내는 기능(아이디 찾기 등)에서도 같은 이메일당 발송 횟수 제한을 쓰기 위한 메서드.
     * 한도를 넘으면 TooManyRequestsException.
     */
    public void reserveMailSend(String email) {
        String limitKey = limitKey(email);
        if (!sendLimiter.tryAcquire(limitKey)) {
            long wait = sendLimiter.retryAfterSeconds(limitKey);
            throw new TooManyRequestsException(
                    "인증메일 요청이 너무 많습니다. " + Math.max(1, (wait + 59) / 60) + "분 후 다시 시도해주세요.", wait);
        }
    }

    // 대소문자만 바꿔서 한도를 피하지 못하도록 이메일은 소문자로 맞춰서 센다. 길이도 제한(사용자 입력이 키가 되므로)
    private static String limitKey(String email) {
        String key = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        return key.length() <= 200 ? key : key.substring(0, 200);
    }

    // 문자열 비교 시간 차이로 코드를 추측하지 못하게 일정한 시간으로 비교
    private static boolean sameCode(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    // 시간이 지난 항목을 정리한다. 인증을 시작만 하고 끝내지 않는 요청이 쌓여도 메모리가 계속 늘지 않게 한다.
    private void purgeIfDue(long now) {
        long last = lastPurgeMs.get();
        if (now - last >= RESEND_COOLDOWN_MS && lastPurgeMs.compareAndSet(last, now)) {
            purgeExpired(now);
        }
    }

    private void purgeExpired(long now) {
        codes.values().removeIf(entry -> now >= entry.expiresAtMs());
        verifiedUntil.values().removeIf(until -> now >= until);
    }

    // 테스트·점검용
    int codeCount() {
        return codes.size();
    }

    int verifiedCount() {
        return verifiedUntil.size();
    }

    private record CodeEntry(String code, long sentAtMs, long expiresAtMs, int failedAttempts) {}
}
