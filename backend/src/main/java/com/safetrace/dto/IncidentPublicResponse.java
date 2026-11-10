package com.safetrace.dto;

import com.safetrace.domain.Incident;

import java.time.LocalDateTime;

// STAFF가 아닌 요청자용 사건 응답 (담당자·원본 제보·종료 사유 제외)
public record IncidentPublicResponse(
        Long incidentId,
        String title,
        String disasterType,
        String severity,
        String status,
        String region,
        Double latitude,
        Double longitude,
        String photoUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static IncidentPublicResponse from(Incident incident) {
        return new IncidentPublicResponse(
                incident.getIncidentId(),
                incident.getTitle(),
                incident.getDisasterType(),
                incident.getSeverity(),
                incident.getStatus(),
                incident.getRegion(),
                incident.getLatitude(),
                incident.getLongitude(),
                incident.getPhotoUrl(),
                incident.getCreatedAt(),
                incident.getUpdatedAt()
        );
    }
}
