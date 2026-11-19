package com.safetrace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
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

class EmailVerificationServiceTest {

    private static final String EMAIL = "user@test.com";
    private static final long SECOND = 1_000L;
    private static final long MINUTE = 60 * SECOND;

    // 실제 메일을 보내지 않고, 보낸 인증코드만 기록하는 가짜 MailService
    static class RecordingMailService extends MailService {
        final List<String> sentTo = new CopyOnWriteArrayList<>();
        final List<String> codes = new CopyOnWriteArrayList<>();
        volatile boolean fail = false;

        RecordingMailService() {
            super(null);
        }

        @Override
        public void sendVerificationCode(String toEmail, String code) {
            if (fail) {
                throw new RuntimeException("메일 서버 오류");
            }
            sentTo.add(toEmail);
            codes.add(code);
        }

        String lastCode() {
            return codes.get(codes.size() - 1);
        }
    }

    private final AtomicLong now = new AtomicLong(1_000_000L);
    private RecordingMailService mail;
    private EmailVerificationService service;

    @BeforeEach
    void setUp() {
        mail = new RecordingMailService();
        service = new EmailVerificationService(mail, now::get);
    }

    private String wrongCodeFor(String realCode) {
        return realCode.equals("000000") ? "000001" : "000000";
    }

    // ---- 인증코드 확인 --------------------------------------------------

    @Test
    void 맞는_코드면_인증이_완료된다() {
        service.sendCode(EMAIL);

        assertTrue(service.verifyCode(EMAIL, mail.lastCode()));
        assertTrue(service.isVerified(EMAIL));
    }

    @Test
    void 코드는_6자리_숫자다() {
        service.sendCode(EMAIL);

        assertTrue(mail.lastCode().matches("\\d{6}"));
    }

    @Test
    void 성공한_코드는_다시_쓸_수_없다() {
        service.sendCode(EMAIL);
        String code = mail.lastCode();

        assertTrue(service.verifyCode(EMAIL, code));
        assertFalse(service.verifyCode(EMAIL, code));
    }

    @Test
    void 코드를_5회_틀리면_폐기되어_맞는_코드도_실패한다() {
        service.sendCode(EMAIL);
        String code = mail.lastCode();
        String wrong = wrongCodeFor(code);

        for (int i = 0; i < 5; i++) {
            assertFalse(service.verifyCode(EMAIL, wrong));
        }

        assertFalse(service.verifyCode(EMAIL, code));
        assertFalse(service.isVerified(EMAIL));
    }

    @Test
    void 코드를_4회_틀려도_5번째에_맞으면_성공한다() {
        service.sendCode(EMAIL);
        String code = mail.lastCode();

        for (int i = 0; i < 4; i++) {
            assertFalse(service.verifyCode(EMAIL, wrongCodeFor(code)));
        }

        assertTrue(service.verifyCode(EMAIL, code));
    }

    @Test
    void 폐기된_뒤_60초가_지나_새_코드를_받으면_실패_횟수가_초기화된다() {
        service.sendCode(EMAIL);
        String oldCode = mail.lastCode();
        for (int i = 0; i < 5; i++) {
            service.verifyCode(EMAIL, wrongCodeFor(oldCode));
        }

        now.addAndGet(60 * SECOND);
        service.sendCode(EMAIL);

        assertTrue(service.verifyCode(EMAIL, mail.lastCode()));
    }

    @Test
    void 코드는_5분이_지나면_만료된다() {
        service.sendCode(EMAIL);
        String code = mail.lastCode();

        now.addAndGet(5 * MINUTE);

        assertFalse(service.verifyCode(EMAIL, code));
    }

    @Test
    void 코드는_5분_직전까지는_유효하다() {
        service.sendCode(EMAIL);
        String code = mail.lastCode();

        now.addAndGet(5 * MINUTE - 1);

        assertTrue(service.verifyCode(EMAIL, code));
    }

    @Test
    void 발송하지_않은_이메일이나_null은_실패한다() {
        assertFalse(service.verifyCode("nobody@test.com", "123456"));
        assertFalse(service.verifyCode(null, "123456"));
        assertFalse(service.verifyCode(EMAIL, null));
        assertEquals(0, service.codeCount()); // 확인만 한 이메일로 메모리에 항목이 생기지 않는다
    }

    @Test
    void 동시에_맞는_코드를_보내도_한_번만_성공한다() throws Exception {
        service.sendCode(EMAIL);
        String code = mail.lastCode();

        AtomicInteger success = new AtomicInteger();
        runConcurrently(32, () -> {
            if (service.verifyCode(EMAIL, code)) {
                success.incrementAndGet();
            }
        });

        assertEquals(1, success.get());
    }

    @Test
    void 동시에_많이_찍어봐도_5회를_넘게_시도할_수_없다() throws Exception {
        service.sendCode(EMAIL);
        String code = mail.lastCode();
        String wrong = wrongCodeFor(code);

        runConcurrently(64, () -> service.verifyCode(EMAIL, wrong));

        // 틀린 시도가 5회를 넘게 반영됐든 아니든, 이미 5회 이상 틀렸으므로 폐기되어 맞는 코드도 통하지 않아야 한다
        assertFalse(service.verifyCode(EMAIL, code));
    }

    @Test
    void 동시에_틀려도_실패_횟수가_빠지지_않고_5회째에_폐기된다() throws Exception {
        service.sendCode(EMAIL);
        String code = mail.lastCode();
        String wrong = wrongCodeFor(code);

        for (int i = 0; i < 3; i++) {
            service.verifyCode(EMAIL, wrong);
        }
        // 3회 실패 상태에서 동시에 틀린 값 2개를 보내면 둘 다 반영되어 정확히 5회째에서 폐기된다
        runConcurrently(2, () -> service.verifyCode(EMAIL, wrong));

        assertFalse(service.verifyCode(EMAIL, code));
    }

    // ---- 인증 완료 상태 ------------------------------------------------

    @Test
    void 인증_완료_상태는_10분이_지나면_사라진다() {
        service.sendCode(EMAIL);
        service.verifyCode(EMAIL, mail.lastCode());

        now.addAndGet(10 * MINUTE - 1);
        assertTrue(service.isVerified(EMAIL));

        now.addAndGet(1);
        assertFalse(service.isVerified(EMAIL));
        assertFalse(service.consumeVerified(EMAIL));
    }

    @Test
    void 인증_완료_상태는_한_번만_쓸_수_있다() {
        service.sendCode(EMAIL);
        service.verifyCode(EMAIL, mail.lastCode());

        assertTrue(service.consumeVerified(EMAIL));
        assertFalse(service.consumeVerified(EMAIL));
        assertFalse(service.isVerified(EMAIL));
    }

    @Test
    void 동시에_인증_상태를_써도_한_번만_성공한다() throws Exception {
        service.sendCode(EMAIL);
        service.verifyCode(EMAIL, mail.lastCode());

        AtomicInteger success = new AtomicInteger();
        runConcurrently(32, () -> {
            if (service.consumeVerified(EMAIL)) {
                success.incrementAndGet();
            }
        });

        assertEquals(1, success.get());
    }

    @Test
    void 새_코드를_요청하면_이전_인증_완료_상태는_지워진다() {
        service.sendCode(EMAIL);
        service.verifyCode(EMAIL, mail.lastCode());
        assertTrue(service.isVerified(EMAIL));

        now.addAndGet(60 * SECOND);
        service.sendCode(EMAIL);

        assertFalse(service.isVerified(EMAIL));
    }

    @Test
    void 쓰기_전에는_isVerified를_여러_번_불러도_상태가_유지된다() {
        service.sendCode(EMAIL);
        service.verifyCode(EMAIL, mail.lastCode());

        assertTrue(service.isVerified(EMAIL));
        assertTrue(service.isVerified(EMAIL));
        assertTrue(service.consumeVerified(EMAIL));
    }

    // ---- 재발송 제한 / 발송 횟수 제한 --------------------------------------

    @Test
    void 재발송은_60초_뒤에_가능하다() {
        service.sendCode(EMAIL);

        now.addAndGet(59 * SECOND);
        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> service.sendCode(EMAIL));
        assertEquals(1, e.getRetryAfterSeconds());
        assertEquals(1, mail.codes.size()); // 메일은 더 나가지 않았다

        now.addAndGet(1 * SECOND);
        service.sendCode(EMAIL);
        assertEquals(2, mail.codes.size());
    }

    @Test
    void 재발송_제한에_걸리면_기존_코드와_인증상태는_그대로다() {
        service.sendCode(EMAIL);
        String code = mail.lastCode();

        assertThrows(TooManyRequestsException.class, () -> service.sendCode(EMAIL));

        assertTrue(service.verifyCode(EMAIL, code));
    }

    @Test
    void 재발송하면_이전_코드는_쓸_수_없다() {
        service.sendCode(EMAIL);
        String oldCode = mail.lastCode();

        now.addAndGet(60 * SECOND);
        service.sendCode(EMAIL);
        String newCode = mail.lastCode();

        if (!oldCode.equals(newCode)) { // 우연히 같은 번호가 나오면 구분할 수 없으므로 건너뛴다
            assertFalse(service.verifyCode(EMAIL, oldCode));
        }
        assertTrue(service.verifyCode(EMAIL, newCode));
    }

    @Test
    void 동시에_발송을_요청해도_메일은_한_번만_나간다() throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();

        runConcurrently(32, () -> {
            try {
                service.sendCode(EMAIL);
                accepted.incrementAndGet();
            } catch (TooManyRequestsException e) {
                rejected.incrementAndGet();
            }
        });

        assertEquals(1, accepted.get());
        assertEquals(31, rejected.get());
        assertEquals(1, mail.codes.size());
    }

    @Test
    void 이메일_하나당_1시간에_5회까지만_발송한다() {
        for (int i = 0; i < 5; i++) {
            service.sendCode(EMAIL);
            now.addAndGet(61 * SECOND); // 재발송 대기시간은 지키면서 계속 요청
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> service.sendCode(EMAIL));
        assertTrue(e.getMessage().contains("분 후"));
        assertEquals(5, mail.codes.size());
    }

    @Test
    void 대소문자만_바꿔서_발송_제한을_피할_수_없다() {
        String[] variants = {"user@test.com", "USER@test.com", "User@Test.com", "user@TEST.com", "uSeR@test.com"};
        for (String variant : variants) {
            service.sendCode(variant);
            now.addAndGet(61 * SECOND);
        }

        assertThrows(TooManyRequestsException.class, () -> service.sendCode("USER@TEST.COM"));
    }

    @Test
    void 발송_횟수는_1시간이_지나면_다시_채워진다() {
        for (int i = 0; i < 5; i++) {
            service.sendCode(EMAIL);
            now.addAndGet(61 * SECOND);
        }
        assertThrows(TooManyRequestsException.class, () -> service.sendCode(EMAIL));

        now.addAndGet(60 * MINUTE);

        service.sendCode(EMAIL);
        assertEquals(6, mail.codes.size());
    }

    @Test
    void 다른_이메일은_서로_영향을_주지_않는다() {
        service.sendCode("a@test.com");
        service.sendCode("b@test.com"); // 같은 시각에도 가능

        assertEquals(2, mail.codes.size());
    }

    @Test
    void 메일_발송이_실패하면_대기시간_없이_바로_다시_시도할_수_있다() {
        mail.fail = true;
        assertThrows(RuntimeException.class, () -> service.sendCode(EMAIL));

        mail.fail = false;
        service.sendCode(EMAIL); // 60초를 기다리지 않아도 된다

        assertEquals(1, mail.codes.size());
        assertTrue(service.verifyCode(EMAIL, mail.lastCode()));
    }

    @Test
    void 아이디찾기_같은_메일도_이메일당_발송_횟수를_함께_센다() {
        for (int i = 0; i < 5; i++) {
            service.reserveMailSend(EMAIL);
        }

        assertThrows(TooManyRequestsException.class, () -> service.reserveMailSend(EMAIL));
        assertThrows(TooManyRequestsException.class, () -> service.reserveMailSend("USER@test.com"));
    }

    // ---- 메모리 -------------------------------------------------------

    @Test
    void 만료된_코드와_인증상태는_정리된다() {
        List<String> emails = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            emails.add("user" + i + "@test.com");
        }
        for (String email : emails) {
            service.sendCode(email);
        }
        service.verifyCode(emails.get(0), mail.codes.get(0));
        assertEquals(199, service.codeCount());
        assertEquals(1, service.verifiedCount());

        now.addAndGet(10 * MINUTE + 1);
        service.sendCode("trigger@test.com"); // 발송 때 정리가 돈다

        assertEquals(1, service.codeCount());
        assertEquals(0, service.verifiedCount());
    }

    @Test
    void 보관_개수_상한에_도달하면_새_이메일은_받지_않는다() {
        for (int i = 0; i < EmailVerificationService.MAX_ENTRIES; i++) {
            service.sendCode("user" + i + "@test.com");
        }

        assertThrows(TooManyRequestsException.class, () -> service.sendCode("overflow@test.com"));
        assertEquals(EmailVerificationService.MAX_ENTRIES, service.codeCount());

        // 시간이 지나 만료되면 다시 받는다
        now.addAndGet(5 * MINUTE);
        service.sendCode("overflow@test.com");
        assertEquals(1, service.codeCount());
    }

    // ---- 도우미 ------------------------------------------------------

    private void runConcurrently(int threads, Runnable task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                task.run();
            });
        }
        ready.await();
        go.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(30, TimeUnit.SECONDS));
    }
}
