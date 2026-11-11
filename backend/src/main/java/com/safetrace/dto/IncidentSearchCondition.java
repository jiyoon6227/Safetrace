package com.safetrace.dto;

import lombok.Data;

import java.time.LocalDateTime;

// 매퍼에 넘기는 사건 검색 조건 - 서비스에서 정리한 값만 담음 (null이면 조건 없음)
@Data
public class IncidentSearchCondition {
    private String q;                // 소문자 + LIKE 특수문자 이스케이프 완료
    private String status;
    private String type;
    private String region;           // 시/도 접두어 (LIKE 이스케이프 완료)
    private String severity;
    private LocalDateTime fromStart; // 시작일 0시 (이상)
    private LocalDateTime toEnd;     // 종료일 다음 날 0시 (미만)
    private boolean oldestFirst;
    private int offset;
    private int size;
}
