import { RefreshCw, Search } from "lucide-react";
import { REQUEST_STATUS_FILTERS } from "../../constants/resource";

const FILTER_CONTROL = "border border-slate-300 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#0F2540]";

// 자원 요청 목록 위의 상태 칩(건수 포함)·검색창·새로고침. data는 useMyResources가 돌려준 값이고,
// children은 검색창 앞에 끼울 화면별 조건(예: STAFF의 사건 선택)이다.
export default function ResourceFilterBar({ data, children }) {
  const counts = data.summary?.counts || {};
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {REQUEST_STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value || "all"}
            type="button"
            onClick={() => data.changeStatus(filter.value)}
            className={`text-[13px] font-bold rounded-full px-3.5 py-1.5 transition cursor-pointer ${
              data.status === filter.value ? "bg-[#0F2540] text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {filter.label} ({filter.value ? counts[filter.value] || 0 : data.summary?.total || 0})
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {children}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={data.keywordInput}
            onChange={(e) => data.setKeywordInput(e.target.value)}
            maxLength={50}
            placeholder="품목명, 사유, 사건명으로 검색하세요."
            aria-label="자원 요청 검색"
            className={`${FILTER_CONTROL} w-full pl-9`}
          />
        </div>
        <button
          type="button"
          onClick={data.reload}
          disabled={data.loading}
          className="flex items-center justify-center gap-1.5 border border-slate-300 rounded-lg bg-white px-3.5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${data.loading ? "animate-spin" : ""}`} /> 새로고침
        </button>
      </div>
    </div>
  );
}
