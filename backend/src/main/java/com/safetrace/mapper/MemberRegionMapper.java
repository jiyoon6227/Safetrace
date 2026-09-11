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
}