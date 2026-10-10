package com.safetrace.service;

import com.safetrace.domain.SafetyCheck;
import com.safetrace.mapper.FamilyRelationMapper;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.SafetyCheckMapper;
import com.safetrace.websocket.SafetyCheckWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SafetyCheckServiceTest {

    private SafetyCheckMapper safetyCheckMapper;
    private SafetyCheckWebSocketHandler webSocketHandler;

    private SafetyCheckService safetyCheckService;

    @BeforeEach
    void setUp() {
        safetyCheckMapper = mock(SafetyCheckMapper.class);
        webSocketHandler = mock(SafetyCheckWebSocketHandler.class);

        safetyCheckService = new SafetyCheckService(
                safetyCheckMapper,
                mock(FamilyRelationMapper.class),
                mock(MemberMapper.class),
                mock(IncidentMapper.class),
                mock(MailService.class),
                webSocketHandler
        );
    }

    @Test
    void 이미_응답된_요청에_사이트에서_다시_응답하면_막는다() {
        SafetyCheck check = new SafetyCheck();
        check.setCheckId(1L);
        check.setTargetMemberId(10L);
        check.setStatus("PENDING");   // 서버가 읽었을 때는 아직 대기중

        when(safetyCheckMapper.findReceivedByTargetId(10L)).thenReturn(List.of(check));
        // 그사이 이메일 링크로 먼저 응답돼서 DB는 이미 대기중이 아님 → 0줄
        when(safetyCheckMapper.respond(1L, "HELP")).thenReturn(0);

        assertThrows(
                IllegalStateException.class,
                () -> safetyCheckService.respond(1L, "HELP", 10L)
        );

        verify(webSocketHandler, never()).broadcastResponded(any());
    }

    @Test
    void 이미_응답된_링크로_다시_응답하면_막는다() {
        SafetyCheck check = new SafetyCheck();
        check.setCheckId(1L);
        check.setStatus("PENDING");
        check.setToken("test-token");
        check.setTokenExpiresAt(LocalDateTime.now().plusHours(1));   // 아직 만료 안 됨

        when(safetyCheckMapper.findByToken("test-token")).thenReturn(check);
        // 그사이 먼저 응답돼서 DB는 이미 응답 완료 → 0줄
        when(safetyCheckMapper.respondByToken("test-token", "SAFE")).thenReturn(0);

        assertThrows(
                IllegalStateException.class,
                () -> safetyCheckService.respondByToken("test-token", "SAFE")
        );

        verify(webSocketHandler, never()).broadcastResponded(any());
    }
}