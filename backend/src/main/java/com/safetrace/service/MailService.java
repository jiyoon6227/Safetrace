package com.safetrace.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

// 가족 안전확인 요청 이메일 발송 전담.
// HTML 메일로 보내서 링크가 실제 클릭 가능한 버튼/하이퍼링크로 뜨게 한다.
// (SimpleMailMessage로 순수 텍스트만 보내면 localhost 같은 주소는 메일 클라이언트가
//  자동으로 링크화를 안 해주는 경우가 많아서, 진짜 <a> 태그를 박아야 확실함)
// 실패해도 전체 요청 흐름(DB 저장)까지 실패시키면 안 되므로,
// 호출하는 쪽(SafetyCheckService)에서 실패를 잡아 로그만 남기고 넘어가는 구조로 쓴다.
@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-base-url}")
    private String frontendBaseUrl;

    public void sendSafetyCheckRequest(String toEmail, String requesterName, String incidentTitle, String token) {
        String link = frontendBaseUrl + "/?safetyCheckToken=" + token;

        String incidentLine = incidentTitle != null
                ? "<p style=\"color:#475569;margin:0 0 16px;\">관련 사건: " + incidentTitle + "</p>"
                : "";

        String html = "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;\">"
                + "<h2 style=\"color:#0F2540;\">SafeTrace 가족 안전확인 요청</h2>"
                + "<p style=\"color:#334155;font-size:15px;\"><b>" + requesterName + "</b>님이 안전확인을 요청했습니다.</p>"
                + incidentLine
                + "<p style=\"color:#475569;margin:0 0 20px;\">아래 버튼을 눌러 현재 상태를 알려주세요.</p>"
                + "<a href=\"" + link + "\" "
                + "style=\"display:inline-block;background:#0F2540;color:#ffffff;text-decoration:none;"
                + "padding:12px 24px;border-radius:8px;font-weight:bold;\">안전 상태 알리기</a>"
                + "<p style=\"color:#94a3b8;font-size:12px;margin-top:24px;\">"
                + "버튼이 안 눌리면 아래 주소를 브라우저 주소창에 직접 붙여넣어 주세요.<br>"
                + "<a href=\"" + link + "\" style=\"color:#0F2540;\">" + link + "</a></p>"
                + "</div>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("[SafeTrace] 가족 안전확인 요청이 도착했습니다");
            helper.setText(html, true); // true = HTML 본문
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("이메일 발송 중 오류: " + e.getMessage(), e);
        }
    }

    // 회원가입 시 이메일 인증코드 발송
    public void sendVerificationCode(String toEmail, String code) {
        String html = "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;\">"
                + "<h2 style=\"color:#0F2540;\">SafeTrace 이메일 인증</h2>"
                + "<p style=\"color:#334155;font-size:15px;\">아래 인증번호를 회원가입 화면에 입력해주세요.</p>"
                + "<div style=\"background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin:20px 0;\">"
                + "<span style=\"font-size:32px;font-weight:bold;letter-spacing:8px;color:#0F2540;\">" + code + "</span>"
                + "</div>"
                + "<p style=\"color:#94a3b8;font-size:12px;\">이 인증번호는 5분간 유효합니다.</p>"
                + "</div>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("[SafeTrace] 이메일 인증번호: " + code);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("인증코드 이메일 발송 중 오류: " + e.getMessage(), e);
        }
    }

    // 관심지역 재난 알림 - 안전확인 메일과 달리 즉각적인 위험을 알리는 거라 주황/빨강 톤으로 구분
    // (호출부인 NotificationService에서 발송 실패를 잡아서 DB 알림 저장까지는 항상 성공하게 처리함)
    public void sendDisasterAlert(String toEmail, String incidentTitle, String disasterType, String region, double distanceKm) {
        String html = "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;\">"
                + "<h2 style=\"color:#dc2626;\">⚠ SafeTrace 재난 알림</h2>"
                + "<p style=\"color:#334155;font-size:15px;\"><b>" + region + "</b>에서 <b>" + disasterType + "</b> 상황이 발생했습니다.</p>"
                + "<p style=\"color:#475569;margin:0 0 20px;\">관심지역에서 약 " + String.format("%.1f", distanceKm) + "km 떨어진 위치입니다.</p>"
                + "<a href=\"" + frontendBaseUrl + "\" "
                + "style=\"display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;"
                + "padding:12px 24px;border-radius:8px;font-weight:bold;\">상세 확인하기</a>"
                + "<p style=\"color:#94a3b8;font-size:12px;margin-top:24px;\">"
                + "버튼이 안 눌리면 아래 주소를 브라우저 주소창에 직접 붙여넣어 주세요.<br>"
                + "<a href=\"" + frontendBaseUrl + "\" style=\"color:#0F2540;\">" + frontendBaseUrl + "</a></p>"
                + "</div>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("[SafeTrace] 관심지역 근처에 재난상황이 발생했습니다");
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("이메일 발송 중 오류: " + e.getMessage(), e);
        }
    }
}