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

    private final JwtTokenProvider provider = new JwtTokenProvider(SECRET, 3_600_000L);

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
        JwtTokenProvider expired = new JwtTokenProvider(SECRET, -1_000L);
        JwtTokenProvider otherKey = new JwtTokenProvider("another-secret-key-for-jwt-unit-tests-9876543210", 3_600_000L);

        assertFalse(provider.validateToken(expired.generateToken(7L, "USER", "이서연", CREATED_AT, 0L)));
        assertFalse(provider.validateToken(otherKey.generateToken(7L, "USER", "이서연", CREATED_AT, 0L)));
        assertFalse(provider.validateToken("not-a-jwt"));
    }
}
