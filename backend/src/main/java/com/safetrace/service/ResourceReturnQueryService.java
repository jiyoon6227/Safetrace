package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.domain.ResourceReturn;
import com.safetrace.dto.ResourceRequestSummaryResponse;
import com.safetrace.dto.ResourceReturnPageResponse;
import com.safetrace.dto.ResourceStatusCount;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceFulfillmentMapper;
import com.safetrace.mapper.ResourceRequestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// 반납 신청 조회 (읽기 전용). 처리(확인·반려·손실)는 ResourceFulfillmentService가 맡는다.
@Service
@RequiredArgsConstructor
public class ResourceReturnQueryService {

    static final int DEFAULT_PAGE_SIZE = 10;
    static final int MAX_PAGE_SIZE = 50;
    static final int MAX_PAGE = 10000;
    private static final List<String> STATUS_ORDER = List.of("PENDING", "CONFIRMED", "REJECTED");
    private static final Set<String> STATUSES = Set.copyOf(STATUS_ORDER);

    private final ResourceFulfillmentMapper fulfillmentMapper;
    private final ResourceRequestMapper requestMapper;
    private final MemberMapper memberMapper;

    /** 한 요청의 반납 신청 목록. 요청자 본인과 ADMIN만 볼 수 있다. */
    @Transactional(readOnly = true)
    public List<ResourceReturn> getReturnApplications(Long memberId, Long requestId) {
        Member actor = requireActiveMember(memberId);
        if (!"ADMIN".equals(actor.getRole()) && !"STAFF".equals(actor.getRole())) {
            throw new AccessDeniedException("반납 신청은 요청자 본인과 자원 관리자만 볼 수 있습니다.");
        }
        ResourceRequest request = requestMapper.findById(requestId);
        if (request == null) {
            throw new IllegalArgumentException("존재하지 않는 자원 요청입니다.");
        }
        if (!"ADMIN".equals(actor.getRole()) && !actor.getMemberId().equals(request.getRequesterId())) {
            throw new AccessDeniedException("이 요청의 반납 신청을 볼 수 있는 권한이 없습니다.");
        }
        return fulfillmentMapper.findReturnsByRequest(requestId);
    }

    /** ADMIN 반납 확인함. status가 없으면 대기 중(PENDING), ALL이면 전체. */
    @Transactional(readOnly = true)
    public ResourceReturnPageResponse getReturnInbox(Long memberId, String status, Integer page, Integer size) {
        Member actor = requireActiveMember(memberId);
        if (!"ADMIN".equals(actor.getRole())) {
            throw new AccessDeniedException("반납 확인함은 자원 관리자(ADMIN)만 볼 수 있습니다.");
        }

        String safeStatus = "PENDING";
        if (status != null && !status.isBlank()) {
            String upper = status.trim().toUpperCase();
            if ("ALL".equals(upper)) {
                safeStatus = null;
            } else if (STATUSES.contains(upper)) {
                safeStatus = upper;
            } else {
                throw new IllegalArgumentException("올바르지 않은 반납 신청 상태입니다.");
            }
        }
        int safePage = page == null ? 1 : Math.min(Math.max(page, 1), MAX_PAGE);
        int safeSize = size == null ? DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        long total = fulfillmentMapper.countReturns(safeStatus);
        List<ResourceReturn> items = total == 0
                ? List.of()
                : fulfillmentMapper.findReturns(safeStatus, (safePage - 1) * safeSize, safePage * safeSize);
        return new ResourceReturnPageResponse(items, total, safePage, safeSize);
    }

    /** ADMIN 반납 현황 카드용. 상태별 건수를 한 번에 세고, 0건인 상태도 0으로 채운다. */
    @Transactional(readOnly = true)
    public ResourceRequestSummaryResponse getReturnSummary(Long memberId) {
        Member actor = requireActiveMember(memberId);
        if (!"ADMIN".equals(actor.getRole())) {
            throw new AccessDeniedException("반납 현황은 자원 관리자(ADMIN)만 볼 수 있습니다.");
        }
        Map<String, Long> counts = new LinkedHashMap<>();
        STATUS_ORDER.forEach(status -> counts.put(status, 0L));
        long total = 0;
        for (ResourceStatusCount row : fulfillmentMapper.countReturnsByStatus()) {
            if (counts.containsKey(row.getStatus())) {
                counts.put(row.getStatus(), row.getRequestCount());
                total += row.getRequestCount();
            }
        }
        return new ResourceRequestSummaryResponse(total, counts);
    }

    private Member requireActiveMember(Long memberId) {
        if (memberId == null) {
            throw new IllegalArgumentException("조회자 정보가 없습니다.");
        }
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("조회자가 존재하지 않습니다.");
        }
        if ("Y".equals(member.getIsWithdrawn())) {
            throw new IllegalArgumentException("탈퇴한 회원입니다.");
        }
        return member;
    }
}
