package com.safetrace.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expirationMs;
    private final long maxSessionMs;

    public JwtTokenProvider(@Value("${jwt.secret}") String secret,
                             @Value("${jwt.expiration-ms}") long expirationMs,
                             @Value("${jwt.max-session-ms:43200000}") long maxSessionMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
        this.maxSessionMs = maxSessionMs;
    }

    // 토큰 생성: memberId, role, name, createdAt, tokenVersion 포함
    // (createdAt: DB 재시딩으로 같은 ID가 재생성된 회원 구분용)
    // (tokenVersion: 로그아웃·비밀번호 변경 전에 만든 토큰을 거절하기 위한 값)
    // 로그인·비밀번호 변경처럼 본인 확인을 새로 거친 경우에 쓰며, 지금이 세션 시작 시각이 된다.
    public String generateToken(Long memberId, String role, String name, LocalDateTime createdAt, long tokenVersion) {
        return buildToken(memberId, role, name, createdAt, tokenVersion, System.currentTimeMillis());
    }

    // 세션 연장용: 세션 시작 시각(sat)은 그대로 두고 만료시각만 늘린다. 시작 시각 + 최대 세션 시간을 넘길 수 없다.
    public String generateRefreshedToken(Long memberId, String role, String name, LocalDateTime createdAt,
                                         long tokenVersion, long sessionStartMs) {
        return buildToken(memberId, role, name, createdAt, tokenVersion, sessionStartMs);
    }

    private String buildToken(Long memberId, String role, String name, LocalDateTime createdAt,
                              long tokenVersion, long sessionStartMs) {
        Date now = new Date();
        Date expiry = new Date(Math.min(now.getTime() + expirationMs, sessionStartMs + maxSessionMs));
        long createdAtEpochMs = createdAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();

        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("role", role)
                .claim("name", name)
                .claim("createdAt", createdAtEpochMs)
                .claim("tv", tokenVersion)
                .claim("sat", sessionStartMs)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long getMemberId(String token) {
        return Long.valueOf(parseClaims(token).getSubject());
    }

    public String getRole(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public Long getCreatedAtEpochMs(String token) {
        return parseClaims(token).get("createdAt", Long.class);
    }

    // 버전이 없는 예전 토큰은 0으로 본다 (DB 기본값과 동일)
    public long getTokenVersion(String token) {
        Object version = parseClaims(token).get("tv");
        return version instanceof Number number ? number.longValue() : 0L;
    }

    // 세션 시작 시각. 이 값이 없는 예전 토큰은 발급 시각으로 본다.
    public long getSessionStartMs(String token) {
        Claims claims = parseClaims(token);
        Object start = claims.get("sat");
        return start instanceof Number number ? number.longValue() : claims.getIssuedAt().getTime();
    }

    // 이 토큰의 만료시각이 이미 최대 세션 시간에 닿아 있으면 더 연장할 수 없다.
    // (JWT 만료시각은 초 단위로 잘리므로 1초 이내 차이는 같은 것으로 본다)
    public boolean isSessionLimitReached(String token) {
        long limitMs = getSessionStartMs(token) + maxSessionMs;
        return limitMs - parseClaims(token).getExpiration().getTime() < 1000L;
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}