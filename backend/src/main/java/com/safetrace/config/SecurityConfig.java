package com.safetrace.config;

import com.safetrace.mapper.MemberMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;

// @PreAuthorize 동작에 필요 (없으면 일반 USER도 STAFF 전용 API 접근 가능)
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final MemberMapper memberMapper;

    // 허용할 Origin 목록(쉼표로 구분). 지정하지 않으면 frontend-base-url 하나만 허용한다.
    @Value("${app.allowed-origins:${app.frontend-base-url}}")
    private String[] allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type")); // 토큰은 헤더로만 보내고 쿠키는 쓰지 않는다
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // nosniff·X-Frame-Options는 Spring Security 기본값. 이 서버는 JSON·이미지만 내려주므로 화면으로 해석되지 않게 막는다.
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy", "geolocation=(), camera=(), microphone=()"))
            )
            // 미인증 요청은 403 대신 401 응답 (프론트가 401 기준으로 자동 로그아웃)
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, authException) ->
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "인증이 필요합니다."))
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/incidents/region/**", "/api/incidents/nearby", "/api/incidents/*/timeline").permitAll()
                .requestMatchers("/api/environment/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/notices", "/api/notices/**").permitAll()  // 공지 목록/상세는 비로그인 공개
                .requestMatchers("/api/ai/briefing", "/api/ai/chat").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/incidents/*").permitAll()
                .requestMatchers("/api/safety-checks/token/**").permitAll()  // 이메일 링크 - 로그인 없이 응답 가능
                // WebSocket HTTP Upgrade는 통과시키되 실제 접속은 JwtWebSocketHandshakeInterceptor가 1회용 티켓을 확인함
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/uploads/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider, memberMapper), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}