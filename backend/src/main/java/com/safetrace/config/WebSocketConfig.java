package com.safetrace.config;

import com.safetrace.websocket.IncidentWebSocketHandler;
import com.safetrace.websocket.ReportWebSocketHandler;
import com.safetrace.websocket.SafetyCheckWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final IncidentWebSocketHandler incidentWebSocketHandler;
    private final SafetyCheckWebSocketHandler safetyCheckWebSocketHandler;
    private final ReportWebSocketHandler reportWebSocketHandler;
    private final JwtWebSocketHandshakeInterceptor jwtWebSocketHandshakeInterceptor;

    @Value("${app.frontend-base-url}")
    private String frontendBaseUrl;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {

        // HTTP Upgrade 자체는 SecurityConfig에서 통과시키고,
        // 실제 WebSocket 접속 허용 여부는
        // JwtWebSocketHandshakeInterceptor가 JWT를 검증한다.

        registry.addHandler(incidentWebSocketHandler, "/ws/incidents")
                .addInterceptors(jwtWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        frontendBaseUrl
                );

        registry.addHandler(safetyCheckWebSocketHandler, "/ws/safety-check")
                .addInterceptors(jwtWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        frontendBaseUrl
                );

        registry.addHandler(reportWebSocketHandler, "/ws/reports")
                .addInterceptors(jwtWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        frontendBaseUrl
                );
    }
}