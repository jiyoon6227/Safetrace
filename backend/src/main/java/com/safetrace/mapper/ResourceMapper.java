package com.safetrace.mapper;

import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
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
}
