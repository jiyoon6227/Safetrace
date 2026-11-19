package com.safetrace.websocket;

import com.safetrace.service.WebSocketTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

// 로그아웃·비밀번호 변경·재설정·탈퇴 때 그 회원의 실시간 연결과 아직 안 쓴 티켓을 없앤다
@Component
@RequiredArgsConstructor
public class WebSocketSessionRevoker {

    private final WebSocketTicketService webSocketTicketService;
    private final IncidentWebSocketHandler incidentWebSocketHandler;
    private final SafetyCheckWebSocketHandler safetyCheckWebSocketHandler;
    private final ReportWebSocketHandler reportWebSocketHandler;

    // 티켓을 먼저 지우고 연결을 닫는다 (닫힌 연결이 남은 티켓으로 바로 다시 붙지 못하게)
    public void revoke(Long memberId) {
        webSocketTicketService.revokeAll(memberId);
        incidentWebSocketHandler.disconnect(memberId);
        safetyCheckWebSocketHandler.disconnect(memberId);
        reportWebSocketHandler.disconnect(memberId);
    }
}
