import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE } from "../../constants/resource";

// 요청 상태 배지 - 자원 관리 탭과 사건 상세 요약이 같이 쓴다
export default function RequestStatusBadge({ status, className = "px-2.5 py-1 text-[11px]" }) {
  return (
    <span className={`shrink-0 font-bold rounded-full whitespace-nowrap ${className} ${REQUEST_STATUS_STYLE[status] || "bg-slate-100 text-slate-600"}`}>
      {REQUEST_STATUS_LABEL[status] || status}
    </span>
  );
}
