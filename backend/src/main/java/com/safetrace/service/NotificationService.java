package com.safetrace.service;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.MemberRegion;
import com.safetrace.domain.Notification;
import com.safetrace.domain.Report;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.MemberRegionMapper;
import com.safetrace.mapper.NotificationMapper;
import com.safetrace.mapper.ReportMapper;
import com.safetrace.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 마이페이지 "최근 알림" 중 재난 알림 / 제보 알림 두 종류를 실제로 생성하는 서비스.
 * (안전확인/기타 알림은 이미 있는 데이터를 프론트에서 그때그때 조합해서 보여주는 방식을
 *  그대로 쓰고, 이 둘만 진짜 이벤트 기반으로 DB에 남겨서 "제대로 된 알림"으로 만든다.)
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper notificationMapper;
    private final MemberRegionMapper memberRegionMapper;
    private final ReportMapper reportMapper;
    private final MemberMapper memberMapper;
    private final MailService mailService;

    // 재난 알림 매칭 반경 - 대표 관심지역 기준 이 거리(km) 이내에 새 Incident가 생기면 알림.
    // 재난문자(행정구역 단위)와 달리 내부 Incident.region은 STAFF가 직접 입력하는 자유
    // 텍스트라 표기가 일관되지 않을 수 있어서, 문자열 매칭 대신 위경도 거리 계산을 씀.
    private static final double DISASTER_ALERT_RADIUS_KM = 3.0;

    /**
     * 새 Incident가 생성되면, 대표 관심지역이 반경 이내인 회원들에게 "재난 알림"을 만든다.
     * (알림설정에서 disasterNotifyEnabled='N'으로 꺼놓은 회원은 제외)
     */
    public void notifyNearbyMembersOfNewIncident(Incident incident) {
        if (incident.getLatitude() == null || incident.getLongitude() == null) {
            return; // 좌표 없는 Incident는 매칭 불가
        }

        for (MemberRegion region : memberRegionMapper.findAllPrimary()) {
            if (region.getLatitude() == null || region.getLongitude() == null) {
                continue;
            }

            double distanceKm = GeoUtils.distanceMeters(
                    region.getLatitude(), region.getLongitude(),
                    incident.getLatitude(), incident.getLongitude()
            ) / 1000.0;

            if (distanceKm > DISASTER_ALERT_RADIUS_KM) {
                continue;
            }

            Member member = memberMapper.findById(region.getMemberId());
            if (member == null || !"Y".equals(member.getDisasterNotifyEnabled())) {
                continue;
            }

            Notification notification = new Notification();
            notification.setMemberId(region.getMemberId());
            notification.setType("DISASTER");
            notification.setTitle(incident.getTitle());
            notification.setContent(String.format(
                    "%s에서 %s 상황이 발생했습니다. (관심지역에서 약 %.1fkm)",
                    incident.getRegion(), incident.getDisasterType(), distanceKm
            ));
            notification.setIncidentId(incident.getIncidentId());
            notificationMapper.insert(notification);

            // 앱 안 알림은 항상 남기고, 이메일은 "혹시 실패해도" DB 알림 자체는 살아있게
            // try-catch로 감쌈. 안전확인 메일(MailService.sendSafetyCheckRequest)도 같은 패턴으로
            // 호출하는 쪽에서 실패를 삼키게 돼있어서 그 관례를 그대로 따름.
            if (member.getEmail() != null && !member.getEmail().isBlank()) {
                try {
                    mailService.sendDisasterAlert(
                            member.getEmail(), incident.getTitle(), incident.getDisasterType(),
                            incident.getRegion(), distanceKm
                    );
                } catch (Exception e) {
                    // 이메일 발송 실패해도 알림 생성 자체는 이미 끝났으니 그냥 넘어감
                }
            }
        }
    }

    /**
     * Incident 상태가 바뀌면, 그 Incident에 제보를 연결한 회원들에게 "제보 알림"을 만든다.
     * 한 회원이 같은 Incident에 여러 제보를 올렸을 수 있어 회원 단위로 중복 없이 한 번만 보낸다.
     * (알림설정에서 reportNotifyEnabled='N'으로 꺼놓은 회원은 제외)
     */
    public void notifyReportersOfStatusChange(Incident incident, String prevStatusLabel, String newStatusLabel) {
        List<Report> linkedReports = reportMapper.findByIncidentId(incident.getIncidentId());

        Set<Long> reporterIds = linkedReports.stream()
                .map(Report::getMemberId)
                .collect(Collectors.toSet());

        for (Long memberId : reporterIds) {
            Member member = memberMapper.findById(memberId);
            if (member == null || !"Y".equals(member.getReportNotifyEnabled())) {
                continue;
            }

            Notification notification = new Notification();
            notification.setMemberId(memberId);
            notification.setType("REPORT");
            notification.setTitle(incident.getTitle());
            notification.setContent(String.format(
                    "내 제보가 연결된 사건의 상태가 %s → %s(으)로 변경되었습니다.",
                    prevStatusLabel, newStatusLabel
            ));
            notification.setIncidentId(incident.getIncidentId());
            notificationMapper.insert(notification);
        }
    }

    // 마이페이지 "최근 알림" - 로그인한 본인 것만
    public List<Notification> getMyNotifications(Long memberId) {
        return notificationMapper.findByMemberId(memberId);
    }

    // 알림 개별 삭제 - 남의 알림 ID를 넣어서 지우는 걸 막기 위해 본인 소유인지 먼저 확인
    public void deleteNotification(Long memberId, Long notificationId) {
        Notification notification = notificationMapper.findById(notificationId);
        if (notification == null || !notification.getMemberId().equals(memberId)) {
            throw new IllegalArgumentException("존재하지 않거나 삭제 권한이 없는 알림입니다.");
        }
        notificationMapper.delete(notificationId);
    }

    // 알림 전체 삭제 ("전체 삭제" 버튼용) - 본인 것만 지우므로 별도 소유권 확인 불필요
    public void deleteAllNotifications(Long memberId) {
        notificationMapper.deleteAllByMemberId(memberId);
    }
}