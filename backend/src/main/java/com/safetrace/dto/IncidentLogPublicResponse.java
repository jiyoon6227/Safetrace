package com.safetrace.dto;

import com.safetrace.domain.IncidentLog;

import java.time.LocalDateTime;

// STAFF가 아닌 요청자용 처리 이력 응답 (처리 담당자 제외)
public record IncidentLogPublicResponse(
        Long logId,
        Long incidentId,
        String prevStatus,
        String newStatus,
        String memo,
        LocalDateTime changedAt
) {
    public static IncidentLogPublicResponse from(IncidentLog log) {
        return new IncidentLogPublicResponse(
                log.getLogId(),
                log.getIncidentId(),
                log.getPrevStatus(),
                log.getNewStatus(),
                log.getMemo(),
                log.getChangedAt()
        );
    }
}
