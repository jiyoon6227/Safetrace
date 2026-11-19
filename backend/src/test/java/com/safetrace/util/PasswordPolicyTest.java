package com.safetrace.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PasswordPolicyTest {

    private void assertRejected(String password, String loginId) {
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.validate(password, loginId));
    }

    @Test
    void 규칙을_지킨_비밀번호는_통과한다() {
        assertDoesNotThrow(() -> PasswordPolicy.validate("password123!", "newuser"));
        assertDoesNotThrow(() -> PasswordPolicy.validate("abcd1234", "tester"));
        assertDoesNotThrow(() -> PasswordPolicy.validate("안전한비밀번호1234", "tester")); // 한글 + 숫자
    }

    @Test
    void 여덟자_미만은_거절한다() {
        assertRejected("abc1234", "tester");
    }

    @Test
    void 정확히_여덟자는_통과한다() {
        assertDoesNotThrow(() -> PasswordPolicy.validate("abcdefg1", "tester"));
    }

    @Test
    void 숫자만_또는_영문만이면_거절한다() {
        assertRejected("12345678", "tester");
        assertRejected("abcdefgh", "tester");
        assertRejected("!!!!!!!!1", "tester"); // 문자(letter) 없음
    }

    @Test
    void 공백이_있으면_거절한다() {
        assertRejected("abcd 1234", "tester");
        assertRejected(" abcd1234", "tester");
        assertRejected("abcd1234\t", "tester");
    }

    @Test
    void 비어있거나_null이면_거절한다() {
        assertRejected(null, "tester");
        assertRejected("", "tester");
    }

    @Test
    void 아이디를_포함하면_거절한다_대소문자_무관() {
        assertRejected("tester1234", "tester");
        assertRejected("MyTESTER123", "tester");
    }

    @Test
    void 아이디가_없어도_나머지_규칙은_검사한다() {
        assertDoesNotThrow(() -> PasswordPolicy.validate("abcd1234", null));
        assertRejected("abcdefgh", null);
    }

    @Test
    void 최대_육십사자를_넘으면_거절한다() {
        String ok = "a1".repeat(32);       // 64자
        String tooLong = "a1".repeat(32) + "a"; // 65자
        assertDoesNotThrow(() -> PasswordPolicy.validate(ok, "tester"));
        assertRejected(tooLong, "tester");
    }

    @Test
    void BCrypt_72바이트를_넘는_한글_비밀번호는_거절한다() {
        // 한글 1자 = UTF-8 3바이트. 25자 = 75바이트 (글자 수는 64자 이하지만 바이트가 72를 넘음)
        String password = "가".repeat(24) + "a1" + "나";
        assertRejected(password, "tester");
    }

    @Test
    void 규칙_위반_메시지는_화면에_보여줄_한글_안내다() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> PasswordPolicy.validate("abc", "tester"));
        assertEquals(PasswordPolicy.RULE_MESSAGE, e.getMessage());
    }
}
