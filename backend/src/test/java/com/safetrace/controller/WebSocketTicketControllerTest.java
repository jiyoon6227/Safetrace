package com.safetrace.controller;

import com.safetrace.service.WebSocketTicketService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class WebSocketTicketControllerTest {

    @Test
    void 로그인한_회원에게_본인_ID로_발급한_티켓을_준다() {
        WebSocketTicketService service = new WebSocketTicketService();
        WebSocketTicketController controller = new WebSocketTicketController(service);

        Map<String, String> response = controller.issueTicket(
                new UsernamePasswordAuthenticationToken(7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        assertNotNull(response.get("ticket"));
        assertEquals(Long.valueOf(7L), service.consume(response.get("ticket")));
    }
}
