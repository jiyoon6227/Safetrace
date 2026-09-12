package com.safetrace.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Notification {
    private Long notificationId;
    private Long memberId;
    private String type;       // DISASTER(관심지역 재난 알림) / REPORT(내 제보 상태변경 알림)
    private String title;
    private String content;
    private Long incidentId;   // 관련 Incident (없으면 null)
    private LocalDateTime createdAt;
}