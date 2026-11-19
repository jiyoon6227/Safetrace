package com.safetrace.service;

import com.safetrace.config.JwtTokenProvider;
import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    private Member member(String loginId, String email) {
        Member member = new Member();
        member.setMemberId(1L);
        member.setLoginId(loginId);
        member.setEmail(email);
        return member;
    }

    // ---- 비밀번호 재설정 -----------------------------------------------------

    @Test
    void 비밀번호재설정_성공하면_인증상태를_사용처리한다() {
        String loginId = "testuser";
        String email = "test@test.com";
        String newPassword = "newPassword123!";

        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));
        when(emailVerificationService.consumeVerified(email)).thenReturn(true);
        when(passwordEncoder.encode(newPassword)).thenReturn("encodedPassword");

        memberService.resetPassword(loginId, email, newPassword);

        verify(memberMapper).updatePassword(1L, "encodedPassword");
        verify(emailVerificationService).consumeVerified(email);
    }

    @Test
    void 이메일인증안하면_비밀번호재설정을막는다() {
        String loginId = "testuser";
        String email = "test@test.com";

        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));
        when(emailVerificationService.consumeVerified(email)).thenReturn(false);

        assertThrows(
                IllegalArgumentException.class,
                () -> memberService.resetPassword(loginId, email, "newPassword123!")
        );

        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
    }

    @Test
    void 인증상태가_만료되었거나_이미_쓰였으면_비밀번호재설정을_막는다() {
        // consumeVerified가 false를 돌려주는 경우 = 10분 만료 또는 이미 한 번 사용됨
        String loginId = "testuser";
        String email = "test@test.com";
        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));
        when(emailVerificationService.consumeVerified(email)).thenReturn(true, false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");

        memberService.resetPassword(loginId, email, "newPassword123!");
        assertThrows(IllegalArgumentException.class,
                () -> memberService.resetPassword(loginId, email, "otherPassword123!"));

        verify(memberMapper).updatePassword(anyLong(), anyString()); // 딱 한 번만 바뀐다
    }

    @Test
    void 규칙에_맞지_않는_새_비밀번호는_인증상태를_쓰기_전에_거절한다() {
        String loginId = "testuser";
        String email = "test@test.com";
        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));

        assertThrows(IllegalArgumentException.class, () -> memberService.resetPassword(loginId, email, "1234"));

        verify(emailVerificationService, never()).consumeVerified(any()); // 인증은 아직 남아 있어 비밀번호만 고쳐 다시 시도 가능
        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
    }

    @Test
    void 회원정보가_다르면_비밀번호재설정에서_인증상태를_쓰지_않는다() {
        when(memberMapper.findByLoginId("testuser")).thenReturn(member("testuser", "real@test.com"));

        assertThrows(IllegalArgumentException.class,
                () -> memberService.resetPassword("testuser", "other@test.com", "newPassword123!"));

        verify(emailVerificationService, never()).consumeVerified(any());
    }

    // ---- 회원가입 ------------------------------------------------------------

    @Test
    void 회원가입_성공하면_인증상태를_사용처리한다() {
        String loginId = "newuser";
        String email = "new@test.com";

        when(memberMapper.findByLoginId(loginId)).thenReturn(null);
        when(memberMapper.findByEmail(email)).thenReturn(null);
        when(emailVerificationService.isVerified(email)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email)).thenReturn(true);
        when(passwordEncoder.encode("password123!")).thenReturn("encodedPassword");

        memberService.signup(loginId, "password123!", "테스트", email);

        verify(memberMapper).insert(any(Member.class));
        verify(emailVerificationService).consumeVerified(email);
    }

    @Test
    void 이메일_인증을_안_했으면_가입을_막는다() {
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified("new@test.com")).thenReturn(false);

        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser", "password123!", "테스트", "new@test.com"));

        verify(memberMapper, never()).insert(any(Member.class));
    }

    @Test
    void 같은_인증으로_동시에_가입하면_한_요청만_통과한다() {
        // isVerified는 둘 다 true로 보이지만(동시 요청), consumeVerified는 한쪽만 true를 받는다
        String email = "new@test.com";
        when(memberMapper.findByLoginId(any())).thenReturn(null);
        when(memberMapper.findByEmail(email)).thenReturn(null);
        when(emailVerificationService.isVerified(email)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email)).thenReturn(true, false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");

        memberService.signup("newuser1", "password123!", "가입자1", email);
        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser2", "password123!", "가입자2", email));

        verify(memberMapper).insert(any(Member.class)); // 1명만 가입된다
    }

    @Test
    void 규칙에_맞지_않는_비밀번호로는_가입할_수_없다() {
        String email = "new@test.com";
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified(email)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "1234", "테스트", email));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "abcdefgh", "테스트", email));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "newuser1234", "테스트", email));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", null, "테스트", email));

        verify(memberMapper, never()).insert(any(Member.class));
        verify(emailVerificationService, never()).consumeVerified(any());
    }

    // ---- 비밀번호 변경 -------------------------------------------------------

    @Test
    void 비밀번호변경_새_비밀번호가_규칙에_맞지_않으면_거절한다() {
        Member found = member("testuser", "test@test.com");
        Member withPassword = member("testuser", "test@test.com");
        withPassword.setPassword("storedHash");
        when(memberMapper.findById(1L)).thenReturn(found);
        when(memberMapper.findByLoginId("testuser")).thenReturn(withPassword);
        when(passwordEncoder.matches("currentPw123", "storedHash")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> memberService.changePassword(1L, "currentPw123", "12345678"));

        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
    }

    @Test
    void 비밀번호변경_규칙에_맞으면_변경된다() {
        Member found = member("testuser", "test@test.com");
        Member withPassword = member("testuser", "test@test.com");
        withPassword.setPassword("storedHash");
        when(memberMapper.findById(1L)).thenReturn(found);
        when(memberMapper.findByLoginId("testuser")).thenReturn(withPassword);
        when(passwordEncoder.matches("currentPw123", "storedHash")).thenReturn(true);
        when(passwordEncoder.encode("newPassword456")).thenReturn("newHash");

        memberService.changePassword(1L, "currentPw123", "newPassword456");

        verify(memberMapper).updatePassword(1L, "newHash");
    }

    @Test
    void 로그인은_예전에_만든_짧은_비밀번호도_허용한다() {
        // 비밀번호 규칙은 가입/변경/재설정에만 적용한다 (기존 계정 로그인이 막히면 안 됨)
        Member stored = member("user1", "u1@test.com");
        stored.setPassword("storedHash");
        stored.setRole("USER");
        stored.setName("이서연");
        when(memberMapper.findByLoginId("user1")).thenReturn(stored);
        when(passwordEncoder.matches("1234", "storedHash")).thenReturn(true);
        when(jwtTokenProvider.generateToken(any(), any(), any(), any())).thenReturn("token");

        assertEquals("token", memberService.login("user1", "1234"));
    }

    // ---- 아이디 찾기 ---------------------------------------------------------

    @Test
    void 아이디찾기는_메일을_보내기_전에_이메일별_발송_횟수를_차감한다() {
        Member found = member("testuser", "test@test.com");
        found.setName("테스터");
        when(memberMapper.findByEmail("test@test.com")).thenReturn(found);

        memberService.findLoginId("테스터", "test@test.com");

        verify(emailVerificationService).reserveMailSend("test@test.com");
        verify(mailService).sendLoginId("test@test.com", "테스터", "testuser");
    }

    @Test
    void 이메일_발송_한도를_넘으면_아이디_안내_메일을_보내지_않는다() {
        Member found = member("testuser", "test@test.com");
        found.setName("테스터");
        when(memberMapper.findByEmail("test@test.com")).thenReturn(found);
        doThrow(new TooManyRequestsException("인증메일 요청이 너무 많습니다.", 600))
                .when(emailVerificationService).reserveMailSend("test@test.com");

        assertThrows(TooManyRequestsException.class, () -> memberService.findLoginId("테스터", "test@test.com"));

        verify(mailService, never()).sendLoginId(anyString(), anyString(), anyString());
    }

    @Test
    void 일치하지_않는_회원정보로는_아이디찾기_발송_횟수를_쓰지_않는다() {
        when(memberMapper.findByEmail("nobody@test.com")).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> memberService.findLoginId("누구", "nobody@test.com"));

        verify(emailVerificationService, never()).reserveMailSend(anyString());
    }
}
