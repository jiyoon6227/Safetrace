package com.safetrace.controller;

import com.safetrace.external.AirQualityService;
import com.safetrace.external.DisasterMessageService;
import com.safetrace.external.ShelterService;
import com.safetrace.external.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

// 공공데이터포털(기상청/에어코리아/행안부) 연동 - 개인정보 없는 공개 환경정보라 인증 없이 열어둠(permitAll)
@RestController
@RequestMapping("/api/environment")
@RequiredArgsConstructor
public class EnvironmentController {

    private final WeatherService weatherService;
    private final AirQualityService airQualityService;
    private final ShelterService shelterService;
    private final DisasterMessageService disasterMessageService;

    // 좌표 기준 현재 날씨 (기상청 초단기실황)
    @GetMapping("/weather")
    public Map<String, Object> getWeather(@RequestParam double lat, @RequestParam double lng) {
        return weatherService.getCurrentWeather(lat, lng);
    }

    // 시/도명 기준 대기질 (에어코리아 시도별 실시간 평균) - sido는 "대전광역시"처럼 카카오 지오코딩이 주는 전체 행정구역명
    @GetMapping("/air-quality")
    public Map<String, Object> getAirQuality(@RequestParam String sido) {
        return airQualityService.getAirQuality(sido);
    }

    // 시/군/구명 + 좌표 기준 근처 민방위대피시설 (거리순 정렬, 기본 5개)
    // guName은 "유성구"처럼 카카오 지오코딩이 주는 시군구명, lat/lng은 거리 정렬용 기준 좌표
    @GetMapping("/shelters")
    public List<Map<String, Object>> getShelters(@RequestParam String guName,
                                                   @RequestParam double lat,
                                                   @RequestParam double lng,
                                                   @RequestParam(defaultValue = "5") int limit) {
        return shelterService.getNearbyShelters(guName, lat, lng, limit);
    }

    // 지역명 기준 실제 발송된 긴급재난문자 조회 (행정안전부, 재난안전데이터공유플랫폼)
    @GetMapping("/disaster-messages")
    public List<Map<String, Object>> getDisasterMessages(@RequestParam String rgnNm,
                                                            @RequestParam(defaultValue = "5") int limit) {
        return disasterMessageService.getRecentMessages(rgnNm, limit);
    }
}