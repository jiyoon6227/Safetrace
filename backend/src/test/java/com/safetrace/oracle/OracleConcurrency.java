package com.safetrace.oracle;

import org.springframework.security.access.AccessDeniedException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/** 여러 스레드가 같은 순간에 출발하도록 하고, 각 호출의 결과(성공 또는 예외)를 모아 돌려준다. */
final class OracleConcurrency {

    private OracleConcurrency() {
    }

    /** 한 번의 호출 결과. error가 없으면 성공이다. */
    record Outcome(Object value, Throwable error) {

        boolean ok() {
            return error == null;
        }

        /** 업무 규칙 충돌(HTTP 409로 바뀌는 예외) */
        boolean conflict() {
            return error instanceof IllegalStateException;
        }

        String message() {
            return error == null ? "" : String.valueOf(error.getMessage());
        }

        /** 업무 규칙으로 거절된 예외(400·403·409). 락 대기 초과·DB 오류 같은 예상 밖 예외는 여기에 들어가지 않는다. */
        boolean businessError() {
            return error instanceof IllegalStateException
                    || error instanceof IllegalArgumentException
                    || error instanceof AccessDeniedException;
        }
    }

    static List<Outcome> runTogether(List<Callable<Object>> tasks) throws Exception {
        int count = tasks.size();
        ExecutorService pool = Executors.newFixedThreadPool(count);
        CountDownLatch ready = new CountDownLatch(count);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Outcome>> futures = new ArrayList<>();
        try {
            for (Callable<Object> task : tasks) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();   // 모든 스레드가 모이면 한꺼번에 출발
                    try {
                        return new Outcome(task.call(), null);
                    } catch (Throwable t) {
                        return new Outcome(null, t);
                    }
                }));
            }
            assertTrue(ready.await(30, TimeUnit.SECONDS), "스레드가 30초 안에 준비되지 않았습니다.");
            start.countDown();
            List<Outcome> outcomes = new ArrayList<>();
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get(90, TimeUnit.SECONDS));
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    static long count(List<Outcome> outcomes, Predicate<Outcome> condition) {
        return outcomes.stream().filter(condition).count();
    }

    /** 락 대기 초과(ORA-30006)·교착(ORA-00060)·DB 오류 같은 예상 밖 예외가 하나라도 있으면 실패시킨다. */
    static void assertOnlyBusinessErrors(List<Outcome> outcomes) {
        for (Outcome outcome : outcomes) {
            if (!outcome.ok() && !outcome.businessError()) {
                fail("업무 규칙 거절이 아닌 예외가 났습니다: " + outcome.error(), outcome.error());
            }
        }
    }
}
