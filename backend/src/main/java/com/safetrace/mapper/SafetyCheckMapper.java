package com.safetrace.mapper;

import com.safetrace.domain.SafetyCheck;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SafetyCheckMapper {
    void insert(SafetyCheck check);
    SafetyCheck findByToken(@Param("token") String token);
    List<SafetyCheck> findSentByRequesterId(@Param("requesterId") Long requesterId);
    List<SafetyCheck> findReceivedByTargetId(@Param("targetMemberId") Long targetMemberId);

    // 로그인 상태에서 응답
    int respond(@Param("checkId") Long checkId, @Param("status") String status);

    // 이메일 링크로 응답
    int respondByToken(@Param("token") String token, @Param("status") String status);
}