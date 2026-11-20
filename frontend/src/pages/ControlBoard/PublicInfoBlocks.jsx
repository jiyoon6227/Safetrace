import { Loader2 } from "lucide-react";

export function SummaryCard({ icon: Icon, tone, label, value, badge, badgeTone, sub, loading, extra }) {
  return (
    <div className="h-[88px] bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-[0_1px_2px_rgba(15,37,64,0.03)]">
      <div className="h-full flex items-center gap-3.5">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className="w-6 h-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            <strong className="text-[22px] leading-none text-[#0F2540] whitespace-nowrap">
              {loading ? "-" : value}
            </strong>
            {!loading && badge ? (
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold whitespace-nowrap ${badgeTone || "text-slate-500 bg-slate-50"}`}>
                {badge}
              </span>
            ) : null}
            <div className="ml-auto">{extra}</div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, action, children }) {
  return (
    <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(15,37,64,0.03)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[#0F2540]">{title}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function LoadingBlock({ compact = false }) {
  return (
    <div className={`flex items-center justify-center text-slate-400 ${compact ? "min-h-[150px]" : "min-h-[340px]"}`}>
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-[11px] font-medium">공공데이터를 불러오는 중입니다.</span>
    </div>
  );
}

export function EmptyBlock({ icon: Icon, title, compact = false }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center text-center ${compact ? "min-h-[150px]" : "min-h-[340px]"}`}>
      <Icon className="w-5 h-5 text-slate-400 mb-2" />
      <p className="text-[11px] font-bold text-slate-600">{title}</p>
      <p className="text-[9px] text-slate-400 mt-1">새로고침 후 다시 확인해주세요.</p>
    </div>
  );
}
