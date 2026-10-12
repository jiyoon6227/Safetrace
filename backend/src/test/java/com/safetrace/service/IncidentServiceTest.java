package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.websocket.IncidentWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
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
        when(memberMapper.findById(10L)).thenReturn(staff);

        assertThrows(
                IllegalStateException.class,
                () -> incidentService.changeStatus(1L, "RESPONDING", "확인 완료", 10L)
        );

        verify(incidentMapper, never()).updateStatus(anyLong(), anyString(), anyString());
        verify(incidentMapper, never()).closeIncident(anyLong(), anyString(), anyString());
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
                () -> incidentService.changeStatus(1L, "CLOSED", "   ", 10L)
        );

        verify(incidentMapper, never()).closeIncident(anyLong(), anyString(), anyString());
        verify(incidentMapper, never()).insertLog(any());
    }

    @Test
    void 담당자가_아닌_STAFF는_상태를_바꿀수_없다() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus("CONFIRMING");
        incident.setAssignedStaffId(10L);   // 담당자는 A(10번)

        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(20L)).thenReturn(activeStaff());   // B(20번)도 정상 STAFF

        assertThrows(
                AccessDeniedException.class,
                () -> incidentService.changeStatus(1L, "RESPONDING", "현장 출동", 20L)   // B가 요청
        );

        verify(incidentMapper, never()).updateStatus(anyLong(), anyString(), anyString());
        verify(incidentMapper, never()).insertLog(any());
    }

    @Test
    void 이미_처리된_상태변경_요청이면_막는다() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus("CONFIRMING");   // 서버가 읽었을 때는 확인중
        incident.setAssignedStaffId(10L);

        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(10L)).thenReturn(activeStaff());   // 담당자 본인 요청
        // 그사이 같은 요청이 먼저 처리돼서 DB는 이미 대응중 → 조건이 안 맞아 0줄
        when(incidentMapper.updateStatus(1L, "CONFIRMING", "RESPONDING")).thenReturn(0);

        assertThrows(
                IllegalStateException.class,
                () -> incidentService.changeStatus(1L, "RESPONDING", "현장 출동", 10L)
        );

        verify(incidentMapper, never()).insertLog(any());
    }

    @Test
    void 담당자가_아닌_STAFF는_사건정보를_수정할수_없다() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus("CONFIRMING");
        incident.setAssignedStaffId(10L);

        when(incidentMapper.findById(1L)).thenReturn(incident);

        Incident updates = new Incident();
        updates.setTitle("제목 변경");

        assertThrows(
                AccessDeniedException.class,
                () -> incidentService.updateIncidentDetails(1L, updates, 20L)
        );

        verify(incidentMapper, never()).updateDetails(any());
    }

    @Test
    void 담당자가_아닌_STAFF는_현장사진을_추가할수_없다() {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus("CONFIRMING");
        incident.setAssignedStaffId(10L);

        when(incidentMapper.findById(1L)).thenReturn(incident);

        assertThrows(
                AccessDeniedException.class,
                () -> incidentService.addIncidentPhoto(1L, "/uploads/test.jpg", 20L)
        );

        verify(incidentMapper, never()).insertPhoto(anyLong(), anyString(), anyInt());
    }

    @Test
    void 반경_500m_안의_같은유형_사건은_중복후보에_포함된다() {
        Incident near = incidentAt(1L, 36.3504 + 0.0044, 127.3845);   // 약 489m

        when(incidentMapper.findRecentByType("침수", 30)).thenReturn(List.of(near));

        List<Incident> result = incidentService.findRelatedIncidents("침수", 36.3504, 127.3845);

        assertEquals(List.of(near), result);
        verify(incidentMapper).findRecentByType("침수", 30);
    }

    @Test
    void 반경_500m_밖의_같은유형_사건은_중복후보에서_제외된다() {
        Incident far = incidentAt(2L, 36.3504 + 0.0046, 127.3845);   // 약 511m

        when(incidentMapper.findRecentByType("침수", 30)).thenReturn(List.of(far));

        List<Incident> result = incidentService.findRelatedIncidents("침수", 36.3504, 127.3845);

        assertEquals(List.of(), result);
    }

    @Test
    void 위치없는_사건이_섞여있어도_에러없이_제외된다() {
        Incident noLocation = incidentAt(3L, null, null);
        Incident near = incidentAt(1L, 36.3504 + 0.0044, 127.3845);

        when(incidentMapper.findRecentByType("침수", 30)).thenReturn(List.of(noLocation, near));

        List<Incident> result = incidentService.findRelatedIncidents("침수", 36.3504, 127.3845);

        assertEquals(List.of(near), result);
    }

    private Incident incidentAt(Long incidentId, Double latitude, Double longitude) {
        Incident incident = new Incident();
        incident.setIncidentId(incidentId);
        incident.setDisasterType("침수");
        incident.setLatitude(latitude);
        incident.setLongitude(longitude);
        return incident;
    }

    private Member activeStaff() {
        Member member = new Member();
        member.setRole("STAFF");
        member.setIsWithdrawn("N");
        return member;
    }
}