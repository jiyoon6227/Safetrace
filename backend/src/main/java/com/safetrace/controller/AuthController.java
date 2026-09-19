package com.safetrace.controller;

import com.safetrace.service.EmailVerificationService;
import com.safetrace.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final MemberService memberService;
    private final EmailVerificationService emailVerificationService;

    // body 예시: { "loginId": "test123", "password": "1234", "name": "곽지윤", "email": "a@b.com" }
    @PostMapping("/signup")
    public Map<String, String> signup(@RequestBody Map<String, String> body) {
        memberService.signup(body.get("loginId"), body.get("password"), body.get("name"), body.get("email"));
        return Map.of("message", "회원가입 완료");
    }

    // body 예시: { "loginId": "test123", "password": "1234" }
    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> body) {
        String token = memberService.login(body.get("loginId"), body.get("password"));
        return Map.of("token", token);
    }

    // 세션 연장 - 만료 전인 기존 토큰으로 호출하면 만료시간만 새로 늘려서 재발급.
    // (프론트의 SessionExpiryModal에서 "연장하기" 버튼 눌렀을 때 호출하는 API)
    //
    // /api/auth/** 는 SecurityConfig에서 permitAll이라 "인증 안 되면 컨트롤러까지 못 옴"이 아니고,
    // JwtAuthenticationFilter는 permitAll 경로에도 그대로 돌아서 유효한 토큰이면 SecurityContext에
    // memberId를 넣어준다. 그래서 여기서 직접 SecurityContext를 확인해서, 인증이 안 돼있으면
    // (토큰 없음/만료/탈퇴 등) 401을 준다 - authFetch가 401을 자동 로그아웃 트리거로 쓰기 때문에
    // 프론트 입장에서는 "연장 실패 = 로그인 만료"로 자연스럽게 처리된다.
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh() {
        // JwtAuthenticationFilter가 유효한 토큰일 때만 SecurityContext에 인증정보를 넣어둠
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long memberId)) {
            // 토큰이 없거나 만료됐거나 이미 무효한 경우 - 연장 불가, 401로 응답
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "세션 연장에 실패했습니다. 다시 로그인해주세요."));
        }
        String token = memberService.reissueToken(memberId); // 만료시간만 새로 늘린 토큰 재발급
        return ResponseEntity.ok(Map.of("token", token));
    }

    // 회원가입 - 이메일 인증코드 발송. body 예시: { "email": "a@b.com" }
    @PostMapping("/email/send-code")
    public Map<String, String> sendVerificationCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일을 입력해주세요.");
        }
        if (memberService.isEmailTaken(email)) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }
        emailVerificationService.sendCode(email);
        return Map.of("message", "인증번호를 발송했습니다.");
    }

    // 회원가입 - 이메일 인증코드 확인. body 예시: { "email": "a@b.com", "code": "123456" }
    // 비밀번호 찾기 2단계(코드 확인)에서도 그대로 재사용한다 - 이메일+코드 검증이라는 로직 자체가 동일함
    @PostMapping("/email/verify-code")
    public Map<String, String> verifyCode(@RequestBody Map<String, String> body) {
        boolean ok = emailVerificationService.verifyCode(body.get("email"), body.get("code"));
        if (!ok) {
            throw new IllegalArgumentException("인증번호가 올바르지 않거나 만료되었습니다.");
        }
        return Map.of("message", "이메일 인증이 완료되었습니다.");
    }

    // 아이디 찾기. body 예시: { "name": "곽지윤", "email": "a@b.com" }
    @PostMapping("/find-id")
    public Map<String, String> findId(@RequestBody Map<String, String> body) {
        memberService.findLoginId(body.get("name"), body.get("email"));
        return Map.of("message", "가입하신 이메일로 아이디를 보내드렸습니다.");
    }

    // 비밀번호 찾기 1단계 - 인증코드 발송. body 예시: { "loginId": "test123", "email": "a@b.com" }
    @PostMapping("/password/send-code")
    public Map<String, String> sendPasswordResetCode(@RequestBody Map<String, String> body) {
        memberService.sendPasswordResetCode(body.get("loginId"), body.get("email"));
        return Map.of("message", "인증번호를 발송했습니다.");
    }

    // 비밀번호 찾기 3단계 - 새 비밀번호로 교체. 이 전에 /api/auth/email/verify-code로 인증부터 완료해야 함.
    // body 예시: { "loginId": "test123", "email": "a@b.com", "newPassword": "1234" }
    @PostMapping("/password/reset")
    public Map<String, String> resetPassword(@RequestBody Map<String, String> body) {
        memberService.resetPassword(body.get("loginId"), body.get("email"), body.get("newPassword"));
        return Map.of("message", "비밀번호가 변경되었습니다.");
    }
}