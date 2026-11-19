package com.safetrace.config;

import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// 로그아웃·비밀번호 변경 뒤에는 그 전에 발급된 JWT로 API(세션 연장 포함)를 쓸 수 없는지 확인한다
class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-key-for-jwt-unit-tests-0123456789";
    private static final LocalDateTime CREATED_AT = LocalDateTime.of(2026, 1, 1, 9, 0);

    private final JwtTokenProvider provider = new JwtTokenProvider(SECRET, 3_600_000L, 43_200_000L);
    private MemberMapper memberMapper;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        memberMapper = mock(MemberMapper.class);
        filter = new JwtAuthenticationFilter(provider, memberMapper);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private Member member(long tokenVersion) {
        Member member = new Member();
        member.setMemberId(7L);
        member.setRole("USER");
        member.setName("이서연");
        member.setCreatedAt(CREATED_AT);
        member.setIsWithdrawn("N");
        member.setTokenVersion(tokenVersion);
        return member;
    }

    private String tokenWithVersion(long version) {
        return provider.generateToken(7L, "USER", "이서연", CREATED_AT, version);
    }

    // 버전 정보가 없던 시절에 발급된 토큰
    private String legacyToken() {
        return Jwts.builder()
                .subject("7")
                .claim("role", "USER")
                .claim("name", "이서연")
                .claim("createdAt", CREATED_AT.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000L))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes()))
                .compact();
    }

    private Authentication authenticate(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (token != null) {
            request.addHeader("Authorization", "Bearer " + token);
        }
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Test
    void 토큰_버전이_회원의_현재_버전과_같으면_인증된다() throws Exception {
        when(memberMapper.findById(7L)).thenReturn(member(2L));

        Authentication auth = authenticate(tokenWithVersion(2L));

        assertNotNull(auth);
        assertEquals(7L, auth.getPrincipal());
        assertTrue(auth.getAuthorities().stream().anyMatch(a -> "ROLE_USER".equals(a.getAuthority())));
    }

    @Test
    void 로그아웃이나_비밀번호_변경으로_버전이_올라가면_그_전에_발급된_토큰은_인증되지_않는다() throws Exception {
        when(memberMapper.findById(7L)).thenReturn(member(3L));

        assertNull(authenticate(tokenWithVersion(2L)));
    }

    @Test
    void 버전이_올라간_뒤_새로_발급받은_토큰은_인증된다() throws Exception {
        when(memberMapper.findById(7L)).thenReturn(member(3L));

        assertNotNull(authenticate(tokenWithVersion(3L)));
    }

    @Test
    void 회원보다_높은_버전의_토큰도_인증되지_않는다() throws Exception {
        when(memberMapper.findById(7L)).thenReturn(member(1L));

        assertNull(authenticate(tokenWithVersion(5L)));
    }

    @Test
    void 버전_정보가_없는_예전_토큰은_회원_버전이_0일_때만_인증된다() throws Exception {
        when(memberMapper.findById(7L)).thenReturn(member(0L));
        assertNotNull(authenticate(legacyToken()));

        SecurityContextHolder.clearContext();
        when(memberMapper.findById(7L)).thenReturn(member(1L));
        assertNull(authenticate(legacyToken()));
    }

    @Test
    void 탈퇴한_회원과_없는_회원과_재생성된_회원의_토큰은_인증되지_않는다() throws Exception {
        Member withdrawn = member(0L);
        withdrawn.setIsWithdrawn("Y");
        when(memberMapper.findById(7L)).thenReturn(withdrawn);
        assertNull(authenticate(tokenWithVersion(0L)));

        when(memberMapper.findById(7L)).thenReturn(null);
        assertNull(authenticate(tokenWithVersion(0L)));

        Member recreated = member(0L);
        recreated.setCreatedAt(CREATED_AT.plusDays(1));
        when(memberMapper.findById(7L)).thenReturn(recreated);
        assertNull(authenticate(tokenWithVersion(0L)));
    }

    @Test
    void 토큰이_없거나_잘못되었으면_회원_조회도_하지_않고_인증되지_않는다() throws Exception {
        assertNull(authenticate(null));
        assertNull(authenticate("not-a-jwt"));

        verify(memberMapper, never()).findById(anyLong());
    }
}
