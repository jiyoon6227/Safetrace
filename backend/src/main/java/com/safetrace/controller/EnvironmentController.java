package com.safetrace.controller;

import com.safetrace.external.AirQualityService;
import com.safetrace.external.DisasterMessageService;
import com.safetrace.external.ShelterService;
import com.safetrace.external.UvIndexService;
import com.safetrace.external.WeatherAlertService;
import com.safetrace.external.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

// 공공데이터포털(기상청/에어코리아/행안부) 연동 - 개인정보 없는 공개 환경정보라 인증 없이 열어둠(permitAll)
@RestController
@RequestMapping("/api/environment")
@RequiredArgsConstructor
public class EnvironmentController {

    private final WeatherService weatherService;
    private final AirQualityService airQualityService;
    private final UvIndexService uvIndexService;
    private final ShelterService shelterService;
    private final DisasterMessageService disasterMessageService;
    private final WeatherAlertService weatherAlertService;

    // 최근 며칠 이내 기상특보 발표/해제 목록 (기본 3일)
    @GetMapping("/weather-alerts")
    public Map<String, Object> getWeatherAlerts(@RequestParam(defaultValue = "3") int lookbackDays) {
        return weatherAlertService.getWeatherAlerts(lookbackDays);
    }

    // 좌표 기준 현재 날씨 (기상청 초단기실황)
    @GetMapping("/weather")
    public Map<String, Object> getWeather(@RequestParam double lat, @RequestParam double lng) {
        return weatherService.getCurrentWeather(lat, lng);
    }

    // 시/도명 기준 대기질 (에어코리아 시도별 실시간 평균)
    @GetMapping("/air-quality")
    public Map<String, Object> getAirQuality(@RequestParam String sido) {
        return airQualityService.getAirQuality(sido);
    }

    // 시/도명 기준 자외선지수 (기상청 생활기상지수)
    @GetMapping("/uv-index")
    public Map<String, Object> getUvIndex(@RequestParam String sido) {
        return uvIndexService.getUvIndex(sido);
    }

    // 전국 등록 민방위대피시설 총 건수
    @GetMapping("/shelters/summary")
    public Map<String, Object> getShelterSummary() {
        return shelterService.getNationwideSummary();
    }

    // 시/군/구명 + 좌표 기준 근처 민방위대피시설 (거리순 정렬, 기본 5개)
    @GetMapping("/shelters")
    public List<Map<String, Object>> getShelters(
            @RequestParam String guName,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5") int limit
    ) {
        return shelterService.getNearbyShelters(guName, lat, lng, limit);
    }

    // 공공정보 '대피시설 전체보기' 모달용 - 전국/시도별 검색 + 페이지네이션
    @GetMapping("/shelters/search")
    public Map<String, Object> searchShelters(
            @RequestParam(defaultValue = "") String region,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return shelterService.searchShelters(region, keyword, page, size);
    }

    /**
     * 공공정보 대시보드용.
     * 지역 필터 없이 전국에서 최근 48시간 이내 발송된 재난문자를 최신순으로 반환한다.
     */
    @GetMapping("/disaster-messages/nationwide")
    public List<Map<String, Object>> getNationwideDisasterMessages(
            @RequestParam(defaultValue = "100") int limit
    ) {
        try {
            return disasterMessageService.getRecentMessagesNationwide(limit);
        } catch (DisasterMessageService.DisasterMessageApiException e) {
            // 쿼터 초과/인증 오류 등 외부 API 실패 - 대시보드가 500으로 죽는 대신 빈 목록으로 응답.
            return List.of();
        }
    }

    /**
     * 마이페이지의 "최근 안전·재난 소식"용.
     * 최근 48시간 이내에 실제 발송된 재난문자만 반환한다.
     */
    @GetMapping("/disaster-messages")
    public List<Map<String, Object>> getDisasterMessages(
            @RequestParam String rgnNm,
            @RequestParam(defaultValue = "5") int limit
    ) {
        try {
            return disasterMessageService.getRecentMessages(rgnNm, limit);
        } catch (DisasterMessageService.DisasterMessageApiException e) {
            return List.of();
        }
    }

    /**
     * 안전·재난 소식 더보기 페이지용.
     * 사용자가 선택한 날짜 범위의 재난문자를 반환한다.
     *
     * 예:
     * /api/environment/disaster-messages/history
     * ?rgnNm=부산광역시%20서구
     * &startDate=2026-06-01
     * &endDate=2026-09-11
     * &limit=500
     */
    @GetMapping("/disaster-messages/history")
    public List<Map<String, Object>> getDisasterMessageHistory(
            @RequestParam String rgnNm,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "500") int limit
    ) {
        try {
            return disasterMessageService.getMessagesByPeriod(rgnNm, startDate, endDate, limit);
        } catch (DisasterMessageService.DisasterMessageApiException e) {
            return List.of();
        }
    }
}