package com.safetrace.service;

import com.safetrace.config.JwtTokenProvider;
import com.safetrace.domain.Member;
import com.safetrace.dto.FamilyMemberSearchResponse;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.util.MemberInputValidator;
import com.safetrace.util.PasswordPolicy;
import com.safetrace.util.UploadUrlValidator;
import com.safetrace.websocket.WebSocketSessionRevoker;
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
    private final WebSocketSessionRevoker webSocketSessionRevoker;

    // verificationToken: 이메일 인증(verify-code)을 통과했을 때 받은 값. 인증한 본인만 가입에 쓸 수 있다.
    public void signup(String loginId, String rawPassword, String name, String email, String verificationToken) {
        // 화면에서 거르더라도 API를 직접 호출하면 우회되므로 서버에서도 입력값과 비밀번호 규칙을 검사
        MemberInputValidator.validateSignup(loginId, name, email);
        PasswordPolicy.validate(rawPassword, loginId);
        if (memberMapper.findByLoginId(loginId) != null) {
            throw new IllegalArgumentException("이미 존재하는 아이디입니다.");
        }
        // 이메일 인증까지 완료된 이메일이어야 가입 가능
        if (!emailVerificationService.isVerified(email, verificationToken)) {
            throw new IllegalArgumentException("이메일 인증을 먼저 완료해주세요.");
        }
        // 인증코드 발송 후 다른 회원의 선가입 대비 재확인
        if (isEmailTaken(email)) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }
        // 인증 완료 상태는 1회용. 같은 인증으로 동시에 가입 요청이 여러 개 와도 한 요청만 통과한다.
        if (!emailVerificationService.consumeVerified(email, verificationToken)) {
            throw new IllegalArgumentException("이메일 인증을 먼저 완료해주세요.");
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

        return jwtTokenProvider.generateToken(member.getMemberId(), member.getRole(), member.getName(), member.getCreatedAt(), member.getTokenVersion());
    }

    // 로그아웃 - 이 회원이 발급받은 JWT를 전부 무효로 만든다 (다른 기기 포함)
    // 이미 열려 있는 WebSocket 연결과 아직 안 쓴 티켓도 같이 끊는다
    public void logout(Long memberId) {
        memberMapper.increaseTokenVersion(memberId);
        webSocketSessionRevoker.revoke(memberId);
    }

    // 새 세션용 토큰 발급 - 세션 시작 시각이 지금으로 새로 잡힌다 (회원 존재·탈퇴 여부는 JwtAuthenticationFilter에서 검증 완료)
    public String reissueToken(Long memberId) {
        Member member = memberMapper.findById(memberId);
        return jwtTokenProvider.generateToken(member.getMemberId(), member.getRole(), member.getName(), member.getCreatedAt(), member.getTokenVersion());
    }

    // 세션 연장 - 로그인 시각은 그대로 두고 만료시각만 늘린다. 최대 세션 시간에 닿았으면 더 늘리지 않는다.
    public String refreshToken(Long memberId, String currentToken) {
        if (jwtTokenProvider.isSessionLimitReached(currentToken)) {
            throw new IllegalStateException("로그인 유지 가능 시간을 모두 사용했습니다. 다시 로그인해주세요.");
        }
        Member member = memberMapper.findById(memberId);
        return jwtTokenProvider.generateRefreshedToken(member.getMemberId(), member.getRole(), member.getName(),
                member.getCreatedAt(), member.getTokenVersion(), jwtTokenProvider.getSessionStartMs(currentToken));
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
        MemberInputValidator.validateProfile(
                updates.getName(), updates.getPhone(), updates.getAddress(), updates.getAddressDetail());
        UploadUrlValidator.requireValidOrBlank(updates.getProfileImageUrl());
        updates.setMemberId(memberId);
        memberMapper.update(updates);
    }

    public void updateNotificationSettings(Long memberId, Member settings) {
        settings.setMemberId(memberId);
        memberMapper.updateNotificationSettings(settings);
    }

    // 비밀번호 변경 - 현재 비밀번호가 맞는지 먼저 검증
    // 변경하면 기존 JWT가 전부 무효가 되므로 새 토큰을 돌려준다
    public String changePassword(Long memberId, String currentPassword, String newPassword) {
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("존재하지 않는 회원입니다.");
        }
        // findById는 비밀번호를 내려주지 않으므로, 검증용으로 loginId 기준 재조회
        Member withPassword = memberMapper.findByLoginId(member.getLoginId());
        if (!passwordEncoder.matches(currentPassword, withPassword.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
        }
        PasswordPolicy.validate(newPassword, member.getLoginId());
        memberMapper.updatePassword(memberId, passwordEncoder.encode(newPassword));
        webSocketSessionRevoker.revoke(memberId);
        return reissueToken(memberId);
    }

    // 가족 등록용 회원 검색 - 로그인ID 부분일치, 본인은 결과에서 제외
    // 화면에 필요한 최소 정보만 DTO로 반환해 개인정보 노출을 막는다.
    // 너무 짧은 검색어는 막고, %·_ 는 이스케이프한다. 결과는 SQL에서 20건까지만.
    public List<FamilyMemberSearchResponse> searchMembers(String loginId, Long excludeMemberId) {
        String keyword = MemberInputValidator.toLoginIdSearchKeyword(loginId);
        return memberMapper.searchByLoginId(keyword).stream()
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
        webSocketSessionRevoker.revoke(memberId);
    }

    // ---- 아이디/비밀번호 찾기 -----------------------------------------------

    // 아이디 찾기 - 이름+이메일이 둘 다 일치하는 회원이 있으면 그 이메일로 로그인 아이디를 보내줌
    public void findLoginId(String name, String email) {
        Member member = memberMapper.findByEmail(email);
        if (member == null || name == null || !name.equals(member.getName())) {
            throw new IllegalArgumentException("일치하는 회원 정보가 없습니다.");
        }
        emailVerificationService.reserveMailSend(email); // 같은 이메일로 메일이 계속 나가지 않도록 횟수 제한
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
    // 교체하면 TOKEN_VERSION이 같이 올라가서 예전에 발급된 JWT는 전부 무효가 된다
    // verificationToken은 verify-code 성공 시 받은 값 (인증을 끝낸 본인만 재설정할 수 있게 함)
    public void resetPassword(String loginId, String email, String newPassword, String verificationToken) {
        Member member = memberMapper.findByLoginId(loginId);
        if (member == null || email == null || !email.equals(member.getEmail())) {
            throw new IllegalArgumentException("일치하는 회원 정보가 없습니다.");
        }
        // 규칙 위반이면 인증 상태를 쓰기 전에 거절 - 비밀번호만 고쳐서 다시 시도할 수 있다
        PasswordPolicy.validate(newPassword, loginId);
        // 인증 완료 상태는 1회용 + 10분 유효
        if (!emailVerificationService.consumeVerified(email, verificationToken)) {
            throw new IllegalArgumentException("이메일 인증을 먼저 완료해주세요.");
        }
        memberMapper.updatePassword(member.getMemberId(), passwordEncoder.encode(newPassword));
        webSocketSessionRevoker.revoke(member.getMemberId());
    }
}