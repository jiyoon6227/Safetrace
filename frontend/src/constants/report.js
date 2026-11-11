// 제보 상태 이름표 - 사건 상태와 따로 표시
// 등록 → 검토중 → 사건연결 / 반려 (RECEIVED = 등록)
export const REPORT_STATE_LABEL = {
  RECEIVED: "등록",
  REVIEWING: "검토중",
  LINKED: "사건연결",
  REJECTED: "반려",
};

// 제보 상태 배지 색
export const REPORT_STATE_STYLE = {
  RECEIVED: "bg-blue-50 text-blue-700",
  REVIEWING: "bg-amber-50 text-amber-700",
  LINKED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
};
