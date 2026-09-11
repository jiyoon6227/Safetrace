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
                //    -> DB 초기화로 SEQUENCE가 재시작되어 예전과 같은 ID로 "다른" 회원이
                //       새로 생겼을 뿐인 경우(재시딩)까지 걸러내기 위함
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
                // 조건을 만족 못하면(회원 없음 / 탈퇴함 / ID만 같고 재생성된 다른 레코드) 인증을 세팅하지 않고
                // 그냥 통과시킨다. 이후 anyRequest().authenticated() 규칙에 걸려 401로 처리됨.
            }
        }

        filterChain.doFilter(request, response);
    }
}