package com.safetrace.config;

import com.safetrace.domain.Member;
import com.safetrace.mapper.MemberMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final MemberMapper memberMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);

            if (jwtTokenProvider.validateToken(token)) {
                Long memberId = jwtTokenProvider.getMemberId(token);

                // 1) DB에 이 ID의 회원이 실제로 존재하고 탈퇴하지 않았는지 확인
                // 2) 그 회원의 CREATED_AT이 토큰 발급 당시와 지금이 같은지 확인
                //    (DB 재시딩으로 같은 ID가 재생성된 회원 차단)
                Member member = memberMapper.findById(memberId);

                boolean isSameMemberInstance = member != null
                        && member.getCreatedAt() != null
                        && member.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                           == jwtTokenProvider.getCreatedAtEpochMs(token);

                if (isSameMemberInstance && !"Y".equals(member.getIsWithdrawn())) {
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + member.getRole()));
                    var authentication = new UsernamePasswordAuthenticationToken(memberId, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
                // 조건 불충족 시 인증 미설정 상태로 통과 (이후 authenticated() 규칙에서 401)
            }
        }

        filterChain.doFilter(request, response);
    }
}