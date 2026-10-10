package com.safetrace.domain;

public enum IncidentStatus {
    RECEIVED("접수"),
    CONFIRMING("확인중"),
    RESPONDING("대응중"),
    RECOVERING("복구중"),
    CLOSED("종료");

    private final String label;

    IncidentStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    /**
     * 현재 상태에서 targetStatus로 전이가 가능한지 검사
     * - 단계를 건너뛸 수 없음 (RECEIVED -> RESPONDING 같은 skip 금지)
     * - 역행은 허용하지 않음 (CLOSED -> RECEIVED 같은 되돌리기 금지)
     */
    public boolean canTransitionTo(IncidentStatus target) {
        // 바로 다음 단계로만 이동 허용 (선언 순서 기준)
        return target.ordinal() == this.ordinal() + 1;
    }
}
