package com.safetrace.mapper;

import com.safetrace.domain.MemberRegion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MemberRegionMapper {
    void insert(MemberRegion region);
    List<MemberRegion> findByMemberId(@Param("memberId") Long memberId);
    void delete(@Param("memberRegionId") Long memberRegionId);
    void clearPrimary(@Param("memberId") Long memberId);
    void setPrimary(@Param("memberRegionId") Long memberRegionId);
    // 재난 알림 매칭용 - 모든 회원의 "대표" 관심지역 전체 조회 (Incident 생성 시 반경 매칭 대상)
    List<MemberRegion> findAllPrimary();
}