package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.websocket.IncidentWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class IncidentServiceTest {

    private IncidentMapper incidentMapper;
    private MemberMapper memberMapper;
    private IncidentWebSocketHandler webSocketHandler;
    private NotificationService notificationService;

    private IncidentService incidentService;

    @BeforeEach
    void setUp() {
        incidentMapper = mock(IncidentMapper.class);
        memberMapper = mock(MemberMapper.class);
        webSocketHandler = mock(IncidentWebSocketHandler.class);
        notificationService = mock(NotificationService.class);

        incidentService = new IncidentService(
                incidentMapper,
                memberMapper,
                webSocketHandler,
                notificationService
        );
    }

    @Test
    void 사건상태를_한단계_건너뛰면_막는다() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus("RECEIVED");
        incident.setAssignedStaffId(10L);

        Member staff = activeStaff();

        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(20L)).thenReturn(staff);

        assertThrows(
                IllegalStateException.class,
                () -> incidentService.changeStatus(1L, "RESPONDING", "확인 완료", 20L)
        );

        verify(incidentMapper, never()).updateStatus(anyLong(), anyString());
        verify(incidentMapper, never()).closeIncident(anyLong(), anyString());
        verify(incidentMapper, never()).insertLog(any());
    }

    @Test
    void 사건종료시_조치내역이_없으면_막는다() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus("RECOVERING");
        incident.setAssignedStaffId(10L);

        Member staff = activeStaff();

        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(anyLong())).thenReturn(staff);

        assertThrows(
                IllegalStateException.class,
                () -> incidentService.changeStatus(1L, "CLOSED", "   ", 20L)
        );

        verify(incidentMapper, never()).closeIncident(anyLong(), anyString());
        verify(incidentMapper, never()).insertLog(any());
    }

    private Member activeStaff() {
        Member member = new Member();
        member.setRole("STAFF");
        member.setIsWithdrawn("N");
        return member;
    }
}
