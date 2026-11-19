package com.safetrace.controller;

import com.safetrace.service.WebSocketTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ws")
@RequiredArgsConstructor
public class WebSocketTicketController {

    private final WebSocketTicketService webSocketTicketService;

    // 로그인한 회원만 받을 수 있다. 받은 ticket은 WebSocket 접속 주소에 ?ticket=... 으로 붙여 쓴다.
    @PostMapping("/ticket")
    public Map<String, String> issueTicket(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return Map.of("ticket", webSocketTicketService.issue(memberId));
    }
}
