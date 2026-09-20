package com.safetrace.dto;

/**
 * 가족 등록용 회원 검색 응답 DTO.
 * 검색 화면에 필요한 최소 정보만 반환하여 회원 개인정보가 노출되지 않도록 한다.
 */
public record FamilyMemberSearchResponse(
        Long memberId,
        String loginId,
        String name
) {
}
