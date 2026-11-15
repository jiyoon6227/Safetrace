// 화면 곳곳에서 같이 쓰는 날짜·시간 표기 모음
const pad2 = (n) => String(n).padStart(2, "0");

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Date -> "2026-11-05" (date 입력칸 값, 날짜 키)
export const toDateInputValue = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// 값 -> "2026.11.05". 비었거나 날짜가 아니면 fallback
export function formatDotDate(value, fallback = "-") {
  const date = toDate(value);
  return date ? `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}` : fallback;
}

// 값 -> "2026.11.05 14:30". 비었거나 날짜가 아니면 fallback
export function formatDotDateTime(value, fallback = "-") {
  const date = toDate(value);
  return date ? `${formatDotDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}` : fallback;
}

// ISO -> "11. 5. 오후 02:30" 같은 짧은 월·일·시각
export const formatShortDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
