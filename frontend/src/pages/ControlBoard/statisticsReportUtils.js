import { toDateInputValue } from "../../utils/dateFormat";

export const TAB_ITEMS = [
  { key: "overview", label: "전체" },
  { key: "type", label: "재난 유형별" },
  { key: "region", label: "지역별" },
  { key: "status", label: "대응 현황" },
];

export const STATUS_META = {
  RECEIVED: { label: "접수", bar: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
  CONFIRMING: { label: "확인 중", bar: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  RESPONDING: { label: "대응 중", bar: "bg-orange-500", chip: "bg-orange-50 text-orange-700" },
  RECOVERING: { label: "복구 중", bar: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  CLOSED: { label: "종료", bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
};

export const TYPE_COLORS = ["#3B82F6", "#14B8A6", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9", "#84CC16", "#F97316"];
export const LINE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6"];

function addDays(value, amount) {
  const d = new Date(value);
  d.setDate(d.getDate() + amount);
  return d;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

export function formatHour(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}분`;
  return `${value.toFixed(value >= 10 ? 0 : 1)}시간`;
}

export function percent(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

export function changePercent(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

export function getPresetRange(days) {
  const end = new Date();
  const start = addDays(end, -(days - 1));
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}
