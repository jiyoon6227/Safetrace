package com.safetrace.service;

/**
 * 시도 횟수·발송 횟수 제한에 걸렸을 때 던지는 예외. GlobalExceptionHandler가 429로 변환한다.
 */
public class TooManyRequestsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyRequestsException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
