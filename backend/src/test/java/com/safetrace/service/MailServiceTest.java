package com.safetrace.service;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// 메일 본문(HTML)에 들어가는 사용자 입력이 이스케이프되는지 확인한다
class MailServiceTest {

    private static final String SCRIPT = "<script>alert(1)</script>";
    private static final String IMG = "<img src=x onerror=alert(1)>";

    private JavaMailSender mailSender;
    private MailService mailService;

    @BeforeEach
    void setUp() {
        mailSender = mock(JavaMailSender.class);
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage((Session) null));
        mailService = new MailService(mailSender);
        ReflectionTestUtils.setField(mailService, "frontendBaseUrl", "http://localhost:5173");
    }

    private String sentHtml() throws Exception {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        return (String) captor.getValue().getContent();
    }

    @Test
    void 안전확인_요청_메일에서_요청자_이름과_사건_제목의_태그는_글자로만_보인다() throws Exception {
        mailService.sendSafetyCheckRequest("to@test.com", IMG, SCRIPT, "token123");

        String html = sentHtml();

        assertFalse(html.contains(SCRIPT));
        assertFalse(html.contains(IMG));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
    }

    @Test
    void 안전확인_요청_메일의_링크와_일반_글자는_그대로_나온다() throws Exception {
        mailService.sendSafetyCheckRequest("to@test.com", "곽지윤", "대전 침수", "token123");

        String html = sentHtml();

        assertTrue(html.contains("<b>곽지윤</b>님이 안전확인을 요청했습니다."));
        assertTrue(html.contains("관련 사건: 대전 침수"));
        assertTrue(html.contains("http://localhost:5173/?safetyCheckToken=token123"));
    }

    @Test
    void 사건_제목이_없으면_관련_사건_줄을_넣지_않는다() throws Exception {
        mailService.sendSafetyCheckRequest("to@test.com", "곽지윤", null, "token123");

        assertFalse(sentHtml().contains("관련 사건"));
    }

    @Test
    void 따옴표나_앰퍼샌드가_들어간_이름도_속성이나_태그를_깨뜨리지_않는다() throws Exception {
        mailService.sendSafetyCheckRequest("to@test.com", "\" onmouseover=\"alert(1) & <b>", "A&B \"사건\"", "t");

        String html = sentHtml();

        assertFalse(html.contains("\" onmouseover=\"alert(1)"));
        assertTrue(html.contains("&quot; onmouseover=&quot;alert(1) &amp; &lt;b&gt;"));
        assertTrue(html.contains("A&amp;B &quot;사건&quot;"));
    }

    @Test
    void 아이디_찾기_메일에서_이름과_아이디의_태그는_글자로만_보인다() throws Exception {
        mailService.sendLoginId("to@test.com", IMG, SCRIPT);

        String html = sentHtml();

        assertFalse(html.contains("<script"));
        assertFalse(html.contains("<img"));
        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
    }

    @Test
    void 재난_알림_메일에서_지역과_재난_유형의_태그는_글자로만_보인다() throws Exception {
        mailService.sendDisasterAlert("to@test.com", "제목", IMG, SCRIPT, 1.234);

        String html = sentHtml();

        assertFalse(html.contains("<script"));
        assertFalse(html.contains("<img"));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
        assertTrue(html.contains("약 1.2km"));
        assertTrue(html.contains("http://localhost:5173"));
    }

    @Test
    void 인증코드_메일에는_코드가_그대로_들어간다() throws Exception {
        mailService.sendVerificationCode("to@test.com", "123456");

        assertTrue(sentHtml().contains(">123456</span>"));
    }
}
