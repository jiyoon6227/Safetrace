package com.safetrace.config;

import com.safetrace.service.TooManyRequestsException;
import com.safetrace.util.LogSanitizer;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

// 서비스 예외 메시지를 응답 message로 전달 (기본 동작은 메시지 누락)
// 단, 메시지 안에 API 키가 섞여 나가지 않도록 LogSanitizer로 한 번 가린다.
// (예: 외부 API 주소를 만들다 난 IllegalArgumentException 메시지에는 serviceKey가 들어 있을 수 있다)
// 이 핸들러가 다루지 않는 예외(RuntimeException 등)는 Spring 기본 처리로 가고,
// server.error.include-message=never 설정(application.properties) 때문에 상세 메시지는 응답에 담기지 않는다.
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", safeMessage(e.getMessage(), "요청 값이 올바르지 않습니다.")));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", safeMessage(e.getMessage(), "요청을 처리할 수 없는 상태입니다.")));
    }

    // 로그인 시도·인증메일 발송 횟수 제한 - 429 + Retry-After(초)
    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<Map<String, String>> handleTooManyRequests(TooManyRequestsException e) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS);
        if (e.getRetryAfterSeconds() > 0) {
            builder.header("Retry-After", String.valueOf(e.getRetryAfterSeconds()));
        }
        return builder.body(Map.of("message", safeMessage(e.getMessage(), "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")));
    }

    // 코드에서 일부러 던진 ResponseStatusException(AI 서비스 오류 안내 등)의 한글 안내 문구는 그대로 전달.
    // include-message=never 로 바꾸면 Spring 기본 처리에서는 이 문구가 사라지므로 여기서 직접 담아준다.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("message", safeMessage(e.getReason(), "요청을 처리하지 못했습니다.")));
    }

    // @Valid 검증 실패 시 400 + 첫 번째 오류 메시지
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getAllErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage())
                .orElse("요청 값이 올바르지 않습니다.");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    // 권한 없음 시 403 + 서버 메시지 (Spring 기본 문구는 "권한이 없습니다."로 대체)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException e) {
        String message = e.getMessage();
        if (message == null || message.isBlank() || "Access Denied".equals(message)) {
            message = "권한이 없습니다.";
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", message));
    }

    private static String safeMessage(String message, String fallback) {
        if (message == null || message.isBlank()) {
            return fallback;
        }
        return LogSanitizer.mask(message);
    }

    // DB 락 대기 시간 초과(ORA-30006·ORA-00054)나 교착(ORA-00060)은 재고 부족 같은 업무 규칙 위반이 아니라
    // 다른 처리와 동시에 부딪힌 일시적 충돌이다. 같은 409지만 code로 구분하고, 다시 시도하라고 안내한다.
    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> handleLockFailure(PessimisticLockingFailureException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "code", "LOCK_CONFLICT",
                "message", "다른 처리와 겹쳤습니다. 잠시 후 다시 시도해 주세요."));
    }
}