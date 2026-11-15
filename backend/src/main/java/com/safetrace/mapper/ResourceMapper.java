package com.safetrace.mapper;

import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceItemLog;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockAdminView;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceStatusCount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ResourceMapper {

    List<ResourceItem> findItems();

    // departmentId / itemId / category는 null이면 조건에서 빠진다. includeInactive=false면 ACTIVE 재고만
    List<ResourceStock> findStocks(@Param("departmentId") Long departmentId,
                                   @Param("itemId") Long itemId,
                                   @Param("category") String category,
                                   @Param("includeInactive") boolean includeInactive);

    ResourceStock findStockById(@Param("stockId") Long stockId);

    // 최신 변경이 먼저, 최대 limit건
    List<ResourceStockLog> findStockLogs(@Param("stockId") Long stockId, @Param("limit") int limit);

    // ---- ADMIN 재고 관리 전용 조회 (STAFF 재고 조회와 따로 둔다) ----
    // status: null(전체) / ACTIVE / INACTIVE / EMPTY(사용 중인데 가용 0). keyword는 이스케이프된 값이고 null이면 조건에서 빠진다.
    List<ResourceStockAdminView> findAdminStocks(@Param("status") String status,
                                                 @Param("keyword") String keyword,
                                                 @Param("departmentId") Long departmentId,
                                                 @Param("category") String category,
                                                 @Param("startRow") int startRow,
                                                 @Param("endRow") int endRow);

    long countAdminStocks(@Param("status") String status,
                          @Param("keyword") String keyword,
                          @Param("departmentId") Long departmentId,
                          @Param("category") String category);

    // 상태 조건만 뺀 같은 조건에서 ACTIVE·INACTIVE·EMPTY 건수를 한 번에 센다 (EMPTY는 ACTIVE의 일부)
    List<ResourceStatusCount> countAdminStocksByStatus(@Param("keyword") String keyword,
                                                       @Param("departmentId") Long departmentId,
                                                       @Param("category") String category);

    ResourceStockAdminView findAdminStockById(@Param("stockId") Long stockId);

    ResourceItem findItemById(@Param("itemId") Long itemId);

    // 최신 수정이 먼저, 최대 limit건
    List<ResourceItemLog> findItemLogs(@Param("itemId") Long itemId, @Param("limit") int limit);
}
