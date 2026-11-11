package com.safetrace.config;

import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DeadlockLoserDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
