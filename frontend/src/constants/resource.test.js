import { describe, expect, it } from "vitest";
import {
  ADMIN_REQUEST_FILTERS,
  ADMIN_STATUS_LABEL,
  ADMIN_STATUS_FILTERS,
  formatCode,
  REQUEST_STATUS_FILTERS,
  parseIncidentIdParam,
  validateReturnForm,
  formatQty,
  STOCK_FORMS,
  getStockActions,
  itemLogToStep,
  stockLogToStep,
  validateStockForm,
  getAdminConfirmMessage,
  getLossPreview,
  getRequestStatusLabel,
  getAdminRequestActions,
  getResourceRequestAvailability,
  needsClosureConfirm,
  validateLossForm,
  validateReason,
  validateRejectReason,
  validateResourceRequestForm,
} from "./resource";

const staff = { memberId: 1, role: "STAFF", name: "안전담당자" };
const incident = { incidentId: 2, status: "RESPONDING", assignedStaffId: 1 };

describe("getResourceRequestAvailability", () => {
  it("사건 담당 STAFF는 진행 중인 사건에 요청할 수 있다", () => {
    expect(getResourceRequestAvailability(staff, incident).allowed).toBe(true);
  });

  it("ADMIN은 요청할 수 없다", () => {
    const result = getResourceRequestAvailability({ memberId: 7, role: "ADMIN" }, incident);
    expect(result.allowed).toBe(false);
    expect(result.reason).not.toBe("");
  });

  it("종료된 사건에는 요청할 수 없다", () => {
    const result = getResourceRequestAvailability(staff, { ...incident, status: "CLOSED" });
    expect(result.allowed).toBe(false);
  });

  it("담당자가 없는 사건에는 요청할 수 없다", () => {
    const result = getResourceRequestAvailability(staff, { ...incident, assignedStaffId: null });
    expect(result.allowed).toBe(false);
  });

  it("다른 담당자의 사건에는 요청할 수 없다", () => {
    const result = getResourceRequestAvailability(staff, { ...incident, assignedStaffId: 4 });
    expect(result.allowed).toBe(false);
  });

  it("로그인 정보나 사건이 없으면 요청할 수 없다", () => {
    expect(getResourceRequestAvailability(null, incident).allowed).toBe(false);
    expect(getResourceRequestAvailability(staff, null).allowed).toBe(false);
  });
});

describe("needsClosureConfirm", () => {
  it("출고 전 요청이 있으면 확인 창이 필요하다", () => {
    expect(needsClosureConfirm({ openRequests: [{ requestId: 1 }], dispatchedCount: 0 })).toBe(true);
  });

  it("출고됐지만 반납 전인 건이 있어도 확인 창이 필요하다", () => {
    expect(needsClosureConfirm({ openRequests: [], dispatchedCount: 2 })).toBe(true);
  });

  it("둘 다 없으면 확인 창 없이 바로 종료한다", () => {
    expect(needsClosureConfirm({ openRequests: [], dispatchedCount: 0 })).toBe(false);
  });

  it("값이 없거나 비어 있으면 확인 창이 필요 없다", () => {
    expect(needsClosureConfirm(null)).toBe(false);
    expect(needsClosureConfirm({})).toBe(false);
  });
});

describe("validateResourceRequestForm", () => {
  const stock = { stockId: 1, totalQty: 10, unit: "대" };

  it("정상 입력이면 빈 문자열을 돌려준다", () => {
    expect(validateResourceRequestForm({ stock, quantity: "3", reason: "배수 지원" })).toBe("");
  });

  it("재고를 고르지 않으면 안내한다", () => {
    expect(validateResourceRequestForm({ stock: null, quantity: "1", reason: "x" })).not.toBe("");
  });

  it("수량이 0이거나 소수이거나 비어 있으면 안내한다", () => {
    expect(validateResourceRequestForm({ stock, quantity: "0", reason: "x" })).not.toBe("");
    expect(validateResourceRequestForm({ stock, quantity: "1.5", reason: "x" })).not.toBe("");
    expect(validateResourceRequestForm({ stock, quantity: "", reason: "x" })).not.toBe("");
  });

  it("보유 총량을 넘으면 안내한다", () => {
    expect(validateResourceRequestForm({ stock, quantity: "11", reason: "x" })).toContain("보유 총량");
  });

  it("사유가 공백뿐이거나 500자를 넘으면 안내한다", () => {
    expect(validateResourceRequestForm({ stock, quantity: "1", reason: "   " })).not.toBe("");
    expect(validateResourceRequestForm({ stock, quantity: "1", reason: "가".repeat(501) })).not.toBe("");
  });
});

describe("formatQty", () => {
  it("천 단위 쉼표와 단위를 붙인다", () => {
    expect(formatQty(1000, "개")).toBe("1,000개");
  });

  it("단위가 없으면 수량만, 값이 없으면 -를 돌려준다", () => {
    expect(formatQty(5)).toBe("5");
    expect(formatQty(null, "개")).toBe("-");
  });
});

describe("getAdminRequestActions", () => {
  it("승인 대기 요청은 승인·반려를 할 수 있다", () => {
    expect(getAdminRequestActions({ status: "REQUESTED" })).toEqual(["approve", "reject"]);
  });

  it("승인된 요청은 출고·승인 취소를 할 수 있다", () => {
    expect(getAdminRequestActions({ status: "APPROVED" })).toEqual(["dispatch", "cancel"]);
  });

  it("그 외 상태와 빈 값은 할 수 있는 일이 없다", () => {
    ["REJECTED", "CANCELLED", "DISPATCHED", "SETTLED", "COMPLETED"].forEach((status) => {
      expect(getAdminRequestActions({ status })).toEqual([]);
    });
    expect(getAdminRequestActions(null)).toEqual([]);
  });
});

describe("getAdminConfirmMessage", () => {
  it("반납 대상 물품과 소모품의 출고 안내가 다르다", () => {
    const returnable = getAdminConfirmMessage("dispatch", { returnable: "Y" });
    const consumable = getAdminConfirmMessage("dispatch", { returnable: "N" });
    expect(returnable).toContain("반납");
    expect(consumable).toContain("총 보유량");
    expect(returnable).not.toBe(consumable);
  });

  it("승인 취소 안내가 있고, 모르는 동작은 빈 문구다", () => {
    expect(getAdminConfirmMessage("cancel", { returnable: "Y" })).not.toBe("");
    expect(getAdminConfirmMessage("approve", { returnable: "Y" })).toBe("");
    expect(getAdminConfirmMessage("dispatch", null)).toBe("");
  });
});

describe("validateRejectReason", () => {
  it("빈 사유와 공백만 있는 사유는 거절한다", () => {
    expect(validateRejectReason("")).not.toBe("");
    expect(validateRejectReason("   ")).not.toBe("");
  });

  it("500자까지는 통과하고 501자부터 거절한다", () => {
    expect(validateRejectReason("가".repeat(500))).toBe("");
    expect(validateRejectReason("가".repeat(501))).not.toBe("");
  });
});

describe("ADMIN_STATUS_FILTERS", () => {
  it("전체 필터가 맨 앞에 있고 값이 겹치지 않는다", () => {
    expect(ADMIN_STATUS_FILTERS[0].value).toBe("");
    const values = ADMIN_STATUS_FILTERS.map((f) => f.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("validateReturnForm", () => {
  it("정상 입력은 통과한다", () => {
    expect(validateReturnForm({ quantity: "3", applicableQty: 5, memo: "", unit: "대" })).toBe("");
  });

  it("0·소수·빈 값은 거절한다", () => {
    ["", "0", "1.5", "-1"].forEach((quantity) => {
      expect(validateReturnForm({ quantity, applicableQty: 5, memo: "" })).not.toBe("");
    });
  });

  it("신청 가능 수량을 넘거나 신청할 수량이 없으면 거절한다", () => {
    expect(validateReturnForm({ quantity: "6", applicableQty: 5, memo: "", unit: "대" })).toContain("5대");
    expect(validateReturnForm({ quantity: "1", applicableQty: 0, memo: "" })).not.toBe("");
  });

  it("메모가 500자를 넘으면 거절한다", () => {
    expect(validateReturnForm({ quantity: "1", applicableQty: 5, memo: "가".repeat(501) })).not.toBe("");
    expect(validateReturnForm({ quantity: "1", applicableQty: 5, memo: "가".repeat(500) })).toBe("");
  });
});

describe("parseIncidentIdParam", () => {
  it("양의 정수만 숫자로 바꾼다", () => {
    expect(parseIncidentIdParam("12")).toBe(12);
    ["", null, undefined, "abc", "0", "-3", "1.5"].forEach((value) => {
      expect(parseIncidentIdParam(value)).toBeNull();
    });
  });
});

describe("REQUEST_STATUS_FILTERS", () => {
  it("ADMIN 필터와 같은 목록을 쓴다", () => {
    expect(REQUEST_STATUS_FILTERS).toBe(ADMIN_STATUS_FILTERS);
  });
});

describe("손실 확정 (출고된 요청)", () => {
  it("출고된 요청은 확정 가능 수량이 남아 있을 때만 손실 확정 버튼이 나온다", () => {
    expect(getAdminRequestActions({ status: "DISPATCHED", applicableReturnQty: 2 })).toEqual(["loss"]);
    expect(getAdminRequestActions({ status: "DISPATCHED", applicableReturnQty: 0 })).toEqual([]);
    expect(getAdminRequestActions({ status: "SETTLED", applicableReturnQty: 2 })).toEqual([]);
  });

  it("수량은 1 이상 확정 가능 수량 이하의 정수여야 한다", () => {
    const base = { maxQty: 3, reason: "침수로 분실", unit: "대" };
    expect(validateLossForm({ ...base, quantity: "" })).not.toBe("");
    expect(validateLossForm({ ...base, quantity: "0" })).not.toBe("");
    expect(validateLossForm({ ...base, quantity: "1.5" })).not.toBe("");
    expect(validateLossForm({ ...base, quantity: "4" })).toContain("3대");
    expect(validateLossForm({ ...base, quantity: "3" })).toBe("");
    expect(validateLossForm({ ...base, maxQty: 0, quantity: "1" })).not.toBe("");
  });

  it("사유가 비었거나 500자를 넘으면 막는다", () => {
    const base = { maxQty: 3, quantity: "1", unit: "대" };
    expect(validateLossForm({ ...base, reason: " " })).toContain("손실 사유");
    expect(validateLossForm({ ...base, reason: "가".repeat(501) })).toContain("손실 사유");
    expect(validateReason("", "반려 사유")).toBe(validateRejectReason(""));
  });

  it("처리 뒤 결과 안내: 남은 수량이 없으면 정산 완료, 대기 중 반납이 있으면 남은 수량에 포함한다", () => {
    const request = { unit: "대", applicableReturnQty: 3, pendingReturnQty: 0 };
    expect(getLossPreview(request, "1")).toContain("남은 미처리 수량은 2대");
    expect(getLossPreview(request, "3")).toContain("정산 완료");
    expect(getLossPreview({ ...request, pendingReturnQty: 1 }, "3")).toContain("남은 미처리 수량은 1대");
    expect(getLossPreview(request, "4")).toBe("");
    expect(getLossPreview(request, "")).toBe("");
  });
});

describe("반납 확인 안내", () => {
  const item = { appliedQty: 2, requestQuantity: 5, returnedQty: 1, lostQty: 0, unit: "대" };

  it("가용 수량 증가, 반납 누적 변화, 남은 수량을 보여준다", () => {
    const message = getAdminConfirmMessage("returnConfirm", item);
    expect(message).toContain("가용 수량이 2대 늘어납니다");
    expect(message).toContain("1대 → 3대");
    expect(message).toContain("남은 미처리 수량은 2대");
  });

  it("마지막 반납이면 정산 완료를 알린다", () => {
    expect(getAdminConfirmMessage("returnConfirm", { ...item, appliedQty: 4 })).toContain("정산 완료");
  });
});

describe("getRequestStatusLabel", () => {
  const dispatched = { status: "DISPATCHED", returnable: "Y", quantity: 2, unit: "대", returnedQty: 0, lostQty: 0 };

  it("반납이 시작되기 전에는 서버 상태 이름 그대로", () => {
    expect(getRequestStatusLabel(dispatched)).toBe("출고됨(반납 전)");
  });

  it("일부만 반납됐으면 진행 수량을 보여준다", () => {
    expect(getRequestStatusLabel({ ...dispatched, returnedQty: 1 })).toBe("1/2대 반납");
    expect(getRequestStatusLabel({ ...dispatched, returnedQty: 1, lostQty: 1 })).toBe("1/2대 반납 · 손실 1");
  });

  it("출고됨이 아니거나 소모품이면 바꾸지 않는다", () => {
    expect(getRequestStatusLabel({ ...dispatched, status: "SETTLED", returnedQty: 2 })).toBe("반납 정산 완료");
    expect(getRequestStatusLabel({ ...dispatched, returnable: "N", returnedQty: 1 })).toBe("출고됨(반납 전)");
    expect(getRequestStatusLabel(null)).toBeUndefined();
  });
});

describe("ADMIN 요청·출고 관리 표시", () => {
  it("표시용 번호는 실제 번호를 4자리로 채운다", () => {
    expect(formatCode("REQ", 38)).toBe("REQ-0038");
    expect(formatCode("INC", 3)).toBe("INC-0003");
    expect(formatCode("INC", 12345)).toBe("INC-12345");
  });

  it("필터는 서버 상태값은 그대로 두고 이름만 ADMIN 업무에 맞게 부른다", () => {
    expect(ADMIN_REQUEST_FILTERS.map((f) => f.value)).toEqual(REQUEST_STATUS_FILTERS.map((f) => f.value));
    expect(ADMIN_REQUEST_FILTERS.find((f) => f.value === "APPROVED").label).toBe("출고 대기");
    expect(getRequestStatusLabel({ status: "DISPATCHED", returnable: "Y", quantity: 2 }, ADMIN_STATUS_LABEL)).toBe("출고 후 관리");
  });
});

describe("ADMIN 재고 관리", () => {
  it("재고 상태에 따라 필요한 처리 버튼만 준다 (비활성 재고는 입고 없음)", () => {
    expect(getStockActions({ status: "ACTIVE" })).toEqual(["stockReceive", "stockAdjust", "stockDeactivate"]);
    expect(getStockActions({ status: "INACTIVE" })).toEqual(["stockAdjust", "stockReactivate"]);
    expect(getStockActions(null)).toEqual([]);
  });

  it("조정 수량은 0이 아닌 정수여야 하고 사유가 필수다", () => {
    const ok = { delta: "-3", reason: "실사 결과 반영" };
    expect(validateStockForm("stockAdjust", ok)).toBe("");
    expect(validateStockForm("stockAdjust", { ...ok, delta: "0" })).toContain("0이 아닌");
    expect(validateStockForm("stockAdjust", { ...ok, delta: "1.5" })).toContain("정수");
    expect(validateStockForm("stockAdjust", { ...ok, delta: "" })).toBe("조정 수량을 입력해주세요.");
    expect(validateStockForm("stockAdjust", { ...ok, reason: "" })).toBe("조정 사유를 입력해주세요.");
    expect(validateStockForm("stockAdjust", { ...ok, reason: "  " })).toContain("조정 사유");
    expect(validateStockForm("stockAdjust", { ...ok, reason: "가".repeat(501) })).toContain("500자");
  });

  it("입고·등록 수량은 1 이상 한도 이하이고 메모는 비워도 된다", () => {
    expect(validateStockForm("stockReceive", { quantity: "5", memo: "" })).toBe("");
    expect(validateStockForm("stockReceive", { quantity: "0", memo: "" })).toContain("사이");
    expect(validateStockForm("stockReceive", { quantity: "100000000", memo: "" })).toContain("사이");
    expect(validateStockForm("stockCreate", { departmentId: "", itemId: "1", quantity: "3", memo: "" })).toBe("부서를 선택해주세요.");
  });

  it("품목 수정에는 단위·반납형 입력이 없고 요청에도 담기지 않는다", () => {
    const names = STOCK_FORMS.itemEdit.fields.map((field) => field.name);
    expect(names).toEqual(["name", "category", "description"]);
    const item = { itemId: 7, name: "양수기", category: "DRAINAGE", unit: "대", returnable: "Y", description: null };
    const values = STOCK_FORMS.itemEdit.init(item);
    expect(values).toEqual({ name: "양수기", category: "DRAINAGE", description: "" });
    expect(STOCK_FORMS.itemEdit.request(item, values)).toEqual({
      path: "/items/7", method: "PATCH", body: { name: "양수기", category: "DRAINAGE", description: null },
    });
  });

  it("재고 입력창은 서버 주소·본문 모양으로 요청을 만든다", () => {
    const stock = { stockId: 3 };
    expect(STOCK_FORMS.stockAdjust.request(stock, { delta: "-2", reason: " 파손 " })).toEqual({ path: "/stocks/3/adjust", method: "POST", body: { delta: -2, reason: "파손" } });
    expect(STOCK_FORMS.stockDeactivate.request(stock, { reason: "점검" }).path).toBe("/stocks/3/deactivate");
    expect(STOCK_FORMS.stockCreate.request(null, { departmentId: "2", itemId: "5", quantity: "10", memo: "" }).body).toEqual({ departmentId: 2, itemId: 5, quantity: 10, memo: null });
  });

  it("재고 이력은 바뀐 수량만 보여주고 요청 번호·사유를 함께 담는다", () => {
    const step = stockLogToStep({ logId: 1, action: "RESERVE", totalBefore: 10, totalAfter: 10, availableBefore: 10, availableAfter: 8, requestId: 12, reason: null, changedByName: "관리자", changedAt: "2026-11-01T10:00:00" }, "개");
    expect(step).toMatchObject({ key: 1, label: "승인(예약)", done: true, by: "관리자", note: "가용 10개 → 8개 · REQ-0012" });
    expect(stockLogToStep({ logId: 2, action: "ADJUST", totalBefore: 10, totalAfter: 7, availableBefore: 10, availableAfter: 7, reason: "파손" }, "개").note).toBe("총 10개 → 7개 · 가용 10개 → 7개 · 파손");
  });

  it("품목 수정 이력은 항목 이름과 전·후 값을 보여준다", () => {
    expect(itemLogToStep({ logId: 4, fieldName: "DESCRIPTION", oldValue: null, newValue: "소형" })).toMatchObject({ label: "설명 변경", note: "(없음) → 소형" });
  });
});
