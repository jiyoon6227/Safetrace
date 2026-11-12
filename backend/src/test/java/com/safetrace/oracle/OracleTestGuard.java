package com.safetrace.oracle;

import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

import java.util.Locale;

/**
 * Oracle 통합 테스트의 안전장치 1: 스프링(=DB 접속)이 시작되기 전에, 접속할 계정이 테스트 전용인지 확인한다.
 * 계정 이름이 _TEST로 끝나지 않으면 테스트를 시작하지 않는다 (개발 DB의 SYSTEM 같은 계정으로는 절대 돌지 않는다).
 */
public class OracleTestGuard implements BeforeAllCallback {

    static final String PASSWORD_ENV = "SAFETRACE_TEST_DB_PASSWORD";
    static final String USERNAME_ENV = "SAFETRACE_TEST_DB_USERNAME";
    static final String DEFAULT_USERNAME = "safetrace_test";

    @Override
    public void beforeAll(ExtensionContext context) {
        String username = configuredUsername();
        if (!isTestAccount(username)) {
            throw new IllegalStateException("Oracle 통합 테스트는 이름이 _TEST로 끝나는 테스트 전용 계정으로만 실행할 수 있습니다. 현재 설정: "
                    + username);
        }
    }

    static String configuredUsername() {
        String value = System.getenv(USERNAME_ENV);
        return value == null || value.isBlank() ? DEFAULT_USERNAME : value.trim();
    }

    static boolean isTestAccount(String username) {
        return username != null && username.toUpperCase(Locale.ROOT).endsWith("_TEST");
    }
}
