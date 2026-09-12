package com.safetrace.controller;

import com.safetrace.domain.Notification;
import com.safetrace.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // 마이페이지 "최근 알림" - 로그인한 본인 것만 (다른 컨트롤러와 동일하게
    // JwtAuthenticationFilter가 SecurityContext에 넣어준 memberId를 그대로 씀)
    @GetMapping
    public List<Notification> getMyNotifications(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        return notificationService.getMyNotifications(memberId);
    }

    // 알림 개별 삭제
    @DeleteMapping("/{notificationId}")
    public void deleteNotification(@PathVariable Long notificationId, Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        notificationService.deleteNotification(memberId, notificationId);
    }

    // 알림 전체 삭제
    @DeleteMapping
    public void deleteAllNotifications(Authentication authentication) {
        Long memberId = (Long) authentication.getPrincipal();
        notificationService.deleteAllNotifications(memberId);
    }
}