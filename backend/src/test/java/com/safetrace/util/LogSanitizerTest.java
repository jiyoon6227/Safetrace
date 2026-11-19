package com.safetrace.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LogSanitizerTest {

    @Test
    void URL의_serviceKey_값을_가린다() {
        String url = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc?serviceKey=AbC%2Bdef%3D%3D&returnType=json&pageNo=1";

        String masked = LogSanitizer.mask(url);

        assertFalse(masked.contains("AbC%2Bdef%3D%3D"));
        assertEquals("https://apis.data.go.kr/B552584/ArpltnInforInqireSvc?serviceKey=****&returnType=json&pageNo=1", masked);
    }

    @Test
    void ServiceKey_대소문자와_마지막_파라미터도_가린다() {
        assertEquals("http://x/y?pageNo=1&ServiceKey=****", LogSanitizer.mask("http://x/y?pageNo=1&ServiceKey=SECRET"));
    }

    @Test
    void api_key와_key_파라미터도_가린다() {
        assertTrue(LogSanitizer.mask("http://x/y?api_key=SECRET1&a=b").contains("api_key=****&a=b"));
        assertTrue(LogSanitizer.mask("http://x/y?apikey=SECRET2").contains("apikey=****"));
        assertTrue(LogSanitizer.mask("http://x/y?key=SECRET3").contains("key=****"));
    }

    @Test
    void 예외_메시지_속_주소도_가린다() {
        String message = "Illegal character in query at index 90: https://x/y?serviceKey=SECRET&cond[A]=가";

        String masked = LogSanitizer.mask(message);

        assertFalse(masked.contains("SECRET"));
        assertTrue(masked.contains("serviceKey=****"));
    }

    @Test
    void Bearer_토큰을_가린다() {
        String masked = LogSanitizer.mask("Authorization: Bearer gsk_abc.DEF-123_xyz");

        assertFalse(masked.contains("gsk_abc"));
        assertTrue(masked.contains("Bearer ****"));
    }

    @Test
    void 키가_없는_문자열은_그대로_둔다() {
        String text = "대피시설 API 오류 응답: guName=중구, resultCode=30";
        assertEquals(text, LogSanitizer.mask(text));
    }

    @Test
    void null은_null로_돌려준다() {
        assertNull(LogSanitizer.mask(null));
    }

    @Test
    void describe는_클래스명과_가려진_메시지를_돌려준다() {
        Exception e = new IllegalArgumentException("bad uri https://x/y?serviceKey=SECRET");

        String text = LogSanitizer.describe(e);

        assertTrue(text.startsWith("java.lang.IllegalArgumentException: "));
        assertFalse(text.contains("SECRET"));
    }

    @Test
    void describe는_메시지가_없는_예외도_처리한다() {
        assertEquals("java.io.IOException: null", LogSanitizer.describe(new java.io.IOException()));
    }
}
