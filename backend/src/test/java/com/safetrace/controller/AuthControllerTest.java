package com.safetrace.controller;

import com.safetrace.config.GlobalExceptionHandler;
import com.safetrace.service.AuthAttemptLimiter;
import com.safetrace.service.EmailVerificationService;
import com.safetrace.service.MemberService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 로그인 시도 제한과 인증메일 IP 제한이 실제 HTTP 응답(429)까지 이어지는지 확인한다 (DB·Spring 컨텍스트 없이)
class AuthControllerTest {

    private MemberService memberService;
    private EmailVerificationService emailVerificationService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        memberService = mock(MemberService.class);
        emailVerificationService = mock(EmailVerificationService.class);
        // 테스트마다 새 제한기를 쓴다 (횟수가 다른 테스트로 넘어가지 않게)
        AuthController controller = new AuthController(memberService, emailVerificationService, new AuthAttemptLimiter());
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        when(memberService.login("user1", "wrong")).thenThrow(new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다."));
        when(memberService.login("user1", "right")).thenReturn("token-value");
    }

    private RequestPostProcessor fromIp(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    private ResultActions login(String loginId, String password, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}")
                .with(fromIp(ip)));
    }

    private ResultActions sendCode(String email, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/email/send-code")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}")
                .with(fromIp(ip)));
    }

    @Test
    void 로그인_성공은_토큰을_돌려준다() throws Exception {
        login("user1", "right", "203.0.113.10")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("token-value"));
    }

    @Test
    void 로그인_5회_실패_뒤_6번째는_429로_막고_비밀번호_확인도_하지_않는다() throws Exception {
        for (int i = 0; i < 5; i++) {
            login("user1", "wrong", "203.0.113.10").andExpect(status().isBadRequest());
        }

        login("user1", "wrong", "203.0.113.10")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("로그인 시도가 너무 많습니다")));

        verify(memberService, times(5)).login("user1", "wrong");
    }

    @Test
    void 차단된_동안에는_맞는_비밀번호도_거절한다() throws Exception {
        for (int i = 0; i < 5; i++) {
            login("user1", "wrong", "203.0.113.10");
        }

        login("user1", "right", "203.0.113.10").andExpect(status().isTooManyRequests());

        verify(memberService, never()).login("user1", "right");
    }

    @Test
    void 로그인에_성공하면_실패_횟수가_초기화된다() throws Exception {
        for (int i = 0; i < 4; i++) {
            login("user1", "wrong", "203.0.113.10").andExpect(status().isBadRequest());
        }
        login("user1", "right", "203.0.113.10").andExpect(status().isOk());

        for (int i = 0; i < 5; i++) {
            login("user1", "wrong", "203.0.113.10").andExpect(status().isBadRequest());
        }
        login("user1", "wrong", "203.0.113.10").andExpect(status().isTooManyRequests());
    }

    @Test
    void 다른_IP에서는_같은_아이디로_계속_로그인할_수_있다() throws Exception {
        for (int i = 0; i < 6; i++) {
            login("user1", "wrong", "198.51.100.1");
        }

        login("user1", "right", "203.0.113.77").andExpect(status().isOk());
    }

    @Test
    void 요청에_넣은_X_Forwarded_For_헤더로_IP_제한을_피할_수_없다() throws Exception {
        // 서버는 getRemoteAddr()만 쓴다. 직접 보낸 헤더 값을 바꿔도 같은 IP로 센다.
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"loginId\":\"user1\",\"password\":\"wrong\"}")
                    .header("X-Forwarded-For", "10.0.0." + i)
                    .with(fromIp("203.0.113.10")));
        }

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"user1\",\"password\":\"wrong\"}")
                        .header("X-Forwarded-For", "10.0.0.99")
                        .with(fromIp("203.0.113.10")))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void 인증메일_요청은_같은_IP에서_1시간에_10회까지만_받는다() throws Exception {
        for (int i = 0; i < 10; i++) {
            sendCode("user" + i + "@test.com", "203.0.113.10").andExpect(status().isOk());
        }

        sendCode("user10@test.com", "203.0.113.10")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("인증메일 요청이 너무 많습니다")));

        verify(emailVerificationService, times(10)).sendCode(anyString());
        sendCode("another@test.com", "198.51.100.5").andExpect(status().isOk());
    }

    @Test
    void 아이디찾기와_비밀번호찾기_메일도_같은_IP_한도를_함께_쓴다() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/find-id")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"테스터\",\"email\":\"a@test.com\"}")
                    .with(fromIp("203.0.113.10"))).andExpect(status().isOk());
            mockMvc.perform(post("/api/auth/password/send-code")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"loginId\":\"user1\",\"email\":\"a@test.com\"}")
                    .with(fromIp("203.0.113.10"))).andExpect(status().isOk());
        }

        sendCode("b@test.com", "203.0.113.10").andExpect(status().isTooManyRequests());
        verify(memberService, never()).isEmailTaken(any());
    }

    @Test
    void 이메일_재발송_대기_중이면_서비스의_429가_그대로_응답된다() throws Exception {
        org.mockito.Mockito.doThrow(new com.safetrace.service.TooManyRequestsException("인증번호는 30초 후에 다시 요청할 수 있습니다.", 30))
                .when(emailVerificationService).sendCode("user@test.com");

        sendCode("user@test.com", "203.0.113.10")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "30"))
                .andExpect(jsonPath("$.message").value("인증번호는 30초 후에 다시 요청할 수 있습니다."));
    }

    // ---- 이메일 인증 토큰 ------------------------------------------------------

    @Test
    void 인증코드가_맞으면_인증_토큰을_내려준다() throws Exception {
        when(emailVerificationService.verifyCode("user@test.com", "123456")).thenReturn("issued-token");

        mockMvc.perform(post("/api/auth/email/verify-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@test.com\",\"code\":\"123456\"}")
                        .with(fromIp("203.0.113.10")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("이메일 인증이 완료되었습니다."))
                .andExpect(jsonPath("$.verificationToken").value("issued-token"));
    }

    @Test
    void 인증코드가_틀리면_토큰_없이_400으로_응답한다() throws Exception {
        when(emailVerificationService.verifyCode("user@test.com", "000000")).thenReturn(null);

        mockMvc.perform(post("/api/auth/email/verify-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@test.com\",\"code\":\"000000\"}")
                        .with(fromIp("203.0.113.10")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.verificationToken").doesNotExist());
    }

    @Test
    void 가입_요청의_인증_토큰이_서비스로_전달된다() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"newuser\",\"password\":\"password123!\",\"name\":\"테스터\","
                                + "\"email\":\"new@test.com\",\"verificationToken\":\"issued-token\"}")
                        .with(fromIp("203.0.113.10")))
                .andExpect(status().isOk());

        verify(memberService).signup("newuser", "password123!", "테스터", "new@test.com", "issued-token");
    }

    @Test
    void 토큰_없이_보낸_가입_요청은_토큰_null로_전달되어_서비스가_거절한다() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("이메일 인증을 먼저 완료해주세요."))
                .when(memberService).signup("newuser", "password123!", "테스터", "new@test.com", null);

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"newuser\",\"password\":\"password123!\",\"name\":\"테스터\","
                                + "\"email\":\"new@test.com\"}")
                        .with(fromIp("203.0.113.10")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이메일 인증을 먼저 완료해주세요."));
    }

    @Test
    void 비밀번호_재설정_요청의_인증_토큰이_서비스로_전달된다() throws Exception {
        mockMvc.perform(post("/api/auth/password/reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"user1\",\"email\":\"a@test.com\","
                                + "\"newPassword\":\"newPassword123!\",\"verificationToken\":\"issued-token\"}")
                        .with(fromIp("203.0.113.10")))
                .andExpect(status().isOk());

        verify(memberService).resetPassword("user1", "a@test.com", "newPassword123!", "issued-token");
    }

    @Test
    void 이메일_형식이_올바르지_않으면_인증코드를_보내지_않는다() throws Exception {
        sendCode("not-an-email", "203.0.113.10").andExpect(status().isBadRequest());
        sendCode("", "203.0.113.10").andExpect(status().isBadRequest());

        verify(emailVerificationService, never()).sendCode(anyString());
    }
}
