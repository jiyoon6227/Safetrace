import { useEffect } from "react";
import { X } from "lucide-react";
import { LineChart, MultiLineChart, DonutChart, HorizontalBars, StatusBars, CompareBars } from "./StatisticsCharts";

export default function ChartDetailModal({ modal, onClose, trend, typeRows, regionRows, statusRows, compareCurrent, comparePrevious, typeTrend, topTypes }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-[#0F2540]">{modal.title}</h3>
            <p className="mt-0.5 text-xs text-slate-400">현재 선택한 기간·지역·재난유형 필터가 적용된 상세 차트입니다.</p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">
          {modal.type === "trend" && <LineChart data={trend} height={330} />}
          {modal.type === "type" && <div className="mx-auto max-w-2xl"><DonutChart rows={typeRows} total={typeRows.reduce((s, r) => s + r.value, 0)} size={240} /></div>}
          {modal.type === "region" && <HorizontalBars rows={regionRows} total={regionRows.reduce((s, r) => s + r.value, 0)} maxRows={17} />}
          {modal.type === "status" && <StatusBars rows={statusRows} />}
          {modal.type === "compare" && <CompareBars currentRows={compareCurrent} previousRows={comparePrevious} />}
          {modal.type === "typeTrend" && <MultiLineChart data={typeTrend} series={topTypes} height={360} />}
        </div>
      </div>
    </div>
  );
}
