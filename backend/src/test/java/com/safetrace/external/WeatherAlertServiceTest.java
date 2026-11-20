package com.safetrace.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WeatherAlertServiceTest {

    private final WeatherAlertService service = new WeatherAlertService("test-key");
    private final ObjectMapper objectMapper = new ObjectMapper();

    private JsonNode item(String tmFc, String t6, String t7, String other) {
        var node = objectMapper.createObjectNode();
        node.put("tmFc", tmFc);
        node.put("t6", t6);
        if (t7 != null) node.put("t7", t7);
        if (other != null) node.put("other", other);
        return node;
    }

    private List<Map<String, Object>> collect(JsonNode... items) {
        return service.collectActiveAlerts(List.of(items));
    }

    private List<String> regions(List<Map<String, Object>> alerts, String type, String level) {
        return alerts.stream()
                .filter(a -> type.equals(a.get("type")) && level.equals(a.get("level")))
                .map(a -> (String) a.get("region"))
                .collect(Collectors.toList());
    }

    @Test
    void 풍랑주의보는_강풍주의보로_분류되지_않는다() {
        String t6 = "o 강풍주의보 : 울릉도.독도\r\n o 풍랑주의보 : 동해중부안쪽먼바다, 제주도앞바다";
        String t7 = "(1) 강풍 예비특보 o 11월 22일 새벽(00시~06시) : 경상북도(영양산지)";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, t7, "o 없음"));

        assertEquals(List.of("울릉도.독도"), regions(alerts, "강풍", "주의보"));
        assertEquals(List.of("동해중부안쪽먼바다", "제주도앞바다"), regions(alerts, "풍랑", "주의보"));
        assertEquals(3, alerts.size());
    }

    @Test
    void 경보와_주의보를_줄별로_구분한다() {
        String t6 = "o 풍랑경보 : 제주도남쪽바깥먼바다\r\n o 풍랑주의보 : 서해전해상";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(List.of("제주도남쪽바깥먼바다"), regions(alerts, "풍랑", "경보"));
        assertEquals(List.of("서해전해상"), regions(alerts, "풍랑", "주의보"));
    }

    @Test
    void 괄호_안_세부구역은_상위_지역과_함께_구역으로_나눈다() {
        String t6 = "o 대설주의보 : 전라남도(영광(낙월면 제외)), 전북자치도(고창, 부안(위도면 제외)), 제주도(제주도산지)";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(
                List.of("전라남도 영광(낙월면 제외)", "전북자치도 고창", "전북자치도 부안(위도면 제외)", "제주도 제주도산지"),
                regions(alerts, "대설", "주의보"));
    }

    @Test
    void 제외로_끝나는_괄호는_쉼표가_있어도_하나의_구역으로_유지한다() {
        String t6 = "o 강풍주의보 : 제주도(제주도산지, 추자도 제외), 충남앞바다(평수구역(안면도 서쪽, 천수만) 제외), 울릉도.독도";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(
                List.of("제주도(제주도산지, 추자도 제외)", "충남앞바다(평수구역(안면도 서쪽, 천수만) 제외)", "울릉도.독도"),
                regions(alerts, "강풍", "주의보"));
    }

    @Test
    void 바다_구역의_세부_앞바다도_구역으로_나눈다() {
        String t6 = "o 풍랑주의보 : 서해중부앞바다(충남북부앞바다, 충남남부앞바다), 서해중부안쪽먼바다";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(
                List.of("서해중부앞바다 충남북부앞바다", "서해중부앞바다 충남남부앞바다", "서해중부안쪽먼바다"),
                regions(alerts, "풍랑", "주의보"));
    }

    @Test
    void 특보가_없으면_빈_목록이다() {
        assertTrue(collect(item("202611210000", "o 없음", null, "o 없음")).isEmpty());
        assertTrue(collect(item("202611210000", "", null, null)).isEmpty());
    }

    @Test
    void 예비특보와_참고사항은_현재_특보로_세지_않는다() {
        String t6 = "o 풍랑주의보 : 서해전해상";
        String t7 = "(1) 강풍 예비특보 o 11월 22일 새벽 : 경상북도(영양산지) (2) 호우 예비특보 o 11월 22일 낮 : 제주도";
        String other = "o 대설주의보 : 강원도(태백)";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, t7, other));

        assertEquals(1, alerts.size());
        assertEquals("풍랑", alerts.get(0).get("type"));
    }

    @Test
    void 같은_구역의_서로_다른_특보는_각각_유지하고_같은_특보는_한_번만_담는다() {
        String t6 = "o 강풍주의보 : 경기도(안산, 화성, 안산)\r\n o 건조주의보 : 경기도(안산)";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(List.of("경기도 안산", "경기도 화성"), regions(alerts, "강풍", "주의보"));
        assertEquals(List.of("경기도 안산"), regions(alerts, "건조", "주의보"));
    }

    @Test
    void 도_이름_없이_시도만_있는_구역도_그대로_담고_상위_지역은_도_이름으로_판단한다() {
        String t6 = "o 강풍주의보 : 서울, 경기도(광주, 이천)";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(List.of("서울", "경기도 광주", "경기도 이천"), regions(alerts, "강풍", "주의보"));
        assertEquals("서울", alerts.get(0).get("regionParent"));
        assertEquals("경기", alerts.get(1).get("regionParent"));
        assertEquals("경기", alerts.get(2).get("regionParent"));
    }

    @Test
    void 특보_유형은_통보문에_적힌_이름을_그대로_사용한다() {
        String t6 = "o 폭풍해일경보 : 부산\r\n o 황사경보 : 서울";

        List<Map<String, Object>> alerts = collect(item("202611210000", t6, null, null));

        assertEquals(List.of("부산"), regions(alerts, "폭풍해일", "경보"));
        assertEquals(List.of("서울"), regions(alerts, "황사", "경보"));
    }

    @Test
    void 발표시각이_가장_최근인_통보문만_현재_특보로_본다() {
        JsonNode old = item("202611202100", "o 강풍주의보 : 울릉도.독도\r\n o 풍랑주의보 : 서해전해상", null, null);
        JsonNode latest = item("202611210000", "o 풍랑주의보 : 서해전해상", null, null);

        List<Map<String, Object>> alerts = collect(old, latest);

        assertEquals(1, alerts.size());
        assertEquals("서해전해상", alerts.get(0).get("region"));
        assertEquals("202611210000", alerts.get(0).get("announcedAt"));
    }

    @Test
    void 제목과_발표시각을_채운다() {
        List<Map<String, Object>> alerts = collect(item("202611210000", "o 풍랑주의보 : 서해전해상", null, null));

        assertEquals("서해전해상 풍랑주의보", alerts.get(0).get("title"));
        assertEquals("202611210000", alerts.get(0).get("announcedAt"));
    }

    @Test
    void 통보문_필드명이_달라도_특보_형식이_있으면_읽는다() {
        var node = objectMapper.createObjectNode();
        node.put("tmFc", "202611210000");
        node.put("title", "기상특보 통보문");
        node.put("content", "o 풍랑주의보 : 서해전해상\r\n o 강풍주의보 : 울릉도.독도");
        node.put("other", "o 없음");

        List<Map<String, Object>> alerts = collect(node);

        assertEquals(List.of("서해전해상"), regions(alerts, "풍랑", "주의보"));
        assertEquals(List.of("울릉도.독도"), regions(alerts, "강풍", "주의보"));
    }

    @Test
    void 통보문이_없으면_빈_목록이다() {
        assertTrue(service.collectActiveAlerts(List.of()).isEmpty());
    }
}
