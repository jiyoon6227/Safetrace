const CACHE_KEY = "safetrace:public-info:nationwide:v9";
const CACHE_TTL = 10 * 60 * 1000;

export function readCache(allowExpired = false) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt) return null;

    const expired = Date.now() - parsed.savedAt > CACHE_TTL;
    if (expired && !allowExpired) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(payload) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 저장공간을 사용할 수 없는 환경에서는 캐시 없이 동작한다.
  }
}

export function getMessageCategory(type) {
  const text = String(type || "");
  if (text.includes("풍랑") || text.includes("강풍")) return "풍랑";
  if (text.includes("호우") || text.includes("홍수")) return "호우";
  if (text.includes("산불") || text.includes("화재")) return "산불";
  return "기타";
}

export function pickRepresentativeShelters(results) {
  const rows = [];
  results.forEach((result) => {
    if (result.status !== "fulfilled" || !Array.isArray(result.value) || result.value.length === 0) return;
    rows.push(result.value[0]);
  });
  return rows.slice(0, 8);
}

export function getTemperatureTrend(delta) {
  if (delta == null || !Number.isFinite(Number(delta))) {
    return { badge: null, tone: "", text: "8개 대표 권역 실시간 평균" };
  }

  const value = Number(delta);
  if (Math.abs(value) < 0.1) {
    return { badge: "±0.0℃", tone: "text-slate-500 bg-slate-50", text: "이전 조회와 비슷해요" };
  }

  if (value > 0) {
    return {
      badge: `▲ ${Math.abs(value).toFixed(1)}℃`,
      tone: "text-rose-500 bg-rose-50",
      text: "이전 조회보다 조금 높아요",
    };
  }

  return {
    badge: `▼ ${Math.abs(value).toFixed(1)}℃`,
    tone: "text-blue-500 bg-blue-50",
    text: "이전 조회보다 조금 낮아요",
  };
}

export function averageTemperature(rows) {
  const values = (rows || [])
    .map((item) => Number(item.temperature))
    .filter(Number.isFinite);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function gradeForValue(value, metric) {
  // null/빈값은 Number(null) === 0 이라서 잘못 "좋음"으로 판정될 수 있으므로 먼저 차단한다.
  if (value == null || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";

  if (metric === "pm10") {
    if (number <= 30) return "좋음";
    if (number <= 80) return "보통";
    if (number <= 150) return "나쁨";
    return "매우나쁨";
  }

  if (number <= 15) return "좋음";
  if (number <= 35) return "보통";
  if (number <= 75) return "나쁨";
  return "매우나쁨";
}

export function weatherEmoji(item) {
  const type = String(item?.precipitationType || "");
  if (type.includes("눈")) return "❄️";
  if (type.includes("비") || type.includes("소나기") || type.includes("빗방울")) return "🌧️";
  if (type.includes("흐림") || type.includes("구름")) return "☁️";
  return "☀️";
}

export function formatWeatherBaseTime(item) {
  if (!item?.baseTime) return "현재 관측";
  const raw = String(item.baseTime).padStart(4, "0");
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)} 기준`;
}

export function formatRainfall(value) {
  if (value == null || value === "") return "-";
  const text = String(value);
  if (text.includes("없음") || text === "0" || text === "0.0") return "강수없음";
  return text.includes("mm") ? text : `${text}mm`;
}

export function messageBadgeTone(type) {
  const text = String(type || "");
  if (text.includes("호우") || text.includes("태풍") || text.includes("폭염") || text.includes("대설")) {
    return "bg-orange-50 text-orange-700";
  }
  if (text.includes("산불") || text.includes("화재")) return "bg-red-50 text-red-700";
  if (text.includes("지진")) return "bg-rose-50 text-rose-700";
  if (text.includes("풍랑") || text.includes("강풍")) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

export function dedupeMessages(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = item.sn || `${item.createdAt}|${item.region}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseExternalDate(value) {
  if (!value) return 0;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length >= 12) {
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6)) - 1;
    const day = Number(digits.slice(6, 8));
    const hour = Number(digits.slice(8, 10));
    const minute = Number(digits.slice(10, 12));
    return new Date(year, month, day, hour, minute).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatExternalDate(value) {
  const time = parseExternalDate(value);
  if (!time) return "-";
  const date = new Date(time);
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatCapacity(value) {
  if (value == null || value === "") return "-";
  const number = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(number)) return String(value);
  return `${number.toLocaleString()}명`;
}

export function normalizeWeatherAlerts(data) {
  return {
    available: data?.available === true,
    active: Array.isArray(data?.active) ? data.active : [],
    recentlyCleared: Array.isArray(data?.recentlyCleared) ? data.recentlyCleared : [],
  };
}

export function splitWeatherAlertRegions(value) {
  const regions = [];
  let depth = 0;
  let current = "";

  for (const char of String(value || "")) {
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;

    if (depth === 0 && /[,;/\n]/.test(char)) {
      regions.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  regions.push(current);

  return regions.map((item) => item.trim()).filter(Boolean);
}

export function flattenWeatherAlertRegions(alerts) {
  if (!Array.isArray(alerts)) return [];

  const regionMap = new Map();

  alerts.forEach((alert, alertIndex) => {
    const regions = splitWeatherAlertRegions(alert?.regionId || alert?.region);
    const normalizedRegions = regions.length > 0 ? regions : [alert?.region || ""];
    const typeLabel = weatherAlertTypeLabel(alert);

    normalizedRegions.forEach((region, regionIndex) => {
      const key = region || `unknown-${alertIndex}-${regionIndex}`;
      const previous = regionMap.get(key);

      if (previous) {
        const types = new Set([...(previous.types || []), typeLabel]);
        regionMap.set(key, { ...previous, types: [...types] });
        return;
      }

      regionMap.set(key, {
        ...alert,
        region,
        types: [typeLabel],
        key: `${alert?.announcedAt || alertIndex}-${regionIndex}-${region}`,
      });
    });
  });

  return [...regionMap.values()];
}

export function weatherAlertTypeLabel(alert) {
  const text = [alert?.type, alert?.warningType, alert?.level, alert?.title]
    .filter(Boolean)
    .join(" ");
  const match = text.match(/(지진해일|폭풍해일|풍랑|호우|강풍|폭염|한파|대설|건조|태풍|황사|해일)\s*(주의보|경보)?/);
  if (match) return `${match[1]}${match[2] || ""}`;

  const title = String(alert?.title || "기상특보").trim();
  return title.split(/[:·]/)[0].trim() || "기상특보";
}

export function summarizeWeatherAlert(title) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (!text) return "발효 중인 기상특보가 있습니다";
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

export function formatWeatherAlertTime(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return "발표 시각 확인 중";
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.length >= 10 ? digits.slice(8, 10) : "";
  const minute = digits.length >= 12 ? digits.slice(10, 12) : "";
  return hour ? `${month}.${day} ${hour}:${minute || "00"} 발표` : `${month}.${day} 발표`;
}
