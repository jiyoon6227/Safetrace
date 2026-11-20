import { TrendingDown, TrendingUp } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, sub, delta, goodWhenDown = false, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-500",
    purple: "bg-violet-50 text-violet-600",
  };
  const positive = delta > 0;
  const improved = goodWhenDown ? delta < 0 : delta > 0;
  const neutral = !Number.isFinite(delta) || Math.abs(delta) < 0.05;
  const DeltaIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm min-w-0 transition hover:border-blue-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-slate-600">{label}</p>
          <div className="mt-0.5 flex items-baseline gap-2 min-w-0">
            <strong className="truncate text-[24px] leading-none font-extrabold tracking-tight text-[#0F2540]">{value}</strong>
            {!neutral && (
              <span className={`inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold ${improved ? "text-emerald-600" : "text-red-500"}`}>
                <DeltaIcon className="h-3 w-3" /> {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  );
}

export function Card({ title, sub, action, children, onClick, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-0 ${onClick ? "cursor-pointer hover:border-blue-300 hover:shadow-md transition" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[#0F2540]">{title}</h3>
          {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
        </div>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function DataTable({ columns, rows, empty = "데이터가 없습니다." }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="bg-slate-50/90">
          <tr>{columns.map((col) => <th key={col.key} className={`px-3 py-3 text-[11px] font-bold text-slate-600 ${col.align === "right" ? "text-right" : ""}`}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {!rows.length && <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">{empty}</td></tr>}
          {rows.map((row, idx) => (
            <tr key={row.id ?? idx} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
              {columns.map((col) => <td key={col.key} className={`px-3 py-3 text-[12px] text-slate-700 ${col.align === "right" ? "text-right" : ""}`}>{col.render ? col.render(row, idx) : row[col.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
