import { CheckCircle2, ClipboardList, Clock, Package, Truck } from "lucide-react";

// large 카드의 열 수: 칸이 좁으면 적게 (칸 폭 기준이라 오른쪽 상세 패널이 붙어도 깨지지 않는다)
const LARGE_GRID = { 3: "@lg:grid-cols-3", 4: "@lg:grid-cols-2 @4xl:grid-cols-4", 5: "@lg:grid-cols-3 @4xl:grid-cols-5" };

// statuses가 없으면 전체 건수. 건수는 서버(/api/resources/requests/summary)가 센 값을 그대로 쓴다.
export const REQUEST_SUMMARY_CARDS = [
  { label: "전체 요청", Icon: ClipboardList, tone: "bg-blue-50 text-blue-600" },
  { label: "승인 대기", hint: "승인 검토 중인 요청", Icon: Clock, tone: "bg-amber-50 text-amber-600", statuses: ["REQUESTED"] },
  { label: "출고 대기", hint: "승인 완료, 출고 전", Icon: Package, tone: "bg-sky-50 text-sky-600", statuses: ["APPROVED"] },
  { label: "반납 진행", hint: "출고 완료, 반납·정산 진행 중", Icon: Truck, tone: "bg-indigo-50 text-indigo-600", statuses: ["DISPATCHED"] },
  { label: "처리 완료", hint: "반납 정산·출고까지 끝남", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", statuses: ["SETTLED", "COMPLETED"] },
];

// 자원 관리 탭 맨 위의 상태 요약 카드. scopeHint는 "전체" 카드의 설명 (STAFF는 내 요청, ADMIN은 접수된 전체)
// large(ADMIN)는 놓인 칸 폭(@container)에 맞춰 열 수를 정한다: 오른쪽 상세 패널이 붙어 좁아져도 글자가 세로로 깨지지 않게
// cards를 넘기면 다른 목록(ADMIN 반납 관리)도 같은 모양으로 보여준다.
export default function ResourceSummaryCards({ summary, scopeHint = "내가 요청한 전체 자원", cards = REQUEST_SUMMARY_CARDS, large }) {
  const counts = summary?.counts || {};
  return (
    <div className={`grid grid-cols-2 gap-3 ${large ? LARGE_GRID[cards.length] : cards.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-5"}`}>
      {cards.map(({ label, hint = scopeHint, Icon, tone, statuses }) => {
        const value = statuses ? statuses.reduce((sum, status) => sum + (counts[status] || 0), 0) : summary?.total || 0;
        return (
          <div key={label} className={`rounded-xl border border-slate-200 bg-white flex items-center gap-3 min-w-0 ${large ? "p-4" : "p-3.5"}`}>
            <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${tone}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-600">{label}</div>
              <div className={`font-extrabold text-[#0F2540] leading-tight ${large ? "text-[26px]" : "text-xl"}`}>
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
