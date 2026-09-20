package com.safetrace.ai;

import com.safetrace.domain.Incident;
import com.safetrace.external.AirQualityService;
import com.safetrace.external.DisasterMessageService;
import com.safetrace.external.ShelterService;
import com.safetrace.external.WeatherService;
import com.safetrace.service.IncidentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * AI가 필요할 때 실제 SafeTrace DB/공공 API 데이터를 조회하는 로컬 도구.
 * LLM 업체와 무관하게 재사용할 수 있도록 별도 ai 패키지에 둔다.
 */
@Component
public class AiToolFunctions {

    private static final Logger log = LoggerFactory.getLogger(AiToolFunctions.class);

    // 시/도 대표 좌표 - 프론트(ControlBoard/constants.js의 SIDO_CENTER)와 동일한 17개 시도.
    // getRegionalSafetyData(예: "서울", "부산")처럼 좌표 없이 지역명만 들어왔을 때
    // 날씨를 조회하려면 위경도가 필요한데, 그 지역의 정확한 지점 좌표까지는 알 수 없으니
    // 시/도 대표 지점(대략 도청/시청 소재지) 좌표로 근사해서 씀.
    private static final Map<String, double[]> SIDO_CENTER = Map.ofEntries(
            Map.entry("서울특별시", new double[]{37.5665, 126.9780}),
            Map.entry("부산광역시", new double[]{35.1796, 129.0756}),
            Map.entry("대구광역시", new double[]{35.8714, 128.6014}),
            Map.entry("인천광역시", new double[]{37.4563, 126.7052}),
            Map.entry("광주광역시", new double[]{35.1595, 126.8526}),
            Map.entry("대전광역시", new double[]{36.3504, 127.3845}),
            Map.entry("울산광역시", new double[]{35.5384, 129.3114}),
            Map.entry("세종특별자치시", new double[]{36.4801, 127.2891}),
            Map.entry("경기도", new double[]{37.2636, 127.0286}),
            Map.entry("강원특별자치도", new double[]{37.8813, 127.7298}),
            Map.entry("충청북도", new double[]{36.6424, 127.4890}),
            Map.entry("충청남도", new double[]{36.6008, 126.6650}),
            Map.entry("전북특별자치도", new double[]{35.8242, 127.1480}),
            Map.entry("전라남도", new double[]{34.9866, 126.3916}),
            Map.entry("경상북도", new double[]{36.5684, 128.7294}),
            Map.entry("경상남도", new double[]{35.2280, 128.6811}),
            Map.entry("제주특별자치도", new double[]{33.4996, 126.5312})
    );

    // 재난안전데이터공유플랫폼의 지역명은 같은 시/도도
    // "대구광역시" / "대구"처럼 정식명과 약칭이 섞여 들어오는 경우가 있다.
    // AI 지역 조회에서도 프론트의 관심지역 조회와 같은 fallback 기준을 사용한다.
    private static final Map<String, String> SIDO_SHORT_NAME = Map.ofEntries(
            Map.entry("서울특별시", "서울"),
            Map.entry("부산광역시", "부산"),
            Map.entry("대구광역시", "대구"),
            Map.entry("인천광역시", "인천"),
            Map.entry("광주광역시", "광주"),
            Map.entry("대전광역시", "대전"),
            Map.entry("울산광역시", "울산"),
            Map.entry("세종특별자치시", "세종"),
            Map.entry("경기도", "경기"),
            Map.entry("강원특별자치도", "강원"),
            Map.entry("충청북도", "충북"),
            Map.entry("충청남도", "충남"),
            Map.entry("전북특별자치도", "전북"),
            Map.entry("전라남도", "전남"),
            Map.entry("경상북도", "경북"),
            Map.entry("경상남도", "경남"),
            Map.entry("제주특별자치도", "제주")
    );

    // "강릉시", "청주시"처럼 광역시가 아닌 시/군 이름만 단독으로 들어오면 SIDO_CENTER의
    // "시/도 이름을 포함하는지"로 좌표를 찾는 방식이 절대 매칭되지 않는다(예: "강릉시"에는
    // "강원특별자치도"라는 글자가 없음). 그래서 대한민국의 모든 시/군을 상위 시/도에
    // 미리 매핑해두고, normalizeRegion에서 필요하면 시/도 이름을 앞에 붙여준다.
    // (구 단위는 다루지 않음 - 구는 항상 "OO광역시 OO구"처럼 상위 시와 같이 언급되거나,
    //  이미 SIDO_CENTER 매칭이 되는 광역시 소속이라 이 표가 없어도 대부분 정상 동작함)
    // 참고: "고성군"은 강원/경남에 동명이 있어 강원 쪽으로 기본 매핑함 - 경남 고성을 물으면
    // "경상남도 고성군"처럼 도 이름을 같이 말해야 정확히 인식됨.
    private static final Map<String, String> CITY_TO_SIDO = Map.<String, String>ofEntries(
            // 경기도
            Map.entry("수원시", "경기도"), Map.entry("성남시", "경기도"), Map.entry("의정부시", "경기도"),
            Map.entry("안양시", "경기도"), Map.entry("부천시", "경기도"), Map.entry("광명시", "경기도"),
            Map.entry("평택시", "경기도"), Map.entry("동두천시", "경기도"), Map.entry("안산시", "경기도"),
            Map.entry("고양시", "경기도"), Map.entry("과천시", "경기도"), Map.entry("구리시", "경기도"),
            Map.entry("남양주시", "경기도"), Map.entry("오산시", "경기도"), Map.entry("시흥시", "경기도"),
            Map.entry("군포시", "경기도"), Map.entry("의왕시", "경기도"), Map.entry("하남시", "경기도"),
            Map.entry("용인시", "경기도"), Map.entry("파주시", "경기도"), Map.entry("이천시", "경기도"),
            Map.entry("안성시", "경기도"), Map.entry("김포시", "경기도"), Map.entry("화성시", "경기도"),
            Map.entry("광주시", "경기도"), Map.entry("양주시", "경기도"), Map.entry("포천시", "경기도"),
            Map.entry("여주시", "경기도"), Map.entry("연천군", "경기도"), Map.entry("가평군", "경기도"),
            Map.entry("양평군", "경기도"),
            // 강원특별자치도
            Map.entry("춘천시", "강원특별자치도"), Map.entry("원주시", "강원특별자치도"),
            Map.entry("강릉시", "강원특별자치도"), Map.entry("동해시", "강원특별자치도"),
            Map.entry("태백시", "강원특별자치도"), Map.entry("속초시", "강원특별자치도"),
            Map.entry("삼척시", "강원특별자치도"), Map.entry("홍천군", "강원특별자치도"),
            Map.entry("횡성군", "강원특별자치도"), Map.entry("영월군", "강원특별자치도"),
            Map.entry("평창군", "강원특별자치도"), Map.entry("정선군", "강원특별자치도"),
            Map.entry("철원군", "강원특별자치도"), Map.entry("화천군", "강원특별자치도"),
            Map.entry("양구군", "강원특별자치도"), Map.entry("인제군", "강원특별자치도"),
            Map.entry("고성군", "강원특별자치도"), Map.entry("양양군", "강원특별자치도"),
            // 충청북도
            Map.entry("청주시", "충청북도"), Map.entry("충주시", "충청북도"), Map.entry("제천시", "충청북도"),
            Map.entry("보은군", "충청북도"), Map.entry("옥천군", "충청북도"), Map.entry("영동군", "충청북도"),
            Map.entry("증평군", "충청북도"), Map.entry("진천군", "충청북도"), Map.entry("괴산군", "충청북도"),
            Map.entry("음성군", "충청북도"), Map.entry("단양군", "충청북도"),
            // 충청남도
            Map.entry("천안시", "충청남도"), Map.entry("공주시", "충청남도"), Map.entry("보령시", "충청남도"),
            Map.entry("아산시", "충청남도"), Map.entry("서산시", "충청남도"), Map.entry("논산시", "충청남도"),
            Map.entry("계룡시", "충청남도"), Map.entry("당진시", "충청남도"), Map.entry("금산군", "충청남도"),
            Map.entry("부여군", "충청남도"), Map.entry("서천군", "충청남도"), Map.entry("청양군", "충청남도"),
            Map.entry("홍성군", "충청남도"), Map.entry("예산군", "충청남도"), Map.entry("태안군", "충청남도"),
            // 전북특별자치도
            Map.entry("전주시", "전북특별자치도"), Map.entry("군산시", "전북특별자치도"),
            Map.entry("익산시", "전북특별자치도"), Map.entry("정읍시", "전북특별자치도"),
            Map.entry("남원시", "전북특별자치도"), Map.entry("김제시", "전북특별자치도"),
            Map.entry("완주군", "전북특별자치도"), Map.entry("진안군", "전북특별자치도"),
            Map.entry("무주군", "전북특별자치도"), Map.entry("장수군", "전북특별자치도"),
            Map.entry("임실군", "전북특별자치도"), Map.entry("순창군", "전북특별자치도"),
            Map.entry("고창군", "전북특별자치도"), Map.entry("부안군", "전북특별자치도"),
            // 전라남도
            Map.entry("목포시", "전라남도"), Map.entry("여수시", "전라남도"), Map.entry("순천시", "전라남도"),
            Map.entry("나주시", "전라남도"), Map.entry("광양시", "전라남도"), Map.entry("담양군", "전라남도"),
            Map.entry("곡성군", "전라남도"), Map.entry("구례군", "전라남도"), Map.entry("고흥군", "전라남도"),
            Map.entry("보성군", "전라남도"), Map.entry("화순군", "전라남도"), Map.entry("장흥군", "전라남도"),
            Map.entry("강진군", "전라남도"), Map.entry("해남군", "전라남도"), Map.entry("영암군", "전라남도"),
            Map.entry("무안군", "전라남도"), Map.entry("함평군", "전라남도"), Map.entry("영광군", "전라남도"),
            Map.entry("장성군", "전라남도"), Map.entry("완도군", "전라남도"), Map.entry("진도군", "전라남도"),
            Map.entry("신안군", "전라남도"),
            // 경상북도
            Map.entry("포항시", "경상북도"), Map.entry("경주시", "경상북도"), Map.entry("김천시", "경상북도"),
            Map.entry("안동시", "경상북도"), Map.entry("구미시", "경상북도"), Map.entry("영주시", "경상북도"),
            Map.entry("영천시", "경상북도"), Map.entry("상주시", "경상북도"), Map.entry("문경시", "경상북도"),
            Map.entry("경산시", "경상북도"), Map.entry("군위군", "경상북도"), Map.entry("의성군", "경상북도"),
            Map.entry("청송군", "경상북도"), Map.entry("영양군", "경상북도"), Map.entry("영덕군", "경상북도"),
            Map.entry("청도군", "경상북도"), Map.entry("고령군", "경상북도"), Map.entry("성주군", "경상북도"),
            Map.entry("칠곡군", "경상북도"), Map.entry("예천군", "경상북도"), Map.entry("봉화군", "경상북도"),
            Map.entry("울진군", "경상북도"), Map.entry("울릉군", "경상북도"),
            // 경상남도
            Map.entry("창원시", "경상남도"), Map.entry("진주시", "경상남도"), Map.entry("통영시", "경상남도"),
            Map.entry("사천시", "경상남도"), Map.entry("김해시", "경상남도"), Map.entry("밀양시", "경상남도"),
            Map.entry("거제시", "경상남도"), Map.entry("양산시", "경상남도"), Map.entry("의령군", "경상남도"),
            Map.entry("함안군", "경상남도"), Map.entry("창녕군", "경상남도"), Map.entry("남해군", "경상남도"),
            Map.entry("하동군", "경상남도"), Map.entry("산청군", "경상남도"), Map.entry("함양군", "경상남도"),
            Map.entry("거창군", "경상남도"), Map.entry("합천군", "경상남도"),
            // 제주특별자치도
            Map.entry("제주시", "제주특별자치도"), Map.entry("서귀포시", "제주특별자치도")
    );

    private final WeatherService weatherService;
    private final DisasterMessageService disasterMessageService;
    private final ShelterService shelterService;
    private final IncidentService incidentService;
    private final AirQualityService airQualityService;

    public AiToolFunctions(
            WeatherService weatherService,
            DisasterMessageService disasterMessageService,
            ShelterService shelterService,
            IncidentService incidentService,
            AirQualityService airQualityService
    ) {
        this.weatherService = weatherService;
        this.disasterMessageService = disasterMessageService;
        this.shelterService = shelterService;
        this.incidentService = incidentService;
        this.airQualityService = airQualityService;
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
                    : getRecentMessagesWithRegionFallback(requestedRegion, 4);
            result.append("\n[최근 재난문자]\n");
            appendMessages(result, messages);
        } catch (Exception e) {
            result.append("\n[최근 재난문자]\n- 재난문자를 조회하지 못함\n");
        }

        try {
            List<Map<String, Object>> shelters = requestedRegion.isBlank()
                    ? List.of()
                    : shelterService.getNearbyShelters(requestedRegion, lat, lng, 3);
            result.append("\n[가까운 대피시설]\n");
            appendNearbyShelters(result, shelters);
        } catch (Exception e) {
            result.append("\n[가까운 대피시설]\n- 대피시설을 조회하지 못함\n");
        }

        return result.toString();
    }

    /** 특정 지역의 재난문자 + 진행 사건 + 대피시설 + 날씨(시/도 대표 좌표 기준) 조회 */
    public String getRegionalSafetyData(String region) {
        String requestedRegion = normalizeRegion(region);
        if (requestedRegion.isBlank()) return "지역명이 비어 있어 조회할 수 없습니다.";

        StringBuilder result = new StringBuilder();
        result.append("[SafeTrace 지역 안전정보 조회 결과]\n");
        result.append("조회 지역: ").append(requestedRegion).append("\n\n");

        // requestedRegion이 "서울특별시 강남구"처럼 시/도+구 형태일 수 있어서, SIDO_CENTER 키 중
        // requestedRegion에 포함되는 걸 찾아 그 시/도의 대표 좌표로 날씨를 조회한다.
        // (정확한 동/읍/면 좌표는 아니고 시/도 단위 근사치라는 점을 답변에도 명시함)
        double[] sidoCoord = SIDO_CENTER.entrySet().stream()
                .filter(entry -> requestedRegion.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);

        if (sidoCoord != null) {
            try {
                Map<String, Object> weather = weatherService.getCurrentWeather(sidoCoord[0], sidoCoord[1]);
                result.append("[현재 날씨 - 시/도 대표 지점 기준 근사치]\n")
                        .append(weather == null || weather.isEmpty() ? "- 조회된 날씨 정보 없음\n" : weather + "\n");
            } catch (Exception e) {
                result.append("[현재 날씨]\n- 날씨 정보를 조회하지 못함\n");
            }
        } else {
            result.append("[현재 날씨]\n- 시/군/구 단위 좌표가 없어 날씨는 시/도 대표 지점 기준으로만 제공됨\n");
        }

        try {
            List<Map<String, Object>> messages = getRecentMessagesWithRegionFallback(requestedRegion, 4);
            result.append("[최근 재난문자]\n");
            appendMessages(result, messages);
        } catch (Exception e) {
            result.append("[최근 재난문자]\n- 재난문자를 조회하지 못함\n");
        }

        try {
            List<Incident> incidents = incidentService.getAllIncidents().stream()
                    .filter(incident -> incident.getStatus() != null && !"CLOSED".equals(incident.getStatus()))
                    .filter(incident -> regionMatches(incident.getRegion(), requestedRegion))
                    .limit(5)
                    .toList();
            result.append("\n[SafeTrace 진행 사건]\n");
            appendIncidents(result, incidents);
        } catch (Exception e) {
            result.append("\n[SafeTrace 진행 사건]\n- 사건 정보를 조회하지 못함\n");
        }

        try {
            Map<String, Object> shelterResult = shelterService.searchShelters(requestedRegion, "", 1, 3);
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
                    if (++count >= 3) break;
                }
            }
        } catch (Exception e) {
            result.append("\n[대피시설]\n- 대피시설을 조회하지 못함\n");
        }

        return result.toString();
    }

    /**
     * 지역별 최근 재난문자 조회.
     *
     * 외부 API는 같은 지역도 "대구광역시" / "대구"처럼 표기가 섞여 있어
     * 정식명으로 0건이어도 약칭으로는 실제 문자가 조회되는 경우가 있다.
     * 프론트 관심지역 화면과 동일하게 정식명 -> 약칭 -> 하위 시군구 단독 순서로 재시도한다.
     *
     * 하위 시군구만으로 재조회할 때는 "동구", "서구" 같은 동명이 다른 시/도에도 있으므로
     * 반드시 결과 region에 원래 시/도(정식명 또는 약칭)가 포함된 것만 남긴다.
     */
    private List<Map<String, Object>> getRecentMessagesWithRegionFallback(
            String requestedRegion,
            int limit
    ) {
        if (requestedRegion == null || requestedRegion.isBlank()) {
            return List.of();
        }

        int safeLimit = Math.max(1, limit);

        // 1차: AI가 받은 지역명 그대로 조회
        List<Map<String, Object>> messages =
                disasterMessageService.getRecentMessages(requestedRegion, safeLimit);

        if (!messages.isEmpty()) {
            return messages;
        }

        String canonicalSido = findCanonicalSido(requestedRegion);
        if (canonicalSido == null) {
            return messages;
        }

        String shortSido = SIDO_SHORT_NAME.get(canonicalSido);

        // 2차: "대구광역시" -> "대구", "대구광역시 중구" -> "대구 중구"
        if (shortSido != null && !shortSido.isBlank()) {
            String shortQuery = requestedRegion.replace(canonicalSido, shortSido).trim();

            if (!shortQuery.equals(requestedRegion)) {
                messages = disasterMessageService.getRecentMessages(shortQuery, safeLimit);
                if (!messages.isEmpty()) {
                    return messages;
                }
            }
        }

        // 3차: "대전광역시 동구" -> "동구"처럼 하위 행정구역만 조회.
        // 동명 지역이 섞일 수 있으므로 시/도 일치 여부를 다시 필터링한다.
        String subRegion = requestedRegion
                .replace(canonicalSido, "")
                .trim();

        if (!subRegion.isBlank()) {
            List<Map<String, Object>> fallback =
                    disasterMessageService.getRecentMessages(subRegion, Math.max(safeLimit * 4, 20));

            return fallback.stream()
                    .filter(message -> belongsToSido(
                            String.valueOf(message.getOrDefault("region", "")),
                            canonicalSido,
                            shortSido
                    ))
                    .limit(safeLimit)
                    .toList();
        }

        return List.of();
    }

    private String findCanonicalSido(String region) {
        if (region == null || region.isBlank()) return null;

        for (String canonical : SIDO_SHORT_NAME.keySet()) {
            if (region.contains(canonical)) {
                return canonical;
            }
        }

        for (Map.Entry<String, String> entry : SIDO_SHORT_NAME.entrySet()) {
            String shortName = entry.getValue();
            if (region.equals(shortName) || region.startsWith(shortName + " ")) {
                return entry.getKey();
            }
        }

        return null;
    }

    private boolean belongsToSido(
            String messageRegion,
            String canonicalSido,
            String shortSido
    ) {
        if (messageRegion == null || messageRegion.isBlank()) return false;

        return messageRegion.contains(canonicalSido)
                || (shortSido != null
                    && !shortSido.isBlank()
                    && messageRegion.contains(shortSido));
    }

    /**
     * 특정 지역의 최근 재난문자만 반환한다.
     *
     * 중요:
     * - 실제 지역 조회 방식은 기존에 정상 동작하던 getRecentMessagesWithRegionFallback()을 그대로 사용한다.
     * - Groq가 직전 지역 답변을 재사용하는 문제를 막기 위해, 재난문자 질문에서는 이 결과를 그대로 반환한다.
     */
    public String getRegionalDisasterMessages(String region) {
        String requestedRegion = normalizeRegion(region);

        if (requestedRegion.isBlank()) {
            return "지역명이 비어 있어 재난문자를 조회할 수 없습니다.";
        }

        List<Map<String, Object>> messages;
        try {
            messages = getRecentMessagesWithRegionFallback(requestedRegion, 8);
        } catch (DisasterMessageService.DisasterMessageApiException e) {
            return "지금 재난문자 조회 서비스에 일시적인 문제가 있어 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.";
        }

        if (messages == null || messages.isEmpty()) {
            return requestedRegion + "에서 최근 48시간 이내 조회된 재난문자가 없습니다.";
        }

        StringBuilder result = new StringBuilder();
        result.append(requestedRegion)
                .append(" 최근 재난문자 ")
                .append(messages.size())
                .append("건\n");

        for (Map<String, Object> message : messages) {
            result.append("- ")
                    .append(valueOf(message, "createdAt"))
                    .append(" / ")
                    .append(valueOf(message, "disasterType"))
                    .append(" / ")
                    .append(summarizeRegion(valueOf(message, "region")))
                    .append(" / ")
                    .append(truncate(valueOf(message, "message"), 350))
                    .append("\n");
        }

        return result.toString().trim();
    }

    /**
     * 시/도 단위 미세먼지(PM10)·초미세먼지(PM2.5) 조회.
     * 에어코리아 API가 시/도 단위 평균만 제공하므로, "대전광역시 동구"처럼
     * 시/군/구까지 들어와도 시/도 단위로 올림(findCanonicalSido)해서 조회한다.
     */
    public String getAirQuality(String region) {
        String requestedRegion = normalizeRegion(region);
        if (requestedRegion.isBlank()) {
            return "지역명이 비어 있어 미세먼지를 조회할 수 없습니다.";
        }

        String canonicalSido = findCanonicalSido(requestedRegion);
        if (canonicalSido == null && SIDO_SHORT_NAME.containsKey(requestedRegion)) {
            canonicalSido = requestedRegion;
        }
        if (canonicalSido == null) {
            log.info("[AiTool] getAirQuality 호출: region={} -> 미지원 지역", requestedRegion);
            return requestedRegion + "은(는) 미세먼지 조회를 지원하지 않는 지역입니다. 시/도 단위로 물어봐 주세요.";
        }

        Map<String, Object> result = airQualityService.getAirQuality(canonicalSido);
        log.info("[AiTool] getAirQuality 호출: region={} -> canonicalSido={}, result={}",
                requestedRegion, canonicalSido, result);

        if (!Boolean.TRUE.equals(result.get("available"))) {
            return canonicalSido + " 미세먼지 정보를 가져오지 못했습니다: "
                    + result.getOrDefault("message", "");
        }

        return String.format(
                "%s 미세먼지(PM10): %s㎍/㎥ (%s) / 초미세먼지(PM2.5): %s㎍/㎥ (%s)",
                canonicalSido,
                result.get("pm10"), result.get("pm10Grade"),
                result.get("pm25"), result.get("pm25Grade")
        );
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
                    .append(" / ").append(summarizeRegion(valueOf(message, "region")))
                    .append(" / ").append(truncate(valueOf(message, "message"), 150))
                    .append("\n");
        }
    }

    // 태풍/호우 경보처럼 한 문자가 여러 구·군에 동시 발송되면 region 필드가
    // "해운대구,연제구,...,기장군"처럼 수십 개 지역명이 콤마로 나열된 채로 온다.
    // 이걸 그대로 붙이면 도구 결과가 지역명 도배로 채워져서(특히 8건이 겹치면 배로 증폭)
    // AI 답변까지 알아보기 힘든 텍스트 덩어리가 되므로, 앞 몇 개만 보여주고 나머지는 개수로 요약한다.
    private String summarizeRegion(String region) {
        if (region == null || region.isBlank()) return "-";
        String[] parts = region.split(",");
        if (parts.length <= 3) return region;
        String head = String.join(", ", parts[0].trim(), parts[1].trim(), parts[2].trim());
        return head + " 외 " + (parts.length - 3) + "개 지역";
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
        String expanded = switch (value) {
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

        if (!expanded.equals(value)) {
            // 위에서 이미 광역시/도 이름으로 확장됐으면(=자기 자신이 상위 시/도) 그대로 사용.
            return expanded;
        }

        // "강릉시", "청주시"처럼 광역시가 아닌 시/군 단독 이름은 SIDO_CENTER나 findCanonicalSido의
        // "지역명이 시/도 이름을 포함하는지" 매칭에서 절대 걸리지 않으므로, 여기서 상위 시/도를
        // 앞에 붙여준다. 이미 "강원특별자치도 강릉시"처럼 상위 시/도가 붙어 있으면 중복 방지를 위해
        // 그대로 둔다.
        String cityKey = value.replaceAll("^.*\\s", ""); // 마지막 공백 이후 토큰(=시/군 이름)만 추출
        String parentSido = CITY_TO_SIDO.get(cityKey.isBlank() ? value : cityKey);

        if (parentSido != null && !value.contains(parentSido)) {
            return parentSido + " " + value;
        }

        return value;
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