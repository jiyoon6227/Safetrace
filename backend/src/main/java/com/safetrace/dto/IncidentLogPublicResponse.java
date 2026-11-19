package com.safetrace.dto;

import com.safetrace.domain.IncidentLog;

import java.time.LocalDateTime;

// STAFF가 아닌 요청자용 처리 이력 응답 (처리 담당자·조치내역(memo) 제외)
// memo는 내부 처리용 메모라 공개하지 않는다 (화면은 memo가 없으면 상태별 기본 안내 문구를 보여줌)
public record IncidentLogPublicResponse(
        Long logId,
        Long incidentId,
        String prevStatus,
        String newStatus,
        LocalDateTime changedAt
) {
    public static IncidentLogPublicResponse from(IncidentLog log) {
        return new IncidentLogPublicResponse(
                log.getLogId(),
                log.getIncidentId(),
                log.getPrevStatus(),
                log.getNewStatus(),
                log.getChangedAt()
        );
    }
}
