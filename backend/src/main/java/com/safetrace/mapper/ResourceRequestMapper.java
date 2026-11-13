package com.safetrace.mapper;

import com.safetrace.domain.Incident;
import com.safetrace.domain.ResourceLog;
import com.safetrace.domain.ResourceRequest;
import com.safetrace.dto.ResourceStatusCount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ResourceRequestMapper {

    // 사건 행을 잠그고 읽는다 (최대 3초 대기, 넘으면 락 예외). 사건 상태·담당자만 채워진다.
    // 요청 생성에서 잠그는 행은 사건 하나뿐이다. 재고는 잠그지 않고 읽기만 한다 (승인 때 다시 검사).
    Incident lockIncident(@Param("incidentId") Long incidentId);

    // 중복 클릭 판단용: 같은 사건·재고·요청자·수량·사유로 최근 withinSeconds초 안에 접수된 요청 수 (반려·취소된 건 제외).
    // 시간은 DB 기준(SYSTIMESTAMP)이라 서버 시계와 무관하다. 시간이 지난 같은 내용의 추가 요청은 세지 않는다.
    int countRecentSame(@Param("incidentId") Long incidentId,
                        @Param("stockId") Long stockId,
                        @Param("requesterId") Long requesterId,
                        @Param("quantity") Integer quantity,
                        @Param("reason") String reason,
                        @Param("withinSeconds") int withinSeconds);

    // 성공 시 requestId가 파라미터 객체에 채워진다
    int insertRequest(ResourceRequest request);

    int insertLog(ResourceLog log);

    ResourceRequest findById(@Param("requestId") Long requestId);

    // requesterId가 null이면 제한 없음(ADMIN), 있으면 그 사람이 보낸 요청만. status·incidentId·keyword는 null이면 조건에서 빠진다.
    // keyword는 품목명·요청 사유·사건 제목·보유 부서명에서 찾는다 (LIKE 특수문자는 서비스가 \로 이스케이프해서 넘긴다).
    List<ResourceRequest> findRequests(@Param("requesterId") Long requesterId,
                                       @Param("status") String status,
                                       @Param("incidentId") Long incidentId,
                                       @Param("keyword") String keyword,
                                       @Param("startRow") int startRow,
                                       @Param("endRow") int endRow);

    long countRequests(@Param("requesterId") Long requesterId,
                       @Param("status") String status,
                       @Param("incidentId") Long incidentId,
                       @Param("keyword") String keyword);

    // 상태별 건수 - 상태 조건만 빼고 목록과 같은 조건. 건수가 있는 상태만 행으로 나온다.
    List<ResourceStatusCount> countRequestsByStatus(@Param("requesterId") Long requesterId,
                                                    @Param("incidentId") Long incidentId,
                                                    @Param("keyword") String keyword);

    // 처리 이력 시간순
    List<ResourceLog> findLogs(@Param("requestId") Long requestId);
}
