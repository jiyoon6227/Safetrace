package com.safetrace.mapper;

import com.safetrace.domain.Member;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MemberMapper {
    void insert(Member member);
    Member findByLoginId(String loginId);

    // 마이페이지
    Member findById(@Param("memberId") Long memberId);
    Member findByEmail(@Param("email") String email);       // 이메일 중복 확인용
    List<Member> searchByLoginId(@Param("loginId") String loginId);  // 가족 등록 시 상대방 검색
    void update(Member member);                     // 내정보 수정 (이름/전화/주소/프로필사진)
    void updatePassword(@Param("memberId") Long memberId, @Param("encodedPassword") String encodedPassword);
    void updateNotificationSettings(Member member); // 알림설정 3종
    void withdraw(@Param("memberId") Long memberId); // 탈퇴 처리 (소프트 삭제)
}