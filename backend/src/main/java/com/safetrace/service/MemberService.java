package com.safetrace.service;

import com.safetrace.config.JwtTokenProvider;
import com.safetrace.domain.Member;
import com.safetrace.dto.FamilyMemberSearchResponse;
import com.safetrace.mapper.MemberMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberMapper memberMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailVerificationService emailVerificationService;
    private final MailService mailService;

    public void signup(String loginId, String rawPassword, String name, String email) {
        if (memberMapper.findByLoginId(loginId) != null) {
            throw new IllegalArgumentException("이미 존재하는 아이디입니다.");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일을 입력해주세요.");
        }
        // 이메일 인증까지 완료된 이메일이어야 가입 가능
        if (!emailVerificationService.isVerified(email)) {
            throw new IllegalArgumentException("이메일 인증을 먼저 완료해주세요.");
        }
        // 인증코드 발송 후 다른 회원의 선가입 대비 재확인
        if (isEmailTaken(email)) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        Member member = new Member();
        member.setLoginId(loginId);
        member.setPassword(passwordEncoder.encode(rawPassword));
        member.setName(name);
        member.setEmail(email);
        member.setRole("USER");

        memberMapper.insert(member);
        emailVerificationService.clearVerified(email);
    }

    public boolean isEmailTaken(String email) {
        return memberMapper.findByEmail(email) != null;
    }

    public String login(String loginId, String rawPassword) {
        Member member = memberMapper.findByLoginId(loginId);

        if (member == null || !passwordEncoder.matches(rawPassword, member.getPassword())) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        return jwtTokenProvider.generateToken(member.getMemberId(), member.getRole(), member.getName(), member.getCreatedAt());
    }

    // 세션 연장용 토큰 재발급 (회원 존재·탈퇴 여부는 JwtAuthenticationFilter에서 검증 완료)
    public String reissueToken(Long memberId) {
        Member member = memberMapper.findById(memberId);
        // 발급 시각 기준으로 만료시각(exp) 연장
        return jwtTokenProvider.generateToken(member.getMemberId(), member.getRole(), member.getName(), member.getCreatedAt());
    }

    // ---- 마이페이지 --------------------------------------------------------

    public Member getMyInfo(Long memberId) {
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("존재하지 않는 회원입니다.");
        }
        member.setPassword(null); // 비밀번호 해시는 응답에 절대 포함하지 않음
        return member;
    }

    // 내정보 수정: 이름/전화/주소/프로필사진만 반영
    // (이메일은 가입 시 인증값으로 고정, UPDATE 쿼리에 EMAIL 미포함)
    public void updateMyInfo(Long memberId, Member updates) {
        updates.setMemberId(memberId);
        memberMapper.update(updates);
    }

    public void updateNotificationSettings(Long memberId, Member settings) {
        settings.setMemberId(memberId);
        memberMapper.updateNotificationSettings(settings);
    }

    // 비밀번호 변경 - 현재 비밀번호가 맞는지 먼저 검증
    public void changePassword(Long memberId, String currentPassword, String newPassword) {
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("존재하지 않는 회원입니다.");
        }
        // findById는 비밀번호를 내려주지 않으므로, 검증용으로 loginId 기준 재조회
        Member withPassword = memberMapper.findByLoginId(member.getLoginId());
        if (!passwordEncoder.matches(currentPassword, withPassword.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
        }
        memberMapper.updatePassword(memberId, passwordEncoder.encode(newPassword));
    }

    // 가족 등록용 회원 검색 - 로그인ID 부분일치, 본인은 결과에서 제외
    // 화면에 필요한 최소 정보만 DTO로 반환해 개인정보 노출을 막는다.
    public List<FamilyMemberSearchResponse> searchMembers(String loginId, Long excludeMemberId) {
        return memberMapper.searchByLoginId(loginId).stream()
                .filter(m -> !m.getMemberId().equals(excludeMemberId))
                .map(m -> new FamilyMemberSearchResponse(
                        m.getMemberId(),
                        m.getLoginId(),
                        m.getName()
                ))
                .collect(Collectors.toList());
    }

    // 탈퇴 - 실제 삭제 대신 IS_WITHDRAWN만 표시 (소프트 삭제). 참조 이력은 그대로 남음
    public void withdraw(Long memberId) {
        memberMapper.withdraw(memberId);
    }

    // ---- 아이디/비밀번호 찾기 -----------------------------------------------

    // 아이디 찾기 - 이름+이메일이 둘 다 일치하는 회원이 있으면 그 이메일로 로그인 아이디를 보내줌
    public void findLoginId(String name, String email) {
        Member member = memberMapper.findByEmail(email);
        if (member == null || name == null || !name.equals(member.getName())) {
            throw new IllegalArgumentException("일치하는 회원 정보가 없습니다.");
        }
        mailService.sendLoginId(email, member.getName(), member.getLoginId());
    }

    // 비밀번호 찾기 1단계 - 아이디+이메일이 둘 다 일치하는 회원에게만 인증코드 발송
    // (회원가입과 같은 EmailVerificationService 사용)
    public void sendPasswordResetCode(String loginId, String email) {
        Member member = memberMapper.findByLoginId(loginId);
        if (member == null || email == null || !email.equals(member.getEmail())) {
            throw new IllegalArgumentException("일치하는 회원 정보가 없습니다.");
        }
        emailVerificationService.sendCode(email);
    }

    // 비밀번호 찾기 2단계 - 이메일 인증(verify-code)까지 끝난 뒤에만 새 비밀번호로 교체 가능
    public void resetPassword(String loginId, String email, String newPassword) {
        Member member = memberMapper.findByLoginId(loginId);
        if (member == null || email == null || !email.equals(member.getEmail())) {
            throw new IllegalArgumentException("일치하는 회원 정보가 없습니다.");
        }
        if (!emailVerificationService.isVerified(email)) {
            throw new IllegalArgumentException("이메일 인증을 먼저 완료해주세요.");
        }
        memberMapper.updatePassword(member.getMemberId(), passwordEncoder.encode(newPassword));
        emailVerificationService.clearVerified(email);
    }
}