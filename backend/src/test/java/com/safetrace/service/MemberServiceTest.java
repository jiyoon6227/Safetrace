package com.safetrace.service;

import com.safetrace.config.JwtTokenProvider;
import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.websocket.WebSocketSessionRevoker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberServiceTest {

    private static final String TOKEN = "verification-token";

    private MemberMapper memberMapper;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider jwtTokenProvider;
    private EmailVerificationService emailVerificationService;
    private MailService mailService;
    private WebSocketSessionRevoker webSocketSessionRevoker;

    private MemberService memberService;

    @BeforeEach
    void setUp() {
        memberMapper = mock(MemberMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        emailVerificationService = mock(EmailVerificationService.class);
        mailService = mock(MailService.class);
        webSocketSessionRevoker = mock(WebSocketSessionRevoker.class);

        memberService = new MemberService(
                memberMapper,
                passwordEncoder,
                jwtTokenProvider,
                emailVerificationService,
                mailService,
                webSocketSessionRevoker
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
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(true);
        when(passwordEncoder.encode(newPassword)).thenReturn("encodedPassword");

        memberService.resetPassword(loginId, email, newPassword, TOKEN);

        verify(memberMapper).updatePassword(1L, "encodedPassword");
        verify(emailVerificationService).consumeVerified(email, TOKEN);
        verify(webSocketSessionRevoker).revoke(1L);
    }

    @Test
    void 이메일인증안하면_비밀번호재설정을막는다() {
        String loginId = "testuser";
        String email = "test@test.com";

        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(false);

        assertThrows(
                IllegalArgumentException.class,
                () -> memberService.resetPassword(loginId, email, "newPassword123!", TOKEN)
        );

        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
        verify(webSocketSessionRevoker, never()).revoke(anyLong());
    }

    @Test
    void 인증상태가_만료되었거나_이미_쓰였으면_비밀번호재설정을_막는다() {
        // consumeVerified가 false를 돌려주는 경우 = 10분 만료 또는 이미 한 번 사용됨
        String loginId = "testuser";
        String email = "test@test.com";
        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(true, false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");

        memberService.resetPassword(loginId, email, "newPassword123!", TOKEN);
        assertThrows(IllegalArgumentException.class,
                () -> memberService.resetPassword(loginId, email, "otherPassword123!", TOKEN));

        verify(memberMapper).updatePassword(anyLong(), anyString()); // 딱 한 번만 바뀐다
    }

    @Test
    void 규칙에_맞지_않는_새_비밀번호는_인증상태를_쓰기_전에_거절한다() {
        String loginId = "testuser";
        String email = "test@test.com";
        when(memberMapper.findByLoginId(loginId)).thenReturn(member(loginId, email));

        assertThrows(IllegalArgumentException.class, () -> memberService.resetPassword(loginId, email, "1234", TOKEN));

        verify(emailVerificationService, never()).consumeVerified(any(), any()); // 인증은 아직 남아 있어 비밀번호만 고쳐 다시 시도 가능
        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
    }

    @Test
    void 회원정보가_다르면_비밀번호재설정에서_인증상태를_쓰지_않는다() {
        when(memberMapper.findByLoginId("testuser")).thenReturn(member("testuser", "real@test.com"));

        assertThrows(IllegalArgumentException.class,
                () -> memberService.resetPassword("testuser", "other@test.com", "newPassword123!", TOKEN));

        verify(emailVerificationService, never()).consumeVerified(any(), any());
    }

    // ---- 회원가입 ------------------------------------------------------------

    @Test
    void 회원가입_성공하면_인증상태를_사용처리한다() {
        String loginId = "newuser";
        String email = "new@test.com";

        when(memberMapper.findByLoginId(loginId)).thenReturn(null);
        when(memberMapper.findByEmail(email)).thenReturn(null);
        when(emailVerificationService.isVerified(email, TOKEN)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(true);
        when(passwordEncoder.encode("password123!")).thenReturn("encodedPassword");

        memberService.signup(loginId, "password123!", "테스트", email, TOKEN);

        verify(memberMapper).insert(any(Member.class));
        verify(emailVerificationService).consumeVerified(email, TOKEN);
    }

    @Test
    void 이메일_인증을_안_했으면_가입을_막는다() {
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified("new@test.com", TOKEN)).thenReturn(false);

        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser", "password123!", "테스트", "new@test.com", TOKEN));

        verify(memberMapper, never()).insert(any(Member.class));
    }

    @Test
    void 같은_인증으로_동시에_가입하면_한_요청만_통과한다() {
        // isVerified는 둘 다 true로 보이지만(동시 요청), consumeVerified는 한쪽만 true를 받는다
        String email = "new@test.com";
        when(memberMapper.findByLoginId(any())).thenReturn(null);
        when(memberMapper.findByEmail(email)).thenReturn(null);
        when(emailVerificationService.isVerified(email, TOKEN)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(true, false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");

        memberService.signup("newuser1", "password123!", "가입자1", email, TOKEN);
        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser2", "password123!", "가입자2", email, TOKEN));

        verify(memberMapper).insert(any(Member.class)); // 1명만 가입된다
    }

    @Test
    void 규칙에_맞지_않는_비밀번호로는_가입할_수_없다() {
        String email = "new@test.com";
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified(email, TOKEN)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "1234", "테스트", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "abcdefgh", "테스트", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "newuser1234", "테스트", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", null, "테스트", email, TOKEN));

        verify(memberMapper, never()).insert(any(Member.class));
        verify(emailVerificationService, never()).consumeVerified(any(), any());
    }

    @Test
    void 가입은_받은_인증_토큰을_그대로_확인하고_사용처리한다() {
        String email = "new@test.com";
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified(email, "내_토큰")).thenReturn(true);
        when(emailVerificationService.consumeVerified(email, "내_토큰")).thenReturn(true);
        when(passwordEncoder.encode("password123!")).thenReturn("encodedPassword");

        memberService.signup("newuser", "password123!", "테스트", email, "내_토큰");

        verify(emailVerificationService).isVerified(email, "내_토큰");
        verify(emailVerificationService).consumeVerified(email, "내_토큰");
    }

    @Test
    void 토큰이_없거나_틀리면_가입을_막는다() {
        String email = "new@test.com";
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified(email, TOKEN)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser", "password123!", "테스트", email, null));
        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser", "password123!", "테스트", email, "남의_토큰"));

        verify(memberMapper, never()).insert(any(Member.class));
        verify(emailVerificationService, never()).consumeVerified(any(), any());
    }

    @Test
    void 인증_상태를_쓰는_순간_토큰이_틀리면_가입되지_않는다() {
        // isVerified와 consumeVerified 사이에 상태가 바뀌어 consume이 실패하는 경우
        String email = "new@test.com";
        when(memberMapper.findByLoginId("newuser")).thenReturn(null);
        when(emailVerificationService.isVerified(email, TOKEN)).thenReturn(true);
        when(emailVerificationService.consumeVerified(email, TOKEN)).thenReturn(false);

        assertThrows(IllegalArgumentException.class,
                () -> memberService.signup("newuser", "password123!", "테스트", email, TOKEN));

        verify(memberMapper, never()).insert(any(Member.class));
    }

    @Test
    void 비밀번호재설정은_토큰이_틀리면_비밀번호를_바꾸지_않는다() {
        String email = "test@test.com";
        when(memberMapper.findByLoginId("testuser")).thenReturn(member("testuser", email));
        when(emailVerificationService.consumeVerified(email, "남의_토큰")).thenReturn(false);

        assertThrows(IllegalArgumentException.class,
                () -> memberService.resetPassword("testuser", email, "newPassword123!", "남의_토큰"));
        assertThrows(IllegalArgumentException.class,
                () -> memberService.resetPassword("testuser", email, "newPassword123!", null));

        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
    }

    @Test
    void 아이디_이름_이메일_형식이_틀리면_인증_확인_전에_가입을_거절한다() {
        String email = "new@test.com";

        assertThrows(IllegalArgumentException.class, () -> memberService.signup("ab", "password123!", "테스트", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("new user", "password123!", "테스트", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "password123!", "  ", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "password123!", "<script>", email, TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "password123!", "테스트", "not-an-email", TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "password123!", "테스트", "", TOKEN));
        assertThrows(IllegalArgumentException.class, () -> memberService.signup("newuser", "password123!", "테스트", null, TOKEN));

        verify(memberMapper, never()).insert(any(Member.class));
        verify(emailVerificationService, never()).isVerified(any(), any());
        verify(emailVerificationService, never()).consumeVerified(any(), any());
    }

    // ---- 내정보 수정 ---------------------------------------------------------

    private Member updates(String name, String phone, String address, String addressDetail, String profileImageUrl) {
        Member updates = new Member();
        updates.setName(name);
        updates.setPhone(phone);
        updates.setAddress(address);
        updates.setAddressDetail(addressDetail);
        updates.setProfileImageUrl(profileImageUrl);
        return updates;
    }

    @Test
    void 내정보_수정은_올바른_값이면_저장한다() {
        Member updates = updates("홍길동", "010-1234-5678", "대전광역시 유성구", "101동 202호", "/uploads/0a1b2c3d.png");

        memberService.updateMyInfo(7L, updates);

        assertEquals(7L, updates.getMemberId());
        verify(memberMapper).update(updates);
    }

    @Test
    void 내정보_수정에서_선택_항목은_비워도_저장된다() {
        Member updates = updates("홍길동", "", null, null, "");

        memberService.updateMyInfo(7L, updates);

        verify(memberMapper).update(updates);
    }

    @Test
    void 프로필_사진은_업로드한_파일_주소만_허용한다() {
        String[] invalid = {
                "http://evil.example/a.jpg",
                "https://evil.example/a.png",
                "javascript:alert(1)",
                "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
                "/uploads/../secret.jpg",
                "/uploads/a.jpg?x=1",
                "//evil.example/uploads/a.jpg",
                "/uploads/a.html",
        };
        for (String url : invalid) {
            assertThrows(IllegalArgumentException.class,
                    () -> memberService.updateMyInfo(7L, updates("홍길동", "010-1234-5678", null, null, url)));
        }

        verify(memberMapper, never()).update(any(Member.class));
    }

    @Test
    void 내정보_수정에서_이름_전화번호_주소_형식이_틀리면_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates(null, null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates(" ", null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates("a".repeat(51), null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates("홍길동", "010-12", null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates("홍길동", "<img src=x>", null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates("홍길동", null, "a".repeat(201), null, null)));
        assertThrows(IllegalArgumentException.class, () -> memberService.updateMyInfo(7L, updates("홍길동", null, null, "a".repeat(201), null)));

        verify(memberMapper, never()).update(any(Member.class));
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
        verify(webSocketSessionRevoker).revoke(1L);
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
        when(jwtTokenProvider.generateToken(any(), any(), any(), any(), anyLong())).thenReturn("token");

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

    // ---- JWT 무효화 ----------------------------------------------------------

    @Test
    void 로그아웃하면_회원의_토큰_버전을_올린다() {
        memberService.logout(1L);

        verify(memberMapper).increaseTokenVersion(1L);
        verify(webSocketSessionRevoker).revoke(1L);
    }

    @Test
    void 탈퇴하면_실시간_연결과_미사용_티켓도_끊는다() {
        memberService.withdraw(1L);

        verify(memberMapper).withdraw(1L);
        verify(webSocketSessionRevoker).revoke(1L);
    }

    @Test
    void 로그인으로_만든_토큰에는_회원의_현재_토큰_버전이_담긴다() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 1, 1, 9, 0);
        Member stored = member("user1", "u1@test.com");
        stored.setPassword("storedHash");
        stored.setRole("USER");
        stored.setName("이서연");
        stored.setCreatedAt(createdAt);
        stored.setTokenVersion(3L);
        when(memberMapper.findByLoginId("user1")).thenReturn(stored);
        when(passwordEncoder.matches("pw123456", "storedHash")).thenReturn(true);
        when(jwtTokenProvider.generateToken(1L, "USER", "이서연", createdAt, 3L)).thenReturn("token-v3");

        assertEquals("token-v3", memberService.login("user1", "pw123456"));
    }

    @Test
    void 새_세션용_토큰에도_회원의_현재_토큰_버전이_담긴다() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 1, 1, 9, 0);
        Member stored = member("user1", "u1@test.com");
        stored.setRole("USER");
        stored.setName("이서연");
        stored.setCreatedAt(createdAt);
        stored.setTokenVersion(5L);
        when(memberMapper.findById(1L)).thenReturn(stored);
        when(jwtTokenProvider.generateToken(1L, "USER", "이서연", createdAt, 5L)).thenReturn("token-v5");

        assertEquals("token-v5", memberService.reissueToken(1L));
    }

    @Test
    void 세션_연장은_로그인_시각을_유지한_채_새_토큰을_만든다() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 1, 1, 9, 0);
        Member stored = member("user1", "u1@test.com");
        stored.setRole("USER");
        stored.setName("이서연");
        stored.setCreatedAt(createdAt);
        stored.setTokenVersion(5L);
        when(memberMapper.findById(1L)).thenReturn(stored);
        when(jwtTokenProvider.isSessionLimitReached("old-token")).thenReturn(false);
        when(jwtTokenProvider.getSessionStartMs("old-token")).thenReturn(123L);
        when(jwtTokenProvider.generateRefreshedToken(1L, "USER", "이서연", createdAt, 5L, 123L)).thenReturn("refreshed");

        assertEquals("refreshed", memberService.refreshToken(1L, "old-token"));

        verify(jwtTokenProvider, never()).generateToken(any(), any(), any(), any(), anyLong());
    }

    @Test
    void 최대_세션_시간에_닿은_토큰은_연장하지_않는다() {
        when(jwtTokenProvider.isSessionLimitReached("old-token")).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> memberService.refreshToken(1L, "old-token"));

        verify(jwtTokenProvider, never()).generateRefreshedToken(any(), any(), any(), any(), anyLong(), anyLong());
    }

    @Test
    void 비밀번호를_바꾸면_올라간_버전으로_새_토큰을_돌려준다() {
        Member before = member("testuser", "test@test.com");
        Member withPassword = member("testuser", "test@test.com");
        withPassword.setPassword("storedHash");
        Member after = member("testuser", "test@test.com");
        after.setTokenVersion(1L);
        // 첫 조회는 변경 전, 변경 뒤 새 토큰을 만들 때의 조회는 버전이 올라간 상태
        when(memberMapper.findById(1L)).thenReturn(before, after);
        when(memberMapper.findByLoginId("testuser")).thenReturn(withPassword);
        when(passwordEncoder.matches("currentPw123", "storedHash")).thenReturn(true);
        when(passwordEncoder.encode("newPassword456")).thenReturn("newHash");
        when(jwtTokenProvider.generateToken(any(), any(), any(), any(), eq(1L))).thenReturn("new-token");

        String token = memberService.changePassword(1L, "currentPw123", "newPassword456");

        assertEquals("new-token", token);
        verify(memberMapper).updatePassword(1L, "newHash");
    }

    @Test
    void 현재_비밀번호가_틀리면_토큰을_새로_만들지_않는다() {
        Member found = member("testuser", "test@test.com");
        Member withPassword = member("testuser", "test@test.com");
        withPassword.setPassword("storedHash");
        when(memberMapper.findById(1L)).thenReturn(found);
        when(memberMapper.findByLoginId("testuser")).thenReturn(withPassword);
        when(passwordEncoder.matches("wrongPw", "storedHash")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> memberService.changePassword(1L, "wrongPw", "newPassword456"));

        verify(memberMapper, never()).updatePassword(anyLong(), anyString());
        verify(jwtTokenProvider, never()).generateToken(any(), any(), any(), any(), anyLong());
        verify(webSocketSessionRevoker, never()).revoke(anyLong());
    }

    // ---- 가족 검색 -----------------------------------------------------------

    @Test
    void 너무_짧은_검색어는_조회하지_않고_거절한다() {
        for (String keyword : new String[]{null, "", " ", "a"}) {
            assertThrows(IllegalArgumentException.class, () -> memberService.searchMembers(keyword, 1L), "거절: " + keyword);
        }

        verify(memberMapper, never()).searchByLoginId(anyString());
    }

    @Test
    void 검색어의_와일드카드는_이스케이프해서_조회한다() {
        when(memberMapper.searchByLoginId("a\\_b")).thenReturn(List.of());
        when(memberMapper.searchByLoginId("\\%\\%")).thenReturn(List.of());

        memberService.searchMembers("a_b", 1L);
        memberService.searchMembers("%%", 1L);

        verify(memberMapper).searchByLoginId("a\\_b");
        verify(memberMapper).searchByLoginId("\\%\\%");
        verify(memberMapper, never()).searchByLoginId("a_b");
        verify(memberMapper, never()).searchByLoginId("%%");
    }

    @Test
    void 검색_결과에서_본인은_빠지고_화면에_필요한_정보만_담긴다() {
        Member me = member("mine01", "me@test.com");
        Member other = member("mine02", "other@test.com");
        other.setMemberId(2L);
        other.setName("다른회원");
        other.setPassword("hash");
        when(memberMapper.searchByLoginId("mine")).thenReturn(List.of(me, other));

        var results = memberService.searchMembers(" mine ", 1L);

        assertEquals(1, results.size());
        assertEquals(Long.valueOf(2L), results.get(0).memberId());
        assertEquals("mine02", results.get(0).loginId());
        assertEquals("다른회원", results.get(0).name());
        assertTrue(results.stream().noneMatch(r -> r.memberId().equals(1L)));
    }
}
