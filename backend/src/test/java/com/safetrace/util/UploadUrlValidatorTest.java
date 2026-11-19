package com.safetrace.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadUrlValidatorTest {

    @Test
    void 업로드_API가_만든_주소와_기본_이미지는_통과한다() {
        assertTrue(UploadUrlValidator.isValid("/uploads/0a1b2c3d-1111-2222-3333-444455556666.jpg"));
        assertTrue(UploadUrlValidator.isValid("/uploads/0a1b2c3d-1111-2222-3333-444455556666.png"));
        assertTrue(UploadUrlValidator.isValid("/uploads/photo.gif"));
        assertTrue(UploadUrlValidator.isValid("/uploads/photo.webp"));
        assertTrue(UploadUrlValidator.isValid("/uploads/incident-fire.jpg"));
        assertTrue(UploadUrlValidator.isValid("/uploads/profile-female.jpg"));
        assertTrue(UploadUrlValidator.isValid("/uploads/report-sinkhole.jpg"));
        assertTrue(UploadUrlValidator.isValid("/uploads/PHOTO.JPEG"));
    }

    @Test
    void 외부_주소와_위험한_스킴은_거절한다() {
        assertFalse(UploadUrlValidator.isValid("http://evil.example/a.jpg"));
        assertFalse(UploadUrlValidator.isValid("https://evil.example/uploads/a.jpg"));
        assertFalse(UploadUrlValidator.isValid("//evil.example/uploads/a.jpg"));
        assertFalse(UploadUrlValidator.isValid("javascript:alert(1)"));
        assertFalse(UploadUrlValidator.isValid("data:image/png;base64,AAAA"));
        assertFalse(UploadUrlValidator.isValid("file:///etc/passwd"));
    }

    @Test
    void 경로를_벗어나거나_하위_폴더를_가리키는_주소는_거절한다() {
        assertFalse(UploadUrlValidator.isValid("/uploads/../secret.jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/..%2fsecret.jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/sub/a.jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/..jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/.jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a..jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads\\a.jpg"));
        assertFalse(UploadUrlValidator.isValid("uploads/a.jpg"));
        assertFalse(UploadUrlValidator.isValid("/api/uploads/a.jpg"));
    }

    @Test
    void 이미지가_아닌_확장자나_추가_문자가_붙은_주소는_거절한다() {
        assertFalse(UploadUrlValidator.isValid("/uploads/a.html"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a.svg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a.jpg.exe"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a.jpg?x=1"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a.jpg#frag"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a.jpg\" onerror=\"alert(1)"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a b.jpg"));
        assertFalse(UploadUrlValidator.isValid("/uploads/a.jpg\n"));
        assertFalse(UploadUrlValidator.isValid("/uploads/"));
    }

    @Test
    void 컬럼_크기_500자를_넘는_주소는_거절한다() {
        String longName = "a".repeat(500);

        assertFalse(UploadUrlValidator.isValid("/uploads/" + longName + ".jpg"));
        assertTrue(UploadUrlValidator.isValid("/uploads/" + "a".repeat(400) + ".jpg"));
    }

    @Test
    void null은_유효하지_않지만_선택_항목_검사에서는_통과한다() {
        assertFalse(UploadUrlValidator.isValid(null));
        assertDoesNotThrow(() -> UploadUrlValidator.requireValidOrBlank(null));
        assertDoesNotThrow(() -> UploadUrlValidator.requireValidOrBlank(""));
        assertDoesNotThrow(() -> UploadUrlValidator.requireValidOrBlank("   "));
        assertDoesNotThrow(() -> UploadUrlValidator.requireValidOrBlank("/uploads/a.jpg"));
    }

    @Test
    void 값이_있는데_형식이_틀리면_예외를_던진다() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> UploadUrlValidator.requireValidOrBlank("http://evil.example/a.jpg"));
        assertTrue(e.getMessage().contains("이미지 주소"));
    }
}
