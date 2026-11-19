package com.safetrace.util;

import java.util.regex.Pattern;

/**
 * 로그·오류 응답에 API 키가 그대로 찍히지 않도록 가리는 도구.
 * 공공데이터 API는 키를 URL 쿼리(serviceKey=...)로 보내기 때문에, URL이나 그 URL이 들어간 예외 메시지를
 * 그대로 로그에 남기면 키가 노출된다.
 */
public final class LogSanitizer {

    // serviceKey=..., ServiceKey=..., api_key=..., apikey=..., key=... 값을 & 또는 공백/따옴표 전까지 가린다
    private static final Pattern KEY_PARAM = Pattern.compile(
            "(?i)((?:service[_-]?key|api[_-]?key|access[_-]?token|key)=)[^&\\s\"'<>]+");
    // Authorization: Bearer xxxx
    private static final Pattern BEARER = Pattern.compile("(?i)(bearer\\s+)[A-Za-z0-9._~+/=-]+");

    private static final String MASK = "****";

    private LogSanitizer() {
    }

    public static String mask(String text) {
        if (text == null) {
            return null;
        }
        String masked = KEY_PARAM.matcher(text).replaceAll("$1" + MASK);
        return BEARER.matcher(masked).replaceAll("$1" + MASK);
    }

    /** 예외를 로그에 남길 때 쓰는 한 줄 표현(클래스명: 메시지). 메시지 안의 키는 가린다. */
    public static String describe(Throwable e) {
        return e.getClass().getName() + ": " + mask(e.getMessage());
    }
}
