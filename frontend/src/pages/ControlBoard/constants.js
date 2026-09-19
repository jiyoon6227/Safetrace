import {
  LayoutDashboard, FileText, ClipboardList,
  FileBarChart, Activity,
} from "lucide-react";

const SEVERITY_COLOR = {
  HIGH: "#1f1b1b",
  MEDIUM: "#F59E0B",
  LOW: "#3B82F6",
};

const STATUS_LABEL = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};

const STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  CONFIRMING: "bg-sky-200 text-sky-800",
  RESPONDING: "bg-rose-200 text-rose-800",
  RECOVERING: "bg-yellow-200 text-yellow-800",
  CLOSED: "bg-emerald-200 text-emerald-800",
};

const STATUS_ORDER = [
  "RECEIVED",
  "CONFIRMING",
  "RESPONDING",
  "RECOVERING",
  "CLOSED",
];

const REPORT_DISASTER_TYPES = [
  "침수",
  "화재",
  "산사태",
  "강풍",
  "폭염",
  "한파",
  "기타",
];

const REGION_OPTIONS = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

const REPORT_STATUS_LABEL = {
  RECEIVED: "접수",
  LINKED: "사건전환 완료",
};

const REPORT_STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  LINKED: "bg-emerald-100 text-emerald-700",
};

const MIN_REPORT_DATE = "2020-01-01";

const toDateInputValue = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getDefaultDateRange = (daysBack) => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - daysBack);

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  };
};

const withRo = (word) => {
  if (!word) return word;

  const last = word.charCodeAt(word.length - 1);

  if (last < 0xac00 || last > 0xd7a3) {
    return `${word}로`;
  }

  const jong = (last - 0xac00) % 28;

  return jong === 0 || jong === 8
    ? `${word}로`
    : `${word}으로`;
};

const formatDateTime = (iso) => {
  if (!iso) return "-";

  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatTimeAgo = (iso) => {
  if (!iso) return "-";

  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;

  const hour = Math.floor(min / 60);

  if (hour < 24) return `${hour}시간 전`;

  return `${Math.floor(hour / 24)}일 전`;
};

const maskPhone = (phone) => {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 8) {
    return phone;
  }

  const first = digits.slice(0, 3);
  const last = digits.slice(-4);

  return `${first}-****-${last}`;
};

const sameDay = (isoA, dateB) => {
  if (!isoA) return false;

  const a = new Date(isoA);

  return (
    a.getFullYear() === dateB.getFullYear() &&
    a.getMonth() === dateB.getMonth() &&
    a.getDate() === dateB.getDate()
  );
};

const markerColorOf = (inc) => {
  if (inc.status === "RECEIVED") return "#64748B";
  if (inc.status === "CONFIRMING") return "#3B82F6";
  if (inc.status === "RESPONDING") return "#F59E0B";
  if (inc.status === "RECOVERING") return "#8B5CF6";

  return "#10B981";
};

const DISASTER_TYPE_COLOR = {
  침수: "#3B82F6",
  화재: "#EF4444",
  산사태: "#8B5CF6",
  태풍: "#06B6D4",
  폭염: "#F59E0B",
  강풍: "#64748B",
  한파: "#0EA5E9",
  기타: "#94A3B8",
};

const DISASTER_TYPE_EMOJI = {
  침수: "💧",
  화재: "🔥",
  산사태: "⛰️",
  태풍: "🌀",
  폭염: "☀️",
  강풍: "💨",
  한파: "❄️",
  기타: "⚠️",
};

const buildMarkerImage = (inc) => {
  const color = markerColorOf(inc);
  const emoji =
    DISASTER_TYPE_EMOJI[inc.disasterType] || "⚠️";

  const isUrgent =
    inc.status !== "CLOSED" &&
    inc.severity === "HIGH";

  const ring = isUrgent
    ? `<circle cx="17" cy="16" r="15.5" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="3 2"/>`
    : `<circle cx="17" cy="16" r="15.5" fill="none" stroke="white" stroke-width="2"/>`;

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="34"
      height="42"
      viewBox="0 0 34 42"
    >
      <path
        d="M17 0C7.6 0 0 7.6 0 17c0 12 17 25 17 25s17-13 17-25C34 7.6 26.4 0 17 0z"
        fill="${color}"
      />
      ${ring}
      <text
        x="17"
        y="21"
        font-size="15"
        text-anchor="middle"
      >
        ${emoji}
      </text>
    </svg>
  `;

  return new window.kakao.maps.MarkerImage(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    new window.kakao.maps.Size(34, 42),
    {
      offset: new window.kakao.maps.Point(17, 42),
    }
  );
};

const NAV_ITEMS = [
  {
    key: "dashboard",
    icon: LayoutDashboard,
    label: "대시보드",
  },
  {
    key: "reports",
    icon: ClipboardList,
    label: "제보 관리",
  },
  {
    key: "incidents",
    icon: FileText,
    label: "사건 관리",
  },
  {
    key: "publicInfo",
    icon: Activity,
    label: "공공 정보",
  },
  {
    key: "statistics",
    icon: FileBarChart,
    label: "통계 보고서",
  },
];

const SIDO_CENTER = {
  서울특별시: {
    guName: "중구",
    lat: 37.5665,
    lng: 126.9780,
  },

  부산광역시: {
    guName: "연제구",
    lat: 35.1796,
    lng: 129.0756,
  },

  대구광역시: {
    guName: "중구",
    lat: 35.8714,
    lng: 128.6014,
  },

  인천광역시: {
    guName: "남동구",
    lat: 37.4563,
    lng: 126.7052,
  },

  광주광역시: {
    guName: "서구",
    lat: 35.1595,
    lng: 126.8526,
  },

  대전광역시: {
    guName: "서구",
    lat: 36.3504,
    lng: 127.3845,
  },

  울산광역시: {
    guName: "남구",
    lat: 35.5384,
    lng: 129.3114,
  },

  세종특별자치시: {
    guName: "세종특별자치시",
    lat: 36.4801,
    lng: 127.2891,
  },

  경기도: {
    guName: "팔달구",
    lat: 37.2636,
    lng: 127.0286,
  },

  강원특별자치도: {
    guName: "춘천시",
    lat: 37.8813,
    lng: 127.7298,
  },

  충청북도: {
    guName: "청주시",
    lat: 36.6424,
    lng: 127.4890,
  },

  충청남도: {
    guName: "홍성군",
    lat: 36.6008,
    lng: 126.6650,
  },

  전북특별자치도: {
    guName: "전주시",
    lat: 35.8242,
    lng: 127.1480,
  },

  전라남도: {
    guName: "무안군",
    lat: 34.9866,
    lng: 126.3916,
  },

  경상북도: {
    guName: "안동시",
    lat: 36.5684,
    lng: 128.7294,
  },

  경상남도: {
    guName: "창원시",
    lat: 35.2280,
    lng: 128.6811,
  },

  제주특별자치도: {
    guName: "제주시",
    lat: 33.4996,
    lng: 126.5312,
  },
};

export {
  SEVERITY_COLOR,
  STATUS_LABEL,
  STATUS_STYLE,
  STATUS_ORDER,
  REPORT_DISASTER_TYPES,
  REGION_OPTIONS,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_STYLE,
  MIN_REPORT_DATE,
  toDateInputValue,
  getDefaultDateRange,
  withRo,
  formatDateTime,
  formatTimeAgo,
  maskPhone,
  sameDay,
  markerColorOf,
  DISASTER_TYPE_COLOR,
  DISASTER_TYPE_EMOJI,
  buildMarkerImage,
  NAV_ITEMS,
  SIDO_CENTER,
};