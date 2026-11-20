import { formatNumber, percent, changePercent, STATUS_META, TYPE_COLORS, LINE_COLORS } from "./statisticsReportUtils";

function EmptyChart({ text = "표시할 데이터가 없습니다." }) {
  return (
    <div className="flex h-[210px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm font-medium text-slate-500">
      {text}
    </div>
  );
}

export function LineChart({ data, height = 210, color = "#2563EB", compact = false }) {
  if (!data?.length) return <EmptyChart />;
  const w = 640;
  const h = height;
  const pad = { l: 36, r: 18, t: 18, b: 34 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const labelEvery = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" shapeRendering="geometricPrecision" textRendering="geometricPrecision">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + t * (h - pad.t - pad.b);
          const val = Math.round(max * (1 - t));
          return (
            <g key={t}>
              <line x1={pad.l} y1={yy} x2={w - pad.r} y2={yy} stroke="#CBD5E1" strokeWidth="1.25" />
              <text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#64748B">{val}</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={d.key || i}>
            <circle cx={x(i)} cy={y(d.value)} r="4.5" fill="white" stroke={color} strokeWidth="3.25"><title>{`${d.label}: ${d.value}건`}</title></circle>
            {i % labelEvery === 0 && (
              <text x={x(i)} y={h - 10} textAnchor="middle" fontSize={compact ? "10" : "11"} fill="#475569">{d.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function MultiLineChart({ data, series, height = 260 }) {
  if (!data?.length || !series?.length) return <EmptyChart />;
  const w = 720;
  const h = height;
  const pad = { l: 38, r: 18, t: 24, b: 38 };
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d.values?.[s] || 0))));
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const labelEvery = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, idx) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
            <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }} />{s}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" shapeRendering="geometricPrecision" textRendering="geometricPrecision">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + t * (h - pad.t - pad.b);
          return <line key={t} x1={pad.l} y1={yy} x2={w - pad.r} y2={yy} stroke="#CBD5E1" strokeWidth="1.25" />;
        })}
        {series.map((s, sIdx) => {
          const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(Number(d.values?.[s] || 0))}`).join(" ");
          const color = LINE_COLORS[sIdx % LINE_COLORS.length];
          return (
            <g key={s}>
              <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
              {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(Number(d.values?.[s] || 0))} r="3.5" fill="white" stroke={color} strokeWidth="2.5"><title>{`${d.label} · ${s}: ${d.values?.[s] || 0}건`}</title></circle>)}
            </g>
          );
        })}
        {data.map((d, i) => i % labelEvery === 0 ? <text key={d.key} x={x(i)} y={h - 10} textAnchor="middle" fontSize="11" fill="#475569">{d.label}</text> : null)}
      </svg>
    </div>
  );
}

export function DonutChart({ rows, total, size = 176 }) {
  if (!rows?.length || !total) return <EmptyChart />;
  let acc = 0;
  const stops = rows.map((row, index) => {
    const start = acc;
    const end = acc + percent(row.value, total);
    acc = end;
    return `${TYPE_COLORS[index % TYPE_COLORS.length]} ${start}% ${end}%`;
  });
  const gradient = `conic-gradient(${stops.join(",")})`;

  return (
    <div className="flex items-center gap-5 min-w-0">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
        <div className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-white text-center">
          <strong className="text-[22px] font-extrabold text-[#0F2540]">{formatNumber(total)}건</strong>
          <span className="text-[10px] font-medium text-slate-500">전체 사건</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {rows.slice(0, 6).map((row, index) => (
          <div key={row.label} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[12px] transition-colors hover:bg-slate-50">
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: TYPE_COLORS[index % TYPE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate font-bold text-slate-700">{row.label}</span>
            <span className="shrink-0 font-bold text-[#0F2540]">{percent(row.value, total).toFixed(1)}%</span>
            <span className="w-12 shrink-0 text-right font-medium text-slate-500">{row.value}건</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBars({ rows, total, maxRows = 7 }) {
  const shown = rows.slice(0, maxRows);
  const max = Math.max(1, ...shown.map((r) => r.value));
  if (!shown.length) return <EmptyChart />;
  return (
    <div className="space-y-3.5">
      {shown.map((row) => (
        <div key={row.label} className="group rounded-lg px-1 py-1 transition-colors hover:bg-slate-50">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate font-bold text-slate-700 group-hover:text-[#0F2540]">{row.label}</span>
            <span className="shrink-0 font-bold text-[#0F2540]">{formatNumber(row.value)}건 <em className="ml-1 not-italic font-medium text-slate-400">{percent(row.value, total).toFixed(1)}%</em></span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(4, (row.value / max) * 100)}%`, opacity: 1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusBars({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const meta = STATUS_META[row.status] || STATUS_META.RECEIVED;
        return (
          <div key={row.status} className="grid grid-cols-[78px_1fr_72px] items-center gap-3 rounded-lg px-1 py-1 text-[12px] transition-colors hover:bg-slate-50">
            <span className="font-bold text-slate-700">{meta.label}</span>
            <div className="h-3.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
              <div className={`h-full rounded-full ${meta.bar} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]`} style={{ width: `${Math.max(row.value ? 5 : 0, (row.value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-extrabold text-[#0F2540]">{row.value} <em className="not-italic text-[10px] font-medium text-slate-500">({percent(row.value, total).toFixed(0)}%)</em></span>
          </div>
        );
      })}
    </div>
  );
}

export function CompareBars({ currentRows, previousRows }) {
  const currentTotal = currentRows.reduce((sum, row) => sum + row.value, 0);
  const previousTotal = previousRows.reduce((sum, row) => sum + row.value, 0);
  const diff = currentTotal - previousTotal;
  const delta = changePercent(currentTotal, previousTotal);
  const max = Math.max(1, ...currentRows.map((r) => r.value), ...previousRows.map((r) => r.value));
  const peak = currentRows.reduce((best, row) => (!best || row.value > best.value ? row : best), null);
  const currentRange = currentRows.length ? `${currentRows[0].fullDate} ~ ${currentRows[currentRows.length - 1].fullDate}` : "-";
  const previousRange = previousRows.length ? `${previousRows[0].fullDate} ~ ${previousRows[previousRows.length - 1].fullDate}` : "-";

  const comparisonText = diff > 0
    ? `직전 7일(${previousTotal}건) 대비 ${diff}건 증가했습니다.`
    : diff < 0
      ? `직전 7일(${previousTotal}건) 대비 ${Math.abs(diff)}건 감소했습니다.`
      : `직전 7일(${previousTotal}건)과 동일합니다.`;

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium leading-5 text-slate-400">
        최근 7일: {currentRange} <span className="mx-1 text-slate-300">|</span> 직전 7일: {previousRange}
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-blue-50 px-3 py-2.5">
          <span className="text-[10px] font-bold text-slate-500">최근 7일 합계</span>
          <div className="mt-0.5 flex items-end gap-2">
            <strong className="text-[24px] font-extrabold leading-none text-blue-600">{currentTotal}건</strong>
            <span className={`pb-0.5 text-[10px] font-extrabold ${diff > 0 ? "text-red-500" : diff < 0 ? "text-blue-500" : "text-slate-400"}`}>
              {diff > 0 ? "▲" : diff < 0 ? "▼" : "-"} {Math.abs(delta).toFixed(0)}%
            </span>
          </div>
          <span className="mt-1 block text-[9px] text-slate-400">직전 7일 대비</span>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="text-[10px] font-bold text-slate-500">직전 7일 합계</span>
          <strong className="mt-0.5 block text-[24px] font-extrabold leading-none text-[#0F2540]">{previousTotal}건</strong>
          <span className="mt-1 block text-[9px] text-slate-400">비교 기준 기간</span>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold text-slate-400">(건)</span>
        <div className="flex gap-3 text-[9px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-blue-500" />최근 7일</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-300" />직전 7일</span>
        </div>
      </div>

      <div className="flex h-[150px] items-end gap-2 border-b border-slate-200 px-1 pb-1">
        {currentRows.map((row, idx) => {
          const current = row.value || 0;
          const previousRow = previousRows[idx];
          const previous = previousRow?.value || 0;
          return (
            <div key={row.dateKey || row.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-[112px] w-full max-w-[48px] items-end justify-center gap-1">
                <div className="flex h-full w-[42%] flex-col justify-end">
                  <span className="mb-1 text-center text-[9px] font-extrabold text-[#0F2540]">{current}</span>
                  <div className="w-full rounded-t bg-blue-500" style={{ height: `${Math.max(current ? 7 : 0, (current / max) * 88)}%` }} title={`${row.fullDate} ${current}건`} />
                </div>
                <div className="flex h-full w-[42%] flex-col justify-end">
                  <span className="mb-1 text-center text-[9px] font-bold text-slate-400">{previous}</span>
                  <div className="w-full rounded-t bg-slate-300" style={{ height: `${Math.max(previous ? 7 : 0, (previous / max) * 88)}%` }} title={`${previousRow?.fullDate || "직전 기간"} ${previous}건`} />
                </div>
              </div>
              <span className="text-[9px] font-semibold text-slate-500">{row.label}</span>
              <span className="text-[8px] text-slate-400">({row.weekday})</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl bg-blue-50/80 px-3 py-2.5 text-[10px] leading-5 text-slate-600">
        <strong className="text-blue-700">최근 7일 동안 {currentTotal}건</strong>의 사건이 발생했으며, {comparisonText}
        {peak?.value > 0 && <><br />특히 <strong>{peak.fullDate}</strong>에 가장 많은 <strong className="text-blue-700">{peak.value}건</strong>의 사건이 발생했습니다.</>}
      </div>
    </div>
  );
}
