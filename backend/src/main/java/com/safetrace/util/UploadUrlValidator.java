package com.safetrace.util;

import java.util.regex.Pattern;

// 제보 사진 / 프로필 사진 URL 검증.
// 사진은 /api/uploads로 올린 파일(/uploads/파일명)만 쓸 수 있다.
// 외부 주소나 javascript: 같은 값이 저장되면 <img src>로 그대로 쓰이는 화면에서 문제가 되므로 서버에서 한 번 더 막는다.
public final class UploadUrlValidator {

    private static final int MAX_LENGTH = 500;
    private static final Pattern UPLOAD_URL =
            Pattern.compile("^/uploads/[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*\\.(?:jpe?g|png|gif|webp)$", Pattern.CASE_INSENSITIVE);

    private UploadUrlValidator() {}

    public static boolean isValid(String url) {
        return url != null && url.length() <= MAX_LENGTH && UPLOAD_URL.matcher(url).matches();
    }

    // 값이 있을 때만 검사한다 (사진은 선택 항목)
    public static void requireValidOrBlank(String url) {
        if (url != null && !url.isBlank() && !isValid(url)) {
            throw new IllegalArgumentException("이미지 주소가 올바르지 않습니다. 사진을 다시 올려주세요.");
        }
    }
}
