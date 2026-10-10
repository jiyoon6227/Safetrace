package com.safetrace.service;

import com.safetrace.domain.FamilyRelation;
import com.safetrace.domain.Member;
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
    private FamilyRelationMapper familyRelationMapper;
    private MemberMapper memberMapper;
    private MailService mailService;
    private SafetyCheckWebSocketHandler webSocketHandler;

    private SafetyCheckService safetyCheckService;

    @BeforeEach
    void setUp() {
        safetyCheckMapper = mock(SafetyCheckMapper.class);
        familyRelationMapper = mock(FamilyRelationMapper.class);
        memberMapper = mock(MemberMapper.class);
        mailService = mock(MailService.class);
        webSocketHandler = mock(SafetyCheckWebSocketHandler.class);

        safetyCheckService = new SafetyCheckService(
                safetyCheckMapper,
                familyRelationMapper,
                memberMapper,
                mock(IncidentMapper.class),
                mailService,
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

    @Test
    void 요청_저장중_실패하면_메일과_알림을_보내지_않는다() {
        Member requester = new Member();
        requester.setMemberId(1L);
        requester.setName("요청자");
        requester.setIsWithdrawn("N");

        when(memberMapper.findById(1L)).thenReturn(requester);
        when(memberMapper.findById(2L)).thenReturn(familyMember(2L));
        when(memberMapper.findById(3L)).thenReturn(familyMember(3L));
        when(familyRelationMapper.findAcceptedFamilies(1L))
                .thenReturn(List.of(relation(2L), relation(3L)));

        // 첫 번째 가족은 저장 성공, 두 번째 가족 저장에서 DB 오류
        doNothing()
                .doThrow(new RuntimeException("DB 오류"))
                .when(safetyCheckMapper).insert(any());

        assertThrows(
                RuntimeException.class,
                () -> safetyCheckService.requestSafetyCheck(1L, List.of(2L, 3L), null)
        );

        // 전체가 취소되는 상황이니, 먼저 저장됐던 첫 번째 가족에게도 메일·알림이 나가면 안 된다
        verify(mailService, never()).sendSafetyCheckRequest(any(), any(), any(), any());
        verify(webSocketHandler, never()).broadcastRequested(any());
    }

    private Member familyMember(Long id) {
        Member member = new Member();
        member.setMemberId(id);
        member.setIsWithdrawn("N");
        member.setEmailNotifyEnabled("Y");
        member.setEmail("family" + id + "@example.com");
        return member;
    }

    private FamilyRelation relation(Long familyMemberId) {
        FamilyRelation relation = new FamilyRelation();
        relation.setFamilyMemberId(familyMemberId);
        return relation;
    }
}