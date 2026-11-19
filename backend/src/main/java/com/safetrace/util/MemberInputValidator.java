package com.safetrace.util;

import java.util.regex.Pattern;

// 회원가입 / 내정보 수정 입력값 검증.
// 화면에서 막더라도 API를 직접 호출하면 우회되므로 서버에서도 확인한다. 길이 상한은 SF_MEMBER 컬럼 크기를 따른다.
public final class MemberInputValidator {

    private static final Pattern LOGIN_ID = Pattern.compile("^[A-Za-z0-9._-]{4,30}$");
    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}$");
    // 010-1234-5678, 01012345678, 02-123-4567 형태
    private static final Pattern PHONE = Pattern.compile("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$");

    static final int NAME_MAX = 50;
    static final int EMAIL_MAX = 100;
    static final int ADDRESS_MAX = 200;
    static final int SEARCH_KEYWORD_MIN = 2;
    static final int SEARCH_KEYWORD_MAX = 30;

    private MemberInputValidator() {}

    public static void validateSignup(String loginId, String name, String email) {
        validateLoginId(loginId);
        validateName(name);
        validateEmail(email);
    }

    public static void validateLoginId(String loginId) {
        if (loginId == null || !LOGIN_ID.matcher(loginId).matches()) {
            throw new IllegalArgumentException("아이디는 영문, 숫자, 특수문자(. _ -) 4~30자로 입력해주세요.");
        }
    }

    public static void validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }
        if (name.length() > NAME_MAX) {
            throw new IllegalArgumentException("이름은 " + NAME_MAX + "자 이하로 입력해주세요.");
        }
        // 제어문자와 HTML 태그 기호는 이름에 쓸 일이 없다 (메일·화면에 그대로 찍히는 값)
        if (name.chars().anyMatch(c -> Character.isISOControl(c) || c == '<' || c == '>')) {
            throw new IllegalArgumentException("이름에 사용할 수 없는 문자가 있습니다.");
        }
    }

    public static void validateEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일을 입력해주세요.");
        }
        if (email.length() > EMAIL_MAX || !EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("이메일 형식이 올바르지 않습니다.");
        }
    }

    // 전화번호는 선택 항목 - 값이 있을 때만 형식을 본다
    public static void validatePhoneOrBlank(String phone) {
        if (phone != null && !phone.isBlank() && !isValidPhone(phone)) {
            throw new IllegalArgumentException("전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)");
        }
    }

    public static boolean isValidPhone(String phone) {
        return phone != null && PHONE.matcher(phone).matches();
    }

    // 가족 등록 검색어 - 공백 제거·길이 확인 후 LIKE용으로 %, _, \ 를 이스케이프 (ESCAPE '\')
    public static String toLoginIdSearchKeyword(String raw) {
        String keyword = raw == null ? "" : raw.trim();
        if (keyword.length() < SEARCH_KEYWORD_MIN || keyword.length() > SEARCH_KEYWORD_MAX) {
            throw new IllegalArgumentException("검색할 아이디를 " + SEARCH_KEYWORD_MIN + "자 이상 " + SEARCH_KEYWORD_MAX + "자 이하로 입력해주세요.");
        }
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    // 내정보 수정에서 받는 이름·전화·주소·상세주소 검증 (프로필 사진 URL은 UploadUrlValidator)
    public static void validateProfile(String name, String phone, String address, String addressDetail) {
        validateName(name);
        validatePhoneOrBlank(phone);
        validateMaxLength(address, ADDRESS_MAX, "주소");
        validateMaxLength(addressDetail, ADDRESS_MAX, "상세주소");
    }

    private static void validateMaxLength(String value, int max, String label) {
        if (value != null && value.length() > max) {
            throw new IllegalArgumentException(label + "는 " + max + "자 이하로 입력해주세요.");
        }
    }
}
