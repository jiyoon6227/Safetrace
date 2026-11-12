// 자원 지원·배정 화면에서 쓰는 이름표, 배지 색, 판단 함수
// STAFF 화면과 /admin 화면이 같은 기준을 쓰도록 한곳에 둔다.

// 자원 요청 진행 상태 이름표
export const REQUEST_STATUS_LABEL = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨(출고 전)",
  REJECTED: "반려",
  CANCELLED: "취소",
  DISPATCHED: "출고됨(반납 전)",
  SETTLED: "반납 정산 완료",
  COMPLETED: "출고 완료",
};

// 자원 요청 상태 배지 색
export const REQUEST_STATUS_STYLE = {
  REQUESTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-sky-100 text-sky-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-200 text-slate-600",
  DISPATCHED: "bg-indigo-100 text-indigo-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

// 품목 분류 이름표
export const ITEM_CATEGORY_LABEL = {
  DRAINAGE: "배수장비",
  RESCUE: "구조장비",
  RELIEF: "구호물품",
  VEHICLE: "차량",
};

// 출고 전(아직 취소할 수 있는) 요청 상태
export const CANCELLABLE_REQUEST_STATUSES = ["REQUESTED", "APPROVED"];

export const MAX_REASON_LENGTH = 500;

// 수량 표시: 천 단위 쉼표 + 단위 (단위가 없으면 수량만)
export function formatQty(qty, unit) {
  if (qty === null || qty === undefined) return "-";
  return `${Number(qty).toLocaleString("ko-KR")}${unit || ""}`;
}

// 자원 요청 버튼을 쓸 수 있는지 판단한다.
// 서버도 같은 규칙으로 다시 검사하므로 화면에서는 "왜 못 누르는지" 안내하는 용도다.
export function getResourceRequestAvailability(currentUser, incident) {
  if (!incident) return { allowed: false, reason: "" };
  if (!currentUser || currentUser.role !== "STAFF") {
    return { allowed: false, reason: "자원 요청은 담당 직원만 할 수 있습니다." };
  }
  if (incident.status === "CLOSED") {
    return { allowed: false, reason: "종료된 사건에는 자원을 요청할 수 없습니다." };
  }
  if (!incident.assignedStaffId) {
    return { allowed: false, reason: "담당자가 배정된 뒤에 자원을 요청할 수 있습니다." };
  }
  if (incident.assignedStaffId !== currentUser.memberId) {
    return { allowed: false, reason: "이 사건의 담당자만 자원을 요청할 수 있습니다." };
  }
  return { allowed: true, reason: "" };
}

// 사건 종료 전에 확인 창을 띄워야 하는지 판단한다.
// 출고 전 요청(승인 대기·승인됨)이 있거나, 출고 뒤 아직 반납이 끝나지 않은 건이 있으면 띄운다.
export function needsClosureConfirm(preview) {
  if (!preview) return false;
  const openCount = Array.isArray(preview.openRequests) ? preview.openRequests.length : 0;
  const dispatchedCount = Number(preview.dispatchedCount) || 0;
  return openCount > 0 || dispatchedCount > 0;
}

// 요청 입력값 검사. 문제가 없으면 빈 문자열, 있으면 화면에 보여줄 안내 문구를 돌려준다.
export function validateResourceRequestForm({ stock, quantity, reason }) {
  if (!stock) return "요청할 재고를 선택해주세요.";
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) return "요청 수량은 1 이상의 정수로 입력해주세요.";
  if (qty > stock.totalQty) {
    return `요청 수량이 보유 총량(${formatQty(stock.totalQty, stock.unit)})을 넘을 수 없습니다.`;
  }
  if (!reason || !reason.trim()) return "요청 사유를 입력해주세요.";
  if (reason.trim().length > MAX_REASON_LENGTH) {
    return `요청 사유는 ${MAX_REASON_LENGTH}자 이하로 입력해주세요.`;
  }
  return "";
}
