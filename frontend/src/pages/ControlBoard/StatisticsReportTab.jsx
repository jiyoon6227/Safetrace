import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileDown,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { authFetch } from "../../api/client";

const TAB_ITEMS = [
  { key: "overview", label: "전체" },
  { key: "type", label: "재난 유형별" },
  { key: "region", label: "지역별" },
  { key: "status", label: "대응 현황" },
];

const STATUS_META = {
  RECEIVED: { label: "접수", bar: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
  CONFIRMING: { label: "확인 중", bar: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  RESPONDING: { label: "대응 중", bar: "bg-orange-500", chip: "bg-orange-50 text-orange-700" },
  RECOVERING: { label: "복구 중", bar: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  CLOSED: { label: "종료", bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
};

const TYPE_COLORS = ["#3B82F6", "#14B8A6", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9", "#84CC16", "#F97316"];
const LINE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6"];

function toDateInputValue(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(value, amount) {
  const d = new Date(value);
  d.setDate(d.getDate() + amount);
  return d;
}

function daysBetweenInclusive(from, to) {
  const ms = startOfDay(to) - startOfDay(from);
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatHour(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}분`;
  return `${value.toFixed(value >= 10 ? 0 : 1)}시간`;
}

function percent(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

function changePercent(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

function regionLabelOf(item) {
  const raw = String(item?.region || item?.address || "").trim();
  if (!raw) return "미지정";
  const first = raw.split(/\s+/)[0];
  const map = {
    서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천",
    광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
    경기도: "경기", 강원특별자치도: "강원", 강원도: "강원", 충청북도: "충북", 충청남도: "충남",
    전북특별자치도: "전북", 전라북도: "전북", 전라남도: "전남", 경상북도: "경북",
    경상남도: "경남", 제주특별자치도: "제주",
  };
  return map[first] || first;
}

function getPresetRange(days) {
  const end = new Date();
  const start = addDays(end, -(days - 1));
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

function withinRange(item, from, to, dateField = "createdAt") {
  const d = parseDate(item?.[dateField]);
  if (!d) return false;
  return d >= startOfDay(from) && d <= endOfDay(to);
}

function getPreviousRange(from, to) {
  const currentStart = startOfDay(from);
  const currentEnd = endOfDay(to);
  const dayCount = daysBetweenInclusive(currentStart, currentEnd);
  const previousEnd = endOfDay(addDays(currentStart, -1));
  const previousStart = startOfDay(addDays(previousEnd, -(dayCount - 1)));
  return { from: toDateInputValue(previousStart), to: toDateInputValue(previousEnd) };
}

function avgCloseHours(rows) {
  const values = rows
    .filter((item) => item.status === "CLOSED")
    .map((item) => {
      const start = parseDate(item.createdAt);
      const end = parseDate(item.updatedAt);
      if (!start || !end || end < start) return null;
      return (end - start) / 3600000;
    })
    .filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function groupCount(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || "미지정";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function createTimeSeries(rows, from, to, keyFn = null) {
  const start = startOfDay(from);
  const end = endOfDay(to);
  const days = daysBetweenInclusive(start, end);
  let unit = "day";
  if (days > 120) unit = "month";
  else if (days > 45) unit = "week";

  const bucketMap = new Map();
  const cursor = new Date(start);
  while (cursor <= end) {
    let key;
    let label;
    if (unit === "month") {
      key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      label = `${cursor.getMonth() + 1}월`;
      cursor.setMonth(cursor.getMonth() + 1, 1);
    } else if (unit === "week") {
      key = toDateInputValue(cursor);
      label = `${cursor.getMonth() + 1}.${cursor.getDate()}`;
      cursor.setDate(cursor.getDate() + 7);
    } else {
      key = toDateInputValue(cursor);
      label = `${cursor.getMonth() + 1}.${cursor.getDate()}`;
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!bucketMap.has(key)) bucketMap.set(key, { key, label, value: 0, values: {} });
  }

  const keys = [...bucketMap.keys()];
  rows.forEach((row) => {
    const d = parseDate(row.createdAt);
    if (!d || d < start || d > end || !keys.length) return;
    let index = 0;
    if (unit === "month") {
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      index = Math.max(0, keys.indexOf(monthKey));
    } else if (unit === "week") {
      const diff = Math.floor((startOfDay(d) - start) / 86400000);
      index = Math.min(keys.length - 1, Math.max(0, Math.floor(diff / 7)));
    } else {
      const dayKey = toDateInputValue(d);
      index = Math.max(0, keys.indexOf(dayKey));
    }
    const bucket = bucketMap.get(keys[index]);
    bucket.value += 1;
    if (keyFn) {
      const subKey = keyFn(row) || "기타";
      bucket.values[subKey] = (bucket.values[subKey] || 0) + 1;
    }
  });
  return [...bucketMap.values()];
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function KpiCard({ icon: Icon, label, value, sub, delta, goodWhenDown = false, tone = "blue" }) {
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

function Card({ title, sub, action, children, onClick, className = "" }) {
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

function EmptyChart({ text = "표시할 데이터가 없습니다." }) {
  return (
    <div className="flex h-[210px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm font-medium text-slate-500">
      {text}
    </div>
  );
}

function LineChart({ data, height = 210, color = "#2563EB", compact = false }) {
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

function MultiLineChart({ data, series, height = 260 }) {
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

function DonutChart({ rows, total, size = 176 }) {
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

function HorizontalBars({ rows, total, maxRows = 7 }) {
  const shown = rows.slice(0, maxRows);
  const max = Math.max(1, ...shown.map((r) => r.value));
  if (!shown.length) return <EmptyChart />;
  return (
    <div className="space-y-3.5">
      {shown.map((row, i) => (
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

function StatusBars({ rows }) {
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

function CompareBars({ currentRows, previousRows }) {
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

function DataTable({ columns, rows, empty = "데이터가 없습니다." }) {
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

function ChartDetailModal({ modal, onClose, trend, typeRows, regionRows, statusRows, compareCurrent, comparePrevious, typeTrend, topTypes }) {
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

export default function StatisticsReportTab() {
  const defaultRange = useMemo(() => getPresetRange(30), []);
  const [activeTab, setActiveTab] = useState("overview");
  const [incidents, setIncidents] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ from: defaultRange.from, to: defaultRange.to, region: "ALL", type: "ALL" });
  const [applied, setApplied] = useState({ from: defaultRange.from, to: defaultRange.to, region: "ALL", type: "ALL" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [incRes, repRes] = await Promise.allSettled([authFetch("/api/incidents"), authFetch("/api/reports")]);
    const nextIncidents = incRes.status === "fulfilled" && Array.isArray(incRes.value) ? incRes.value : [];
    const nextReports = repRes.status === "fulfilled" && Array.isArray(repRes.value) ? repRes.value : [];
    setIncidents(nextIncidents);
    setReports(nextReports);
    setUpdatedAt(new Date());
    if (incRes.status === "rejected" && repRes.status === "rejected") setError("통계 데이터를 불러오지 못했습니다.");
    else if (incRes.status === "rejected") setError("사건 데이터 일부를 불러오지 못했습니다.");
    else if (repRes.status === "rejected") setError("제보 데이터 일부를 불러오지 못했습니다.");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const regionOptions = useMemo(() => {
    const set = new Set([...incidents.map(regionLabelOf), ...reports.map(regionLabelOf)].filter((v) => v && v !== "미지정"));
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [incidents, reports]);

  const typeOptions = useMemo(() => {
    const set = new Set([...incidents, ...reports].map((item) => item?.disasterType).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [incidents, reports]);

  const filterRows = useCallback((rows, range, type = "incident") => rows.filter((item) => {
    if (!withinRange(item, range.from, range.to)) return false;
    if (applied.type !== "ALL" && item.disasterType !== applied.type) return false;
    if (applied.region !== "ALL" && regionLabelOf(item) !== applied.region) return false;
    return true;
  }), [applied.region, applied.type]);

  const currentIncidents = useMemo(() => filterRows(incidents, applied), [incidents, applied, filterRows]);
  const currentReports = useMemo(() => filterRows(reports, applied, "report"), [reports, applied, filterRows]);
  const previousRange = useMemo(() => getPreviousRange(applied.from, applied.to), [applied.from, applied.to]);
  const previousIncidents = useMemo(() => filterRows(incidents, previousRange), [incidents, previousRange, filterRows]);
  const previousReports = useMemo(() => filterRows(reports, previousRange, "report"), [reports, previousRange, filterRows]);

  const totalIncidents = currentIncidents.length;
  const closed = currentIncidents.filter((i) => i.status === "CLOSED").length;
  const high = currentIncidents.filter((i) => i.severity === "HIGH").length;
  const avgHours = avgCloseHours(currentIncidents);
  const prevAvgHours = avgCloseHours(previousIncidents);

  const kpis = [
    {
      icon: ShieldAlert, label: "총 사건 수", value: `${formatNumber(totalIncidents)}건`, tone: "blue",
      delta: changePercent(totalIncidents, previousIncidents.length), sub: "선택 기간 내 등록 사건 · 전 기간 대비",
    },
    {
      icon: CheckCircle2, label: "처리 완료", value: `${formatNumber(closed)}건`, tone: "green",
      delta: changePercent(closed, previousIncidents.filter((i) => i.status === "CLOSED").length), sub: `종료율 ${percent(closed, totalIncidents).toFixed(1)}%`,
    },
    {
      icon: Clock3, label: "평균 처리시간", value: formatHour(avgHours), tone: "orange", goodWhenDown: true,
      delta: avgHours == null || prevAvgHours == null ? 0 : changePercent(avgHours, prevAvgHours), sub: "종료 사건의 접수→최종 업데이트 기준",
    },
    {
      icon: AlertTriangle, label: "긴급 사건", value: `${formatNumber(high)}건`, tone: "red",
      delta: changePercent(high, previousIncidents.filter((i) => i.severity === "HIGH").length), sub: `전체 사건의 ${percent(high, totalIncidents).toFixed(1)}%`,
    },
    {
      icon: BarChart3, label: "시민 제보", value: `${formatNumber(currentReports.length)}건`, tone: "purple",
      delta: changePercent(currentReports.length, previousReports.length), sub: "선택 기간 내 접수된 제보",
    },
  ];

  const trend = useMemo(() => createTimeSeries(currentIncidents, applied.from, applied.to), [currentIncidents, applied]);
  const typeRows = useMemo(() => groupCount(currentIncidents, (i) => i.disasterType || "기타"), [currentIncidents]);
  const regionRows = useMemo(() => groupCount(currentIncidents, regionLabelOf), [currentIncidents]);
  const statusRows = useMemo(() => Object.keys(STATUS_META).map((status) => ({ status, value: currentIncidents.filter((i) => i.status === status).length })), [currentIncidents]);

  const topTypes = useMemo(() => typeRows.slice(0, 4).map((r) => r.label), [typeRows]);
  const typeTrend = useMemo(() => createTimeSeries(currentIncidents, applied.from, applied.to, (i) => i.disasterType || "기타"), [currentIncidents, applied]);

  const compareCurrent = useMemo(() => {
    const end = endOfDay(applied.to);
    const start = startOfDay(addDays(end, -6));
    const rangeRows = filterRows(incidents, { from: toDateInputValue(start), to: toDateInputValue(end) });
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 7 }, (_, idx) => {
      const d = addDays(start, idx);
      const key = toDateInputValue(d);
      return {
        dateKey: key,
        label: `${d.getMonth() + 1}.${d.getDate()}`,
        fullDate: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
        weekday: weekdays[d.getDay()],
        value: rangeRows.filter((i) => toDateInputValue(parseDate(i.createdAt) || 0) === key).length,
      };
    });
  }, [incidents, applied.to, filterRows]);

  const comparePrevious = useMemo(() => {
    const end = endOfDay(addDays(applied.to, -7));
    const start = startOfDay(addDays(end, -6));
    const rangeRows = filterRows(incidents, { from: toDateInputValue(start), to: toDateInputValue(end) });
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 7 }, (_, idx) => {
      const d = addDays(start, idx);
      const key = toDateInputValue(d);
      return {
        dateKey: key,
        label: `${d.getMonth() + 1}.${d.getDate()}`,
        fullDate: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
        weekday: weekdays[d.getDay()],
        value: rangeRows.filter((i) => toDateInputValue(parseDate(i.createdAt) || 0) === key).length,
      };
    });
  }, [incidents, applied.to, filterRows]);

  const typeDetailRows = useMemo(() => {
    const prevMap = new Map(groupCount(previousIncidents, (i) => i.disasterType || "기타").map((r) => [r.label, r.value]));
    return typeRows.map((row) => {
      const typeIncidents = currentIncidents.filter((i) => (i.disasterType || "기타") === row.label);
      const closedCount = typeIncidents.filter((i) => i.status === "CLOSED").length;
      const highCount = typeIncidents.filter((i) => i.severity === "HIGH").length;
      const inProgressCount = Math.max(0, typeIncidents.length - closedCount);
      const topRegion = groupCount(typeIncidents, regionLabelOf)[0]?.label || "-";
      return {
        ...row,
        pct: percent(row.value, totalIncidents),
        high: highCount,
        closed: closedCount,
        inProgress: inProgressCount,
        closeRate: percent(closedCount, typeIncidents.length),
        avgHours: avgCloseHours(typeIncidents),
        topRegion,
        delta: changePercent(row.value, prevMap.get(row.label) || 0),
      };
    });
  }, [typeRows, previousIncidents, currentIncidents, totalIncidents]);

  const regionDetailRows = useMemo(() => {
    const prevMap = new Map(groupCount(previousIncidents, regionLabelOf).map((r) => [r.label, r.value]));
    return regionRows.map((row) => {
      const regionInc = currentIncidents.filter((i) => regionLabelOf(i) === row.label);
      return {
        ...row,
        pct: percent(row.value, totalIncidents),
        closed: regionInc.filter((i) => i.status === "CLOSED").length,
        high: regionInc.filter((i) => i.severity === "HIGH").length,
        delta: changePercent(row.value, prevMap.get(row.label) || 0),
      };
    });
  }, [regionRows, previousIncidents, currentIncidents, totalIncidents]);

  const durationRows = useMemo(() => {
    const ranges = [
      { label: "1시간 이내", min: 0, max: 1 },
      { label: "1~3시간", min: 1, max: 3 },
      { label: "3~6시간", min: 3, max: 6 },
      { label: "6~12시간", min: 6, max: 12 },
      { label: "12시간 이상", min: 12, max: Infinity },
    ];
    const closedRows = currentIncidents.filter((i) => i.status === "CLOSED");
    return ranges.map((range) => ({
      label: range.label,
      value: closedRows.filter((i) => {
        const s = parseDate(i.createdAt); const e = parseDate(i.updatedAt);
        if (!s || !e) return false;
        const h = (e - s) / 3600000;
        return h >= range.min && h < range.max;
      }).length,
    }));
  }, [currentIncidents]);

  const quickRange = (days) => setFilters((f) => ({ ...f, ...getPresetRange(days) }));
  const applyFilters = () => {
    if (!filters.from || !filters.to || filters.from > filters.to) return;
    setApplied({ ...filters });
  };
  const resetFilters = () => {
    const range = getPresetRange(30);
    const next = { ...range, region: "ALL", type: "ALL" };
    setFilters(next); setApplied(next);
  };

  const openPrintWindow = (autoPrint = true) => {
    const topType = typeRows.slice(0, 6);
    const topRegion = regionRows.slice(0, 8);
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>SafeTrace 재난·안전 통계보고서</title>
      <style>body{font-family:Arial,'Noto Sans KR',sans-serif;color:#0f2540;margin:36px}h1{font-size:26px;margin:0}small{color:#64748b}.head{border-bottom:2px solid #0f2540;padding-bottom:18px;margin-bottom:22px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.k{border:1px solid #e2e8f0;border-radius:12px;padding:12px}.k b{display:block;font-size:20px;margin-top:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}.box{border:1px solid #e2e8f0;border-radius:12px;padding:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc}.bar{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#3b82f6}@media print{button{display:none}body{margin:16mm}}</style></head><body>
      <div class="head"><h1>SafeTrace 재난·안전 통계보고서</h1><small>${applied.from} ~ ${applied.to} · 지역 ${applied.region === "ALL" ? "전체" : applied.region} · 유형 ${applied.type === "ALL" ? "전체" : applied.type}</small></div>
      <div class="kpis">${kpis.map((k) => `<div class="k"><small>${k.label}</small><b>${k.value}</b><small>${k.sub}</small></div>`).join("")}</div>
      <div class="grid"><div class="box"><h3>재난 유형별</h3><table><tr><th>유형</th><th>건수</th><th>비율</th></tr>${topType.map((r) => `<tr><td>${r.label}</td><td>${r.value}</td><td>${percent(r.value,totalIncidents).toFixed(1)}%</td></tr>`).join("")}</table></div>
      <div class="box"><h3>지역별</h3><table><tr><th>지역</th><th>건수</th><th>비율</th></tr>${topRegion.map((r) => `<tr><td>${r.label}</td><td>${r.value}</td><td>${percent(r.value,totalIncidents).toFixed(1)}%</td></tr>`).join("")}</table></div></div>
      <div class="box" style="margin-top:18px"><h3>대응 상태</h3>${statusRows.map((r) => `<p style="display:grid;grid-template-columns:90px 1fr 55px;gap:10px;align-items:center;font-size:12px"><span>${STATUS_META[r.status]?.label}</span><span class="bar"><i style="width:${percent(r.value,Math.max(1,totalIncidents))}%"></i></span><b>${r.value}건</b></p>`).join("")}</div>
      <p style="margin-top:22px;font-size:10px;color:#94a3b8">※ 평균 처리시간은 종료 사건의 CREATED_AT부터 최종 UPDATED_AT까지를 기준으로 계산합니다.</p>
      <script>window.onload=()=>{${autoPrint ? "setTimeout(()=>window.print(),250);" : ""}}</script></body></html>`;
    const win = window.open("", "_blank", "width=1100,height=850");
    if (!win) return;
    win.document.open(); win.document.write(html); win.document.close();
  };

  const downloadExcel = () => {
    const rows = [
      ["SafeTrace 통계보고서"],
      ["기간", applied.from, applied.to],
      ["지역", applied.region], ["재난유형", applied.type], [],
      ["구분", "값"], ...kpis.map((k) => [k.label, k.value]), [],
      ["재난유형", "사건수", "비율"], ...typeRows.map((r) => [r.label, r.value, `${percent(r.value,totalIncidents).toFixed(1)}%`]), [],
      ["지역", "사건수", "비율"], ...regionRows.map((r) => [r.label, r.value, `${percent(r.value,totalIncidents).toFixed(1)}%`]), [],
      ["상태", "사건수"], ...statusRows.map((r) => [STATUS_META[r.status]?.label || r.status, r.value]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SafeTrace_통계보고서_${applied.from}_${applied.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeColumns = [
    { key: "rank", label: "순위", render: (_, idx) => <span className="font-bold text-slate-400">{idx + 1}</span> },
    { key: "label", label: "재난 유형", render: (r) => <span className="font-extrabold text-[#0F2540]">{r.label}</span> },
    { key: "value", label: "사건 수", align: "right", render: (r) => `${formatNumber(r.value)}건` },
    { key: "pct", label: "비율", align: "right", render: (r) => `${r.pct.toFixed(1)}%` },
    { key: "high", label: "긴급", align: "right", render: (r) => <span className={r.high > 0 ? "font-bold text-red-500" : "text-slate-500"}>{r.high}건</span> },
    { key: "closed", label: "처리 완료", align: "right", render: (r) => `${r.closed}건` },
    { key: "inProgress", label: "진행 중", align: "right", render: (r) => `${r.inProgress}건` },
    { key: "closeRate", label: "종료율", align: "right", render: (r) => `${r.closeRate.toFixed(1)}%` },
    { key: "avgHours", label: "평균 처리시간", align: "right", render: (r) => formatHour(r.avgHours) },
    { key: "topRegion", label: "주요 지역", render: (r) => <span className="font-semibold text-slate-700">{r.topRegion}</span> },
    { key: "delta", label: "전 기간 대비", align: "right", render: (r) => <span className={r.delta > 0 ? "font-bold text-red-500" : r.delta < 0 ? "font-bold text-blue-500" : "text-slate-400"}>{r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "-"} {Math.abs(r.delta).toFixed(0)}%</span> },
  ];
  const regionColumns = [
    { key: "rank", label: "순위", render: (_, idx) => <span className="font-bold text-slate-400">{idx + 1}</span> },
    { key: "label", label: "지역", render: (r) => <span className="font-bold text-[#0F2540]">{r.label}</span> },
    { key: "value", label: "사건", align: "right", render: (r) => `${r.value}건` },
    { key: "closed", label: "종료", align: "right", render: (r) => `${r.closed}건` },
    { key: "high", label: "긴급", align: "right", render: (r) => `${r.high}건` },
    { key: "pct", label: "비율", align: "right", render: (r) => `${r.pct.toFixed(1)}%` },
    { key: "delta", label: "전 기간 대비", align: "right", render: (r) => <span className={r.delta > 0 ? "font-bold text-red-500" : r.delta < 0 ? "font-bold text-blue-500" : "text-slate-400"}>{r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "-"} {Math.abs(r.delta).toFixed(0)}%</span> },
  ];


  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-blue-600">통계 보고서</p>
          <h1 className="mt-0.5 text-[26px] font-extrabold tracking-tight text-[#0F2540]">재난·안전 통계 분석</h1>
          <p className="mt-1 text-[12px] text-slate-600">사건·시민 제보 데이터를 기간, 지역, 재난 유형별로 분석합니다.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {updatedAt && <span className="mr-1 text-[10px] text-slate-400">{updatedAt.toLocaleString("ko-KR")} 업데이트</span>}
          <button onClick={() => openPrintWindow(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer hover:bg-slate-50 hover:border-slate-300"><FileDown className="h-4 w-4 text-red-500" />PDF 내보내기</button>
          <button onClick={downloadExcel} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer hover:bg-slate-50 hover:border-slate-300"><FileSpreadsheet className="h-4 w-4 text-emerald-600" />엑셀 다운로드</button>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />새로고침</button>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
          {TAB_ITEMS.map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`cursor-pointer rounded-lg px-4 py-2.5 text-[12px] font-bold transition ${activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}>{tab.label}</button>)}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[142px] flex-1 max-w-[190px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">시작일</span><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({...f, from:e.target.value}))} className="w-full cursor-pointer rounded-xl border border-slate-200 py-2.5 pl-9 pr-2 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"/></div></label>
          <label className="min-w-[142px] flex-1 max-w-[190px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">종료일</span><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({...f, to:e.target.value}))} className="w-full cursor-pointer rounded-xl border border-slate-200 py-2.5 pl-9 pr-2 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"/></div></label>
          <div className="flex items-center gap-1 pb-[1px]">{[[1,"오늘"],[7,"7일"],[30,"30일"],[90,"3개월"],[365,"1년"]].map(([d,l]) => <button key={d} onClick={() => quickRange(d)} className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600">{l}</button>)}</div>
          <label className="min-w-[135px] flex-1 max-w-[185px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">지역</span><div className="relative"><select value={filters.region} onChange={(e) => setFilters((f)=>({...f,region:e.target.value}))} className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 px-3 py-2.5 pr-8 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"><option value="ALL">전체 지역</option>{regionOptions.map((r)=><option key={r} value={r}>{r}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div></label>
          <label className="min-w-[145px] flex-1 max-w-[200px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">재난 유형</span><div className="relative"><select value={filters.type} onChange={(e) => setFilters((f)=>({...f,type:e.target.value}))} className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 px-3 py-2.5 pr-8 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"><option value="ALL">전체 유형</option>{typeOptions.map((t)=><option key={t} value={t}>{t}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div></label>
          <button onClick={applyFilters} className="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-[12px] font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.97]"><Search className="h-3.5 w-3.5"/>조회하기</button>
          <button onClick={resetFilters} className="h-[38px] cursor-pointer rounded-xl border border-slate-200 px-4 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97]">초기화</button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-700">{error}</div>}
      {loading && !incidents.length && !reports.length ? <div className="flex h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div> : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">{kpis.map((k)=><KpiCard key={k.label} {...k}/>)}</div>

          {activeTab === "overview" && <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr]">
              <Card title="사건 발생 추이" sub="선택 기간 내 사건 접수 건수" onClick={() => setModal({type:"trend",title:"사건 발생 추이 상세"})}><LineChart data={trend}/><p className="mt-1 text-right text-[9px] text-slate-400">차트를 클릭하면 크게 볼 수 있습니다.</p></Card>
              <Card title="재난 유형별 비율" sub="사건의 재난 유형 구성" onClick={() => setModal({type:"type",title:"재난 유형별 비율 상세"})}><DonutChart rows={typeRows} total={totalIncidents}/></Card>
              <Card title="지역별 사건 현황" sub="사건 발생 지역 상위 순" onClick={() => setModal({type:"region",title:"지역별 사건 현황 상세"})}><HorizontalBars rows={regionRows} total={totalIncidents}/></Card>
            </div>
            <div className="grid items-start gap-3 xl:grid-cols-[1.15fr_1fr_0.9fr]">
              <Card
                title={
                  <span className="inline-flex items-center gap-1.5">
                    최근 7일 비교
                    <span className="group relative inline-flex" onClick={(e) => e.stopPropagation()}>
                      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-blue-100 text-[10px] font-extrabold text-blue-600">?</span>
                      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-800 px-3 py-2.5 text-left text-[10px] font-medium leading-5 text-white shadow-xl group-hover:block">
                        선택한 종료일을 기준으로 최근 7일과 그 직전 7일의 사건 발생 건수를 날짜별로 비교합니다.
                      </span>
                    </span>
                  </span>
                }
                sub="최근 7일과 직전 7일의 사건 발생 건수를 날짜별로 비교합니다."
                onClick={() => setModal({type:"compare",title:"최근 7일 비교 상세"})}
              ><CompareBars currentRows={compareCurrent} previousRows={comparePrevious}/></Card>
              <Card title="처리 상태별 현황" sub="현재 선택 기간 사건의 진행 상태" className="self-start" onClick={() => setModal({type:"status",title:"처리 상태별 현황 상세"})}><StatusBars rows={statusRows}/></Card>
              <Card title="주요 재난 유형" sub="발생 건수 기준 상위 유형" className="self-start"><div className="divide-y divide-slate-100">{typeDetailRows.slice(0,5).map((r,idx)=><div key={r.label} className="flex items-center gap-2 rounded-lg px-1.5 py-3 text-[12px] transition-colors hover:bg-slate-50"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold ${idx<3?"bg-blue-50 text-blue-600":"bg-slate-100 text-slate-600"}`}>{idx+1}</span><span className="min-w-0 flex-1 truncate font-extrabold text-[#0F2540]">{r.label}</span><span className="font-bold text-slate-700">{r.value}건</span><span className={`w-12 text-right text-[10px] font-bold ${r.delta>0?"text-red-500":r.delta<0?"text-blue-500":"text-slate-400"}`}>{r.delta>0?"▲":r.delta<0?"▼":"-"} {Math.abs(r.delta).toFixed(0)}%</span></div>)}</div></Card>
            </div>
          </div>}

          {activeTab === "type" && <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
              <Card title="재난 유형별 사건 추이" sub="상위 4개 재난 유형의 기간별 변화" onClick={() => setModal({type:"typeTrend",title:"재난 유형별 사건 추이 상세"})}><MultiLineChart data={typeTrend} series={topTypes}/></Card>
              <Card title="재난 유형별 구성" sub="현재 필터 기준"><DonutChart rows={typeRows} total={totalIncidents}/></Card>
            </div>
            <Card title="재난 유형별 상세 통계" sub="유형별 건수·긴급·처리 현황·주요 지역·전 기간 대비" className="w-full mr-auto">
              <DataTable columns={typeColumns} rows={typeDetailRows}/>
            </Card>
          </div>}

          {activeTab === "region" && <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
            <Card title="지역별 발생 순위" sub="전국 시·도 수준 요약" onClick={() => setModal({type:"region",title:"지역별 발생 현황 상세"})}><HorizontalBars rows={regionRows} total={totalIncidents} maxRows={17}/></Card>
            <Card title="지역별 상세 통계" sub="사건·종료·긴급 현황"><DataTable columns={regionColumns} rows={regionDetailRows}/></Card>
          </div>}

          {activeTab === "status" && <div className="grid gap-3 xl:grid-cols-2">
            <Card title="처리 상태별 현황" sub="접수 → 확인 → 대응 → 복구 → 종료" onClick={() => setModal({type:"status",title:"대응 상태 상세"})}><StatusBars rows={statusRows}/></Card>
            <Card title="종료 사건 처리시간 분포" sub="종료 사건의 접수부터 최종 업데이트까지"><HorizontalBars rows={durationRows} total={Math.max(1,closed)} maxRows={5}/></Card>
            <Card title="대응 요약" sub="현재 선택 기간" className="xl:col-span-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {statusRows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const ratio = percent(r.value, totalIncidents);
                  return (
                    <div key={r.status} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${meta.chip}`}>{meta.label}</span>
                        <span className="text-[11px] font-bold text-slate-500">{ratio.toFixed(1)}%</span>
                      </div>
                      <strong className="mt-3 block text-[28px] leading-none font-extrabold tracking-tight text-[#0F2540]">{r.value}건</strong>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">전체 대비 {ratio.toFixed(1)}%</p>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                        <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${r.value > 0 ? Math.max(ratio, 8) : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>}


        </>
      )}

      <ChartDetailModal modal={modal} onClose={() => setModal(null)} trend={trend} typeRows={typeRows} regionRows={regionRows} statusRows={statusRows} compareCurrent={compareCurrent} comparePrevious={comparePrevious} typeTrend={typeTrend} topTypes={topTypes}/>
    </div>
  );
}
