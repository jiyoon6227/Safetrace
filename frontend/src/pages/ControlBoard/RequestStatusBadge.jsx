import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, getRequestStatusLabel } from "../../constants/resource";

// 요청 상태 배지 - 자원 관리 탭과 사건 상세 요약이 같이 쓴다
// 반납 신청 상태도 labels·styles만 바꿔 같은 배지로 보여준다. request를 넘기면 부분 반납 진행(1/2대 반납)을 글자에 담는다.
export default function RequestStatusBadge({ status, request, className = "px-2.5 py-1 text-[11px]", labels = REQUEST_STATUS_LABEL, styles = REQUEST_STATUS_STYLE }) {
  return (
    <span className={`shrink-0 font-bold rounded-full whitespace-nowrap ${className} ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {request ? getRequestStatusLabel(request) : labels[status] || status}
    </span>
  );
}
