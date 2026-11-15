package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

// 품목 수정 이력 - SF_RESOURCE_ITEM_LOG (바뀐 항목마다 한 줄, 변경자 이름은 조인 결과)
@Data
public class ResourceItemLog {
    private Long logId;
    private Long itemId;
    private String fieldName;     // NAME / CATEGORY / DESCRIPTION
    private String oldValue;
    private String newValue;
    private Long changedBy;
    private String changedByName;
    private LocalDateTime changedAt;
}
