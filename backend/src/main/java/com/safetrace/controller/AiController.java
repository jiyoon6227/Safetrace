package com.safetrace.controller;

import com.safetrace.domain.Incident;
import com.safetrace.domain.Member;
import com.safetrace.domain.Report;
import com.safetrace.external.DisasterMessageService;
import com.safetrace.external.ShelterService;
import com.safetrace.external.WeatherService;
import com.safetrace.service.GroqService;
import com.safetrace.service.IncidentService;
import com.safetrace.service.MemberService;
import com.safetrace.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final GroqService groqService;
    private final WeatherService weatherService;
    private final IncidentService incidentService;
    private final DisasterMessageService disasterMessageService;
    private final ShelterService shelterService;
    private final MemberService memberService;
    private final ReportService reportService;

    /** 메인 화면 AI 상황 브리핑: 실제 SafeTrace/공공 API 데이터를 모아 Groq가 요약 */
    @GetMapping("/briefing")
    public Map<String, Object> briefing(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam String region
    ) {
        Map<String, Object> weather = weatherService.getCurrentWeather(lat, lng);
        List<Incident> incidents = incidentService.getActiveIncidentsNearby(lat, lng, 3.0);
        List<Map<String, Object>> disasterMessages = disasterMessageService.getRecentMessages(region, 5);
        List<Map<String, Object>> shelters = shelterService.getNearbyShelters(region, lat, lng, 3);

        String summary = groqService.generateBriefing(region, weather, incidents, disasterMessages, shelters);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("incidentCount", incidents.size());
        result.put("messageCount", disasterMessages.size());
        result.put("shelterCount", shelters.size());
        return result;
    }

    /**
     * AI 안전 도우미 자유질문.
     * 실제 안전 데이터가 필요한 질문은 Groq Tool Calling으로 필요한 로컬 도구만 실행한다.
     */
    @PostMapping("/chat")
    public Map<String, Object> chat(
            @RequestBody ChatRequest request,
            Authentication authentication
    ) {
        String question = request.message() == null ? "" : request.message().trim();
        if (question.isBlank()) throw new IllegalArgumentException("질문 내용을 입력해주세요.");
        if (question.length() > 1200) throw new IllegalArgumentException("질문은 1200자 이하로 입력해주세요.");

        String region = request.region() == null || request.region().isBlank()
                ? "현재 위치 정보 없음"
                : request.region().trim();

        String memberName = null;
        List<Report> myReports = List.of();

        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Long memberId) {
            Member member = memberService.getMyInfo(memberId);
            memberName = member.getName();
            myReports = reportService.getMyReports(memberId);
        }

        String answer = groqService.generateChatReply(
                question,
                region,
                request.lat(),
                request.lng(),
                memberName,
                myReports,
                request.history()
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", answer);
        result.put("region", region);
        result.put("hasCurrentLocation", request.lat() != null && request.lng() != null);
        result.put("loggedIn", memberName != null);
        return result;
    }

    public record ChatRequest(
            String message,
            Double lat,
            Double lng,
            String region,
            List<Map<String, String>> history
    ) {}
}
