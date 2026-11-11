package com.safetrace.mapper;

import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// ADMIN 재고 관리(품목 등록·재고 등록·입고·조정·사용 중지/재개) 전용 매퍼. 읽기 전용 조회는 ResourceMapper가 맡는다.
@Mapper
public interface ResourceAdminMapper {

    // 성공 시 itemId가 채워진다. 같은 이름이 있으면 UNIQUE 위반(DuplicateKeyException)
    int insertItem(ResourceItem item);

    ResourceItem findItemById(@Param("itemId") Long itemId);

    int countDepartment(@Param("departmentId") Long departmentId);

    // 최초 재고 등록: 총보유량 = 가용 = totalQty, 상태 ACTIVE. 성공 시 stockId가 채워진다.
    // 같은 부서·품목이 있으면 UNIQUE 위반(DuplicateKeyException)
    int insertStock(ResourceStock stock);

    // 재고 행을 잠그고 읽는다 (최대 3초 대기, 넘으면 락 예외). 조인 없이 이 테이블만 읽는다.
    ResourceStock lockStock(@Param("stockId") Long stockId);

    // 입고: 총보유량과 가용에 같은 수량을 더한다. ACTIVE일 때만. 영향 받은 행이 0이면 반영 안 됨
    int receiveStock(@Param("stockId") Long stockId, @Param("quantity") int quantity);

    // 조정: 총보유량과 가용에 같은 delta를 더한다. 바꾼 뒤 가용이 음수가 되면 반영하지 않는다
    int adjustStock(@Param("stockId") Long stockId, @Param("delta") int delta);

    // 상태 변경: 지금 상태가 expectedStatus일 때만 newStatus로 바꾼다
    int changeStockStatus(@Param("stockId") Long stockId,
                          @Param("expectedStatus") String expectedStatus,
                          @Param("newStatus") String newStatus);

    // 재고 변경 이력 INSERT. 성공 시 logId가 채워진다. 요청 없이 직접 바꾼 변경만 기록하므로 REQUEST_ID는 비운다.
    int insertStockLog(ResourceStockLog log);
}
