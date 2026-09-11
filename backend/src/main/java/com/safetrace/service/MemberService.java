package com.safetrace.service;

import com.safetrace.config.JwtTokenProvider;
import com.safetrace.domain.Member;
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
        // 인증코드 발송 이후 다른 사람이 그 사이 먼저 가입해버렸을 가능성 대비, 가입 직전에 한번 더 확인
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

    // ---- 마이페이지 --------------------------------------------------------

    public Member getMyInfo(Long memberId) {
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("존재하지 않는 회원입니다.");
        }
        member.setPassword(null); // 비밀번호 해시는 응답에 절대 포함하지 않음
        return member;
    }

    // 내정보 수정 - 이메일/전화/주소/프로필사진만 변경 가능... 이라고 했지만
    // 이메일은 가입 시 인증된 값으로 고정하고 이후 변경은 막음(중복/재인증 로직이 없어 악용 소지가 있었음).
    // 로그인ID/이름/권한/이메일은 여기서 안 건드림
    public void updateMyInfo(Long memberId, Member updates) {
        updates.setEmail(null); // 요청에 이메일이 실려와도 무시 - 절대 변경되지 않도록
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
    public List<Member> searchMembers(String loginId, Long excludeMemberId) {
        return memberMapper.searchByLoginId(loginId).stream()
                .filter(m -> !m.getMemberId().equals(excludeMemberId))
                .peek(m -> m.setPassword(null))
                .collect(Collectors.toList());
    }

    // 탈퇴 - 실제 삭제 대신 IS_WITHDRAWN만 표시 (소프트 삭제). 참조 이력은 그대로 남음
    public void withdraw(Long memberId) {
        memberMapper.withdraw(memberId);
    }
}