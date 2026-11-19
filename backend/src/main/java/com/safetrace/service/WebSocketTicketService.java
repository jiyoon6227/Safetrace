package com.safetrace.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * WebSocket 접속용 1회용 티켓 (서버 메모리에만 보관).
 * 브라우저 WebSocket은 Authorization 헤더를 못 보내서 JWT를 접속 주소에 실으면 접속 로그에 남는다.
 * 대신 로그인 상태에서 티켓을 받아 접속하게 하고, 티켓은 30초 안에 한 번만 쓸 수 있어서 로그에 남아도 쓸모가 없다.
 */
@Service
public class WebSocketTicketService {

    private static final long TTL_MS = 30_000L;
    private static final int MAX_TICKETS = 10_000;

    private record Ticket(Long memberId, long expiresAtMs) {}

    private final SecureRandom random = new SecureRandom();
    private final LongSupplier clockMs;
    private final ConcurrentHashMap<String, Ticket> tickets = new ConcurrentHashMap<>();

    public WebSocketTicketService() {
        this(() -> System.nanoTime() / 1_000_000L);
    }

    // 테스트에서 시계를 주입하기 위한 생성자
    WebSocketTicketService(LongSupplier clockMs) {
        this.clockMs = clockMs;
    }

    /** 티켓을 만든다. 가득 차면 만료된 티켓부터 정리하고, 그래도 가득 차 있으면 발급하지 않는다. */
    public String issue(Long memberId) {
        long now = clockMs.getAsLong();
        if (tickets.size() >= MAX_TICKETS) {
            tickets.values().removeIf(t -> t.expiresAtMs() <= now);
            if (tickets.size() >= MAX_TICKETS) {
                throw new TooManyRequestsException("접속 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 30);
            }
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tickets.put(ticket, new Ticket(memberId, now + TTL_MS));
        return ticket;
    }

    /** 티켓을 한 번 쓴다. 맞으면 회원 ID를 돌려주고 지운다. 없거나 만료됐거나 이미 썼으면 null. */
    public Long consume(String ticket) {
        if (ticket == null) {
            return null;
        }
        Ticket found = tickets.remove(ticket);
        if (found == null || found.expiresAtMs() <= clockMs.getAsLong()) {
            return null;
        }
        return found.memberId();
    }
}
