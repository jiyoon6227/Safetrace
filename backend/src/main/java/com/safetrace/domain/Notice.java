package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Notice {
    private Long noticeId;
    private String title;
    private String content;
    private String noticeType;      // NORMAL(안내) / URGENT(긴급) / MAINTENANCE(점검)
    private String isPinned;        // Y / N
    private Long viewCount;
    private String noticeImageUrl;  // 공지당 이미지 1장
    private Long writerId;
    private String writerName;      // SF_MEMBER 조인 결과
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
