package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class MemberRegion {
    private Long memberRegionId;
    private Long memberId;
    private String regionCode;   // 공공 API 연동용, 당장은 null 가능
    private String regionName;   // 지역명/주소 (예: 대전광역시 유성구 어은동 123-4)
    private Double latitude;     // 위도 (지도 마커, 날씨/대기질 조회용)
    private Double longitude;    // 경도 (지도 마커, 날씨/대기질 조회용)
    private String regionLabel;  // 우리집/가족보호/관심지역 등 자유 라벨
    private String isPrimary;    // Y/N - 대표 관심지역
    private LocalDateTime createdAt;
}