package com.safetrace.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtTokenProviderTest {

    private static final String SECRET = "test-secret-key-for-jwt-unit-tests-0123456789";
    private static final LocalDateTime CREATED_AT = LocalDateTime.of(2026, 1, 1, 9, 0);

    private static final long MAX_SESSION_MS = 43_200_000L;

    private final JwtTokenProvider provider = new JwtTokenProvider(SECRET, 3_600_000L, MAX_SESSION_MS);

    @Test
    void 토큰에_담긴_회원_정보와_토큰_버전을_읽을_수_있다() {
        String token = provider.generateToken(7L, "STAFF", "김담당", CREATED_AT, 4L);

        assertTrue(provider.validateToken(token));
        assertEquals(7L, provider.getMemberId(token));
        assertEquals("STAFF", provider.getRole(token));
        assertEquals(4L, provider.getTokenVersion(token));
    }

    @Test
    void 버전이_다르면_토큰_값도_다르다() {
        String first = provider.generateToken(7L, "USER", "이서연", CREATED_AT, 0L);
        String second = provider.generateToken(7L, "USER", "이서연", CREATED_AT, 1L);

        assertEquals(0L, provider.getTokenVersion(first));
        assertEquals(1L, provider.getTokenVersion(second));
    }

    @Test
    void 버전_정보가_없는_예전_토큰은_0으로_읽는다() {
        String legacy = Jwts.builder()
                .subject("7")
                .claim("role", "USER")
                .claim("name", "이서연")
                .claim("createdAt", 1L)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000L))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes()))
                .compact();

        assertTrue(provider.validateToken(legacy));
        assertEquals(0L, provider.getTokenVersion(legacy));
    }

    @Test
    void 만료되었거나_서명이_다른_토큰은_유효하지_않다() {
        JwtTokenProvider expired = new JwtTokenProvider(SECRET, -1_000L, MAX_SESSION_MS);
        JwtTokenProvider otherKey = new JwtTokenProvider("another-secret-key-for-jwt-unit-tests-9876543210", 3_600_000L, MAX_SESSION_MS);

        assertFalse(provider.validateToken(expired.generateToken(7L, "USER", "이서연", CREATED_AT, 0L)));
        assertFalse(provider.validateToken(otherKey.generateToken(7L, "USER", "이서연", CREATED_AT, 0L)));
        assertFalse(provider.validateToken("not-a-jwt"));
    }

    @Test
    void 로그인으로_만든_토큰은_지금을_세션_시작_시각으로_담는다() {
        long before = System.currentTimeMillis();
        String token = provider.generateToken(7L, "USER", "이서연", CREATED_AT, 0L);
        long after = System.currentTimeMillis();

        long start = provider.getSessionStartMs(token);
        assertTrue(start >= before && start <= after);
        assertFalse(provider.isSessionLimitReached(token));
    }

    @Test
    void 연장해도_세션_시작_시각은_그대로다() {
        long start = System.currentTimeMillis() - 2 * 3_600_000L;

        String refreshed = provider.generateRefreshedToken(7L, "USER", "이서연", CREATED_AT, 0L, start);

        assertTrue(provider.validateToken(refreshed));
        assertEquals(start, provider.getSessionStartMs(refreshed));
        assertFalse(provider.isSessionLimitReached(refreshed));
    }

    @Test
    void 연장한_토큰의_만료시각은_최대_세션_시간을_넘지_못한다() {
        long start = System.currentTimeMillis() - MAX_SESSION_MS + 600_000L; // 한도까지 10분 남은 세션
        long limit = start + MAX_SESSION_MS;

        String refreshed = provider.generateRefreshedToken(7L, "USER", "이서연", CREATED_AT, 0L, start);

        long exp = provider.parseClaims(refreshed).getExpiration().getTime();
        assertTrue(exp <= limit);
        assertTrue(exp > limit - 2_000L, "1시간이 아니라 남은 10분에 맞춰진다");
        assertTrue(provider.isSessionLimitReached(refreshed), "이 토큰은 더 연장할 수 없다");
    }

    @Test
    void 최대_세션_시간이_지난_세션은_연장해도_이미_만료된_토큰이_나온다() {
        long start = System.currentTimeMillis() - MAX_SESSION_MS - 1_000L;

        String refreshed = provider.generateRefreshedToken(7L, "USER", "이서연", CREATED_AT, 0L, start);

        assertFalse(provider.validateToken(refreshed));
    }

    @Test
    void 세션_시작_시각이_없는_예전_토큰은_발급_시각을_시작으로_본다() {
        long issuedAt = System.currentTimeMillis() - 300_000L;
        String legacy = Jwts.builder()
                .subject("7")
                .claim("role", "USER")
                .claim("name", "이서연")
                .claim("createdAt", 1L)
                .issuedAt(new Date(issuedAt))
                .expiration(new Date(System.currentTimeMillis() + 60_000L))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes()))
                .compact();

        assertEquals(issuedAt / 1000 * 1000, provider.getSessionStartMs(legacy));
    }
}
