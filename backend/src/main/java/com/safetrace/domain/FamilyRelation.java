package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class FamilyRelation {
    private Long relationId;
    private Long memberId;         // 요청한 사람
    private Long familyMemberId;   // 가족으로 등록된 상대방
    private String relationType;   // 배우자/자녀/부모님/형제자매/가족 등
    private String status;         // PENDING / ACCEPTED
    private LocalDateTime createdAt;

    // 화면에 바로 보여주기 위한 조인 결과용 필드 (DB 컬럼 아님)
    private String familyMemberName;
    private String familyMemberLoginId;
    private String familyMemberPhone;
    private String familyMemberProfileImageUrl;
}