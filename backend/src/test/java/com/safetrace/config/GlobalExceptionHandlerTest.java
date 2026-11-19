package com.safetrace.config;

import com.safetrace.service.TooManyRequestsException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DeadlockLoserDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void 락_대기_시간_초과는_409로_응답한다() {
        ResponseEntity<Map<String, String>> response =
                handler.handleLockFailure(new CannotAcquireLockException("ORA-30006"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("다른 처리와 겹쳤습니다. 잠시 후 다시 시도해 주세요.", response.getBody().get("message"));
        assertEquals("LOCK_CONFLICT", response.getBody().get("code"));
    }

    @Test
    void 교착상태는_409로_응답한다() {
        ResponseEntity<Map<String, String>> response =
                handler.handleLockFailure(new DeadlockLoserDataAccessException("ORA-00060", null));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
    }

    @Test
    void 횟수_제한은_429와_Retry_After로_응답한다() {
        ResponseEntity<Map<String, String>> response =
                handler.handleTooManyRequests(new TooManyRequestsException("로그인 시도가 너무 많습니다. 10분 후 다시 시도해주세요.", 600));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("600", response.getHeaders().getFirst("Retry-After"));
        assertEquals("로그인 시도가 너무 많습니다. 10분 후 다시 시도해주세요.", response.getBody().get("message"));
    }

    @Test
    void 대기시간이_없으면_Retry_After_헤더를_넣지_않는다() {
        ResponseEntity<Map<String, String>> response =
                handler.handleTooManyRequests(new TooManyRequestsException("요청이 많습니다.", 0));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertNull(response.getHeaders().getFirst("Retry-After"));
    }

    @Test
    void 일부러_던진_ResponseStatusException의_안내_문구는_그대로_전달한다() {
        ResponseEntity<Map<String, String>> response = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 서비스 연결에 실패했습니다."));

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        assertEquals("AI 서비스 연결에 실패했습니다.", response.getBody().get("message"));
    }

    @Test
    void ResponseStatusException에_사유가_없으면_기본_문구를_쓴다() {
        ResponseEntity<Map<String, String>> response =
                handler.handleResponseStatus(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("요청을 처리하지 못했습니다.", response.getBody().get("message"));
    }

    @Test
    void 오류_메시지에_API_키가_섞여_있으면_가려서_응답한다() {
        IllegalArgumentException e = new IllegalArgumentException(
                "Illegal character in query at index 80: https://apis.data.go.kr/x?serviceKey=SECRETKEY123&pageNo=1");

        ResponseEntity<Map<String, String>> response = handler.handleIllegalArgument(e);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        String message = response.getBody().get("message");
        assertFalse(message.contains("SECRETKEY123"));
        assertTrue(message.contains("serviceKey=****"));
    }

    @Test
    void 일반_업무_예외_메시지는_그대로_전달한다() {
        ResponseEntity<Map<String, String>> response =
                handler.handleIllegalArgument(new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다."));

        assertEquals("아이디 또는 비밀번호가 올바르지 않습니다.", response.getBody().get("message"));
    }

    @Test
    void 메시지가_없는_예외도_NPE_없이_기본_문구로_응답한다() {
        ResponseEntity<Map<String, String>> badRequest = handler.handleIllegalArgument(new IllegalArgumentException());
        ResponseEntity<Map<String, String>> conflict = handler.handleIllegalState(new IllegalStateException());

        assertEquals(HttpStatus.BAD_REQUEST, badRequest.getStatusCode());
        assertEquals("요청 값이 올바르지 않습니다.", badRequest.getBody().get("message"));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        assertEquals("요청을 처리할 수 없는 상태입니다.", conflict.getBody().get("message"));
    }
}
