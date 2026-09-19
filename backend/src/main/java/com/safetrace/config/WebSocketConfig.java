package com.safetrace.config;

import com.safetrace.websocket.IncidentWebSocketHandler;
import com.safetrace.websocket.ReportWebSocketHandler;
import com.safetrace.websocket.SafetyCheckWebSocketHandler;
import lombok.RequiredArgsConstructor;
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

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // HTTP Upgrade 자체는 SecurityConfig에서 통과시키고,
        // 실제 WebSocket 접속 허용 여부는 이 JWT HandshakeInterceptor가 검증한다.
        // 개발 중 Vite 포트가 5173/5174 등으로 바뀔 수 있어 localhost만 허용한다.
        registry.addHandler(incidentWebSocketHandler, "/ws/incidents")
                .addInterceptors(jwtWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*");

        registry.addHandler(safetyCheckWebSocketHandler, "/ws/safety-check")
                .addInterceptors(jwtWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*");

        registry.addHandler(reportWebSocketHandler, "/ws/reports")
                .addInterceptors(jwtWebSocketHandshakeInterceptor)
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*");
    }
}
