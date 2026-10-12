import { WEATHER_LOCATION_CACHE_KEY } from "./constants";

export const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// "2026. 09. 07. 14:30" 형식 — 연/월/일 2자리 고정 + 24시간제 시:분
export const formatDateTimeFull = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "5분 전" / "1시간 전" / "1일 전" 형식 - 제보 목록 모달의 "마지막 업데이트" 표시용
export const formatRelativeTime = (iso) => {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `약 ${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `약 ${hr}시간 전`;
  return `약 ${Math.floor(hr / 24)}일 전`;
};

export const readWeatherCachedLocation = () => {
  try {
    const raw = window.sessionStorage.getItem(WEATHER_LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
};

export const weatherEmoji = (weather) => {
  const type = String(weather?.precipitationType || "");
  if (type.includes("눈") && type.includes("비")) return "🌨️";
  if (type.includes("눈")) return "❄️";
  if (type.includes("비") || type.includes("빗")) return "🌧️";
  return "☀️";
};

export const normalizeRainfall = (value) => {
  if (value == null || value === "" || String(value).includes("없")) return "0mm";
  const number = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? `${number}mm` : String(value);
};

export const airGradeClass = (grade) => {
  switch (grade) {
    case "좋음": return "text-blue-600";
    case "보통": return "text-emerald-600";
    case "나쁨": return "text-orange-500";
    case "매우나쁨": return "text-red-600";
    default: return "text-slate-500";
  }
};

export const formatWeatherObservationTime = (weather) => {
  const baseDate = String(weather?.baseDate || "");
  const baseTime = String(weather?.baseTime || "").padStart(4, "0");

  if (!/^\d{8}$/.test(baseDate) || !/^\d{4}$/.test(baseTime)) return "";

  const year = Number(baseDate.slice(0, 4));
  const month = Number(baseDate.slice(4, 6));
  const day = Number(baseDate.slice(6, 8));
  const hour = baseTime.slice(0, 2);
  const minute = baseTime.slice(2, 4);
  const date = new Date(year, month - 1, day);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];

  return `${month}월 ${day}일 (${weekday}) ${hour}:${minute} 기준`;
};

// 위경도 두 점 사이의 거리(km) - 백엔드 GeoUtils(하버사인 공식)와 동일한 방식.
// 히어로 카드에 "내 위치에서 약 X km" 표시할 때 씀.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 사건 목록에서 히어로 카드에 띄울 "가장 심각한 사건" 하나만 뽑음 - HIGH > MEDIUM > LOW, 동급이면 최근 등록순.
export const INCIDENT_SEVERITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
export function pickPriorityIncident(incidents) {
  if (!incidents.length) return null;
  return [...incidents].sort((a, b) => {
    const rankDiff = (INCIDENT_SEVERITY_RANK[a.severity] ?? 3) - (INCIDENT_SEVERITY_RANK[b.severity] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  })[0];
}
