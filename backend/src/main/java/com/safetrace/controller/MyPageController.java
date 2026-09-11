package com.safetrace.controller;

import com.safetrace.domain.Member;
import com.safetrace.domain.MemberRegion;
import com.safetrace.service.MemberRegionService;
import com.safetrace.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
public class MyPageController {

    private final MemberService memberService;
    private final MemberRegionService memberRegionService;

    @GetMapping
    public Member getMyInfo(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return memberService.getMyInfo(memberId);
    }

    // body 예시: { "email": "a@b.com", "phone": "010-1234-5678", "address": "대전 유성구", "addressDetail": "...", "profileImageUrl": "/uploads/xxx.jpg" }
    @PutMapping
    public Map<String, String> updateMyInfo(@RequestBody Member updates, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        memberService.updateMyInfo(memberId, updates);
        return Map.of("message", "내정보가 수정되었습니다.");
    }

    // body 예시: { "emailNotifyEnabled": "Y", "disasterNotifyEnabled": "N", "reportNotifyEnabled": "Y" }
    @PutMapping("/notifications")
    public Map<String, String> updateNotifications(@RequestBody Member settings, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        memberService.updateNotificationSettings(memberId, settings);
        return Map.of("message", "알림 설정이 저장되었습니다.");
    }

    // body 예시: { "currentPassword": "1234", "newPassword": "5678" }
    @PutMapping("/password")
    public Map<String, String> changePassword(@RequestBody Map<String, String> body, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        memberService.changePassword(memberId, body.get("currentPassword"), body.get("newPassword"));
        return Map.of("message", "비밀번호가 변경되었습니다.");
    }

    @DeleteMapping
    public Map<String, String> withdraw(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        memberService.withdraw(memberId);
        return Map.of("message", "탈퇴 처리되었습니다.");
    }

    @GetMapping("/regions")
    public List<MemberRegion> getMyRegions(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return memberRegionService.getMyRegions(memberId);
    }

    // body 예시: { "regionName": "대전광역시 유성구 어은동 123-4", "latitude": 36.3625, "longitude": 127.3453, "regionLabel": "우리집", "isPrimary": true }
    @PostMapping("/regions")
    public Map<String, String> addRegion(@RequestBody Map<String, Object> body, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        String regionName = (String) body.get("regionName");
        Double latitude = body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null;
        Double longitude = body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;
        String regionLabel = (String) body.get("regionLabel");
        boolean isPrimary = Boolean.TRUE.equals(body.get("isPrimary"));
        memberRegionService.addRegion(memberId, regionName, latitude, longitude, regionLabel, isPrimary);
        return Map.of("message", "관심지역이 등록되었습니다.");
    }

    @DeleteMapping("/regions/{memberRegionId}")
    public Map<String, String> deleteRegion(@PathVariable Long memberRegionId, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        memberRegionService.deleteRegion(memberRegionId, memberId);
        return Map.of("message", "관심지역이 삭제되었습니다.");
    }

    // 대표 지역 변경
    @PatchMapping("/regions/{memberRegionId}/primary")
    public Map<String, String> setPrimaryRegion(@PathVariable Long memberRegionId, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        memberRegionService.setPrimaryRegion(memberRegionId, memberId);
        return Map.of("message", "대표 지역으로 설정되었습니다.");
    }
}