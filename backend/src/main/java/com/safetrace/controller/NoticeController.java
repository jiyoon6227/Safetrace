package com.safetrace.controller;

import com.safetrace.domain.Notice;
import com.safetrace.service.NoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService noticeService;

    // 비로그인 포함 전체 공개
    @GetMapping
    public List<Notice> getNotices() {
        return noticeService.getNotices();
    }

    // 비로그인 포함 전체 공개 + 상세 진입 시 조회수 1 증가
    @GetMapping("/{noticeId}")
    public Notice getNotice(@PathVariable Long noticeId) {
        return noticeService.getNoticeDetail(noticeId);
    }

    // STAFF만 작성 가능
    @PostMapping
    @PreAuthorize("hasRole('STAFF')")
    public Notice createNotice(@RequestBody Notice notice, Authentication authentication) {
        Long writerId = (Long) authentication.getPrincipal();
        return noticeService.createNotice(notice, writerId);
    }

    // STAFF만 수정 가능
    @PatchMapping("/{noticeId}")
    @PreAuthorize("hasRole('STAFF')")
    public Notice updateNotice(@PathVariable Long noticeId, @RequestBody Notice notice) {
        return noticeService.updateNotice(noticeId, notice);
    }

    // STAFF만 삭제 가능
    @DeleteMapping("/{noticeId}")
    @PreAuthorize("hasRole('STAFF')")
    public Map<String, String> deleteNotice(@PathVariable Long noticeId) {
        noticeService.deleteNotice(noticeId);
        return Map.of("message", "공지사항이 삭제되었습니다.");
    }
}
