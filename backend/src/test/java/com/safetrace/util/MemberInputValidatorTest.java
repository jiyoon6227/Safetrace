package com.safetrace.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MemberInputValidatorTest {

    private void rejectsSignup(String loginId, String name, String email) {
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validateSignup(loginId, name, email));
    }

    @Test
    void 올바른_가입_정보는_통과한다() {
        assertDoesNotThrow(() -> MemberInputValidator.validateSignup("newuser1", "곽지윤", "jiyoon@test.com"));
        assertDoesNotThrow(() -> MemberInputValidator.validateSignup("user.name-1_a", "Jiyoon Kwak", "a.b+c@sub.test.co.kr"));
    }

    @Test
    void 기존_계정_아이디_형식도_가입_규칙에_맞는다() {
        // 기본 데이터의 아이디(staff, user1, user2)와 같은 형식
        assertDoesNotThrow(() -> MemberInputValidator.validateLoginId("staff"));
        assertDoesNotThrow(() -> MemberInputValidator.validateLoginId("user1"));
    }

    @Test
    void 아이디는_4자_미만_30자_초과_허용되지_않는_문자는_거절한다() {
        rejectsSignup("abc", "이름", "a@test.com");
        rejectsSignup("a".repeat(31), "이름", "a@test.com");
        rejectsSignup("new user", "이름", "a@test.com");
        rejectsSignup("new/user", "이름", "a@test.com");
        rejectsSignup("user<script>", "이름", "a@test.com");
        rejectsSignup("아이디한글", "이름", "a@test.com");
        rejectsSignup("user\n1", "이름", "a@test.com");
        rejectsSignup("", "이름", "a@test.com");
        rejectsSignup(null, "이름", "a@test.com");
        assertDoesNotThrow(() -> MemberInputValidator.validateLoginId("a".repeat(30)));
        assertDoesNotThrow(() -> MemberInputValidator.validateLoginId("abcd"));
    }

    @Test
    void 이름은_비어_있거나_50자를_넘거나_태그_기호가_있으면_거절한다() {
        rejectsSignup("newuser", "", "a@test.com");
        rejectsSignup("newuser", "   ", "a@test.com");
        rejectsSignup("newuser", null, "a@test.com");
        rejectsSignup("newuser", "가".repeat(51), "a@test.com");
        rejectsSignup("newuser", "<script>alert(1)</script>", "a@test.com");
        rejectsSignup("newuser", "홍길동>", "a@test.com");
        rejectsSignup("newuser", "홍길\n동", "a@test.com");
        assertDoesNotThrow(() -> MemberInputValidator.validateName("가".repeat(50)));
        assertDoesNotThrow(() -> MemberInputValidator.validateName("O'Brien Jr."));
    }

    @Test
    void 이메일은_형식이_틀리거나_100자를_넘으면_거절한다() {
        rejectsSignup("newuser", "이름", "");
        rejectsSignup("newuser", "이름", " ");
        rejectsSignup("newuser", "이름", null);
        rejectsSignup("newuser", "이름", "not-an-email");
        rejectsSignup("newuser", "이름", "a@b");
        rejectsSignup("newuser", "이름", "@test.com");
        rejectsSignup("newuser", "이름", "a@@test.com");
        rejectsSignup("newuser", "이름", "a b@test.com");
        rejectsSignup("newuser", "이름", "<a@test.com>");
        rejectsSignup("newuser", "이름", "a@test.com\nBcc: victim@test.com");
        rejectsSignup("newuser", "이름", "a".repeat(95) + "@test.com");
    }

    @Test
    void 정규식_성능을_노린_긴_입력도_바로_거절한다() {
        String attack = "a@" + "a.".repeat(5000) + "!";

        long start = System.nanoTime();
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validateEmail(attack));

        assertTrue((System.nanoTime() - start) / 1_000_000 < 1000);
    }

    @Test
    void 전화번호는_비워두거나_국내_번호_형식이어야_한다() {
        for (String phone : new String[]{null, "", "  ", "010-1234-5678", "01012345678", "010-123-4567", "02-123-4567", "031-1234-5678"}) {
            assertDoesNotThrow(() -> MemberInputValidator.validatePhoneOrBlank(phone), "허용: " + phone);
        }
        for (String phone : new String[]{"010-12", "abcdefg", "010-1234-567890", "+82-10-1234-5678", "<b>010</b>", "010-1234-5678 ", "1".repeat(30)}) {
            assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validatePhoneOrBlank(phone), "거절: " + phone);
        }
        assertTrue(MemberInputValidator.isValidPhone("010-1234-5678"));
        assertFalse(MemberInputValidator.isValidPhone(null));
    }

    @Test
    void 프로필은_이름과_주소_길이를_본다() {
        assertDoesNotThrow(() -> MemberInputValidator.validateProfile("홍길동", "010-1234-5678", "대전광역시 서구", "101호"));
        assertDoesNotThrow(() -> MemberInputValidator.validateProfile("홍길동", null, null, null));
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validateProfile("", null, null, null));
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validateProfile("홍길동", "bad", null, null));
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validateProfile("홍길동", null, "가".repeat(201), null));
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.validateProfile("홍길동", null, null, "가".repeat(201)));
        assertDoesNotThrow(() -> MemberInputValidator.validateProfile("홍길동", null, "가".repeat(200), "가".repeat(200)));
    }

    // ---- 가족 검색어 ---------------------------------------------------------

    @Test
    void 검색어는_앞뒤_공백을_지우고_2자_이상_30자_이하여야_한다() {
        assertEquals("ab", MemberInputValidator.toLoginIdSearchKeyword("  ab  "));
        assertEquals("a".repeat(30), MemberInputValidator.toLoginIdSearchKeyword("a".repeat(30)));

        for (String keyword : new String[]{null, "", "   ", "a", " a ", "a".repeat(31)}) {
            assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.toLoginIdSearchKeyword(keyword), "거절: " + keyword);
        }
    }

    @Test
    void 검색어의_퍼센트와_밑줄과_역슬래시는_글자_그대로_찾도록_이스케이프한다() {
        assertEquals("\\%\\%", MemberInputValidator.toLoginIdSearchKeyword("%%"));
        assertEquals("a\\_b", MemberInputValidator.toLoginIdSearchKeyword("a_b"));
        assertEquals("a\\\\b", MemberInputValidator.toLoginIdSearchKeyword("a\\b"));
        // 이스케이프 문자가 먼저 처리되어야 %를 이스케이프한 뒤의 역슬래시가 다시 이중으로 처리되지 않는다
        assertEquals("\\\\\\%", MemberInputValidator.toLoginIdSearchKeyword("\\%"));
        assertEquals("user.01", MemberInputValidator.toLoginIdSearchKeyword("user.01"));
    }

    @Test
    void 와일드카드만으로_이루어진_검색어도_전체_조회가_되지_않는다() {
        // "%%"는 이스케이프되면 "\%\%"(길이 4)가 되어 글자 그대로 찾는다. 길이 검사는 이스케이프 전 글자 수 기준이다.
        assertEquals("\\%\\%", MemberInputValidator.toLoginIdSearchKeyword("%%"));
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.toLoginIdSearchKeyword("%"));
        assertThrows(IllegalArgumentException.class, () -> MemberInputValidator.toLoginIdSearchKeyword("_"));
    }
}
