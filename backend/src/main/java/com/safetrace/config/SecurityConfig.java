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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

// @EnableMethodSecurity가 있어야 컨트롤러의 @PreAuthorize("hasRole('STAFF') ...")가 실제로 동작함.
// 이게 없으면 @PreAuthorize는 그냥 주석이나 다름없어서, 로그인만 한 일반 USER도 STAFF 전용 API에 접근 가능했음.
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final MemberMapper memberMapper;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));  // Vite 기본 포트
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // 이 프로젝트는 httpBasic()/formLogin()을 안 씀(JWT만 사용). 그런 상태에서
            // AuthenticationEntryPoint를 따로 지정 안 하면 Spring Security 기본값은
            // Http403ForbiddenEntryPoint라서, 토큰이 없거나 무효해서 인증이 안 된 요청까지도
            // 전부 403으로 응답해버림 -> 프론트가 401 기준으로 하는 자동 로그아웃 처리가 안 먹힘
            // (토큰이 무효해도 403만 받고 계속 로그인된 것처럼 보이는 원인이었음).
            // 인증 자체가 안 된 요청은 401로 응답하도록 entryPoint를 명시적으로 지정.
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
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/uploads/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider, memberMapper), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}