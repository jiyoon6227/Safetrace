package com.safetrace.controller;

import com.safetrace.domain.SafetyCheck;
import com.safetrace.dto.SafetyCheckRespondRequest;
import com.safetrace.service.SafetyCheckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/safety-checks")
@RequiredArgsConstructor
public class SafetyCheckController {

    private final SafetyCheckService safetyCheckService;

    // body 예시: { "targetMemberIds": [2, 5], "incidentId": null }
    //   - incidentId 없이 홈에서 요청하면 null, 사건 상세에서 요청하면 해당 사건 ID
    @PostMapping
    public Map<String, String> request(@RequestBody Map<String, Object> body, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();

        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) body.get("targetMemberIds");
        List<Long> targetMemberIds = rawIds.stream().map(Integer::longValue).toList();

        Long incidentId = body.get("incidentId") != null
                ? Long.valueOf(String.valueOf(body.get("incidentId")))
                : null;

        safetyCheckService.requestSafetyCheck(memberId, targetMemberIds, incidentId);
        return Map.of("message", "안전확인 요청을 보냈습니다.");
    }

    @GetMapping("/sent")
    public List<SafetyCheck> getSent(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return safetyCheckService.getSentRequests(memberId);
    }

    @GetMapping("/received")
    public List<SafetyCheck> getReceived(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return safetyCheckService.getReceivedRequests(memberId);
    }

    // 로그인 상태(사이트 접속 중)에서 응답. body 예시: { "status": "SAFE" }
    @PatchMapping("/{checkId}/respond")
    public Map<String, String> respond(@PathVariable Long checkId, @RequestBody @Valid SafetyCheckRespondRequest request,
                                        Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        safetyCheckService.respond(checkId, request.status(), memberId);
        return Map.of("message", "응답이 저장되었습니다.");
    }

    // 이메일 링크로 들어왔을 때 - 로그인 없이 토큰만으로 응답 (SecurityConfig에서 permitAll 처리됨)
    @PatchMapping("/token/{token}/respond")
    public Map<String, String> respondByToken(@PathVariable String token, @RequestBody Map<String, String> body) {
        safetyCheckService.respondByToken(token, body.get("status"));
        return Map.of("message", "응답이 저장되었습니다.");
    }
}
