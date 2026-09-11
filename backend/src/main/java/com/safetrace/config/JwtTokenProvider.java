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

    // 토큰 생성 - memberId, role, name과 함께 로그인 시점의 회원 가입일시(createdAt)도 담음.
    // DB를 초기화(재시딩)하면 SEQUENCE가 다시 1번부터 채번되므로 예전과 같은 MEMBER_ID의
    // 회원이 다시 생길 수 있는데, 그건 데이터상 완전히 다른(재생성된) 레코드임.
    // 그 경우에도 CREATED_AT(가입일시)까지 똑같이 우연히 일치할 가능성은 사실상 없으므로,
    // 이 값을 토큰에 넣어두면 "겉보기 ID만 같고 실제로는 재생성된 회원"인 경우를 구분해낼 수 있음.
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