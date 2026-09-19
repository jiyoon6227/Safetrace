package com.safetrace.service;

import com.safetrace.domain.Notice;
import com.safetrace.mapper.NoticeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NoticeService {

    private static final Set<String> NOTICE_TYPES = Set.of("NORMAL", "URGENT", "MAINTENANCE");

    private final NoticeMapper noticeMapper;

    public List<Notice> getNotices() {
        return noticeMapper.findAll();
    }

    /**
     * 공지 상세 조회.
     * 목록 조회에서는 조회수를 올리지 않고, 상세 화면에 들어왔을 때만 +1 한다.
     */
    @Transactional
    public Notice getNoticeDetail(Long noticeId) {
        Notice existing = noticeMapper.findById(noticeId);
        if (existing == null) {
            throw new IllegalArgumentException("존재하지 않는 공지사항입니다.");
        }

        noticeMapper.increaseViewCount(noticeId);
        return noticeMapper.findById(noticeId);
    }

    @Transactional
    public Notice createNotice(Notice notice, Long writerId) {
        normalizeAndValidate(notice);
        notice.setWriterId(writerId);
        noticeMapper.insert(notice);
        return noticeMapper.findById(notice.getNoticeId());
    }

    @Transactional
    public Notice updateNotice(Long noticeId, Notice request) {
        Notice existing = noticeMapper.findById(noticeId);
        if (existing == null) {
            throw new IllegalArgumentException("존재하지 않는 공지사항입니다.");
        }

        normalizeAndValidate(request);
        request.setNoticeId(noticeId);
        noticeMapper.update(request);
        return noticeMapper.findById(noticeId);
    }

    @Transactional
    public void deleteNotice(Long noticeId) {
        Notice existing = noticeMapper.findById(noticeId);
        if (existing == null) {
            throw new IllegalArgumentException("존재하지 않는 공지사항입니다.");
        }
        noticeMapper.delete(noticeId);
    }

    private void normalizeAndValidate(Notice notice) {
        if (notice == null) {
            throw new IllegalArgumentException("공지사항 내용을 입력해주세요.");
        }

        String title = notice.getTitle() == null ? "" : notice.getTitle().trim();
        String content = notice.getContent() == null ? "" : notice.getContent().trim();
        String noticeType = notice.getNoticeType() == null || notice.getNoticeType().isBlank()
                ? "NORMAL"
                : notice.getNoticeType().trim().toUpperCase();
        String isPinned = "Y".equalsIgnoreCase(notice.getIsPinned()) ? "Y" : "N";

        if (title.isBlank()) {
            throw new IllegalArgumentException("공지 제목을 입력해주세요.");
        }
        if (title.length() > 200) {
            throw new IllegalArgumentException("공지 제목은 200자 이내로 입력해주세요.");
        }
        if (content.isBlank()) {
            throw new IllegalArgumentException("공지 내용을 입력해주세요.");
        }
        if (content.length() > 2000) {
            throw new IllegalArgumentException("공지 내용은 2000자 이내로 입력해주세요.");
        }
        if (!NOTICE_TYPES.contains(noticeType)) {
            throw new IllegalArgumentException("공지 유형이 올바르지 않습니다.");
        }

        notice.setTitle(title);
        notice.setContent(content);
        notice.setNoticeType(noticeType);
        notice.setIsPinned(isPinned);

        if (notice.getNoticeImageUrl() != null && notice.getNoticeImageUrl().isBlank()) {
            notice.setNoticeImageUrl(null);
        }
    }
}
