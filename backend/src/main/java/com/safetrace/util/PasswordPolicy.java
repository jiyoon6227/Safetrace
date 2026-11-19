package com.safetrace.util;

import java.nio.charset.StandardCharsets;

/**
 * 서버 쪽 비밀번호 규칙. 화면에서 걸러도 API를 직접 호출하면 우회되므로 가입·변경·재설정 모두 여기서 다시 검사한다.
 * 로그인 시에는 쓰지 않는다 (예전에 만든 짧은 비밀번호 계정도 로그인은 되어야 하므로).
 * <p>
 * 규칙: 8~64자 / 영문자·숫자를 각각 1자 이상 / 공백 없음 / 아이디를 포함하지 않음 /
 *       BCrypt는 72바이트까지만 비교하므로 UTF-8로 72바이트를 넘지 않음
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 64;
    private static final int BCRYPT_MAX_BYTES = 72;

    public static final String RULE_MESSAGE =
            "비밀번호는 8~64자이며 영문과 숫자를 각각 1자 이상 포함해야 하고, 공백은 사용할 수 없습니다.";

    private PasswordPolicy() {
    }

    /** 규칙을 어기면 IllegalArgumentException(화면에 그대로 보여줄 한글 메시지). */
    public static void validate(String password, String loginId) {
        if (password == null || password.isEmpty()) {
            throw new IllegalArgumentException("비밀번호를 입력해주세요.");
        }
        int length = password.codePointCount(0, password.length());
        if (length < MIN_LENGTH || length > MAX_LENGTH
                || password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw new IllegalArgumentException(RULE_MESSAGE);
        }

        boolean hasLetter = false;
        boolean hasDigit = false;
        for (int i = 0; i < password.length(); ) {
            int cp = password.codePointAt(i);
            if (Character.isWhitespace(cp) || Character.isSpaceChar(cp)) {
                throw new IllegalArgumentException(RULE_MESSAGE);
            }
            if (Character.isLetter(cp)) {
                hasLetter = true;
            } else if (Character.isDigit(cp)) {
                hasDigit = true;
            }
            i += Character.charCount(cp);
        }
        if (!hasLetter || !hasDigit) {
            throw new IllegalArgumentException(RULE_MESSAGE);
        }

        if (loginId != null && !loginId.isBlank()
                && password.toLowerCase().contains(loginId.trim().toLowerCase())) {
            throw new IllegalArgumentException("비밀번호에 아이디를 포함할 수 없습니다.");
        }
    }
}
