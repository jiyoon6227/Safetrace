package com.safetrace.config;

import com.safetrace.websocket.IncidentWebSocketHandler;
import com.safetrace.websocket.SafetyCheckWebSocketHandler;
import com.safetrace.websocket.ReportWebSocketHandler;
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

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(incidentWebSocketHandler, "/ws/incidents")
                .setAllowedOrigins("*");

        registry.addHandler(safetyCheckWebSocketHandler, "/ws/safety-check")
                .setAllowedOrigins("*");

        registry.addHandler(reportWebSocketHandler, "/ws/reports")
                .setAllowedOrigins("*");
    }
}
