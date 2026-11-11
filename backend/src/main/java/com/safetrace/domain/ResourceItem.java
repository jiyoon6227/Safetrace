package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

// 자원 품목 (양수기, 모래주머니 등) - SF_RESOURCE_ITEM
@Data
public class ResourceItem {
    private Long itemId;
    private String name;
    private String category;      // DRAINAGE / RESCUE / RELIEF / VEHICLE
    private String unit;
    private String returnable;    // Y(반납형 장비) / N(소모품)
    private String description;
    private LocalDateTime createdAt;
}
