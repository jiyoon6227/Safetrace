package com.safetrace.controller;

import com.safetrace.service.AuthAttemptLimiter;
import com.safetrace.service.EmailVerificationService;
import com.safetrace.service.MemberService;
import com.safetrace.util.MemberInputValidator;
import jakarta.servlet.http.HttpServletRequest;
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
    private final AuthAttemptLimiter authAttemptLimiter;

    // body 예시: { "loginId": "test123", "password": "abcd1234", "name": "곽지윤", "email": "a@b.com", "verificationToken": "..." }
    // verificationToken은 /api/auth/email/verify-code 응답으로 받은 값
    @PostMapping("/signup")
    public Map<String, String> signup(@RequestBody Map<String, String> body) {
        memberService.signup(body.get("loginId"), body.get("password"), body.get("name"), body.get("email"),
                body.get("verificationToken"));
        return Map.of("message", "회원가입 완료");
    }

    // body 예시: { "loginId": "test123", "password": "1234" }
    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String loginId = body.get("loginId");
        String ip = clientIp(request);
        // 비밀번호를 확인하기 전에 시도 횟수부터 차감 (동시에 여러 요청을 보내도 한도를 넘길 수 없음). 성공하면 초기화.
        authAttemptLimiter.acquireLogin(loginId, ip);
        String token = memberService.login(loginId, body.get("password"));
        authAttemptLimiter.resetLogin(loginId, ip);
        return Map.of("token", token);
    }

    // 로그아웃 - 이 회원의 JWT를 서버에서도 전부 무효로 만든다
    // /api/auth/**는 permitAll이므로 인증 여부 직접 확인, 미인증이어도 성공으로 응답
    @PostMapping("/logout")
    public Map<String, String> logout() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long memberId) {
            memberService.logout(memberId);
        }
        return Map.of("message", "로그아웃되었습니다.");
    }

    // 세션 연장 - 만료 전인 기존 토큰으로 호출하면 만료시간만 새로 늘려서 재발급.
    // 로그인한 시각부터 jwt.max-session-ms가 지나면 더 늘려주지 않고 409로 응답한다 (401이 아니라서 프론트가 자동 로그아웃시키지는 않는다)
    // (프론트의 SessionExpiryModal에서 "연장하기" 버튼 눌렀을 때 호출하는 API)
    // /api/auth/**는 permitAll이므로 인증 여부 직접 확인, 미인증 시 401 (프론트 authFetch의 자동 로그아웃 트리거)
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(HttpServletRequest request) {
        // JwtAuthenticationFilter가 유효한 토큰일 때만 SecurityContext에 인증정보를 넣어둠
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long memberId)) {
            // 토큰이 없거나 만료됐거나 이미 무효한 경우 - 연장 불가, 401로 응답
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "세션 연장에 실패했습니다. 다시 로그인해주세요."));
        }
        // 필터를 통과해 인증됐다면 Bearer 토큰이 반드시 있다
        String currentToken = request.getHeader("Authorization").substring(7);
        String token = memberService.refreshToken(memberId, currentToken);
        return ResponseEntity.ok(Map.of("token", token));
    }

    // 회원가입 - 이메일 인증코드 발송. body 예시: { "email": "a@b.com" }
    @PostMapping("/email/send-code")
    public Map<String, String> sendVerificationCode(@RequestBody Map<String, String> body, HttpServletRequest request) {
        authAttemptLimiter.acquireMail(clientIp(request));
        String email = body.get("email");
        MemberInputValidator.validateEmail(email);
        if (memberService.isEmailTaken(email)) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }
        emailVerificationService.sendCode(email);
        return Map.of("message", "인증번호를 발송했습니다.");
    }

    // 회원가입 - 이메일 인증코드 확인. body 예시: { "email": "a@b.com", "code": "123456" }
    // 성공하면 verificationToken을 내려주고, 가입/비밀번호 재설정 때 이 값을 같이 보내야 한다.
    // 비밀번호 찾기 2단계(코드 확인)에서도 사용
    @PostMapping("/email/verify-code")
    public Map<String, String> verifyCode(@RequestBody Map<String, String> body) {
        String verificationToken = emailVerificationService.verifyCode(body.get("email"), body.get("code"));
        if (verificationToken == null) {
            throw new IllegalArgumentException("인증번호가 올바르지 않거나 만료되었습니다. 5회 이상 틀렸다면 인증번호를 다시 받아주세요.");
        }
        return Map.of("message", "이메일 인증이 완료되었습니다.", "verificationToken", verificationToken);
    }

    // 아이디 찾기. body 예시: { "name": "곽지윤", "email": "a@b.com" }
    @PostMapping("/find-id")
    public Map<String, String> findId(@RequestBody Map<String, String> body, HttpServletRequest request) {
        authAttemptLimiter.acquireMail(clientIp(request));
        memberService.findLoginId(body.get("name"), body.get("email"));
        return Map.of("message", "가입하신 이메일로 아이디를 보내드렸습니다.");
    }

    // 비밀번호 찾기 1단계 - 인증코드 발송. body 예시: { "loginId": "test123", "email": "a@b.com" }
    @PostMapping("/password/send-code")
    public Map<String, String> sendPasswordResetCode(@RequestBody Map<String, String> body, HttpServletRequest request) {
        authAttemptLimiter.acquireMail(clientIp(request));
        memberService.sendPasswordResetCode(body.get("loginId"), body.get("email"));
        return Map.of("message", "인증번호를 발송했습니다.");
    }

    // 비밀번호 찾기 3단계 - 새 비밀번호로 교체. 이 전에 /api/auth/email/verify-code로 인증부터 완료해야 함.
    // body 예시: { "loginId": "test123", "email": "a@b.com", "newPassword": "abcd1234", "verificationToken": "..." }
    @PostMapping("/password/reset")
    public Map<String, String> resetPassword(@RequestBody Map<String, String> body) {
        memberService.resetPassword(body.get("loginId"), body.get("email"), body.get("newPassword"),
                body.get("verificationToken"));
        return Map.of("message", "비밀번호가 변경되었습니다.");
    }

    // 클라이언트 IP. 프록시(nginx) 뒤에서는 server.forward-headers-strategy=native 설정 덕분에
    // 신뢰하는 프록시가 붙여준 X-Forwarded-For 값이 getRemoteAddr()에 반영된다.
    // 직접 보낸 X-Forwarded-For 헤더를 여기서 따로 읽지 않는 이유: 헤더를 위조해 IP 제한을 피할 수 있기 때문.
    private static String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}