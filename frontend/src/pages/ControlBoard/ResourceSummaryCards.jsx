import { CheckCircle2, ClipboardList, Clock, Package, Truck } from "lucide-react";

// statuses가 없으면 전체 건수. 건수는 서버(/api/resources/requests/summary)가 센 값을 그대로 쓴다.
const CARDS = [
  { label: "전체 요청", Icon: ClipboardList, tone: "bg-blue-50 text-blue-600" },
  { label: "승인 대기", hint: "승인 검토 중인 요청", Icon: Clock, tone: "bg-amber-50 text-amber-600", statuses: ["REQUESTED"] },
  { label: "출고 대기", hint: "승인 완료, 출고 전", Icon: Package, tone: "bg-sky-50 text-sky-600", statuses: ["APPROVED"] },
  { label: "반납 전", hint: "출고 완료, 반납 대기", Icon: Truck, tone: "bg-indigo-50 text-indigo-600", statuses: ["DISPATCHED"] },
  { label: "처리 완료", hint: "반납 정산·출고까지 끝남", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", statuses: ["SETTLED", "COMPLETED"] },
];

// 자원 관리 탭 맨 위의 상태 요약 카드. scopeHint는 "전체 요청" 카드의 설명 (STAFF는 내 요청, ADMIN은 접수된 전체)
export default function ResourceSummaryCards({ summary, scopeHint = "내가 요청한 전체 자원" }) {
  const counts = summary?.counts || {};
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {CARDS.map(({ label, hint = scopeHint, Icon, tone, statuses }) => {
        const value = statuses ? statuses.reduce((sum, status) => sum + (counts[status] || 0), 0) : summary?.total || 0;
        return (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3 min-w-0">
            <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${tone}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-600">{label}</div>
              <div className="text-xl font-extrabold text-[#0F2540] leading-tight">
                {value}
                <span className="text-xs font-bold text-slate-400 ml-0.5">건</span>
              </div>
              <div className="text-xs text-slate-500 truncate">{hint}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
