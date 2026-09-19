package com.safetrace.service;

import com.safetrace.domain.FamilyRelation;
import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.SafetyCheck;
import com.safetrace.mapper.FamilyRelationMapper;
import com.safetrace.mapper.IncidentMapper;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.SafetyCheckMapper;
import com.safetrace.websocket.SafetyCheckWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SafetyCheckService {

    private final SafetyCheckMapper safetyCheckMapper;
    private final FamilyRelationMapper familyRelationMapper;
    private final MemberMapper memberMapper;
    private final IncidentMapper incidentMapper;
    private final MailService mailService;
    private final SafetyCheckWebSocketHandler webSocketHandler;

    @Value("${app.safety-check-token-expiry-hours}")
    private long tokenExpiryHours;

    // 안전확인 요청 생성.
    // 보안상 프론트에서 넘어온 targetMemberIds를 그대로 신뢰하지 않고,
    // 서버에서 "요청자와 ACCEPTED 상태의 가족인지" 반드시 다시 검증한다.
    // 검증이 하나라도 실패하면 요청 전체를 생성하지 않도록 트랜잭션으로 묶는다.
    @Transactional
    public void requestSafetyCheck(Long requesterId, List<Long> targetMemberIds, Long incidentId) {
        if (requesterId == null) {
            throw new IllegalArgumentException("로그인 정보가 올바르지 않습니다.");
        }

        if (targetMemberIds == null || targetMemberIds.isEmpty()) {
            throw new IllegalArgumentException("안전확인을 요청할 가족을 선택해주세요.");
        }

        Member requester = memberMapper.findById(requesterId);
        if (requester == null || "Y".equals(requester.getIsWithdrawn())) {
            throw new IllegalArgumentException("요청자 정보를 확인할 수 없습니다.");
        }

        // 중복 ID 제거 + null 제거
        List<Long> uniqueTargetIds = targetMemberIds.stream()
                .filter(id -> id != null)
                .distinct()
                .toList();

        if (uniqueTargetIds.isEmpty()) {
            throw new IllegalArgumentException("안전확인을 요청할 가족을 선택해주세요.");
        }

        // findAcceptedFamilies()는 관계 방향과 상관없이
        // 현재 로그인 회원 기준으로 상대방 ID를 familyMemberId에 담아 반환한다.
        var acceptedFamilyIds = familyRelationMapper.findAcceptedFamilies(requesterId).stream()
                .map(FamilyRelation::getFamilyMemberId)
                .collect(Collectors.toSet());

        // 모든 대상자를 먼저 검증한다.
        // 한 명이라도 가족이 아니면 그 앞 사람 요청까지 일부 저장되는 일을 막는다.
        Map<Long, Member> targetMembers = new LinkedHashMap<>();

        for (Long targetId : uniqueTargetIds) {
            if (requesterId.equals(targetId)) {
                throw new IllegalArgumentException("본인에게는 안전확인을 요청할 수 없습니다.");
            }

            if (!acceptedFamilyIds.contains(targetId)) {
                throw new IllegalArgumentException("수락된 가족에게만 안전확인을 요청할 수 있습니다.");
            }

            Member target = memberMapper.findById(targetId);
            if (target == null || "Y".equals(target.getIsWithdrawn())) {
                throw new IllegalArgumentException("탈퇴했거나 존재하지 않는 가족에게는 안전확인을 요청할 수 없습니다.");
            }

            targetMembers.put(targetId, target);
        }

        String incidentTitle = null;
        if (incidentId != null) {
            Incident incident = incidentMapper.findById(incidentId);
            if (incident == null) {
                throw new IllegalArgumentException("존재하지 않는 사건입니다.");
            }
            incidentTitle = incident.getTitle();
        }

        // 위 검증이 모두 통과한 뒤에만 실제 요청을 생성한다.
        for (Long targetId : uniqueTargetIds) {
            Member target = targetMembers.get(targetId);

            SafetyCheck check = new SafetyCheck();
            check.setRequesterId(requesterId);
            check.setTargetMemberId(targetId);
            check.setIncidentId(incidentId);
            check.setToken(UUID.randomUUID().toString());
            check.setTokenExpiresAt(LocalDateTime.now().plusHours(tokenExpiryHours));

            safetyCheckMapper.insert(check);

            // 사이트에 접속 중인 요청자/대상자에게만 실시간 알림
            webSocketHandler.broadcastRequested(check);

            // 이메일 알림 설정이 켜져있고 이메일이 등록되어 있으면 메일 발송
            // 메일 실패 때문에 DB 요청 생성 자체가 실패하지 않도록 개별 예외 처리
            if ("Y".equals(target.getEmailNotifyEnabled())
                    && target.getEmail() != null
                    && !target.getEmail().isBlank()) {
                try {
                    mailService.sendSafetyCheckRequest(
                            target.getEmail(),
                            requester.getName(),
                            incidentTitle,
                            check.getToken()
                    );
                } catch (Exception e) {
                    System.err.println(
                            "안전확인 이메일 발송 실패 (targetId="
                                    + targetId + "): " + e.getMessage()
                    );
                }
            }
        }
    }

    public List<SafetyCheck> getSentRequests(Long requesterId) {
        return safetyCheckMapper.findSentByRequesterId(requesterId);
    }

    public List<SafetyCheck> getReceivedRequests(Long targetMemberId) {
        return safetyCheckMapper.findReceivedByTargetId(targetMemberId);
    }

    // 로그인 상태(사이트 접속 중)에서 응답
    public void respond(Long checkId, String status, Long currentMemberId) {
        validateStatus(status);

        SafetyCheck check = getReceivedOrThrow(checkId, currentMemberId);

        if (!"PENDING".equals(check.getStatus())) {
            throw new IllegalStateException("이미 응답한 요청입니다.");
        }

        safetyCheckMapper.respond(checkId, status);

        check.setStatus(status);
        webSocketHandler.broadcastResponded(check);
    }

    // 이메일 링크로 응답 (비로그인).
    // 토큰 유효성 + 만료 + 재사용 여부를 여기서 전부 검사한다.
    public void respondByToken(String token, String status) {
        validateStatus(status);

        SafetyCheck check = safetyCheckMapper.findByToken(token);

        if (check == null) {
            throw new IllegalArgumentException("유효하지 않은 링크입니다.");
        }

        if (check.getConfirmedAt() != null) {
            throw new IllegalStateException("이미 응답이 완료된 링크입니다.");
        }

        if (check.getTokenExpiresAt() != null
                && check.getTokenExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("만료된 링크입니다. 로그인 후 다시 응답해주세요.");
        }

        safetyCheckMapper.respondByToken(token, status);

        check.setStatus(status);
        webSocketHandler.broadcastResponded(check);
    }

    private SafetyCheck getReceivedOrThrow(Long checkId, Long currentMemberId) {
        return safetyCheckMapper.findReceivedByTargetId(currentMemberId).stream()
                .filter(c -> c.getCheckId().equals(checkId))
                .findFirst()
                .orElseThrow(
                        () -> new IllegalArgumentException(
                                "응답 권한이 없거나 존재하지 않는 요청입니다."
                        )
                );
    }

    private void validateStatus(String status) {
        if (!"SAFE".equals(status) && !"HELP".equals(status)) {
            throw new IllegalArgumentException("status는 SAFE 또는 HELP만 가능합니다.");
        }
    }
}
