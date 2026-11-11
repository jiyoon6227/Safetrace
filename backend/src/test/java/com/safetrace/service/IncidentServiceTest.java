package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.dto.DailyCount;
import com.safetrace.dto.DailyIncidentStat;
import com.safetrace.dto.DashboardStatsResponse;
import com.safetrace.dto.IncidentPageResponse;
import com.safetrace.dto.IncidentSearchCondition;
import com.safetrace.dto.IncidentSearchRequest;
import com.safetrace.dto.IncidentStatusCounts;
import com.safetrace.dto.TypeMonthlyCount;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.websocket.IncidentWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class IncidentServiceTest {

    private IncidentMapper incidentMapper;
    private MemberMapper memberMapper;
    private IncidentWebSocketHandler webSocketHandler;
    private NotificationService notificationService;
    private ResourceClosureService resourceClosureService;

    private IncidentService incidentService;

    @BeforeEach
    void setUp() {
        incidentMapper = mock(IncidentMapper.class);
        memberMapper = mock(MemberMapper.class);
        webSocketHandler = mock(IncidentWebSocketHandler.class);
        notificationService = mock(NotificationService.class);
        resourceClosureService = mock(ResourceClosureService.class);

        incidentService = new IncidentService(
                incidentMapper,
                memberMapper,
                webSocketHandler,
                notificationService,
                resourceClosureService
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

    @Test
    void 대시보드_일별통계는_0건인_날도_채워서_7일을_내려준다() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 11, 14, 30);
        when(incidentMapper.selectDashboardSummary(anyLong(), any(), any(), any(), any()))
                .thenReturn(new DashboardStatsResponse());
        when(incidentMapper.countCreatedByDay(any(), any()))
                .thenReturn(List.of(dailyCount("2026-11-05", 2), dailyCount("2026-11-11", 3)));
        when(incidentMapper.countClosedByDay(any(), any()))
                .thenReturn(List.of(dailyCount("2026-11-10", 1), dailyCount("2026-11-11", 4)));

        List<DailyIncidentStat> daily = incidentService.getDashboardStats(now, 10L).getDaily();

        assertEquals(7, daily.size());
        assertEquals(new DailyIncidentStat("2026-11-05", 2, 0), daily.get(0));
        assertEquals(new DailyIncidentStat("2026-11-06", 0, 0), daily.get(1));
        assertEquals(new DailyIncidentStat("2026-11-10", 0, 1), daily.get(5));
        assertEquals(new DailyIncidentStat("2026-11-11", 3, 4), daily.get(6));
    }

    @Test
    void 대시보드_통계는_화면에서_보낸_현재시각으로_날짜경계를_잡는다() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 11, 0, 10);
        when(incidentMapper.selectDashboardSummary(anyLong(), any(), any(), any(), any()))
                .thenReturn(new DashboardStatsResponse());

        incidentService.getDashboardStats(now, 10L);

        verify(incidentMapper).selectDashboardSummary(
                10L,
                LocalDateTime.of(2026, 11, 11, 0, 0),
                LocalDateTime.of(2026, 11, 12, 0, 0),
                LocalDateTime.of(2026, 11, 10, 0, 0),
                LocalDateTime.of(2026, 11, 8, 0, 10));
        verify(incidentMapper).countCreatedByDay(
                LocalDateTime.of(2026, 11, 5, 0, 0),
                LocalDateTime.of(2026, 11, 12, 0, 0));
        verify(incidentMapper).countClosedByDay(
                LocalDateTime.of(2026, 11, 5, 0, 0),
                LocalDateTime.of(2026, 11, 12, 0, 0));
    }

    @Test
    void 사건이_없어도_대시보드_통계는_0건으로_내려준다() {
        when(incidentMapper.selectDashboardSummary(anyLong(), any(), any(), any(), any())).thenReturn(null);

        DashboardStatsResponse stats = incidentService.getDashboardStats(LocalDateTime.of(2026, 11, 11, 9, 0), 10L);

        assertEquals(0, stats.getTotal());
        assertEquals(7, stats.getDaily().size());
        assertEquals(0, stats.getDaily().get(6).resolved());
    }

    @Test
    void 유형별통계는_고정순서_7개로_내려주고_목록에_없는_유형은_기타로_합친다() {
        when(incidentMapper.countByTypeForMonth(
                LocalDateTime.of(2026, 10, 1, 0, 0),
                LocalDateTime.of(2026, 11, 1, 0, 0),
                LocalDateTime.of(2026, 12, 1, 0, 0)))
                .thenReturn(List.of(
                        new TypeMonthlyCount("화재", 3, 1),
                        new TypeMonthlyCount("태풍", 2, 0),
                        new TypeMonthlyCount("기타", 1, 2)));

        List<TypeMonthlyCount> result = incidentService.getMonthlyTypeStats(YearMonth.of(2026, 11));

        assertEquals(List.of("침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"),
                result.stream().map(TypeMonthlyCount::getDisasterType).toList());
        assertEquals(new TypeMonthlyCount("침수", 0, 0), result.get(0));
        assertEquals(new TypeMonthlyCount("화재", 3, 1), result.get(1));
        assertEquals(new TypeMonthlyCount("기타", 3, 2), result.get(6));
    }

    @Test
    void 사건검색에서_ALL과_빈검색어는_조건없음으로_넘긴다() {
        IncidentSearchCondition condition = searchAndCaptureCondition(
                new IncidentSearchRequest("   ", "ALL", "ALL", "ALL", "ALL", null, null, "newest", 1, 5, null));

        assertNull(condition.getQ());
        assertNull(condition.getStatus());
        assertNull(condition.getType());
        assertNull(condition.getRegion());
        assertNull(condition.getSeverity());
        assertNull(condition.getFromStart());
        assertNull(condition.getToEnd());
        assertFalse(condition.isOldestFirst());
    }

    @Test
    void 사건검색어는_소문자로_바꾸고_LIKE_특수문자를_이스케이프한다() {
        IncidentSearchCondition condition = searchAndCaptureCondition(
                new IncidentSearchRequest(" A_100%침수 ", null, null, null, null, null, null, null, null, null, null));

        assertEquals("a\\_100\\%침수", condition.getQ());
    }

    @Test
    void 사건검색_기간은_시작일_0시부터_종료일_다음날_0시_미만으로_잡는다() {
        IncidentSearchCondition condition = searchAndCaptureCondition(new IncidentSearchRequest(
                null, null, null, null, null, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 11),
                "oldest", null, null, null));

        assertEquals(LocalDateTime.of(2026, 11, 1, 0, 0), condition.getFromStart());
        assertEquals(LocalDateTime.of(2026, 11, 12, 0, 0), condition.getToEnd());
        assertTrue(condition.isOldestFirst());
    }

    @Test
    void 사건검색_페이지와_크기는_허용범위로_보정한다() {
        IncidentSearchCondition third = searchAndCaptureCondition(
                new IncidentSearchRequest(null, null, null, null, null, null, null, null, 3, 5, null));
        assertEquals(10, third.getOffset());
        assertEquals(5, third.getSize());

        IncidentSearchCondition tooLarge = searchAndCaptureCondition(
                new IncidentSearchRequest(null, null, null, null, null, null, null, null, 0, 1000, null));
        assertEquals(0, tooLarge.getOffset());
        assertEquals(50, tooLarge.getSize());
    }

    @Test
    void 상태를_고르면_전체건수는_그_상태의_건수를_쓴다() {
        IncidentStatusCounts counts = new IncidentStatusCounts();
        counts.setTotal(10);
        counts.setRespondingCount(3);
        when(incidentMapper.countIncidentsByStatus(any())).thenReturn(counts);

        IncidentPageResponse responding = incidentService.searchIncidents(
                new IncidentSearchRequest(null, "RESPONDING", null, null, null, null, null, null, 1, 5, null));
        IncidentPageResponse all = incidentService.searchIncidents(
                new IncidentSearchRequest(null, "ALL", null, null, null, null, null, null, 1, 5, null));

        assertEquals(3, responding.totalCount());
        assertEquals(10, all.totalCount());
        assertSame(counts, all.statusCounts());
    }

    @Test
    void 선택한_사건_포함여부는_검색어_조건만으로_확인한다() {
        when(incidentMapper.countKeywordMatch("침수", 7L)).thenReturn(0);

        IncidentPageResponse response = incidentService.searchIncidents(
                new IncidentSearchRequest("침수", "CLOSED", "화재", "서울특별시", "HIGH", null, null, null, 1, 5, 7L));

        assertEquals(Boolean.FALSE, response.selectedIncluded());
        verify(incidentMapper).countKeywordMatch("침수", 7L);
    }

    @Test
    void 선택한_사건이_없으면_포함여부를_조회하지_않는다() {
        IncidentPageResponse response = incidentService.searchIncidents(
                new IncidentSearchRequest("침수", null, null, null, null, null, null, null, 1, 5, null));

        assertNull(response.selectedIncluded());
        verify(incidentMapper, never()).countKeywordMatch(any(), any());
    }

    // ================= 7단계: 종료 연동 =================

    @Test
    void 종료_전환은_출고_전_요청_정리를_먼저_하고_그_뒤에_사건을_종료한다() {
        Incident incident = incidentWithStatus("RECOVERING");
        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(10L)).thenReturn(activeStaff());
        when(incidentMapper.closeIncident(1L, "RECOVERING", "조치 완료")).thenReturn(1);

        incidentService.changeStatus(1L, "CLOSED", "조치 완료", 10L, List.of(5L, 6L));

        InOrder order = inOrder(resourceClosureService, incidentMapper);
        order.verify(resourceClosureService).cancelOpenRequestsForClose(1L, "RECOVERING", List.of(5L, 6L), 10L);
        order.verify(incidentMapper).closeIncident(1L, "RECOVERING", "조치 완료");
        order.verify(incidentMapper).insertLog(any());
    }

    @Test
    void 기존_4개_인자_상태변경은_확인_목록_없이_종료_정리를_호출한다() {
        Incident incident = incidentWithStatus("RECOVERING");
        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(10L)).thenReturn(activeStaff());
        when(incidentMapper.closeIncident(1L, "RECOVERING", "조치 완료")).thenReturn(1);

        incidentService.changeStatus(1L, "CLOSED", "조치 완료", 10L);

        verify(resourceClosureService).cancelOpenRequestsForClose(1L, "RECOVERING", null, 10L);
    }

    @Test
    void 종료가_아닌_전환은_종료_정리를_호출하지_않는다() {
        Incident incident = incidentWithStatus("CONFIRMING");
        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(10L)).thenReturn(activeStaff());
        when(incidentMapper.updateStatus(1L, "CONFIRMING", "RESPONDING")).thenReturn(1);

        incidentService.changeStatus(1L, "RESPONDING", "현장 출동", 10L, List.of(5L));

        verifyNoInteractions(resourceClosureService);
        verify(incidentMapper).updateStatus(1L, "CONFIRMING", "RESPONDING");
    }

    @Test
    void 종료_정리가_실패하면_사건을_종료하거나_이력을_남기지_않는다() {
        Incident incident = incidentWithStatus("RECOVERING");
        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(10L)).thenReturn(activeStaff());
        doThrow(new IllegalStateException("확인하지 않은 출고 전 요청이 있어 종료할 수 없습니다."))
                .when(resourceClosureService).cancelOpenRequestsForClose(anyLong(), anyString(), any(), anyLong());

        assertThrows(IllegalStateException.class,
                () -> incidentService.changeStatus(1L, "CLOSED", "조치 완료", 10L, List.of()));

        verify(incidentMapper, never()).closeIncident(anyLong(), anyString(), anyString());
        verify(incidentMapper, never()).insertLog(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void 종료_사유가_없으면_종료_정리를_시작하기_전에_막는다() {
        Incident incident = incidentWithStatus("RECOVERING");
        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(10L)).thenReturn(activeStaff());

        assertThrows(IllegalStateException.class,
                () -> incidentService.changeStatus(1L, "CLOSED", "  ", 10L, List.of(5L)));

        verifyNoInteractions(resourceClosureService);
    }

    @Test
    void 담당자가_아닌_STAFF의_종료_요청은_종료_정리를_호출하지_않는다() {
        Incident incident = incidentWithStatus("RECOVERING");
        when(incidentMapper.findById(1L)).thenReturn(incident);
        when(memberMapper.findById(20L)).thenReturn(activeStaff());

        assertThrows(AccessDeniedException.class,
                () -> incidentService.changeStatus(1L, "CLOSED", "조치 완료", 20L, List.of(5L)));

        verifyNoInteractions(resourceClosureService);
    }

    private Incident incidentWithStatus(String status) {
        Incident incident = new Incident();
        incident.setIncidentId(1L);
        incident.setStatus(status);
        incident.setAssignedStaffId(10L);
        return incident;
    }

    private IncidentSearchCondition searchAndCaptureCondition(IncidentSearchRequest request) {
        clearInvocations(incidentMapper);
        incidentService.searchIncidents(request);
        ArgumentCaptor<IncidentSearchCondition> captor = ArgumentCaptor.forClass(IncidentSearchCondition.class);
        verify(incidentMapper).searchIncidents(captor.capture());
        return captor.getValue();
    }

    private DailyCount dailyCount(String date, int count) {
        DailyCount row = new DailyCount();
        row.setStatDate(date);
        row.setCnt(count);
        return row;
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