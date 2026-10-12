import {
  ChevronRight,
} from "lucide-react";
import { MAIN_DISASTER_FILTERS, disasterBadgeClass, disasterFilterOf, disasterSummary, disasterTitle, formatDisasterTime } from "../../utils/disasterMessages";

// 실시간 재난·안전 정보
export default function DisasterInfoSection({
  disasterListRef,
  mainDisasterMessages,
  mainDisasterLoading,
  mainDisasterError,
  mainDisasterFilter,
  setMainDisasterFilter,
  goTo,
}) {
  return (
    <section ref={disasterListRef} className="bg-white rounded-[18px] border border-slate-200 shadow-sm overflow-hidden min-h-[430px]">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-extrabold text-[#0B2A52] flex items-center gap-2">
          <span className="text-red-500">◉</span> 실시간 재난 · 안전 정보
        </h2>
        <button onClick={() => goTo("disaster-info")} className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">
          더보기 <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 flex gap-2 pb-3 overflow-x-auto">
        {MAIN_DISASTER_FILTERS.map((x) => (
          <button
            key={x}
            onClick={() => setMainDisasterFilter(x)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition whitespace-nowrap ${mainDisasterFilter === x ? "bg-[#0B2A52] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            {x}
          </button>
        ))}
      </div>

      <ul className="px-5">
        {mainDisasterLoading && (
          <li className="py-14 text-center text-sm text-slate-400 border-t border-slate-100">재난문자를 불러오는 중입니다.</li>
        )}

        {!mainDisasterLoading && mainDisasterError && (
          <li className="py-12 text-center border-t border-slate-100">
            <div className="text-sm text-slate-500">{mainDisasterError}</div>
            <button onClick={() => goTo("disaster-info")} className="mt-2 text-xs font-bold text-blue-600 cursor-pointer">전체 페이지에서 다시 확인하기</button>
          </li>
        )}

        {!mainDisasterLoading && !mainDisasterError && mainDisasterMessages
          .filter((m) => mainDisasterFilter === "전체" || disasterFilterOf(m) === mainDisasterFilter)
          .slice(0, 4)
          .map((m, i) => (
            <li
              key={m.sn || `${m.createdAt || "time"}-${i}`}
              onClick={() => goTo("disaster-info", { disasterSn: m.sn || null })}
              className="py-4 border-t border-slate-100 flex gap-3 items-start cursor-pointer hover:bg-slate-50 transition -mx-5 px-5"
            >
              <span className={`min-w-[52px] text-center rounded-lg border px-2 py-1.5 text-xs font-bold ${disasterBadgeClass(m)}`}>
                {disasterFilterOf(m)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[14px] text-[#0B2A52] truncate">{disasterTitle(m)}</div>
                <div className="text-[12px] text-slate-400 mt-1 truncate">{disasterSummary(m)}</div>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">{formatDisasterTime(m.createdAt)}</span>
            </li>
          ))}

        {!mainDisasterLoading && !mainDisasterError && mainDisasterMessages
          .filter((m) => mainDisasterFilter === "전체" || disasterFilterOf(m) === mainDisasterFilter).length === 0 && (
            <li className="py-10 text-center text-sm text-slate-400 border-t border-slate-100">조건에 맞는 재난문자가 없습니다.</li>
          )}
      </ul>
    </section>
  );
}
