package com.safetrace.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

// 제보 등록 요청의 서버 측 입력값 검증 (화면에서 막는 값도 API 직접 호출로 들어올 수 있다)
class ReportCreateRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private ReportCreateRequest request(String disasterType, String content, Double latitude, Double longitude,
                                        String address, String reporterPhone, List<String> additionalPhotoUrls) {
        return new ReportCreateRequest(disasterType, content, latitude, longitude, address, reporterPhone,
                "/uploads/a.jpg", additionalPhotoUrls);
    }

    private ReportCreateRequest valid() {
        return request("침수", "도로가 잠겼어요", 36.35, 127.38, "대전광역시 서구", "010-1234-5678", List.of("/uploads/b.jpg"));
    }

    private boolean hasViolationOn(Set<ConstraintViolation<ReportCreateRequest>> violations, String field) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    @Test
    void 올바른_제보는_통과한다() {
        assertTrue(validator.validate(valid()).isEmpty());
    }

    @Test
    void 제보_화면의_재난_유형은_모두_통과한다() {
        for (String type : List.of("침수", "화재", "산사태", "강풍", "폭염", "한파", "기타")) {
            assertTrue(validator.validate(request(type, "내용", 36.35, 127.38, null, null, null)).isEmpty(), type);
        }
    }

    @Test
    void 선택지에_없는_재난_유형은_거절한다() {
        assertTrue(hasViolationOn(validator.validate(request("<script>", "내용", 36.35, 127.38, null, null, null)), "disasterType"));
        assertTrue(hasViolationOn(validator.validate(request("지진", "내용", 36.35, 127.38, null, null, null)), "disasterType"));
        assertTrue(hasViolationOn(validator.validate(request("", "내용", 36.35, 127.38, null, null, null)), "disasterType"));
        assertTrue(hasViolationOn(validator.validate(request(null, "내용", 36.35, 127.38, null, null, null)), "disasterType"));
    }

    @Test
    void 현장_상황은_비어_있거나_1000자를_넘으면_거절한다() {
        assertTrue(hasViolationOn(validator.validate(request("침수", " ", 36.35, 127.38, null, null, null)), "content"));
        assertTrue(hasViolationOn(validator.validate(request("침수", "가".repeat(1001), 36.35, 127.38, null, null, null)), "content"));
        assertTrue(validator.validate(request("침수", "가".repeat(1000), 36.35, 127.38, null, null, null)).isEmpty());
    }

    @Test
    void 위도_경도는_지구_좌표_범위를_벗어나면_거절한다() {
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", 90.1, 127.38, null, null, null)), "latitude"));
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", -90.1, 127.38, null, null, null)), "latitude"));
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", 36.35, 180.1, null, null, null)), "longitude"));
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", 36.35, -180.1, null, null, null)), "longitude"));
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", null, 127.38, null, null, null)), "latitude"));
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", 36.35, null, null, null, null)), "longitude"));
    }

    @Test
    void 주소는_300자를_넘으면_거절한다() {
        assertTrue(hasViolationOn(validator.validate(request("침수", "내용", 36.35, 127.38, "가".repeat(301), null, null)), "address"));
        assertTrue(validator.validate(request("침수", "내용", 36.35, 127.38, "가".repeat(300), null, null)).isEmpty());
    }

    @Test
    void 연락처는_비워두거나_전화번호_형식이어야_한다() {
        for (String phone : new String[]{null, "", "010-1234-5678", "01012345678", "011-123-4567", "02-123-4567"}) {
            assertTrue(validator.validate(request("침수", "내용", 36.35, 127.38, null, phone, null)).isEmpty(), "허용: " + phone);
        }
        for (String phone : new String[]{"010-12", "abc", "<img src=x onerror=alert(1)>", "010-1234-5678; DROP TABLE", "1".repeat(40)}) {
            assertTrue(hasViolationOn(validator.validate(request("침수", "내용", 36.35, 127.38, null, phone, null)), "reporterPhone"), "거절: " + phone);
        }
    }

    @Test
    void 추가_사진은_6장_이상_보낼_수_없다() {
        List<String> six = List.of("/uploads/1.jpg", "/uploads/2.jpg", "/uploads/3.jpg", "/uploads/4.jpg", "/uploads/5.jpg", "/uploads/6.jpg");

        Set<ConstraintViolation<ReportCreateRequest>> violations =
                validator.validate(request("침수", "내용", 36.35, 127.38, null, null, six));

        assertEquals(1, violations.size());
        assertTrue(hasViolationOn(violations, "additionalPhotoUrls"));
    }
}
