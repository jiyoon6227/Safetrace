// 사건 진행 상태 이름표 - STAFF 화면과 시민 화면이 같은 기준을 씀
// 접수 → 확인중 → 대응중 → 복구중 → 종료
export const STATUS_LABEL = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};

// 사건 진행 상태 배지 색
export const STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  CONFIRMING: "bg-sky-200 text-sky-800",
  RESPONDING: "bg-rose-200 text-rose-800",
  RECOVERING: "bg-yellow-200 text-yellow-800",
  CLOSED: "bg-emerald-200 text-emerald-800",
};
