package com.safetrace.config;

import com.safetrace.mapper.MemberMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;

class SecurityConfigCorsTest {

    private CorsConfiguration corsFor(String... allowedOrigins) {
        SecurityConfig config = new SecurityConfig(mock(JwtTokenProvider.class), mock(MemberMapper.class));
        ReflectionTestUtils.setField(config, "allowedOrigins", allowedOrigins);
        UrlBasedCorsConfigurationSource source = (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        return source.getCorsConfigurations().get("/**");
    }

    @Test
    void 운영처럼_도메인만_지정하면_그_Origin만_허용한다() {
        CorsConfiguration cors = corsFor("https://safetrace.kr");

        assertEquals("https://safetrace.kr", cors.checkOrigin("https://safetrace.kr"));
        assertNull(cors.checkOrigin("http://localhost:5173"));
        assertNull(cors.checkOrigin("http://127.0.0.1:5173"));
        assertNull(cors.checkOrigin("https://evil.example"));
        assertNull(cors.checkOrigin("https://safetrace.kr.evil.example"));
        assertNull(cors.checkOrigin("http://safetrace.kr"));
    }

    @Test
    void 로컬처럼_localhost_패턴을_지정하면_포트와_상관없이_허용한다() {
        CorsConfiguration cors = corsFor("http://localhost:*", "http://127.0.0.1:*");

        assertEquals("http://localhost:5173", cors.checkOrigin("http://localhost:5173"));
        assertEquals("http://localhost:5174", cors.checkOrigin("http://localhost:5174"));
        assertEquals("http://127.0.0.1:3000", cors.checkOrigin("http://127.0.0.1:3000"));
        assertNull(cors.checkOrigin("http://localhost.evil.example"));
        assertNull(cors.checkOrigin("https://safetrace.kr"));
    }

    @Test
    void 요청_헤더는_토큰과_JSON에_필요한_것만_허용하고_쿠키는_쓰지_않는다() {
        CorsConfiguration cors = corsFor("https://safetrace.kr");

        assertEquals(List.of("Authorization", "Content-Type"), cors.getAllowedHeaders());
        assertNotEquals(Boolean.TRUE, cors.getAllowCredentials());
    }
}
