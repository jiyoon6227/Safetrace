package com.safetrace.controller;

import com.safetrace.domain.FamilyRelation;
import com.safetrace.dto.FamilyMemberSearchResponse;
import com.safetrace.service.FamilyRelationService;
import com.safetrace.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/family")
@RequiredArgsConstructor
public class FamilyController {

    private final FamilyRelationService familyRelationService;
    private final MemberService memberService;

    // 가족 등록할 상대방 검색 - 로그인ID 부분일치
    @GetMapping("/search")
    public List<FamilyMemberSearchResponse> search(@RequestParam String loginId, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return memberService.searchMembers(loginId, memberId);
    }

    // body 예시: { "targetLoginId": "citizen01", "relationType": "배우자" }
    @PostMapping("/request")
    public Map<String, String> sendRequest(@RequestBody Map<String, String> body, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        familyRelationService.sendRequest(memberId, body.get("targetLoginId"), body.get("relationType"));
        return Map.of("message", "가족 등록 요청을 보냈습니다.");
    }

    @GetMapping("/sent")
    public List<FamilyRelation> getSent(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return familyRelationService.getSentRequests(memberId);
    }

    @GetMapping("/received")
    public List<FamilyRelation> getReceived(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return familyRelationService.getReceivedRequests(memberId);
    }

    // 실제 연결된(양쪽 다 ACCEPTED) 가족 목록 - 안전확인 요청 대상 선택 화면에서 사용
    @GetMapping
    public List<FamilyRelation> getAccepted(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return familyRelationService.getAcceptedFamilies(memberId);
    }

    @PatchMapping("/{relationId}/accept")
    public Map<String, String> accept(@PathVariable Long relationId, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        familyRelationService.accept(relationId, memberId);
        return Map.of("message", "가족 등록을 수락했습니다.");
    }

    @DeleteMapping("/{relationId}")
    public Map<String, String> delete(@PathVariable Long relationId, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        familyRelationService.delete(relationId, memberId);
        return Map.of("message", "가족 연결이 해제되었습니다.");
    }
}