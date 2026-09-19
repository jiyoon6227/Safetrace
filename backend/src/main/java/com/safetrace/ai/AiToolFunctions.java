package com.safetrace.ai;

import com.safetrace.domain.Incident;
import com.safetrace.external.DisasterMessageService;
import com.safetrace.external.ShelterService;
import com.safetrace.external.WeatherService;
import com.safetrace.service.IncidentService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * AI가 필요할 때 실제 SafeTrace DB/공공 API 데이터를 조회하는 로컬 도구.
 * LLM 업체와 무관하게 재사용할 수 있도록 별도 ai 패키지에 둔다.
 */
@Component
public class AiToolFunctions {

    private final WeatherService weatherService;
    private final DisasterMessageService disasterMessageService;
    private final ShelterService shelterService;
    private final IncidentService incidentService;

    public AiToolFunctions(
            WeatherService weatherService,
            DisasterMessageService disasterMessageService,
            ShelterService shelterService,
            IncidentService incidentService
    ) {
        this.weatherService = weatherService;
        this.disasterMessageService = disasterMessageService;
        this.shelterService = shelterService;
        this.incidentService = incidentService;
    }

    /** 현재 위치 기준 날씨 + 주변 사건 + 재난문자 + 가까운 대피시설 조회 */
    public String getCurrentSafetyData(String region, double lat, double lng) {
        String requestedRegion = normalizeRegion(region);
        StringBuilder result = new StringBuilder();
        result.append("[SafeTrace 현재 위치 안전정보]\n");
        result.append("기준 지역: ").append(requestedRegion.isBlank() ? "현재 위치" : requestedRegion).append("\n\n");

        try {
            Map<String, Object> weather = weatherService.getCurrentWeather(lat, lng);
            result.append("[현재 날씨]\n").append(weather == null || weather.isEmpty() ? "- 조회된 날씨 정보 없음\n" : weather + "\n");
        } catch (Exception e) {
            result.append("[현재 날씨]\n- 날씨 정보를 조회하지 못함\n");
        }

        try {
            List<Incident> incidents = incidentService.getActiveIncidentsNearby(lat, lng, 3.0);
            result.append("\n[3km 이내 진행 사건]\n");
            appendIncidents(result, incidents);
        } catch (Exception e) {
            result.append("\n[3km 이내 진행 사건]\n- 사건 정보를 조회하지 못함\n");
        }

        try {
            List<Map<String, Object>> messages = requestedRegion.isBlank()
                    ? List.of()
                    : disasterMessageService.getRecentMessages(requestedRegion, 8);
            result.append("\n[최근 재난문자]\n");
            appendMessages(result, messages);
        } catch (Exception e) {
            result.append("\n[최근 재난문자]\n- 재난문자를 조회하지 못함\n");
        }

        try {
            List<Map<String, Object>> shelters = requestedRegion.isBlank()
                    ? List.of()
                    : shelterService.getNearbyShelters(requestedRegion, lat, lng, 5);
            result.append("\n[가까운 대피시설]\n");
            appendNearbyShelters(result, shelters);
        } catch (Exception e) {
            result.append("\n[가까운 대피시설]\n- 대피시설을 조회하지 못함\n");
        }

        return result.toString();
    }

    /** 특정 지역의 재난문자 + 진행 사건 + 대피시설 조회 */
    public String getRegionalSafetyData(String region) {
        String requestedRegion = normalizeRegion(region);
        if (requestedRegion.isBlank()) return "지역명이 비어 있어 조회할 수 없습니다.";

        StringBuilder result = new StringBuilder();
        result.append("[SafeTrace 지역 안전정보 조회 결과]\n");
        result.append("조회 지역: ").append(requestedRegion).append("\n\n");

        try {
            List<Map<String, Object>> messages = disasterMessageService.getRecentMessages(requestedRegion, 8);
            result.append("[최근 재난문자]\n");
            appendMessages(result, messages);
        } catch (Exception e) {
            result.append("[최근 재난문자]\n- 재난문자를 조회하지 못함\n");
        }

        try {
            List<Incident> incidents = incidentService.getAllIncidents().stream()
                    .filter(incident -> incident.getStatus() != null && !"CLOSED".equals(incident.getStatus()))
                    .filter(incident -> regionMatches(incident.getRegion(), requestedRegion))
                    .limit(8)
                    .toList();
            result.append("\n[SafeTrace 진행 사건]\n");
            appendIncidents(result, incidents);
        } catch (Exception e) {
            result.append("\n[SafeTrace 진행 사건]\n- 사건 정보를 조회하지 못함\n");
        }

        try {
            Map<String, Object> shelterResult = shelterService.searchShelters(requestedRegion, "", 1, 5);
            result.append("\n[대피시설]\n");
            Object itemsObj = shelterResult.get("items");
            if (!(itemsObj instanceof List<?> items) || items.isEmpty()) {
                result.append("- 해당 지역에서 조회된 대피시설 없음\n");
            } else {
                int count = 0;
                for (Object itemObj : items) {
                    if (!(itemObj instanceof Map<?, ?> raw)) continue;
                    result.append("- ").append(rawValue(raw, "name"))
                            .append(" / 주소: ").append(rawValue(raw, "address"))
                            .append(" / 수용인원: ").append(rawValue(raw, "capacity"))
                            .append("\n");
                    if (++count >= 5) break;
                }
            }
        } catch (Exception e) {
            result.append("\n[대피시설]\n- 대피시설을 조회하지 못함\n");
        }

        return result.toString();
    }

    /** 전국 최근 재난문자 조회 */
    public String getNationwideDisasterMessages() {
        StringBuilder result = new StringBuilder("[전국 최근 재난문자]\n");
        try {
            appendMessages(result, disasterMessageService.getRecentMessagesNationwide(10));
        } catch (Exception e) {
            result.append("- 전국 재난문자를 조회하지 못함\n");
        }
        return result.toString();
    }

    private void appendIncidents(StringBuilder result, List<Incident> incidents) {
        if (incidents == null || incidents.isEmpty()) {
            result.append("- 조회된 진행 사건 없음\n");
            return;
        }
        for (Incident incident : incidents) {
            result.append("- ").append(nullSafe(incident.getTitle()))
                    .append(" / 유형: ").append(nullSafe(incident.getDisasterType()))
                    .append(" / 상태: ").append(nullSafe(incident.getStatus()))
                    .append(" / 위치: ").append(nullSafe(incident.getRegion()))
                    .append("\n");
        }
    }

    private void appendMessages(StringBuilder result, List<Map<String, Object>> messages) {
        if (messages == null || messages.isEmpty()) {
            result.append("- 조회된 재난문자 없음\n");
            return;
        }
        for (Map<String, Object> message : messages) {
            result.append("- ").append(valueOf(message, "createdAt"))
                    .append(" / ").append(valueOf(message, "disasterType"))
                    .append(" / ").append(valueOf(message, "region"))
                    .append(" / ").append(truncate(valueOf(message, "message"), 350))
                    .append("\n");
        }
    }

    private void appendNearbyShelters(StringBuilder result, List<Map<String, Object>> shelters) {
        if (shelters == null || shelters.isEmpty()) {
            result.append("- 조회된 가까운 대피시설 없음\n");
            return;
        }
        for (Map<String, Object> shelter : shelters) {
            result.append("- ").append(valueOf(shelter, "name"))
                    .append(" / 거리: ").append(valueOf(shelter, "distanceM")).append("m")
                    .append(" / 주소: ").append(valueOf(shelter, "address"))
                    .append(" / 수용인원: ").append(valueOf(shelter, "capacity"))
                    .append("\n");
        }
    }

    private boolean regionMatches(String incidentRegion, String requestedRegion) {
        if (incidentRegion == null || incidentRegion.isBlank()) return false;
        String source = compact(incidentRegion);
        String target = compact(requestedRegion);
        if (source.contains(target) || target.contains(source)) return true;

        String shortTarget = requestedRegion
                .replace("특별자치시", "").replace("특별자치도", "")
                .replace("특별시", "").replace("광역시", "")
                .replace("경기도", "경기").replace("충청북도", "충북")
                .replace("충청남도", "충남").replace("전라북도", "전북")
                .replace("전라남도", "전남").replace("경상북도", "경북")
                .replace("경상남도", "경남").trim();
        return !shortTarget.isBlank() && source.contains(compact(shortTarget));
    }

    private String normalizeRegion(String region) {
        if (region == null) return "";
        String value = region.trim();
        return switch (value) {
            case "서울" -> "서울특별시";
            case "부산" -> "부산광역시";
            case "대구" -> "대구광역시";
            case "인천" -> "인천광역시";
            case "광주" -> "광주광역시";
            case "대전" -> "대전광역시";
            case "울산" -> "울산광역시";
            case "세종" -> "세종특별자치시";
            case "경기" -> "경기도";
            case "강원" -> "강원특별자치도";
            case "충북" -> "충청북도";
            case "충남" -> "충청남도";
            case "전북" -> "전북특별자치도";
            case "전남" -> "전라남도";
            case "경북" -> "경상북도";
            case "경남" -> "경상남도";
            case "제주" -> "제주특별자치도";
            default -> value;
        };
    }

    private String compact(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }

    private String valueOf(Map<String, Object> map, String key) {
        if (map == null) return "-";
        Object value = map.get(key);
        return value == null || String.valueOf(value).isBlank() ? "-" : String.valueOf(value);
    }

    private String rawValue(Map<?, ?> map, String key) {
        Object value = map.get(key);
        return value == null || String.valueOf(value).isBlank() ? "-" : String.valueOf(value);
    }

    private String nullSafe(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength) + "…";
    }
}
