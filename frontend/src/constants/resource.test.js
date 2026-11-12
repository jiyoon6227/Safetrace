import { describe, expect, it } from "vitest";
import {
  formatQty,
  getResourceRequestAvailability,
  needsClosureConfirm,
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
