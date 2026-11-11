package com.safetrace.service;

import com.safetrace.domain.Member;
import com.safetrace.domain.ResourceItem;
import com.safetrace.domain.ResourceStock;
import com.safetrace.domain.ResourceStockLog;
import com.safetrace.dto.ResourceItemCreateRequest;
import com.safetrace.dto.ResourceStockAdjustRequest;
import com.safetrace.dto.ResourceStockCreateRequest;
import com.safetrace.dto.ResourceStockReasonRequest;
import com.safetrace.dto.ResourceStockReceiveRequest;
import com.safetrace.mapper.MemberMapper;
import com.safetrace.mapper.ResourceAdminMapper;
import com.safetrace.mapper.ResourceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * ADMIN 재고 관리: 품목 등록, 부서별 최초 재고 등록, 입고, 수량 조정, 사용 중지·재개.
 *
 * 규칙 (기획 문서 "재고 관리 규칙"과 같다)
 *  - 재고를 바꾸는 모든 메서드는 한 트랜잭션이다. 재고 행을 먼저 잠그고(FOR UPDATE WAIT 3) 잠근 값을 읽어
 *    변경 후 값을 계산한 뒤 조건부 UPDATE를 하고, 같은 트랜잭션에서 재고 변경 이력을 INSERT한다.
 *    이력 INSERT가 실패하면 재고 변경도 롤백된다.
 *  - 조건부 UPDATE는 서비스 검사가 뚫려도 재고가 음수가 되거나 한도를 넘지 못하게 하는 마지막 방어선이다.
 *  - 삭제 기능은 없다. 잘못 등록한 재고는 사용 중지한다.
 *  - 이 서비스는 재고 행 하나만 잠근다 (사건·요청 행은 건드리지 않으므로 잠금 순서 규칙과 충돌하지 않는다).
 *  - 잠금 대기가 3초를 넘으면 락 예외가 나고, GlobalExceptionHandler가 409(LOCK_CONFLICT)로 바꿔준다.
 */
@Service
@RequiredArgsConstructor
public class ResourceAdminService {

    static final int MAX_QUANTITY = 99_999_999;   // 재고 컬럼 NUMBER(8)의 한도
    static final int MAX_NAME_LENGTH = 50;
    static final int MAX_UNIT_LENGTH = 10;
    static final int MAX_DESCRIPTION_LENGTH = 200;
    static final int MAX_TEXT_LENGTH = 500;       // 메모·사유

    private static final Set<String> CATEGORIES = Set.of("DRAINAGE", "RESCUE", "RELIEF", "VEHICLE");

    private final ResourceAdminMapper adminMapper;
    private final ResourceMapper resourceMapper;
    private final MemberMapper memberMapper;

    /** 품목 등록. 같은 이름이 이미 있으면 409. 품목은 등록만 하고 수정·삭제하지 않는다. */
    @Transactional
    public ResourceItem registerItem(Long memberId, ResourceItemCreateRequest request) {
        requireAdmin(memberId);
        if (request == null) {
            throw new IllegalArgumentException("품목 정보가 없습니다.");
        }
        String name = trimToNull(request.name());
        String unit = trimToNull(request.unit());
        String description = trimToNull(request.description());
        if (name == null) {
            throw new IllegalArgumentException("품목명을 입력해주세요.");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("품목명은 " + MAX_NAME_LENGTH + "자 이하로 입력해주세요.");
        }
        if (request.category() == null || !CATEGORIES.contains(request.category())) {
            throw new IllegalArgumentException("올바르지 않은 자원 분류입니다.");
        }
        if (unit == null) {
            throw new IllegalArgumentException("단위를 입력해주세요.");
        }
        if (unit.length() > MAX_UNIT_LENGTH) {
            throw new IllegalArgumentException("단위는 " + MAX_UNIT_LENGTH + "자 이하로 입력해주세요.");
        }
        if (!"Y".equals(request.returnable()) && !"N".equals(request.returnable())) {
            throw new IllegalArgumentException("반납형 여부는 Y 또는 N이어야 합니다.");
        }
        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("설명은 " + MAX_DESCRIPTION_LENGTH + "자 이하로 입력해주세요.");
        }

        ResourceItem item = new ResourceItem();
        item.setName(name);
        item.setCategory(request.category());
        item.setUnit(unit);
        item.setReturnable(request.returnable());
        item.setDescription(description);
        try {
            adminMapper.insertItem(item);
        } catch (DuplicateKeyException e) {
            throw new IllegalStateException("이미 등록된 품목명입니다.");
        }
        return adminMapper.findItemById(item.getItemId());
    }

    /**
     * 부서별 최초 재고 등록. 총보유량 = 가용 = 수량, 상태 ACTIVE, 이력 REGISTER.
     * 같은 부서·품목 재고가 이미 있으면 409 (UNIQUE 위반을 바꾼다). 이 단계는 잠글 기존 행이 없다.
     */
    @Transactional
    public ResourceStock registerStock(Long memberId, ResourceStockCreateRequest request) {
        Member admin = requireAdmin(memberId);
        if (request == null) {
            throw new IllegalArgumentException("재고 정보가 없습니다.");
        }
        if (request.departmentId() == null) {
            throw new IllegalArgumentException("부서를 선택해주세요.");
        }
        if (request.itemId() == null) {
            throw new IllegalArgumentException("품목을 선택해주세요.");
        }
        int quantity = requireQuantity(request.quantity(), "수량");
        String memo = optionalText(request.memo(), "메모");
        if (adminMapper.countDepartment(request.departmentId()) == 0) {
            throw new IllegalArgumentException("존재하지 않는 부서입니다.");
        }
        if (adminMapper.findItemById(request.itemId()) == null) {
            throw new IllegalArgumentException("존재하지 않는 품목입니다.");
        }

        ResourceStock stock = new ResourceStock();
        stock.setDepartmentId(request.departmentId());
        stock.setItemId(request.itemId());
        stock.setTotalQty(quantity);
        stock.setAvailableQty(quantity);
        try {
            adminMapper.insertStock(stock);
        } catch (DuplicateKeyException e) {
            throw new IllegalStateException("이 부서에 같은 품목의 재고가 이미 있습니다. 수량을 늘리려면 입고를 이용해주세요.");
        }
        writeLog(stock.getStockId(), "REGISTER", 0, quantity, 0, quantity, memo, admin.getMemberId());
        return resourceMapper.findStockById(stock.getStockId());
    }

    /** 추가 입고. ACTIVE 재고만 가능하고, 총보유량과 가용이 함께 늘어난다. 이력 RECEIVE. */
    @Transactional
    public ResourceStock receive(Long memberId, Long stockId, ResourceStockReceiveRequest request) {
        Member admin = requireAdmin(memberId);
        if (request == null) {
            throw new IllegalArgumentException("입고 정보가 없습니다.");
        }
        int quantity = requireQuantity(request.quantity(), "입고 수량");
        String memo = optionalText(request.memo(), "메모");

        ResourceStock stock = lockExistingStock(stockId);
        if (!"ACTIVE".equals(stock.getStatus())) {
            throw new IllegalStateException("사용이 중지된 재고에는 입고할 수 없습니다.");
        }
        long newTotal = (long) stock.getTotalQty() + quantity;
        if (newTotal > MAX_QUANTITY) {
            throw new IllegalArgumentException("입고하면 총보유량이 한도(" + MAX_QUANTITY + ")를 넘습니다.");
        }

        if (adminMapper.receiveStock(stockId, quantity) == 0) {
            throw new IllegalStateException("재고가 다른 처리와 겹쳐 입고되지 않았습니다. 새로고침 후 다시 시도해주세요.");
        }
        writeLog(stockId, "RECEIVE",
                stock.getTotalQty(), (int) newTotal,
                stock.getAvailableQty(), stock.getAvailableQty() + quantity,
                memo, admin.getMemberId());
        return resourceMapper.findStockById(stockId);
    }

    /**
     * 수량 조정. 증감 delta(0이 아님)와 사유가 필요하고, 총보유량과 가용에 같은 delta를 더한다.
     * 예약·출고 중인 수량은 줄일 수 없다 (바꾼 뒤 가용이 0보다 작아지면 409). 사용 중지 재고도 조정할 수 있다.
     */
    @Transactional
    public ResourceStock adjust(Long memberId, Long stockId, ResourceStockAdjustRequest request) {
        Member admin = requireAdmin(memberId);
        if (request == null) {
            throw new IllegalArgumentException("조정 정보가 없습니다.");
        }
        Integer delta = request.delta();
        if (delta == null || delta == 0) {
            throw new IllegalArgumentException("조정 수량은 0이 아닌 값이어야 합니다.");
        }
        if (Math.abs((long) delta) > MAX_QUANTITY) {
            throw new IllegalArgumentException("조정 수량이 너무 큽니다.");
        }
        String reason = requireText(request.reason(), "조정 사유");

        ResourceStock stock = lockExistingStock(stockId);
        long newTotal = (long) stock.getTotalQty() + delta;
        long newAvailable = (long) stock.getAvailableQty() + delta;
        if (newAvailable < 0) {
            throw new IllegalStateException(String.format(
                    "가용 수량(%d)보다 많이 줄일 수 없습니다. 예약·출고 중인 수량은 줄일 수 없습니다.", stock.getAvailableQty()));
        }
        if (newTotal > MAX_QUANTITY) {
            throw new IllegalArgumentException("조정하면 총보유량이 한도(" + MAX_QUANTITY + ")를 넘습니다.");
        }

        if (adminMapper.adjustStock(stockId, delta) == 0) {
            throw new IllegalStateException("재고가 다른 처리와 겹쳐 조정되지 않았습니다. 새로고침 후 다시 시도해주세요.");
        }
        writeLog(stockId, "ADJUST",
                stock.getTotalQty(), (int) newTotal,
                stock.getAvailableQty(), (int) newAvailable,
                reason, admin.getMemberId());
        return resourceMapper.findStockById(stockId);
    }

    /** 사용 중지. 새 요청·승인·입고가 막힌다 (이미 승인·출고된 건의 취소·정산은 계속된다). 이미 중지면 409. */
    @Transactional
    public ResourceStock deactivate(Long memberId, Long stockId, ResourceStockReasonRequest request) {
        return changeStatus(memberId, stockId, request, "ACTIVE", "INACTIVE", "DEACTIVATE");
    }

    /** 사용 재개. 이미 사용 중이면 409. */
    @Transactional
    public ResourceStock reactivate(Long memberId, Long stockId, ResourceStockReasonRequest request) {
        return changeStatus(memberId, stockId, request, "INACTIVE", "ACTIVE", "REACTIVATE");
    }

    private ResourceStock changeStatus(Long memberId, Long stockId, ResourceStockReasonRequest request,
                                       String fromStatus, String toStatus, String action) {
        Member admin = requireAdmin(memberId);
        if (request == null) {
            throw new IllegalArgumentException("사유를 입력해주세요.");
        }
        String reason = requireText(request.reason(), "사유");

        ResourceStock stock = lockExistingStock(stockId);
        if (!fromStatus.equals(stock.getStatus())) {
            throw new IllegalStateException("ACTIVE".equals(toStatus)
                    ? "이미 사용 중인 재고입니다." : "이미 사용이 중지된 재고입니다.");
        }
        if (adminMapper.changeStockStatus(stockId, fromStatus, toStatus) == 0) {
            throw new IllegalStateException("재고 상태가 다른 처리와 겹쳐 바뀌지 않았습니다. 새로고침 후 다시 시도해주세요.");
        }
        // 수량은 그대로라 전·후 값이 같다
        writeLog(stockId, action,
                stock.getTotalQty(), stock.getTotalQty(),
                stock.getAvailableQty(), stock.getAvailableQty(),
                reason, admin.getMemberId());
        return resourceMapper.findStockById(stockId);
    }

    // ---- 공통 ----

    // 재고 행을 잠그고 읽는다. 없으면 400.
    private ResourceStock lockExistingStock(Long stockId) {
        if (stockId == null) {
            throw new IllegalArgumentException("재고를 선택해주세요.");
        }
        ResourceStock stock = adminMapper.lockStock(stockId);
        if (stock == null) {
            throw new IllegalArgumentException("존재하지 않는 재고입니다.");
        }
        return stock;
    }

    // 잠근 값(전)과 계산한 값(후)을 같은 트랜잭션에서 기록한다. 요청 없이 직접 바꾼 변경이라 REQUEST_ID는 없다.
    private void writeLog(Long stockId, String action, int totalBefore, int totalAfter,
                          int availableBefore, int availableAfter, String reason, Long changedBy) {
        ResourceStockLog log = new ResourceStockLog();
        log.setStockId(stockId);
        log.setAction(action);
        log.setTotalBefore(totalBefore);
        log.setTotalAfter(totalAfter);
        log.setAvailableBefore(availableBefore);
        log.setAvailableAfter(availableAfter);
        log.setReason(reason);
        log.setChangedBy(changedBy);
        adminMapper.insertStockLog(log);
    }

    // JWT의 memberId로 DB에서 회원을 다시 읽어 ADMIN인지 확인한다 (컨트롤러의 @PreAuthorize와 별개로 한 번 더).
    private Member requireAdmin(Long memberId) {
        if (memberId == null) {
            throw new IllegalArgumentException("처리자 정보가 없습니다.");
        }
        Member member = memberMapper.findById(memberId);
        if (member == null) {
            throw new IllegalArgumentException("처리자가 존재하지 않습니다.");
        }
        if ("Y".equals(member.getIsWithdrawn())) {
            throw new IllegalArgumentException("탈퇴한 회원입니다.");
        }
        if (!"ADMIN".equals(member.getRole())) {
            throw new AccessDeniedException("재고 관리는 자원 관리자(ADMIN)만 할 수 있습니다.");
        }
        return member;
    }

    private int requireQuantity(Integer quantity, String label) {
        if (quantity == null || quantity < 1) {
            throw new IllegalArgumentException(label + "은(는) 1 이상이어야 합니다.");
        }
        if (quantity > MAX_QUANTITY) {
            throw new IllegalArgumentException(label + "이(가) 너무 큽니다.");
        }
        return quantity;
    }

    // 필수 텍스트(사유): 공백만 있으면 안 되고, 앞뒤 공백은 자른다
    private String requireText(String text, String label) {
        String trimmed = trimToNull(text);
        if (trimmed == null) {
            throw new IllegalArgumentException(label + "를 입력해주세요.");
        }
        if (trimmed.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException(label + "는 " + MAX_TEXT_LENGTH + "자 이하로 입력해주세요.");
        }
        return trimmed;
    }

    // 선택 텍스트(메모): 비어 있으면 null
    private String optionalText(String text, String label) {
        String trimmed = trimToNull(text);
        if (trimmed != null && trimmed.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException(label + "는 " + MAX_TEXT_LENGTH + "자 이하로 입력해주세요.");
        }
        return trimmed;
    }

    private String trimToNull(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
