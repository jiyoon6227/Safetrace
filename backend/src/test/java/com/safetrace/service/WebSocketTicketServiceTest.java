package com.safetrace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebSocketTicketServiceTest {

    private final AtomicLong now = new AtomicLong(1_000_000L);
    private WebSocketTicketService service;

    @BeforeEach
    void setUp() {
        service = new WebSocketTicketService(now::get);
    }

    @Test
    void 발급받은_티켓으로_회원_ID를_확인할_수_있다() {
        String ticket = service.issue(7L);

        assertEquals(Long.valueOf(7L), service.consume(ticket));
    }

    @Test
    void 티켓은_한_번만_쓸_수_있다() {
        String ticket = service.issue(7L);

        assertEquals(Long.valueOf(7L), service.consume(ticket));
        assertNull(service.consume(ticket));
    }

    @Test
    void 티켓은_30초가_지나면_쓸_수_없다() {
        String ticket = service.issue(7L);

        now.addAndGet(30_000L);

        assertNull(service.consume(ticket));
    }

    @Test
    void 만료_직전까지는_쓸_수_있다() {
        String ticket = service.issue(7L);

        now.addAndGet(29_999L);

        assertEquals(Long.valueOf(7L), service.consume(ticket));
    }

    @Test
    void 없는_티켓과_빈_값은_거절한다() {
        assertNull(service.consume(null));
        assertNull(service.consume(""));
        assertNull(service.consume("not-issued"));
    }

    @Test
    void 티켓은_매번_다르고_JWT_같은_구조를_갖지_않는다() {
        Set<String> tickets = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            tickets.add(service.issue((long) i)); // 회원별 발급 한도에 걸리지 않게 회원을 나눈다
        }

        assertEquals(200, tickets.size());
        String ticket = tickets.iterator().next();
        assertTrue(ticket.length() >= 40, "추측할 수 없을 만큼 길어야 한다");
        assertTrue(ticket.matches("[A-Za-z0-9_-]+"), "주소에 그대로 붙여도 되는 글자만 쓴다");
    }

    @Test
    void 회원마다_자기_티켓은_자기_ID로만_확인된다() {
        String first = service.issue(1L);
        String second = service.issue(2L);

        assertEquals(Long.valueOf(2L), service.consume(second));
        assertEquals(Long.valueOf(1L), service.consume(first));
    }

    @Test
    void 티켓이_너무_많이_쌓이면_새로_발급하지_않지만_만료된_것은_정리한다() {
        for (int i = 0; i < 10_000; i++) {
            service.issue((long) i);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> service.issue(2L));
        assertTrue(e.getRetryAfterSeconds() > 0);

        now.addAndGet(30_000L); // 전부 만료
        String ticket = service.issue(2L);

        assertEquals(Long.valueOf(2L), service.consume(ticket));
    }

    @Test
    void 한_회원이_1분에_받을_수_있는_티켓에는_한도가_있다() {
        for (int i = 0; i < 30; i++) {
            service.issue(7L);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> service.issue(7L));

        assertTrue(e.getRetryAfterSeconds() > 0);
    }

    @Test
    void 발급_한도는_회원마다_따로_센다() {
        for (int i = 0; i < 30; i++) {
            service.issue(7L);
        }

        assertEquals(Long.valueOf(8L), service.consume(service.issue(8L)));
    }

    @Test
    void 발급_한도는_1분이_지나면_풀린다() {
        for (int i = 0; i < 30; i++) {
            service.issue(7L);
        }

        now.addAndGet(60_000L);

        assertEquals(Long.valueOf(7L), service.consume(service.issue(7L)));
    }

    @Test
    void 회원의_미사용_티켓을_모두_폐기해도_다른_회원_티켓은_그대로다() {
        String first = service.issue(7L);
        String second = service.issue(7L);
        String other = service.issue(8L);

        service.revokeAll(7L);

        assertNull(service.consume(first));
        assertNull(service.consume(second));
        assertEquals(Long.valueOf(8L), service.consume(other));
    }
}
