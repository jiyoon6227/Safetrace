package com.safetrace.dto;

import java.time.LocalDateTime;

// 요청 처리 이력 화면용 한 단계. done=true는 이미 기록된 처리, false는 앞으로 남은 단계(current=지금 해야 할 단계)
public record ResourceTimelineStep(String key, String label, boolean done, boolean current,
                                   LocalDateTime time, String by, String note) {
}
