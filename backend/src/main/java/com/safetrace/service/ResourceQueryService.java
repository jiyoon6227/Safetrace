package com.safetrace.service;

import com.safetrace.domain.Department;
import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.mapper.DepartmentMapper;
import com.safetrace.mapper.ResourceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

// 자원 조회 전용 서비스 (데이터를 바꾸지 않는다)
@Service
@RequiredArgsConstructor
public class ResourceQueryService {

    private static final Set<String> CATEGORIES = Set.of("DRAINAGE", "RESCUE", "RELIEF", "VEHICLE");
    static final int DEFAULT_LOG_LIMIT = 50;
    static final int MAX_LOG_LIMIT = 200;

    private final DepartmentMapper departmentMapper;
    private final ResourceMapper resourceMapper;

    @Transactional(readOnly = true)
    public List<Department> getDepartments() {
        return departmentMapper.findAll();
    }

    @Transactional(readOnly = true)
    public List<ResourceItem> getItems() {
        return resourceMapper.findItems();
    }

    /**
     * 재고 조회. 사용 중지(INACTIVE) 재고는 ADMIN이 includeInactive=true로 요청할 때만 포함한다.
     * STAFF가 includeInactive=true를 보내도 무시한다 (요청 가능한 재고만 보여야 하므로).
     */
    @Transactional(readOnly = true)
    public List<ResourceStock> getStocks(Long departmentId, Long itemId, String category,
                                         boolean includeInactive, boolean admin) {
        if (category != null && !CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("올바르지 않은 자원 분류입니다.");
        }
        boolean withInactive = admin && includeInactive;
        return resourceMapper.findStocks(departmentId, itemId, category, withInactive);
    }

    /** 재고 변경 이력 (ADMIN 전용은 컨트롤러에서 막는다). limit이 없거나 범위를 벗어나면 보정한다. */
    @Transactional(readOnly = true)
    public List<ResourceStockLog> getStockLogs(Long stockId, Integer limit) {
        if (resourceMapper.findStockById(stockId) == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        int safeLimit = limit == null ? DEFAULT_LOG_LIMIT : Math.min(Math.max(limit, 1), MAX_LOG_LIMIT);
        return resourceMapper.findStockLogs(stockId, safeLimit);
    }
}
