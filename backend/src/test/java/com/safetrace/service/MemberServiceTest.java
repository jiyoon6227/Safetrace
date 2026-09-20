package com.safetrace.service;

import com.safetrace.config.JwtTokenProvider;
import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class MemberServiceTest {

    private MemberMapper memberMapper;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider jwtTokenProvider;
    private EmailVerificationService emailVerificationService;
    private MailService mailService;

    private MemberService memberService;

    @BeforeEach
    void setUp() {
        memberMapper = mock(MemberMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        emailVerificationService = mock(EmailVerificationService.class);
        mailService = mock(MailService.class);

        memberService = new MemberService(
                memberMapper,
                passwordEncoder,
                jwtTokenProvider,
                emailVerificationService,
                mailService
        );
    }

    @Test
    void 비밀번호재설정_성공하면_인증상태를삭제한다() {
        String loginId = "testuser";
        String email = "test@test.com";
        String newPassword = "newPassword123!";

        Member member = new Member();
        member.setMemberId(1L);
        member.setLoginId(loginId);
        member.setEmail(email);

        when(memberMapper.findByLoginId(loginId)).thenReturn(member);
        when(emailVerificationService.isVerified(email)).thenReturn(true);
        when(passwordEncoder.encode(newPassword)).thenReturn("encodedPassword");

        memberService.resetPassword(loginId, email, newPassword);

        verify(memberMapper).updatePassword(1L, "encodedPassword");
        verify(emailVerificationService).clearVerified(email);
    }

    @Test
    void 이메일인증안하면_비밀번호재설정을막는다() {
        String loginId = "testuser";
        String email = "test@test.com";

        Member member = new Member();
        member.setMemberId(1L);
        member.setLoginId(loginId);
        member.setEmail(email);

        when(memberMapper.findByLoginId(loginId)).thenReturn(member);
        when(emailVerificationService.isVerified(email)).thenReturn(false);

        assertThrows(
                IllegalArgumentException.class,
                () -> memberService.resetPassword(
                        loginId,
                        email,
                        "newPassword123!"
                )
        );

        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
        verify(emailVerificationService, never()).clearVerified(email);
    }

    @Test
    void 회원가입_성공하면_인증상태를삭제한다() {
        String loginId = "newuser";
        String email = "new@test.com";

        when(memberMapper.findByLoginId(loginId)).thenReturn(null);
        when(memberMapper.findByEmail(email)).thenReturn(null);
        when(emailVerificationService.isVerified(email)).thenReturn(true);
        when(passwordEncoder.encode("password123!")).thenReturn("encodedPassword");

        memberService.signup(
                loginId,
                "password123!",
                "테스트",
                email
        );

        verify(memberMapper).insert(any(Member.class));
        verify(emailVerificationService).clearVerified(email);
    }
}