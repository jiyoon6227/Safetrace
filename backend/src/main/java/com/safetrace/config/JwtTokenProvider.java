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

    public JwtTokenProvider(@Value("${jwt.secret}") String secret,
                             @Value("${jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    // 토큰 생성: memberId, role, name, createdAt 포함
    // (createdAt: DB 재시딩으로 같은 ID가 재생성된 회원 구분용)
    public String generateToken(Long memberId, String role, String name, LocalDateTime createdAt) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        long createdAtEpochMs = createdAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();

        return Jwts.builder()
                .subject(String.valueOf(memberId))
                .claim("role", role)
                .claim("name", name)
                .claim("createdAt", createdAtEpochMs)
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

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}