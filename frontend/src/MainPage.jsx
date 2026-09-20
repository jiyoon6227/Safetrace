import React, { useState, useEffect, useRef } from "react";
import {
  Home, MapPin, ShieldAlert, Camera, GraduationCap, Users,
  Search, Menu, Bell, ChevronRight, ChevronLeft, ChevronDown, CloudRain, Wind, Waves,
  Thermometer, Mountain, CloudFog, Fish, Snowflake, Flame, Droplets,
  CheckCircle2, Clock, Truck, Construction, ArrowRight, Navigation, X, Hash, Bot, MessageCircle, RefreshCw, Send, Building2
} from "lucide-react";
import LoginPage from "./pages/LoginPage";
import ControlBoard from "./pages/ControlBoard";
import ReportForm from "./pages/ReportForm";
import ReportPage from "./pages/ReportPage";
import MyPage from "./pages/MyPage";
import WithdrawModal from "./pages/MyPage/WithdrawModal";
import SafetyCheckResponsePage from "./pages/SafetyCheckResponsePage";
import ShelterPage from "./pages/ShelterPage";
import SafetyGuidePage from "./pages/SafetyGuidePage";
import DisasterNewsPage from "./pages/DisasterNewsPage";
import PublicDisasterPage from "./pages/PublicDisasterPage";
import SafetyMapPage from "./pages/SafetyMapPage";
import NoticePage from "./pages/NoticePage";
import SearchPage from "./pages/SearchPage";
import NearbySafetyMap from "./components/NearbySafetyMap";
import SiteFooter from "./components/SiteFooter";
import { getCurrentUser, authFetch, getNotifications } from "./api/client";
import { connectIncidentSocket, connectSafetyCheckSocket, connectReportSocket } from "./api/socket";
import { buildNotificationItems } from "./pages/MyPage/constants";
import { useEscapeKey } from "./hooks/useEscapeKey";
import mainBg from "./assets/main.png";
import { MAIN_DISASTER_FILTERS, disasterBadgeClass, disasterFilterOf, disasterSummary, disasterTitle, formatDisasterTime } from "./utils/disasterMessages";
import { SAFETY_GUIDES, SAFETY_GUIDE_ORDER, getSafetyGuide } from "./data/safetyGuides";

// ---- 색상/토큰 -----------------------------------------------------------
// 신뢰감 있는 네이비(공공/안전) + 경보용 레드 + 대응중 앰버 + 완료 그린
// 정보 제공형 사이트가 아니라 "추적형" 서비스라는 걸 타임라인 컴포넌트로 강조

const quickMenu = [
  { icon: Home, label: "대피시설", title: "대피시설 찾기", sub: "가까운 대피시설을 확인하세요" },
  { icon: Camera, label: "현장제보", title: "현장 제보하기", sub: "지금, 바로 제보해주세요" },
  { icon: GraduationCap, label: "행동요령", title: "행동요령", sub: "재난별 행동요령을 확인하세요" },
  { icon: Users, label: "가족확인", title: "가족 안전확인", sub: "가족의 안전 상태를 확인하세요" },
];

const SAFETY_GUIDE_ICONS = {
  FLOOD: CloudRain,
  EARTHQUAKE: Waves,
  FIRE: Flame,
  TYPHOON: Wind,
  WILDFIRE: Mountain,
  HEATWAVE: Thermometer,
  COLDWAVE: Snowflake,
};

const AI_SUGGESTED_QUESTIONS = [
  "현재 주변 위험 상황이 뭐야?",
  "지금 밖에 나가도 될까?",
  "가까운 대피시설은 어디야?",
  "침수 시 주의사항 알려줘.",
];

const actionGuides = [
  { icon: Wind, label: "태풍" },
  { icon: CloudRain, label: "호우" },
  { icon: Waves, label: "홍수" },
  { icon: Thermometer, label: "폭염" },
  { icon: CloudFog, label: "가뭄" },
  { icon: Mountain, label: "산사태" },
  { icon: Snowflake, label: "한파" },
  { icon: Fish, label: "적조" },
];

// STAFF 화면(ControlBoard.jsx)과 같은 6단계 라벨/색 — 시민 화면에도 같은 기준으로 노출
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

// 제보 상태는 사건 상태와 분리해서 표시
// 제보: 등록 -> 검토중 -> 사건연결 / 반려
const REPORT_STATE_LABEL = {
  RECEIVED: "등록",
  REVIEWING: "검토중",
  LINKED: "사건연결",
  REJECTED: "반려",
};

const REPORT_STATE_STYLE = {
  RECEIVED: "bg-blue-50 text-blue-700",
  REVIEWING: "bg-amber-50 text-amber-700",
  LINKED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
};

// 사건 카드 왼쪽 상태 색 막대 (뱃지 배경보다 진한 톤으로, 목록에서 한눈에 구분되게)
const STATUS_BAR = {
  RECEIVED: "bg-slate-200",
  CONFIRMING: "bg-sky-300",
  RESPONDING: "bg-rose-300",
  RECOVERING: "bg-yellow-300",
  CLOSED: "bg-emerald-300",
};

// 제보 등록 폼(ReportForm.jsx)의 재난유형 값과 맞춘 아이콘 매핑
const DISASTER_ICON = {
  화재: Flame,
  침수: Droplets,
  산사태: Mountain,
  강풍: Wind,
  폭염: Thermometer,
  한파: Snowflake,
};

// 모달 상세화면 상단 배너 배경 (은은한 톤)
const STATUS_BANNER = {
  RECEIVED: "bg-slate-100 border border-slate-200",
  CONFIRMING: "bg-sky-100 border border-sky-200",
  RESPONDING: "bg-rose-100 border border-rose-200",
  RECOVERING: "bg-yellow-100 border border-yellow-200",
  CLOSED: "bg-emerald-100 border border-emerald-200",
};

// 타임라인 점 색 (뱃지보다 진하게, 시각적으로 딱 떨어지게)
const STATUS_DOT = {
  RECEIVED: "bg-slate-300",
  CONFIRMING: "bg-sky-400",
  RESPONDING: "bg-rose-400",
  RECOVERING: "bg-yellow-400",
  CLOSED: "bg-emerald-400",
};

// "대응상황 상세" 모달 진행바 전용 - STATUS 5개를 6칸(접수/담당자배정/현장확인/대응중/복구중/완료)에 맞춰 재배치.
// CONFIRMING 하나가 "담당자배정"과 "현장확인" 두 칸을 걸치는 상태라, 활성 칸을 3(현장확인)으로 두면
// 자동으로 1~2칸(접수·담당자배정)은 완료, 3칸(현장확인)은 진행중으로 표시됨 - "사이"에 있다는 의미를 그렇게 표현
const DETAIL_PROGRESS_STEPS = ["접수", "담당자배정", "현장확인", "대응중", "복구중", "완료"];
const DETAIL_STEP_BY_STATUS = { RECEIVED: 1, CONFIRMING: 3, RESPONDING: 4, RECOVERING: 5, CLOSED: 6 };

// 담당자가 로그에 memo를 안 남긴 경우에도 타임라인 각 단계에 짧은 설명이 비어 보이지 않도록 하는 기본 문구
const STATUS_LOG_FALLBACK_TEXT = {
  RECEIVED: "시민 제보가 접수되었습니다.",
  CONFIRMING: "담당 부서에서 제보 내용을 확인하고 있습니다.",
  RESPONDING: "현장 대응이 진행되고 있습니다.",
  RECOVERING: "복구 작업이 진행되고 있습니다.",
  CLOSED: "사건 처리가 완료되었습니다.",
};

const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// "2026. 09. 07. 14:30" 형식 — 연/월/일 2자리 고정 + 24시간제 시:분
const formatDateTimeFull = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 시:분만 (가족 안전확인 카드용)
const formatTimeOnly = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
};

// "5분 전" / "1시간 전" / "1일 전" 형식 - 제보 목록 모달의 "마지막 업데이트" 표시용
const formatRelativeTime = (iso) => {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `약 ${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `약 ${hr}시간 전`;
  return `약 ${Math.floor(hr / 24)}일 전`;
};

// 안전확인 응답 상태별 배지/문구
const SAFETY_STATUS_META = {
  SAFE: { badge: "안전", badgeStyle: "bg-emerald-50 text-emerald-600", message: '"괜찮아요" 응답' },
  HELP: { badge: "도움 필요", badgeStyle: "bg-red-50 text-red-600", message: '"도움이 필요해요" 응답' },
  PENDING: { badge: "응답 대기", badgeStyle: "bg-amber-50 text-amber-600", message: "확인 요청 중" },
};

// 그 가족이 "나한테" 보낸 미응답 요청용 배지 - 위 SAFETY_STATUS_META와 별개로,
// 내가 지금 응답해야 하는 항목이라는 걸 색으로 구분되게 (주황 계열)
const NEEDS_MY_RESPONSE_META = { badge: "응답 필요", badgeStyle: "bg-orange-100 text-orange-700", message: "나에게 안전확인을 요청했어요" };

// 카드 안에 넣는 축소판 타임라인 — 모달 상세의 타임라인과 같은 구성(점+라벨+시각+메모)을 더 작게
function MiniTimeline({ logs }) {
  if (!logs) {
    return <p className="text-[10px] text-slate-400 mt-2">불러오는 중...</p>;
  }
  if (logs.length === 0) {
    return <p className="text-[10px] text-slate-400 mt-2">아직 기록이 없습니다.</p>;
  }
  return (
    <div className="mt-2.5">
      {logs.map((log, i) => (
        <React.Fragment key={log.logId}>
          <div className="flex items-start gap-1.5">
            <span
              className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[log.newStatus] || "bg-slate-400"}`}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                <span className="text-xs font-semibold text-slate-700">{STATUS_LABEL[log.newStatus] || log.newStatus}</span>
                <span className="text-[10px] text-slate-400">{formatDateTime(log.changedAt)}</span>
              </div>
              {log.memo && <div className="text-[11px] text-slate-500 leading-tight">{log.memo}</div>}
            </div>
          </div>
          {i < logs.length - 1 && (
            <div className="pl-[3px] py-0.5">
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function LevelBadge({ level, children }) {
  const styles = {
    red: "bg-red-600 text-white",
    amber: "bg-amber-500 text-white",
    blue: "bg-blue-600 text-white",
  };
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded ${styles[level] || styles.blue}`}>
      {children}
    </span>
  );
}


const WEATHER_LOCATION_CACHE_KEY = "safetrace:last-location";

const readWeatherCachedLocation = () => {
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

const weatherEmoji = (weather) => {
  const type = String(weather?.precipitationType || "");
  if (type.includes("눈") && type.includes("비")) return "🌨️";
  if (type.includes("눈")) return "❄️";
  if (type.includes("비") || type.includes("빗")) return "🌧️";
  return "☀️";
};

const normalizeRainfall = (value) => {
  if (value == null || value === "" || String(value).includes("없")) return "0mm";
  const number = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? `${number}mm` : String(value);
};

const airGradeClass = (grade) => {
  switch (grade) {
    case "좋음": return "text-blue-600";
    case "보통": return "text-emerald-600";
    case "나쁨": return "text-orange-500";
    case "매우나쁨": return "text-red-600";
    default: return "text-slate-500";
  }
};

const formatWeatherObservationTime = (weather) => {
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
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 사건 목록에서 히어로 카드에 띄울 "가장 심각한 사건" 하나만 뽑음 - HIGH > MEDIUM > LOW, 동급이면 최근 등록순.
const INCIDENT_SEVERITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
function pickPriorityIncident(incidents) {
  if (!incidents.length) return null;
  return [...incidents].sort((a, b) => {
    const rankDiff = (INCIDENT_SEVERITY_RANK[a.severity] ?? 3) - (INCIDENT_SEVERITY_RANK[b.severity] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  })[0];
}

export default function MainPage() {
  const currentUser = getCurrentUser();
  const isStaff = currentUser?.role === "STAFF";

  const [tab, setTab] = useState("nearby");
  // 이메일 안전확인 링크(?safetyCheckToken=xxx)로 들어온 거면 그 응답 화면부터 바로 보여줌
  const safetyCheckTokenFromUrl = new URLSearchParams(window.location.search).get("safetyCheckToken");
  // 새로고침(F5)을 해도 지금 보던 화면이 유지되도록, history.state에 남아있던 페이지가 있으면 그걸 먼저 씀.
  // (history.state는 새로고침해도 그대로 남아있음 - 지금까지는 이걸 안 읽어서 새로고침할 때마다 무조건 "home"으로 튕겼었음)
  const [page, setPage] = useState(
    safetyCheckTokenFromUrl ? "safety-check-response" : window.history.state?.page || "home"
  ); // "home" | "login" | "mypage" | "shelters" | "safety-guides" | "disaster-info" | "safety-map" | "safety-news" | "safety-check-response" | "notices"
  const [selectedShelterRegionId, setSelectedShelterRegionId] = useState(
    window.history.state?.shelterRegionId ?? null
  );
  const [selectedSafetyNewsRegionId, setSelectedSafetyNewsRegionId] = useState(
    window.history.state?.safetyNewsRegionId ?? null
  );
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // 로그인이 필요한 기능을 로그아웃 상태에서 눌렀을 때 - 진짜 브라우저 네이티브 alert으로 띄움
  // (커스텀 모달 말고 window.alert 그대로 씀. 확인 누르면 alert이 닫히고 바로 다음 줄인 goTo("login")로 넘어감)
  const requireLogin = (action) => {
    if (!token) {
      window.alert("로그인이 필요한 서비스입니다.");
      goTo("login");
      return;
    }
    action();
  };

  // 헤더 검색 - "실시간 재난·안전 정보" 목록을 지역/키워드로 필터링
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const headerSearchInputRef = useRef(null);
  const disasterListRef = useRef(null);
  const safetyMapRef = useRef(null);
  const shelterPanelRef = useRef(null);
  const safetyGuidePanelRef = useRef(null);

  // 메인 "실시간 재난 · 안전 정보" - 행안부 긴급재난문자 최근 48시간 데이터를 사용
  const [mainDisasterMessages, setMainDisasterMessages] = useState([]);
  const [mainNearbyIncident, setMainNearbyIncident] = useState(null);
  const [mainNearbyIncidentLoading, setMainNearbyIncidentLoading] = useState(false);
  const [mainDisasterLoading, setMainDisasterLoading] = useState(true);
  const [mainDisasterError, setMainDisasterError] = useState("");
  const [mainDisasterFilter, setMainDisasterFilter] = useState("전체");

  // 메인 현재 날씨 - 안전지도와 같은 sessionStorage 위치를 사용한다.
  // 위치 권한을 자동으로 다시 요청하지 않고, 캐시된 위치가 있으면 그 좌표로만 조회한다.
  const [weatherLocation, setWeatherLocation] = useState(() => readWeatherCachedLocation());
  const [weatherLocationLabel, setWeatherLocationLabel] = useState("내 위치");
  const [currentWeather, setCurrentWeather] = useState(null);
  const [currentAirQuality, setCurrentAirQuality] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const [weatherLocating, setWeatherLocating] = useState(false);

  // 메인 퀵메뉴 "대피시설 찾기" 중간 패널
  const [shelterPanelOpen, setShelterPanelOpen] = useState(false);
  const [quickShelters, setQuickShelters] = useState([]);
  const [quickShelterLoading, setQuickShelterLoading] = useState(false);
  const [quickShelterError, setQuickShelterError] = useState("");
  const [quickShelterQuery, setQuickShelterQuery] = useState("");
  const [quickShelterRefreshKey, setQuickShelterRefreshKey] = useState(0);

  // 메인 퀵메뉴 "행동요령" 중간 패널
  const [safetyGuidePanelOpen, setSafetyGuidePanelOpen] = useState(false);
  const [activeSafetyGuideKey, setActiveSafetyGuideKey] = useState("FLOOD");

  // AI 상황 브리핑
  const [aiBriefing, setAiBriefing] = useState("");
  const [aiBriefingLoading, setAiBriefingLoading] = useState(false);
  const [aiBriefingError, setAiBriefingError] = useState("");
  const [aiBriefingRefreshKey, setAiBriefingRefreshKey] = useState(0);

  // AI 안전 도우미 채팅
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatError, setAiChatError] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      role: "assistant",
      content: "안녕하세요. SafeTrace 안전 도우미입니다. 내 주변 정보뿐 아니라 서울·화성시처럼 다른 지역의 재난문자·사건·대피시설도 질문해보세요.",
    },
  ]);
  const aiChatEndRef = useRef(null);

  const closeAiChat = () => {
    if (aiChatLoading) return;
    setAiChatOpen(false);
    setAiChatError("");
  };

  const openAiChat = () => {
    setAiChatError("");
    setAiChatOpen(true);
  };

  const sendAiChatMessage = async (presetQuestion) => {
    const message = String(presetQuestion ?? aiChatInput).trim();
    if (!message || aiChatLoading) return;

    const region = weatherLocation
      ? String(weatherLocationLabel || "")
          .replace(/\s*기준\s*$/, "")
          .trim() || "현재 위치 주변"
      : "현재 위치 정보 없음";

    const history = aiChatMessages
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    setAiChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setAiChatInput("");
    setAiChatError("");
    setAiChatLoading(true);

    try {
      const data = await authFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          lat: weatherLocation?.lat ?? null,
          lng: weatherLocation?.lng ?? null,
          region,
          history,
        }),
      });

      setAiChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(data?.answer || "답변을 생성하지 못했습니다."),
        },
      ]);
    } catch (e) {
      setAiChatError(e?.message || "AI 안전 도우미 답변을 불러오지 못했습니다.");
    } finally {
      setAiChatLoading(false);
    }
  };

  useEffect(() => {
    if (!aiChatOpen) return;
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiChatOpen, aiChatMessages, aiChatLoading]);

  useEscapeKey(aiChatOpen, closeAiChat);

  const requestWeatherLocation = () => {
    if (!navigator.geolocation) {
      setWeatherError("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setWeatherLocating(true);
    setWeatherError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        try {
          window.sessionStorage.setItem(WEATHER_LOCATION_CACHE_KEY, JSON.stringify(next));
        } catch {
          // 저장소 사용 불가 환경에서는 현재 화면에서만 사용
        }
        setWeatherLocation(next);
        setWeatherLocating(false);
        setWeatherRefreshKey((value) => value + 1);
      },
      (error) => {
        setWeatherLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setWeatherError("위치 권한을 허용하면 현재 위치의 날씨를 볼 수 있어요.");
        } else if (error.code === error.TIMEOUT) {
          setWeatherError("위치 확인 시간이 초과됐습니다. 다시 시도해주세요.");
        } else {
          setWeatherError("현재 위치를 확인하지 못했습니다.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // 안전지도에서 위치를 확인한 뒤 sessionStorage가 갱신되면 날씨 카드도 같은 위치로 따라간다.
  // GPS를 재요청하는 타이머가 아니라, 저장된 좌표가 바뀌었는지만 확인한다.
  useEffect(() => {
    if (page !== "home") return undefined;

    const syncCachedLocation = () => {
      const cached = readWeatherCachedLocation();
      if (!cached) return;
      setWeatherLocation((prev) => {
        if (prev && prev.lat === cached.lat && prev.lng === cached.lng) return prev;
        return cached;
      });
    };

    syncCachedLocation();
    const timer = window.setInterval(syncCachedLocation, 1500);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (page !== "home" || !weatherLocation) return undefined;

    let active = true;
    setWeatherLoading(true);
    setWeatherError("");

    const { lat, lng } = weatherLocation;

    const resolveRegion = () => new Promise((resolve) => {
      let attempts = 0;
      const tryResolve = () => {
        if (!active) {
          resolve(null);
          return;
        }

        if (window.kakao?.maps?.services?.Geocoder) {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.coord2RegionCode(lng, lat, (result, status) => {
            if (!active || status !== window.kakao.maps.services.Status.OK || !result?.length) {
              resolve(null);
              return;
            }
            const region = result.find((item) => item.region_type === "H") || result[0];
            resolve({
              sido: region?.region_1depth_name || "",
              label: [region?.region_1depth_name, region?.region_2depth_name]
                .filter(Boolean)
                .join(" "),
            });
          });
          return;
        }

        attempts += 1;
        if (attempts >= 30) {
          resolve(null);
          return;
        }
        window.setTimeout(tryResolve, 100);
      };

      tryResolve();
    });

    Promise.allSettled([
      authFetch(`/api/environment/weather?lat=${lat}&lng=${lng}&_=${Date.now()}`),
      resolveRegion(),
    ]).then(async ([weatherResult, regionResult]) => {
      if (!active) return;

      const weatherData = weatherResult.status === "fulfilled" ? weatherResult.value : null;
      const region = regionResult.status === "fulfilled" ? regionResult.value : null;

      setCurrentWeather(weatherData?.available ? weatherData : null);
      if (region?.label) setWeatherLocationLabel(`${region.label} 기준`);
      else setWeatherLocationLabel("내 위치 기준");

      if (region?.sido) {
        try {
          const air = await authFetch(`/api/environment/air-quality?sido=${encodeURIComponent(region.sido)}&_=${Date.now()}`);
          if (active) setCurrentAirQuality(air?.available ? air : null);
        } catch {
          if (active) setCurrentAirQuality(null);
        }
      } else {
        setCurrentAirQuality(null);
      }

      if (!weatherData?.available) {
        setWeatherError(weatherData?.message || "현재 날씨를 불러오지 못했습니다.");
      }

      if (active) setWeatherLoading(false);
    });

    return () => { active = false; };
  }, [page, weatherLocation, weatherRefreshKey]);


  // 대피시설 패널이 열렸을 때만 실제 공공 API를 조회한다.
  // 메인 진입 때마다 불필요하게 대피시설 API를 호출하지 않도록 분리함.
  useEffect(() => {
    if (page !== "home" || !shelterPanelOpen || !weatherLocation) return undefined;

    const region = String(weatherLocationLabel || "")
      .replace(/\s*기준\s*$/, "")
      .trim();

    // 카카오 좌표 -> 행정구역 변환이 끝나기 전에는 잠시 기다림
    if (!region || region === "내 위치") return undefined;

    let active = true;
    const { lat, lng } = weatherLocation;

    setQuickShelterLoading(true);
    setQuickShelterError("");

    const loadShelters = async () => {
      try {
        let data = await authFetch(
          `/api/environment/shelters?guName=${encodeURIComponent(region)}&lat=${lat}&lng=${lng}&limit=50`
        );

        // 일부 공공데이터는 "대전광역시 동구"보다 "동구" LIKE 검색에서 더 잘 잡히는 경우가 있어 1회만 fallback
        if (!Array.isArray(data) || data.length === 0) {
          const parts = region.split(/\s+/).filter(Boolean);
          const gu = parts.length >= 2 ? parts[1] : "";
          if (gu) {
            data = await authFetch(
              `/api/environment/shelters?guName=${encodeURIComponent(gu)}&lat=${lat}&lng=${lng}&limit=50`
            );
          }
        }

        if (!active) return;
        setQuickShelters(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setQuickShelters([]);
        setQuickShelterError(e?.message || "대피시설 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setQuickShelterLoading(false);
      }
    };

    loadShelters();

    return () => {
      active = false;
    };
  }, [page, shelterPanelOpen, weatherLocation, weatherLocationLabel, quickShelterRefreshKey]);

  const filteredQuickShelters = quickShelters
    .filter((shelter) => {
      const query = quickShelterQuery.trim().toLowerCase();
      if (!query) return true;

      return `${shelter.name || ""} ${shelter.address || ""}`
        .toLowerCase()
        .includes(query);
    })
    .sort(
      (a, b) =>
        (Number(a.distanceM) || Number.MAX_SAFE_INTEGER) -
        (Number(b.distanceM) || Number.MAX_SAFE_INTEGER)
    );

  const formatShelterDistance = (distanceM) => {
    const value = Number(distanceM);
    if (!Number.isFinite(value)) return "거리 정보 없음";
    if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
    return `${Math.round(value)}m`;
  };

  const openShelterPanel = () => {
    const willOpen = !shelterPanelOpen;
    setSafetyGuidePanelOpen(false);
    setShelterPanelOpen(willOpen);
    setQuickShelterError("");

    if (willOpen) {
      window.setTimeout(() => {
        shelterPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
    }
  };

  const openSafetyGuidePanel = () => {
    const willOpen = !safetyGuidePanelOpen;
    setShelterPanelOpen(false);
    setSafetyGuidePanelOpen(willOpen);

    if (willOpen) {
      window.setTimeout(() => {
        safetyGuidePanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
    }
  };

  // 현재 위치/지역을 기준으로 백엔드의 Gemini 상황 브리핑을 가져온다.
  useEffect(() => {
    if (page !== "home" || !weatherLocation) return undefined;

    const region = String(weatherLocationLabel || "")
      .replace(/\s*기준\s*$/, "")
      .trim();

    // 카카오 좌표→지역 변환이 끝나기 전에는 호출하지 않는다.
    if (!region || region === "내 위치") return undefined;

    let active = true;
    setAiBriefingLoading(true);
    setAiBriefingError("");

    const { lat, lng } = weatherLocation;
    const query = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      region,
      _: String(Date.now()),
    });

    authFetch(`/api/ai/briefing?${query.toString()}`)
      .then((data) => {
        if (!active) return;
        setAiBriefing(String(data?.summary || "").trim());
      })
      .catch((e) => {
        if (!active) return;
        setAiBriefing("");
        setAiBriefingError(e?.message || "AI 상황 브리핑을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setAiBriefingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, weatherLocation, weatherLocationLabel, aiBriefingRefreshKey]);

  useEffect(() => {
    if (page !== "home") return undefined;

    let active = true;
    setMainDisasterLoading(true);
    setMainDisasterError("");

    authFetch("/api/environment/disaster-messages/nationwide?limit=30")
      .then((data) => {
        if (!active) return;
        setMainDisasterMessages(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!active) return;
        setMainDisasterMessages([]);
        setMainDisasterError(e?.message || "재난문자를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setMainDisasterLoading(false);
      });

    return () => { active = false; };
  }, [page]);

  // 히어로 카드용 - 내 위치 반경 3km 내 진행 중인 사건 중 가장 심각한 것 1건.
  // 안전지도/대피시설 패널과 같은 /api/incidents/nearby를 쓰되, 여기선 화면에 하나만 보여주면 되므로
  // 거리 계산(distanceKm) 후 pickPriorityIncident로 우선순위가 가장 높은 사건만 골라 state에 저장함.
  useEffect(() => {
    if (page !== "home" || !weatherLocation) {
      setMainNearbyIncident(null);
      return undefined;
    }

    let active = true;
    const { lat, lng } = weatherLocation;
    setMainNearbyIncidentLoading(true);

    authFetch(`/api/incidents/nearby?lat=${lat}&lng=${lng}&radiusKm=3`)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const picked = pickPriorityIncident(list);
        setMainNearbyIncident(
          picked ? { ...picked, distanceKm: distanceKm(lat, lng, picked.latitude, picked.longitude) } : null
        );
      })
      .catch(() => {
        if (active) setMainNearbyIncident(null);
      })
      .finally(() => {
        if (active) setMainNearbyIncidentLoading(false);
      });

    return () => { active = false; };
  }, [page, weatherLocation]);

  // 브라우저 뒤로가기/앞으로가기가 앱 내 페이지 전환도 따라가게 함.
  // 지금까지는 setPage만 써서 화면은 바뀌어도 URL 히스토리엔 기록이 안 남았고,
  // 그래서 뒤로가기를 누르면 앱 안으로 안 돌아오고 이 탭을 열기 전 페이지(구글 등)로 튀어버렸음.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, page }, "");
    const handlePopState = (e) => {
      setPage(e.state?.page || "home");
      setSelectedShelterRegionId(e.state?.shelterRegionId ?? null);
      setSelectedSafetyNewsRegionId(e.state?.safetyNewsRegionId ?? null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 페이지 전환: 추가 state도 같이 저장해두면 새로고침/뒤로가기에서도 선택 정보를 유지할 수 있음
  const goTo = (nextPage, extraState = {}) => {
    // 일반 페이지 이동 시 열려 있던 현장제보 팝업 상태를 반드시 닫는다.
    // openReport=true를 명시한 경우에만 기존 팝업 방식으로 연다.
    if (extraState.openReport) {
      setShowReportForm(true);
    } else {
      setShowReportForm(false);
    }

    setPage(nextPage);

    if (Object.prototype.hasOwnProperty.call(extraState, "shelterRegionId")) {
      setSelectedShelterRegionId(extraState.shelterRegionId);
    }
    if (Object.prototype.hasOwnProperty.call(extraState, "safetyNewsRegionId")) {
      setSelectedSafetyNewsRegionId(extraState.safetyNewsRegionId);
    }

    window.history.pushState({ page: nextPage, ...extraState }, "");
  };

  // 프로필 드롭다운 바깥을 클릭하면 자동으로 닫힘
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false); // 마이페이지 푸터의 "회원탈퇴" - SiteFooter는 공통 컴포넌트라 여기서 상태를 들고 있다가 넘겨줌
  const [reportSuccess, setReportSuccess] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [myReportsLoading, setMyReportsLoading] = useState(false);

  // client.js의 authFetch/authUpload가 401(서버 기준 더 이상 유효하지 않은 토큰)을 받으면
  // 거기서 localStorage의 토큰은 이미 지우고 이 이벤트를 쏨. 여기선 화면 쪽 상태를 정리한다.
  // (DB 초기화, 회원 탈퇴, 토큰 만료 등으로 실제로는 로그아웃된 상태를 화면에도 반영하는 부분)
  useEffect(() => {
    const handleAuthInvalid = () => {
      setToken(null);
      setMyProfile(null);
      if (page === "mypage" || page === "safety-news") {
        goTo("home");
      }
    };
    window.addEventListener("auth:invalid", handleAuthInvalid);
    return () => window.removeEventListener("auth:invalid", handleAuthInvalid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 연결된 사건들의 현재 상태 (incidentId -> Incident 객체)
  const incidentInfoRef = useRef({});
  const [incidentInfo, setIncidentInfo] = useState({});
  incidentInfoRef.current = incidentInfo;
  // 연결된 사건들의 처리 타임라인 (incidentId -> IncidentLog[]) - 사이드바 카드에 바로 보여주기 위함
  const [incidentTimelines, setIncidentTimelines] = useState({});

  // 대응상황 추적 모달 상태
  // trackingOpen=true & detailIncidentId=null  -> "내 연결된 사건 목록" 모드 (전체보기용)
  // trackingOpen=true & detailIncidentId=있음  -> 그 사건의 상태+타임라인 상세 모드
  const [trackingOpen, setTrackingOpen] = useState(false);
  // 제보 목록 모달의 필터/정렬 (상태 전체·진행중·완료·반려 / 재난유형 / 정렬)
  const [trackingStatusFilter, setTrackingStatusFilter] = useState("all"); // "all" | "progress" | "closed" | "rejected"
  const [trackingTypeFilter, setTrackingTypeFilter] = useState(null); // null(전체) | "침수" | "화재" 등
  const [trackingSort, setTrackingSort] = useState("newest"); // "newest" | "oldest"
  const [detailIncidentId, setDetailIncidentId] = useState(null);
  const detailIncidentIdRef = useRef(null); // 소켓 콜백 안에서 "지금 열려있는 모달"의 최신값을 읽기 위함
  useEffect(() => {
    detailIncidentIdRef.current = detailIncidentId;
  }, [detailIncidentId]);
  const [detailTimeline, setDetailTimeline] = useState([]);
  const [detailTimelineLoading, setDetailTimelineLoading] = useState(false);
  // 상세 모달 "처리 타임라인" 정렬 - 기본값은 최신순
  const [detailTimelineSort, setDetailTimelineSort] = useState("newest"); // "oldest" | "newest"
  const detailMapRef = useRef(null); // "대응상황 상세" 모달의 실제 Kakao 지도 컨테이너

  // 가족 안전확인 - 등록된 가족 + 나와 주고받은 요청들
  const [families, setFamilies] = useState([]);
  const [receivedSafetyChecks, setReceivedSafetyChecks] = useState([]); // 그 가족이 나한테 보낸 것 전부 (PENDING/SAFE/HELP) - 가족별 최신 상태 계산에 필요해서 상태 무관하게 다 들고 있음
  const [sentSafetyChecks, setSentSafetyChecks] = useState([]); // 내가 보낸 안전확인 요청들 - 가족별 최신 응답상태 계산용
  const [showSafetyCheckModal, setShowSafetyCheckModal] = useState(false);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState([]);
  const [safetyCheckSending, setSafetyCheckSending] = useState(false);

  // 내 프로필 정보 - 헤더 표시용. 토큰 안 이름/사진은 로그인 시점 스냅샷이라 마이페이지에서
  // 수정해도 안 바뀌므로, 토큰 대신 이 값을 화면에 쓰고 홈으로 돌아올 때마다 다시 불러온다.
  const [myProfile, setMyProfile] = useState(null);
  useEffect(() => {
    if (!token) {
      setMyProfile(null);
      return;
    }
    if (page !== "home") return;
    authFetch("/api/mypage").then(setMyProfile).catch(() => {});
  }, [token, page]);

  // 로그인된 상태면 화면 진입 시 내가 등록한 제보 목록을 실제 DB에서 가져옴
  useEffect(() => {
    if (!token) {
      setMyReports([]);
      return;
    }
    setMyReportsLoading(true);
    authFetch("/api/reports/my")
      .then(setMyReports)
      .catch(() => setMyReports([]))
      .finally(() => setMyReportsLoading(false));
  }, [token, reportSuccess]);

  // 헤더 종모양 배지 - 마이페이지 "알림" 탭이랑 완전히 같은 기준(재난/제보/기타/안전확인 다 합쳐서)으로
  // 세야 하는데, 그중 재난알림/제보알림/기타는 마이페이지에서만 불러오던 데이터라 여기서도 따로 불러옴.
  // (안전확인은 위에서 이미 sentSafetyChecks/receivedSafetyChecks로 갖고 있어서 재사용)
  const [regions, setRegions] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]);
  useEffect(() => {
    if (!token) {
      setRegions([]);
      setDbNotifications([]);
      return;
    }
    authFetch("/api/mypage/regions").then(setRegions).catch(() => {});
    getNotifications().then(setDbNotifications).catch(() => {});
  }, [token]);

  // myReports가 갱신될 때마다, 연결된(고유한) Incident들의 현재 상태 + 타임라인을 같이 가져옴
  useEffect(() => {
    const uniqueIds = [...new Set(myReports.filter((r) => r.incidentId).map((r) => r.incidentId))];
    uniqueIds.forEach((id) => {
      if (!incidentInfo[id]) {
        authFetch(`/api/incidents/${id}`)
          .then((data) => setIncidentInfo((prev) => ({ ...prev, [id]: data })))
          .catch(() => {});
      }
      if (!incidentTimelines[id]) {
        authFetch(`/api/incidents/${id}/timeline`)
          .then((data) => setIncidentTimelines((prev) => ({ ...prev, [id]: data })))
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReports]);

  // "내 현장제보 목록"의 검토 대기중(사건 미연결) 항목들 - 위경도만 있고 주소 텍스트는 DB에 없어서
  // 카카오 리버스 지오코딩으로 좌표 -> 주소 문자열을 변환해둠 (담당자 대시보드의 제보 관리 탭과 동일한 방식)
  const [pendingReportAddresses, setPendingReportAddresses] = useState({});
  useEffect(() => {
    const targets = myReports.filter((r) => !r.incidentId && !pendingReportAddresses[r.reportId]);
    if (targets.length === 0 || !window.kakao?.maps) return;

    // Kakao SDK가 autoload=false라 services를 바로 쓰면 아직 준비되지 않은 경우가 있음.
    // maps.load 안에서 Geocoder를 생성해야 신규 제보 주소도 정상 표시된다.
    window.kakao.maps.load(() => {
      if (!window.kakao?.maps?.services) return;

      const geocoder = new window.kakao.maps.services.Geocoder();
      targets.forEach((report) => {
        if (report.latitude == null || report.longitude == null) {
          setPendingReportAddresses((prev) => ({
            ...prev,
            [report.reportId]: "위치정보 없음",
          }));
          return;
        }

        geocoder.coord2Address(report.longitude, report.latitude, (result, status) => {
          const addr =
            status === window.kakao.maps.services.Status.OK && result[0]
              ? result[0].road_address?.address_name || result[0].address?.address_name || "주소 확인 불가"
              : "주소 확인 불가";

          setPendingReportAddresses((prev) => ({ ...prev, [report.reportId]: addr }));
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReports]);

  // 로그인 상태일 때 WebSocket 연결 - STAFF가 내가 추적 중인 사건 상태를 바꾸면
  // 새로고침 없이 뱃지/타임라인이 자동으로 갱신됨
  useEffect(() => {
    if (!token) return;

    const socket = connectIncidentSocket((data) => {
      // 백엔드 재시작 등으로 소켓이 끊겼다가 다시 붙은 경우, 끊겨 있던 동안의 상태 변경까지
      // 현재 DB 값으로 다시 맞춘다.
      if (data?.eventType === "SOCKET_CONNECTED") {
        Object.keys(incidentInfoRef.current).forEach((id) => {
          authFetch(`/api/incidents/${id}`)
            .then((freshIncident) => {
              setIncidentInfo((prev) => ({ ...prev, [id]: freshIncident }));
            })
            .catch(() => {});

          authFetch(`/api/incidents/${id}/timeline`)
            .then((timeline) => {
              setIncidentTimelines((prev) => ({ ...prev, [id]: timeline }));
              if (String(detailIncidentIdRef.current) === String(id)) {
                setDetailTimeline(timeline);
              }
            })
            .catch(() => {});
        });

        getNotifications().then(setDbNotifications).catch(() => {});
        return;
      }

      const changedId = data?.incident?.incidentId;
      if (!changedId) return;


      getNotifications().then(setDbNotifications).catch(() => {});

      // WebSocket payload를 먼저 즉시 반영하고, DB 확정값을 다시 조회해서 한 번 더 동기화한다.
      // 이렇게 해야 다른 담당자 화면에서 상태를 바꿨을 때 시민 화면의 뱃지/진행바가 즉시 바뀌고,
      // 재연결 직후에도 오래된 상태가 남지 않는다.
      setIncidentInfo((prev) => {
        if (!prev[changedId]) return prev;
        return { ...prev, [changedId]: { ...prev[changedId], ...data.incident } };
      });

      if (incidentInfoRef.current?.[changedId]) {
        authFetch(`/api/incidents/${changedId}`)
          .then((freshIncident) => {
            setIncidentInfo((prev) => ({ ...prev, [changedId]: freshIncident }));
          })
          .catch(() => {});

        authFetch(`/api/incidents/${changedId}/timeline`)
          .then((timeline) => {
            setIncidentTimelines((prev) => ({ ...prev, [changedId]: timeline }));

            if (detailIncidentIdRef.current === changedId) {
              setDetailTimeline(timeline);
            }
          })
          .catch(() => {});
      }
    });

    return () => socket.close();
  }, [token]);

  // 제보 WebSocket - 담당자가 제보를 검토중/사건연결/반려로 바꾸면
  // /api/reports/my를 다시 조회해서 메인 "내 현장제보" 목록/배지가 즉시 바뀐다.
  useEffect(() => {
    if (!token) return;

    const socket = connectReportSocket((data) => {
      const changedReport = data?.report;

      // 현재 목록에 있는 내 제보라면 이벤트 데이터로 먼저 즉시 반영
      if (changedReport?.reportId) {
        setMyReports((prev) =>
          prev.map((report) =>
            report.reportId === changedReport.reportId
              ? { ...report, ...changedReport }
              : report
          )
        );
      }

      // DB 확정값으로 한 번 더 동기화. 사건연결 시 incidentId도 여기서 최신화된다.
      authFetch("/api/reports/my")
        .then(setMyReports)
        .catch(() => {});

      getNotifications()
        .then(setDbNotifications)
        .catch(() => {});
    });

    return () => socket.close();
  }, [token]);

  // 로그인 상태면 등록된 가족 + 나한테 온 응답대기 안전확인 요청을 불러옴
  const loadSafetyCheckData = () => {
    if (!token) {
      setFamilies([]);
      setReceivedSafetyChecks([]);
      setSentSafetyChecks([]);
      return;
    }
    authFetch("/api/family").then(setFamilies).catch(() => {});
    authFetch("/api/safety-checks/received").then(setReceivedSafetyChecks).catch(() => {});
    authFetch("/api/safety-checks/sent").then(setSentSafetyChecks).catch(() => {});
  };

  useEffect(loadSafetyCheckData, [token]);

  // 안전확인 WebSocket - 누가 나한테 요청을 보내거나, 내가 보낸 요청에 응답이 오면 실시간 갱신
  useEffect(() => {
    if (!token) return;
    const socket = connectSafetyCheckSocket(() => {
      loadSafetyCheckData();
    });
    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleSelectedFamily = (memberId) => {
    setSelectedFamilyIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const sendSafetyCheckRequest = async () => {
    if (selectedFamilyIds.length === 0) return;
    setSafetyCheckSending(true);
    try {
      await authFetch("/api/safety-checks", {
        method: "POST",
        body: JSON.stringify({ targetMemberIds: selectedFamilyIds, incidentId: null }),
      });
      setShowSafetyCheckModal(false);
      setSelectedFamilyIds([]);
      alert("안전확인 요청을 보냈습니다.");
    } catch (err) {
      alert(err.message);
    } finally {
      setSafetyCheckSending(false);
    }
  };

  const respondSafetyCheck = async (checkId, status) => {
    try {
      await authFetch(`/api/safety-checks/${checkId}/respond`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadSafetyCheckData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    goTo("home");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    goTo("home");
  };

  // 메인 가운데/퀵메뉴의 "현장 제보하기"는 기존처럼 팝업을 연다.
  const handleReportClick = () => requireLogin(() => setShowReportForm(true));

  // 헤더의 "현장 제보"만 별도 페이지로 이동한다.
  // 혹시 기존 팝업 상태가 남아 있어도 먼저 닫고 report 페이지로 전환한다.
  const handleReportPageClick = () =>
    requireLogin(() => {
      setShowReportForm(false);
      goTo("report");
      window.scrollTo({ top: 0, behavior: "auto" });
    });

  const handleReportSuccess = () => {
    setShowReportForm(false);
    setReportSuccess(true);
    setTimeout(() => setReportSuccess(false), 4000);
  };

  // 특정 사건의 상세(상태+타임라인)를 모달로 열기
  const openIncidentDetail = async (incidentId) => {
    setTrackingOpen(true);
    setDetailIncidentId(incidentId);
    setDetailTimelineLoading(true);
    try {
      const data = await authFetch(`/api/incidents/${incidentId}/timeline`);
      setDetailTimeline(data);
    } catch {
      setDetailTimeline([]);
    } finally {
      setDetailTimelineLoading(false);
    }
  };

  // "전체보기"는 제보가 1건뿐이어도 항상 목록부터 연다.
  // 목록에서 항목을 클릭했을 때만 해당 제보/사건의 대응상황 상세로 들어간다.
  const openTrackingOverview = () => requireLogin(() => {
    setTrackingOpen(true);
    setDetailIncidentId(null);
    setDetailPendingReportId(null);
  });

  const closeTracking = () => {
    setTrackingOpen(false);
    setDetailIncidentId(null);
    setDetailTimeline([]);
    setDetailPendingReportId(null);
  };
  useEscapeKey(trackingOpen, closeTracking);

  // "검토 대기중"(사건 미연결) 제보 상세보기 - 아직 Incident가 없어서 타임라인/진행상태는 없고
  // 제보 원본 내용만 보여주는 단순 모드
  const [detailPendingReportId, setDetailPendingReportId] = useState(null);

  const uniqueLinkedIds = [...new Set(myReports.filter((r) => r.incidentId).map((r) => r.incidentId))];
  const detailIncident = detailIncidentId ? incidentInfo[detailIncidentId] : null;
  const detailPendingReport = detailPendingReportId
    ? myReports.find((r) => r.reportId === detailPendingReportId)
    : null;
  const unlinkedReports = myReports.filter((r) => !(r.status === "LINKED" && r.incidentId));

  // 가족 각자와 나 사이의 안전확인 기록은 방향이 두 가지(내가 보낸 것 / 그 가족이 보낸 것)라
  // 둘 다 합쳐서 "가장 최근 기록 하나"를 찾아야 카드에 정확한 현재 상태가 뜸.
  // (예: 그 가족이 나한테 요청 보내고 내가 이미 응답까지 한 경우 - sentSafetyChecks에는 없고
  //  받은 목록에만 있어서, 합치지 않으면 "아직 요청한 적 없어요"로 잘못 표시됐었음)
  const latestCheckByMember = {};
  const considerCheck = (memberId, check, direction) => {
    const existing = latestCheckByMember[memberId];
    if (!existing || new Date(check.requestedAt) > new Date(existing.check.requestedAt)) {
      latestCheckByMember[memberId] = { check, direction };
    }
  };
  sentSafetyChecks.forEach((c) => considerCheck(c.targetMemberId, c, "sent"));
  receivedSafetyChecks.forEach((c) => considerCheck(c.requesterId, c, "received"));

  // 헤더 종모양 알림 배지 - 마이페이지 "알림" 탭과 완전히 같은 기준으로 계산함
  // (재난 알림 + 제보 알림 + 기타(관심지역 등록) + 안전확인, 그리고 마이페이지에서 읽음 처리한
  //  건 localStorage(safeTraceReadNotifications)를 그대로 같이 봐서 두 화면 숫자가 항상 일치하게)
  const notificationItems = buildNotificationItems({
    sentChecks: sentSafetyChecks,
    receivedChecks: receivedSafetyChecks,
    myReports,
    regions,
    dbNotifications,
  });
  let readNotificationIds = [];
  try {
    readNotificationIds = JSON.parse(localStorage.getItem("safeTraceReadNotifications") || "[]");
  } catch {
    readNotificationIds = [];
  }
  // 마이페이지에서 삭제한 알림은 홈 화면 배지에서도 똑같이 빠져야 함 (같은 localStorage 키 공유)
  let dismissedNotificationIds = [];
  try {
    dismissedNotificationIds = JSON.parse(localStorage.getItem("safeTraceDismissedNotifications") || "[]");
  } catch {
    dismissedNotificationIds = [];
  }
  const unreadNotificationCount = notificationItems.filter(
    (n) => !readNotificationIds.includes(n.id) && !dismissedNotificationIds.includes(n.id)
  ).length;

  // "내 현장제보 추적"을 제보 단위가 아니라 "연결된 사건" 단위로 묶음 —
  // 같은 사건에 제보 여러 개가 묶여도 카드 하나로 압축되고, 최근 업데이트순으로 정렬
  const groupedIncidents = uniqueLinkedIds
    .map((id) => ({
      incidentId: id,
      incident: incidentInfo[id],
      reports: myReports.filter((r) => r.incidentId === id),
    }))
    .sort((a, b) => {
      const ta = a.incident?.updatedAt ? new Date(a.incident.updatedAt).getTime() : 0;
      const tb = b.incident?.updatedAt ? new Date(b.incident.updatedAt).getTime() : 0;
      return tb - ta;
    });

  // "대응상황 상세" 모달용 - 이 사건에 연결된 내 제보(사진/제보내용)와, 타임라인상 가장 최근 로그
  const detailReports = groupedIncidents.find((g) => g.incidentId === detailIncidentId)?.reports || [];
  const detailPhotoUrl = detailReports.find((r) => r.photoUrl)?.photoUrl;
  // detailTimeline은 항상 오래된순(API 원본 순서)이라, 정렬 토글과 무관하게 마지막 원소가 곧 최신 로그
  const latestDetailLog = detailTimeline[detailTimeline.length - 1];
  const detailDescription = latestDetailLog?.memo || detailReports[0]?.content || null;
  const detailMapUrl =
    detailIncident?.latitude && detailIncident?.longitude
      ? `https://www.google.com/maps?q=${detailIncident.latitude},${detailIncident.longitude}`
      : null;

  // "대응상황 상세" 모달이 열리고 좌표가 있을 때, 가짜 배경 패턴 대신 실제 Kakao 지도를 렌더링
  useEffect(() => {
    if (!detailIncidentId || !detailIncident?.latitude || !detailIncident?.longitude) return;
    if (!detailMapRef.current || !window.kakao || !window.kakao.maps) return;
    window.kakao.maps.load(() => {
      if (!detailMapRef.current) return;
      const center = new window.kakao.maps.LatLng(detailIncident.latitude, detailIncident.longitude);
      const map = new window.kakao.maps.Map(detailMapRef.current, { center, level: 4 });
      map.setDraggable(false);
      map.setZoomable(false);
      new window.kakao.maps.Marker({ position: center, map });
    });
  }, [detailIncidentId, detailIncident?.latitude, detailIncident?.longitude]);
  const detailTimelineSorted = detailTimelineSort === "newest" ? [...detailTimeline].reverse() : detailTimeline;

  // 제보 목록 모달용 - 연결 전/반려 제보까지 포함해서 실제 등장하는 재난유형을 보여준다.
  const trackingDisasterTypes = [...new Set(myReports.map((r) => r.disasterType).filter(Boolean))];

  // 사건에 아직 연결되지 않은 제보의 현재 제보 상태를 그대로 표시한다.
  // RECEIVED=등록, REVIEWING=검토중, REJECTED=반려
  const reportStateOf = (report) => {
    const code = report.status || (report.incidentId ? "LINKED" : "RECEIVED");
    return {
      code,
      label: REPORT_STATE_LABEL[code] || code,
      style: REPORT_STATE_STYLE[code] || REPORT_STATE_STYLE.RECEIVED,
    };
  };

  // 사건에 연결되지 않은 제보를 진행중 제보와 반려 제보로 분리한다.
  // 반려(REJECTED)는 더 이상 진행중이 아니므로 진행중 개수/탭에서 제외한다.
  const pendingReports = myReports.filter((r) => !r.incidentId);
  const rejectedReports = pendingReports.filter((r) => reportStateOf(r).code === "REJECTED");
  const activePendingReports = pendingReports.filter((r) => reportStateOf(r).code !== "REJECTED");

  // 메인 "내 현장제보 추적" 미리보기는 연결 사건뿐 아니라
  // 아직 사건에 연결되지 않은 등록/검토중/반려 제보까지 모두 합쳐 최근 3건을 보여준다.
  // 연결된 제보 여러 개가 같은 Incident에 묶인 경우에는 사건 카드 1개로 유지한다.
  const trackingPreviewItems = [
    ...pendingReports.map((report) => ({
      kind: "report",
      key: `report-${report.reportId}`,
      sortTime: new Date(report.createdAt || 0).getTime(),
      report,
    })),
    ...groupedIncidents.map((group) => ({
      kind: "incident",
      key: `incident-${group.incidentId}`,
      sortTime: new Date(group.incident?.updatedAt || group.reports[0]?.createdAt || 0).getTime(),
      ...group,
    })),
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 3);

  // 메인 카드 레이아웃은 기존 디자인대로
  // "대표 제보 1건 + 다른 제보 2건" 구조를 유지한다.
  // 연결된 사건이 있으면 가장 최근 사건을 대표로 보여주고,
  // 연결 사건이 없을 때만 가장 최근 미연결 제보를 대표로 사용한다.
  const primaryTrackingItem =
    groupedIncidents.length > 0
      ? {
          kind: "incident",
          key: `incident-${groupedIncidents[0].incidentId}`,
          ...groupedIncidents[0],
        }
      : trackingPreviewItems[0] || null;

  const otherTrackingItems = trackingPreviewItems
    .filter((item) => item.key !== primaryTrackingItem?.key)
    .slice(0, 2);

  const trackingProgressCount =
    groupedIncidents.filter((g) => g.incident?.status !== "CLOSED").length + activePendingReports.length;
  const trackingClosedCount = groupedIncidents.filter((g) => g.incident?.status === "CLOSED").length;
  const trackingRejectedCount = rejectedReports.length;

  const filteredPendingReports = pendingReports.filter((r) => {
    const reportCode = reportStateOf(r).code;

    if (trackingStatusFilter === "closed") return false;
    if (trackingStatusFilter === "rejected" && reportCode !== "REJECTED") return false;
    if (trackingStatusFilter === "progress" && reportCode === "REJECTED") return false;

    if (trackingTypeFilter && r.disasterType !== trackingTypeFilter) return false;
    return true;
  });

  const filteredTrackingIncidents = groupedIncidents.filter((g) => {
    if (trackingStatusFilter === "rejected") return false;
    if (trackingStatusFilter === "progress" && g.incident?.status === "CLOSED") return false;
    if (trackingStatusFilter === "closed" && g.incident?.status !== "CLOSED") return false;
    if (trackingTypeFilter && g.reports[0]?.disasterType !== trackingTypeFilter) return false;
    return true;
  });

  // 미연결/반려 제보와 연결 사건을 하나로 합친 뒤 시간 기준으로 정렬한다.
  // 이렇게 해야 최신순/오래된순이 전체 목록 기준으로 정상 동작한다.
  const filteredTrackingItems = [
    ...filteredPendingReports.map((report) => ({
      kind: "report",
      key: `pending-${report.reportId}`,
      sortTime: new Date(report.createdAt || 0).getTime(),
      report,
    })),
    ...filteredTrackingIncidents.map((group) => ({
      kind: "incident",
      key: `incident-${group.incidentId}`,
      sortTime: new Date(group.incident?.updatedAt || group.reports[0]?.createdAt || 0).getTime(),
      ...group,
    })),
  ].sort((a, b) =>
    trackingSort === "newest"
      ? b.sortTime - a.sortTime
      : a.sortTime - b.sortTime
  );

  const renderWithFooter = (content, footerProps = {}) => (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">{content}</div>
      <SiteFooter onNavigate={goTo} {...footerProps} />
    </div>
  );

  if (page === "safety-check-response") {
    return renderWithFooter(
      <SafetyCheckResponsePage
        token={safetyCheckTokenFromUrl}
        onDone={() => {
          window.history.replaceState({}, "", "/");
          goTo("home");
        }}
      />
    );
  }

  if (page === "login") {
    return renderWithFooter(
      <LoginPage onLoginSuccess={handleLoginSuccess} onBackToHome={() => goTo("home")} onSearch={() => goTo("search")} />
    );
  }

  if (page === "mypage") {
    return (
      <>
        {renderWithFooter(
          <MyPage
            onBackToHome={() => goTo("home")}
            onLogout={handleLogout}
            onOpenShelters={(regionId) => goTo("shelters", { shelterRegionId: regionId })}
            onOpenSafetyNews={(regionId) => goTo("safety-news", { safetyNewsRegionId: regionId })}
          />,
          { showWithdraw: true, onWithdraw: () => setShowWithdrawModal(true) }
        )}
        {showWithdrawModal && <WithdrawModal onClose={() => setShowWithdrawModal(false)} />}
      </>
    );
  }

  if (page === "shelters") {
    return renderWithFooter(
      <ShelterPage
        initialRegionId={selectedShelterRegionId}
        initialFocusShelter={window.history.state?.shelterFocus ?? null}
        onBackToHome={() => goTo("home")}
        onLogin={() => goTo("login")}
        onNavigate={goTo}
      />
    );
  }

  if (page === "safety-guides") {
    return renderWithFooter(
      <SafetyGuidePage
        initialGuideKey={window.history.state?.safetyGuideKey || "FLOOD"}
        onBackToHome={() => goTo("home")}
        onOpenShelters={() => goTo("shelters")}
        onNavigate={goTo}
      />
    );
  }

  if (page === "safety-map") {
    return renderWithFooter(
      <SafetyMapPage
        onBackToHome={() => goTo("home")}
        onNavigate={goTo}
        focusIncidentId={window.history.state?.focusIncidentId ?? null}
      />
    );
  }

  if (page === "disaster-info") {
    return renderWithFooter(
      <PublicDisasterPage
        initialMessageSn={window.history.state?.disasterSn ?? null}
        onBackToHome={() => goTo("home")}
        onOpenShelters={() => goTo("shelters", { shelterRegionId: null })}
        onOpenReport={() => requireLogin(() => goTo("home", { openReport: true }))}
        onNavigate={goTo}
      />
    );
  }

  if (page === "report") {
    return renderWithFooter(
      <ReportPage
        onNavigate={goTo}
        onSuccess={() => {
          setReportSuccess(true);
          goTo("home");
          setTimeout(() => setReportSuccess(false), 4000);
        }}
      />
    );
  }

  if (page === "safety-news") {
    return renderWithFooter(
      <DisasterNewsPage
        initialRegionId={selectedSafetyNewsRegionId}
        onBackToHome={() => goTo("home")}
        onLogout={handleLogout}
        onGoToMyPageTab={(tab) => goTo("mypage", { mypageTab: tab })}
      />
    );
  }

  if (page === "staff" && isStaff) {
    return (
      <ControlBoard
        onBackToHome={() => goTo("home")}
        onLogout={handleLogout}
        onOpenNotices={(noticeId) => goTo("notices", noticeId ? { noticeId } : {})}
      />
    );
  }

  if (page === "search") {
    return renderWithFooter(
      <SearchPage
        initialQuery={window.history.state?.searchQuery || ""}
        onNavigate={goTo}
      />
    );
  }

  if (page === "notices") {
    return renderWithFooter(
      <NoticePage
        initialNoticeId={window.history.state?.noticeId ?? null}
        onBackToHome={() => goTo("home")}
        onNavigate={goTo}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hi+Melody&display=swap');`}</style>
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-[1450px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <button onClick={() => goTo("home")} className="flex items-center gap-3 hover:opacity-80 transition cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#0B2A52] flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-5 h-5 text-amber-400" strokeWidth={2.4} />
            </div>
            <div className="text-left leading-tight">
              <div className="font-extrabold text-xl text-[#0B2A52] tracking-tight">세이프트레이스</div>
              <div className="text-[10px] text-slate-400">함께 만드는 더 안전한 일상</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-10 text-[16px] font-semibold text-[#0B2A52]">
            <button onClick={() => goTo("disaster-info")} className="hover:text-blue-600 cursor-pointer transition">재난정보</button>
            <button onClick={() => goTo("safety-map")} className="hover:text-blue-600 cursor-pointer transition">안전지도</button>
            <button onClick={() => goTo("shelters", { shelterRegionId: null })} className="hover:text-blue-600 cursor-pointer transition">대피시설</button>
            <button onClick={handleReportPageClick} className="hover:text-blue-600 cursor-pointer transition">현장 제보</button>
            <button onClick={() => goTo("safety-guides", { safetyGuideKey: activeSafetyGuideKey })} className="hover:text-blue-600 cursor-pointer transition">행동요령</button>
            <button onClick={() => goTo("notices")} className="hover:text-blue-600 cursor-pointer transition">공지사항</button>
          </nav>

          <div className="flex items-center gap-4 text-[#0B2A52]">
            <button
              type="button"
              onClick={() => goTo("search")}
              className="hidden md:flex w-9 h-9 items-center justify-center hover:bg-slate-100 transition cursor-pointer"
              aria-label="통합검색"
              title="통합검색"
            >
              <Search className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => requireLogin(() => goTo("mypage", { mypageTab: "notify" }))}
                className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
                aria-label="알림"
              >
                <Bell className="w-5 h-5" />
                {token && unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </button>
            </div>
           {token ? (
  <>
    {isStaff && (
  <button onClick={() => goTo("staff")} className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 cursor-pointer">
    담당자 대시보드
  </button>
)}
    <div className="relative hidden sm:block" ref={profileMenuRef}>
      <button onClick={() => setProfileMenuOpen((v) => !v)} className="flex items-center gap-2 font-bold text-sm cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-[#0B2A52] text-white flex items-center justify-center overflow-hidden shrink-0">
          {myProfile?.profileImageUrl ? (
            <img src={myProfile.profileImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users className="w-4 h-4" />
          )}
        </div>
        {myProfile?.name || currentUser?.name}님 <ChevronDown className={`w-4 h-4 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
      </button>
      {profileMenuOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50">
          <button
            onClick={() => { setProfileMenuOpen(false); goTo("mypage"); }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#0B2A52] hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition"
          >
            마이페이지
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 cursor-pointer transition"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  </>
) : (
  <button onClick={() => goTo("login")} className="text-sm font-bold hover:text-blue-600 transition cursor-pointer">로그인</button>
)}
          </div>
        </div>
      </header>

      {/* 메인 히어로 */}
      <section className="relative overflow-hidden bg-[#071A31]">
        {/*
          배경 이미지는 절대 100% 100%로 강제 늘리지 않음.
          object-cover가 원본 비율을 유지한 채 영역을 채워서
          창 폭이 바뀌어도 지도가 찌그러지지 않는다.
        */}
        <img
          src={mainBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        />
        <div className="absolute inset-0 bg-[#04182b]/10 pointer-events-none" />

        <div className="relative max-w-[1450px] mx-auto px-5 sm:px-6 lg:px-8 py-9 sm:py-11 lg:py-12 grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-7 lg:gap-12 items-center">
          <div className="max-w-[590px]">
            <div className="text-[10px] sm:text-[11px] tracking-[0.42em] font-bold text-white/80 mb-3 sm:mb-4">SAFETRACE</div>
            <h1 className="text-[38px] sm:text-[46px] xl:text-[54px] leading-[1.08] font-black tracking-tight text-white">
              오늘도,<br />
              <span className="text-[#36A3FF]">더 안전한 내일을</span> 위해
            </h1>
            <p className="mt-4 sm:mt-5 text-[14px] sm:text-[16px] leading-6 sm:leading-7 font-medium text-white/95">
              작은 관심이 더 안전한 일상을 만듭니다.<br />
              세이프트레이스는 언제나 함께합니다.
            </p>
            <div className="mt-5 bg-white rounded-2xl h-[54px] sm:h-[58px] shadow-xl shadow-black/20 border border-white/80 flex items-center px-4 sm:px-5 w-full max-w-[510px]">
              <Search className="w-5 h-5 text-[#0B2A52] mr-3 shrink-0" />
              <input className="w-full min-w-0 outline-none bg-transparent text-sm placeholder:text-slate-400" placeholder="지역, 재난 유형, 키워드를 검색해보세요." />
            </div>
          </div>

          <div className="w-full bg-white/95 backdrop-blur-[2px] rounded-[22px] shadow-2xl shadow-slate-900/15 p-5 sm:p-6 border border-white/80">
            <div className="flex items-start sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 font-bold text-[#0B2A52] text-sm sm:text-base">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${mainNearbyIncident ? "bg-red-50" : "bg-emerald-50"}`}>
                  {mainNearbyIncident ? (
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                </div>
                지금, 내 주변에 발생한 재난
              </div>
              <button onClick={() => goTo("disaster-info")} className="text-xs sm:text-sm text-slate-500 flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer shrink-0">더보기 <ChevronRight className="w-4 h-4" /></button>
            </div>

            {!weatherLocation ? (
              <>
                <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-[#0B2A52]">내 위치를 확인해주세요</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  위치 권한을 허용하면 내 주변 반경 3km 내 진행 중인 사건을 바로 보여드려요.
                </p>
              </>
            ) : mainNearbyIncidentLoading ? (
              <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-slate-300">불러오는 중...</h2>
            ) : mainNearbyIncident ? (
              <>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="text-[26px] sm:text-[31px] font-extrabold tracking-tight text-[#0B2A52]">{mainNearbyIncident.title}</h2>
                  <span className="px-3 py-1 rounded-full bg-red-50 text-red-500 text-xs font-bold">{mainNearbyIncident.disasterType}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <MapPin className="w-4 h-4 text-[#0B2A52] shrink-0" /> 내 위치에서 약 {mainNearbyIncident.distanceKm.toFixed(1)}km
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {mainNearbyIncident.region}에서 {mainNearbyIncident.disasterType} 상황이 진행 중입니다.<br className="hidden sm:block" /> 가까운 대피시설을 확인하고, 안전에 유의하세요.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-[#0B2A52]">현재 반경 3km 내 접수된 재난이 없습니다</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  평온한 상황이에요. 그래도 이상한 상황을 발견하면 바로 제보해주세요.
                </p>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button onClick={() => goTo("safety-map", { focusIncidentId: mainNearbyIncident?.incidentId ?? null })} className="h-12 rounded-xl bg-[#0B2A52] hover:bg-[#173b65] transition text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Navigation className="w-4 h-4" /> 주변 재난지도 보기 <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={handleReportPageClick} className="h-12 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-[#0B2A52] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" /> 현장 제보하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 퀵 메뉴 - 자주 쓰는 기능만 4개로 축소 */}
      <section className="relative z-20 -mt-7 max-w-[1450px] mx-auto px-6">
        <div className="bg-white rounded-[22px] shadow-lg shadow-slate-900/8 border border-slate-200 grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
          {quickMenu.map(({ icon: Icon, label, title, sub }, index) => {
            const iconStyles = [
              "bg-blue-50 text-blue-600",
              "bg-emerald-50 text-emerald-600",
              "bg-orange-50 text-orange-500",
              "bg-violet-50 text-violet-600",
            ];

            const handleClick = () => {
              if (label === "대피시설") {
                openShelterPanel();
                return;
              }
              if (label === "현장제보") {
                handleReportClick();
                return;
              }
              if (label === "행동요령") {
                openSafetyGuidePanel();
                return;
              }
              if (label === "가족확인") {
                requireLogin(() => goTo("mypage", { mypageTab: "family" }));
                return;
              }
            };

            return (
              <button
                key={label}
                onClick={handleClick}
                className={`group px-5 py-4 sm:py-5 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors cursor-pointer border-slate-200 ${
                  index % 2 === 0 ? "border-r" : ""
                } ${index < 2 ? "border-b lg:border-b-0" : ""} ${index !== 3 ? "lg:border-r" : ""}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconStyles[index]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[#0B2A52] text-sm group-hover:text-blue-600 transition-colors">{title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>


      {/* 대피시설 찾기 - 퀵메뉴 클릭 시 메인 중간에 펼쳐지는 패널 */}
      {shelterPanelOpen && (
        <section ref={shelterPanelRef} className="max-w-[1450px] mx-auto px-6 pt-4">
          <div className="bg-white rounded-[22px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[20px] font-extrabold text-[#0B2A52]">가까운 대피시설</h2>
                    {weatherLocation && (
                      <span className="text-[11px] text-slate-400 truncate">
                        {String(weatherLocationLabel || "").replace(/\s*기준\s*$/, "")} 기준
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">현재 위치에서 가까운 실제 민방위 대피시설을 거리순으로 보여드립니다.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-9 w-full sm:w-[320px] border border-slate-200 rounded-lg px-3 flex items-center gap-2 focus-within:border-blue-300">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    value={quickShelterQuery}
                    onChange={(e) => setQuickShelterQuery(e.target.value)}
                    placeholder="시설명 또는 주소 검색"
                    className="flex-1 min-w-0 text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {!weatherLocation ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin className="w-6 h-6" />
                </div>
                <p className="mt-3 text-sm font-extrabold text-[#0B2A52]">가까운 대피시설을 보려면 현재 위치가 필요합니다.</p>
                <button
                  type="button"
                  onClick={requestWeatherLocation}
                  disabled={weatherLocating}
                  className="mt-4 h-10 px-5 rounded-xl bg-[#0B2A52] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {weatherLocating ? "위치 확인 중..." : "내 위치 확인하기"}
                </button>
              </div>
            ) : quickShelterLoading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">가까운 대피시설을 불러오는 중입니다.</div>
            ) : quickShelterError ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-red-500">{quickShelterError}</p>
                <button
                  type="button"
                  onClick={() => setQuickShelterRefreshKey((value) => value + 1)}
                  className="mt-3 text-xs font-bold text-blue-600 cursor-pointer"
                >
                  다시 확인하기
                </button>
              </div>
            ) : filteredQuickShelters.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                검색 조건에 맞는 대피시설이 없습니다. 시설명이나 주소를 다시 확인해주세요.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredQuickShelters.slice(0, 3).map((shelter, index) => (
                  <div key={`${shelter.name || "대피시설"}-${shelter.address || index}`} className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <span className="text-sm font-extrabold">{index + 1}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-extrabold text-[#0B2A52]">{shelter.name || "대피시설"}</h3>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">가장 가까운 곳</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">{shelter.address || "주소 정보 없음"}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        {shelter.floorType && <span className="px-2 py-1 rounded-md bg-slate-100">{shelter.floorType}</span>}
                        {shelter.capacity && <span className="px-2 py-1 rounded-md bg-slate-100">수용인원 {shelter.capacity}명</span>}
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-sm font-extrabold text-blue-600 shrink-0">
                      <MapPin className="w-4 h-4" />
                      {formatShelterDistance(shelter.distanceM)}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        goTo("shelters", {
                          shelterFocus: {
                            name: shelter.name || "",
                            address: shelter.address || "",
                            latitude: shelter.latitude ?? null,
                            longitude: shelter.longitude ?? null,
                          },
                        })
                      }
                      className="h-9 px-3 rounded-lg border border-blue-100 text-blue-600 text-xs font-bold flex items-center gap-1.5 shrink-0 hover:bg-blue-50 cursor-pointer"
                    >
                      <Navigation className="w-4 h-4" />
                      지도에서 보기
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                {weatherLocation ? `가까운 순 · ${filteredQuickShelters.length}개 확인` : "현재 위치 확인 필요"}
              </span>
              <button
                type="button"
                onClick={() => goTo("shelters")}
                className="text-xs font-extrabold text-[#0B2A52] hover:text-blue-600 flex items-center gap-1 cursor-pointer"
              >
                전체 대피시설 보기 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 재난 행동요령 - 퀵메뉴 클릭 시 대피시설 패널과 같은 자리를 교체해서 사용 */}
      {safetyGuidePanelOpen && (() => {
        const guide = getSafetyGuide(activeSafetyGuideKey);
        return (
          <section ref={safetyGuidePanelRef} className="max-w-[1450px] mx-auto px-6 pt-4">
            <div className="bg-white rounded-[22px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-extrabold text-[#0B2A52]">재난 행동요령</h2>
                    <p className="text-[11px] text-slate-400 mt-1">재난 유형을 선택해 지금 필요한 핵심 행동요령을 확인하세요.</p>
                  </div>
                </div>
              </div>

              <div className="px-5 sm:px-6 pt-4 flex gap-2 overflow-x-auto">
                {SAFETY_GUIDE_ORDER.map((key) => {
                  const item = SAFETY_GUIDES[key];
                  const Icon = SAFETY_GUIDE_ICONS[key] || ShieldAlert;
                  const active = activeSafetyGuideKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveSafetyGuideKey(key)}
                      className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#0B2A52] border-[#0B2A52] text-white"
                          : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="px-5 sm:px-6 py-5">
                <div className="rounded-2xl bg-orange-50/70 border border-orange-100 px-4 py-3 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-[#0B2A52]">{guide.label} 핵심 행동요령</div>
                    <div className="text-xs text-slate-500 mt-1">{guide.shortDescription}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
                  {guide.quickTips.map((tip, index) => (
                    <article
                      key={tip.title}
                      className="min-h-[104px] rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.06)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-sm font-black shrink-0 shadow-sm">
                          {index + 1}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <h3 className="text-[14px] font-extrabold text-[#0B2A52] leading-5">{tip.title}</h3>
                          <div className="w-8 h-[2px] bg-blue-100 rounded-full my-2" />
                          <p className="text-[12px] font-medium text-slate-600 leading-5">{tip.description}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[11px] text-slate-400">공식 국민행동요령을 바탕으로 핵심 내용을 요약했습니다.</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openShelterPanel}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-[#0B2A52] text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" /> 가까운 대피시설 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo("safety-guides", { safetyGuideKey: activeSafetyGuideKey })}
                    className="h-9 px-4 rounded-lg bg-[#0B2A52] text-white text-xs font-bold hover:bg-[#173b65] flex items-center gap-1.5 cursor-pointer"
                  >
                    상세 행동요령 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* 하단 대시보드 - 정보/지도/개인화 3열 구조 */}
      <main className="max-w-[1450px] mx-auto px-6 py-5 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.08fr_0.97fr] gap-4 items-start">

          {/* 실시간 재난 · 안전 정보 */}
          <section ref={disasterListRef} className="bg-white rounded-[18px] border border-slate-200 shadow-sm overflow-hidden min-h-[430px]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold text-[#0B2A52] flex items-center gap-2">
                <span className="text-red-500">◉</span> 실시간 재난 · 안전 정보
              </h2>
              <button onClick={() => goTo("disaster-info")} className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">
                더보기 <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 flex gap-2 pb-3 overflow-x-auto">
              {MAIN_DISASTER_FILTERS.map((x) => (
                <button
                  key={x}
                  onClick={() => setMainDisasterFilter(x)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition whitespace-nowrap ${mainDisasterFilter === x ? "bg-[#0B2A52] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <ul className="px-5">
              {mainDisasterLoading && (
                <li className="py-14 text-center text-sm text-slate-400 border-t border-slate-100">재난문자를 불러오는 중입니다.</li>
              )}

              {!mainDisasterLoading && mainDisasterError && (
                <li className="py-12 text-center border-t border-slate-100">
                  <div className="text-sm text-slate-500">{mainDisasterError}</div>
                  <button onClick={() => goTo("disaster-info")} className="mt-2 text-xs font-bold text-blue-600 cursor-pointer">전체 페이지에서 다시 확인하기</button>
                </li>
              )}

              {!mainDisasterLoading && !mainDisasterError && mainDisasterMessages
                .filter((m) => mainDisasterFilter === "전체" || disasterFilterOf(m) === mainDisasterFilter)
                .slice(0, 4)
                .map((m, i) => (
                  <li
                    key={m.sn || `${m.createdAt || "time"}-${i}`}
                    onClick={() => goTo("disaster-info", { disasterSn: m.sn || null })}
                    className="py-4 border-t border-slate-100 flex gap-3 items-start cursor-pointer hover:bg-slate-50 transition -mx-5 px-5"
                  >
                    <span className={`min-w-[52px] text-center rounded-lg border px-2 py-1.5 text-xs font-bold ${disasterBadgeClass(m)}`}>
                      {disasterFilterOf(m)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px] text-[#0B2A52] truncate">{disasterTitle(m)}</div>
                      <div className="text-[12px] text-slate-400 mt-1 truncate">{disasterSummary(m)}</div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatDisasterTime(m.createdAt)}</span>
                  </li>
                ))}

              {!mainDisasterLoading && !mainDisasterError && mainDisasterMessages
                .filter((m) => mainDisasterFilter === "전체" || disasterFilterOf(m) === mainDisasterFilter).length === 0 && (
                  <li className="py-10 text-center text-sm text-slate-400 border-t border-slate-100">조건에 맞는 재난문자가 없습니다.</li>
                )}
            </ul>
          </section>

          {/* 내 주변 안전지도 - 실제 Kakao Map + 현재 위치 + 진행중 사건 + 대피시설 */}
          <section ref={safetyMapRef}>
            <NearbySafetyMap
              mode="compact"
              onOpenFullMap={() => goTo("safety-map")}
            />
          </section>

          {/* 오른쪽: 날씨 / AI 브리핑 / 내 제보 */}
          <div className="space-y-3">

            {/* 현재 날씨 - 기상청 초단기실황 + 에어코리아 */}
            <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-extrabold text-[#0B2A52]">현재 날씨</h2>

                <button
                  type="button"
                  onClick={() => {
                    if (!weatherLocation || weatherLoading) return;
                    setWeatherError("");
                    setWeatherRefreshKey((value) => value + 1);
                  }}
                  disabled={weatherLoading || !weatherLocation}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  title="날씨 새로고침"
                  aria-label="날씨 새로고침"
                >
                  <RefreshCw className={`w-4 h-4 ${weatherLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {!weatherLocation ? (
                <div className="mt-3 flex min-h-[112px] items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold text-[#0B2A52]">내 위치의 날씨를 확인해보세요.</p>
                    <p className="mt-1 text-[10px] text-slate-400">위치 권한은 버튼을 누를 때만 요청합니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={requestWeatherLocation}
                    disabled={weatherLocating}
                    className="h-9 shrink-0 cursor-pointer rounded-lg border border-blue-100 bg-blue-50 px-3 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {weatherLocating ? "확인 중..." : "내 위치 확인"}
                  </button>
                </div>
              ) : weatherLoading && !currentWeather ? (
                <div className="mt-3 flex min-h-[112px] items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  날씨 정보를 불러오는 중...
                </div>
              ) : currentWeather ? (
                <>
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="text-[46px] leading-none">{weatherEmoji(currentWeather)}</div>

                      <div className="min-w-0">
                        <div className="flex items-end gap-1">
                          <span className="text-[31px] leading-none font-black tracking-tight text-[#0B2A52]">
                            {currentWeather.temperature ?? "-"}°C
                          </span>
                        </div>

                        <div className="mt-1.5 text-[12px] font-bold text-slate-600">
                          {currentWeather.precipitationType || "현재 상태"}
                        </div>

                        <div className="mt-0.5 text-[10px] text-slate-400">
                          풍속 {currentWeather.windSpeed ?? "-"}m/s
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1.5 border-l border-slate-100 pl-4 text-[11px]">
                      <span className="text-slate-500">미세먼지</span>
                      <b className={airGradeClass(currentAirQuality?.pm10Grade)}>
                        {currentAirQuality?.pm10Grade || "-"}
                      </b>

                      <span className="text-slate-500">1시간 강수</span>
                      <b className="text-[#0B2A52]">
                        {normalizeRainfall(currentWeather.hourlyRainfall)}
                      </b>

                      <span className="text-slate-500">습도</span>
                      <b className="text-[#0B2A52]">{currentWeather.humidity ?? "-"}%</b>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="truncate">{weatherLocationLabel}</span>
                    {formatWeatherObservationTime(currentWeather) && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="shrink-0">{formatWeatherObservationTime(currentWeather)}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-3 flex min-h-[112px] items-center justify-between gap-3">
                  <p className="text-[11px] text-red-500">
                    {weatherError || "날씨 정보를 불러오지 못했습니다."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setWeatherRefreshKey((value) => value + 1)}
                    className="h-8 shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {weatherError && currentWeather && (
                <p className="mt-2 text-[9px] text-slate-400">일부 환경정보를 불러오지 못했습니다.</p>
              )}
            </section>

            {/* Gemini API 기반 AI 상황 브리핑 */}
            <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-extrabold text-[#0B2A52] flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </span>
                  AI 상황 브리핑
                  <span className="rounded-full bg-rose-50 text-rose-500 px-2 py-0.5 text-[9px] font-extrabold">Beta</span>
                </h2>

                <button
                  type="button"
                  onClick={() => setAiBriefingRefreshKey((value) => value + 1)}
                  disabled={!weatherLocation || aiBriefingLoading}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  title="AI 브리핑 새로고침"
                  aria-label="AI 브리핑 새로고침"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiBriefingLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="mt-3 min-h-[60px]">
                {!weatherLocation ? (
                  <p className="text-[12px] leading-5 text-slate-500">
                    내 위치를 확인하면 주변 재난·날씨·현장정보를 바탕으로 AI 브리핑을 생성합니다.
                  </p>
                ) : aiBriefingLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    주변 정보를 분석해 AI 상황 브리핑을 생성하고 있습니다...
                  </div>
                ) : aiBriefingError ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] leading-5 text-rose-500">{aiBriefingError}</p>
                    <button
                      type="button"
                      onClick={() => setAiBriefingRefreshKey((value) => value + 1)}
                      className="shrink-0 h-8 px-3 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] leading-5 text-slate-600 whitespace-pre-line">
                    {aiBriefing || "현재 위치의 AI 상황 브리핑을 준비하고 있습니다."}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="mt-3 w-full h-9 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition cursor-pointer"
                onClick={openAiChat}
              >
                <MessageCircle className="w-4 h-4" /> AI 안전 도우미에게 질문하기 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </section>

            {/* 내 현장제보 추적 - 기존 디자인: 대표 1건 + 다른 제보 2건 */}
            <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-[17px] font-extrabold text-[#0B2A52] flex items-center gap-2">
                    <Camera className="w-4.5 h-4.5 text-blue-600" /> 내 현장제보 추적
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    내가 제보한 현장의 처리 상황을 실시간으로 확인할 수 있습니다.
                  </p>
                </div>
                <button
                  onClick={openTrackingOverview}
                  className="text-xs text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer shrink-0 mt-0.5"
                >
                  전체보기 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {!token ? (
                <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
                  <p className="text-sm font-bold text-[#0B2A52]">내 제보 처리과정을 확인하세요</p>
                  <p className="text-[11px] text-slate-400 mt-1">등록한 제보와 연결 사건의 진행상태를 볼 수 있습니다.</p>
                  <button
                    onClick={() => goTo("login")}
                    className="mt-3 h-8 px-4 rounded-lg bg-[#0B2A52] text-white text-xs font-bold cursor-pointer"
                  >
                    로그인
                  </button>
                </div>
              ) : myReportsLoading ? (
                <p className="text-sm text-slate-400 py-5 text-center">불러오는 중...</p>
              ) : primaryTrackingItem ? (
                <div>
                  {/* 대표 제보/사건 */}
                  {primaryTrackingItem.kind === "incident" ? (() => {
                    const { incidentId, incident, reports } = primaryTrackingItem;
                    const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                    const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || Droplets;
                    const PRIMARY_STEP_BY_STATUS = {
                      RECEIVED: 1,
                      CONFIRMING: 2,
                      RESPONDING: 3,
                      RECOVERING: 3,
                      CLOSED: 4,
                    };
                    const activeStep = PRIMARY_STEP_BY_STATUS[incident?.status] || 1;
                    const steps = ["접수", "담당자 배정", "현장 확인", "처리 완료"];

                    return (
                      <button
                        onClick={() => openIncidentDetail(incidentId)}
                        className="w-full text-left rounded-xl border border-blue-100 bg-blue-50/40 hover:border-blue-200 hover:shadow-sm transition cursor-pointer p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-[68px] h-[64px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {photoUrl ? (
                              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-6 h-6 text-blue-500" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <b className="text-[14px] text-[#0B2A52] truncate">
                                {incident?.title || `${reports[0]?.disasterType || "현장"} 제보`}
                              </b>
                              <span
                                className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${
                                  STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {incident ? STATUS_LABEL[incident.status] || incident.status : "확인중"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{incident?.region || "내 주변 신고 위치"}</span>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>

                        <div className="mt-3 px-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4].map((step) => (
                              <React.Fragment key={step}>
                                <div
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    step <= activeStep ? "bg-blue-600" : "bg-slate-300"
                                  } ${step === activeStep ? "ring-2 ring-blue-100" : ""}`}
                                />
                                {step < 4 && (
                                  <div
                                    className={`h-[2px] flex-1 ${
                                      step < activeStep ? "bg-blue-600" : "bg-slate-200"
                                    }`}
                                  />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="grid grid-cols-4 text-[9px] text-slate-400 mt-1 text-center">
                            {steps.map((step) => (
                              <span key={step}>{step}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })() : (() => {
                    const report = primaryTrackingItem.report;
                    const reportState = reportStateOf(report);
                    const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;
                    const REPORT_STEP_BY_STATUS = { RECEIVED: 1, REVIEWING: 2, LINKED: 3, REJECTED: 1 };
                    const activeStep = REPORT_STEP_BY_STATUS[reportState.code] || 1;
                    const steps = ["접수", "검토중", "사건 연결", "처리 완료"];

                    return (
                      <button
                        onClick={() => {
                          setTrackingOpen(true);
                          setDetailIncidentId(null);
                          setDetailPendingReportId(report.reportId);
                        }}
                        className="w-full text-left rounded-xl border border-blue-100 bg-blue-50/40 hover:border-blue-200 hover:shadow-sm transition cursor-pointer p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-[68px] h-[64px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {report.photoUrl ? (
                              <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-6 h-6 text-blue-500" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <b className="text-[14px] text-[#0B2A52] truncate">
                                {report.content || `${report.disasterType || "현장"} · 제보 #${report.reportId}`}
                              </b>
                              <span className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${reportState.style}`}>
                                {reportState.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">{formatDateTimeFull(report.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {pendingReportAddresses[report.reportId] || report.address || "주소 확인 중..."}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>

                        <div className="mt-3 px-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4].map((step) => (
                              <React.Fragment key={step}>
                                <div
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    step <= activeStep ? "bg-blue-600" : "bg-slate-300"
                                  }`}
                                />
                                {step < 4 && (
                                  <div
                                    className={`h-[2px] flex-1 ${
                                      step < activeStep ? "bg-blue-600" : "bg-slate-200"
                                    }`}
                                  />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="grid grid-cols-4 text-[9px] text-slate-400 mt-1 text-center">
                            {steps.map((step) => (
                              <span key={step}>{step}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })()}

                  {/* 다른 제보 현황 - 한 줄에 1개씩, 모두 표시 */}
                  {otherTrackingItems.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5 font-bold text-[13px] text-[#0B2A52]">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          다른 제보 현황
                        </div>

                        <div className="text-[10px] text-slate-500">
                          진행 중 <b className="text-blue-600">{trackingProgressCount}건</b>
                          <span className="mx-1">·</span>
                          완료 <b className="text-emerald-500">{trackingClosedCount}건</b>
                          {trackingRejectedCount > 0 && (
                            <>
                              <span className="mx-1">·</span>
                              반려 <b className="text-rose-500">{trackingRejectedCount}건</b>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 한 줄에 한 건씩, otherTrackingItems 전체 표시 */}
                      <div className="space-y-2">
                        {otherTrackingItems.map((item) => {
                          if (item.kind === "report") {
                            const report = item.report;
                            const reportState = reportStateOf(report);
                            const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;

                            return (
                              <button
                                key={item.key}
                                onClick={() => {
                                  setTrackingOpen(true);
                                  setDetailIncidentId(null);
                                  setDetailPendingReportId(report.reportId);
                                }}
                                className="w-full min-w-0 rounded-xl border border-slate-100 bg-white p-3 text-left hover:border-slate-200 hover:shadow-sm transition cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-[58px] h-[58px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                    {report.photoUrl ? (
                                      <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <DisasterIcon className="w-5 h-5 text-blue-500" />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <b className="text-[13px] font-extrabold text-[#0B2A52] truncate">
                                        {`${report.disasterType || "현장"} · 제보 #${report.reportId}`}
                                      </b>
                                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${reportState.style}`}>
                                        {reportState.label}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 min-w-0">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{formatDateTimeFull(report.createdAt)}</span>
                                    </div>

                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 min-w-0">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        {pendingReportAddresses[report.reportId] || report.address || "주소 확인 중..."}
                                      </span>
                                    </div>
                                  </div>

                                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                </div>
                              </button>
                            );
                          }

                          const { incidentId, incident, reports } = item;
                          const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                          const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || ShieldAlert;

                          return (
                            <button
                              key={item.key}
                              onClick={() => openIncidentDetail(incidentId)}
                              className="w-full min-w-0 rounded-xl border border-slate-100 bg-white p-3 text-left hover:border-slate-200 hover:shadow-sm transition cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-[58px] h-[58px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                  {photoUrl ? (
                                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <DisasterIcon className="w-5 h-5 text-blue-500" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <b className="text-[13px] font-extrabold text-[#0B2A52] truncate">
                                      {incident?.title || `${reports[0]?.disasterType || "현장"} · 제보 #${reports[0]?.reportId || ""}`}
                                    </b>
                                    <span
                                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                        STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {incident ? STATUS_LABEL[incident.status] || incident.status : "확인중"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 min-w-0">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                      {formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 min-w-0">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{incident?.region || "내 주변 신고 위치"}</span>
                                  </div>
                                </div>

                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
                  <p className="text-sm font-bold text-[#0B2A52]">아직 등록한 제보가 없습니다.</p>
                  <button
                    onClick={handleReportClick}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    현장 제보하기
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {showReportForm && (
        <ReportForm onClose={() => setShowReportForm(false)} onSuccess={handleReportSuccess} />
      )}

      {reportSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F2540] text-white text-sm font-semibold rounded-lg px-4 py-3 shadow-lg z-50">
          제보가 등록되었습니다. 담당자가 확인 후 처리할 예정입니다.
        </div>
      )}

      {/* AI 안전 도우미 채팅 모달 */}
      {aiChatOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAiChat();
          }}
        >
          <div className="flex h-[min(720px,86vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-[#0B2A52]">AI 안전 도우미</h2>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-500">Beta</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {weatherLocation
                      ? `${weatherLocationLabel || "현재 위치"} · 실시간 안전정보 기반`
                      : "지역 지정 질문 가능 · 내 주변 질문은 위치 확인 필요"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAiChat}
                disabled={aiChatLoading}
                className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="AI 안전 도우미 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {AI_SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendAiChatMessage(question)}
                    disabled={aiChatLoading}
                    className="shrink-0 cursor-pointer rounded-full border border-blue-100 bg-white px-3 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
              <div className="space-y-3">
                {aiChatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <span className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Bot className="h-4 w-4" />
                      </span>
                    )}
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12px] leading-5 ${
                        message.role === "user"
                          ? "rounded-br-md bg-blue-600 text-white"
                          : "rounded-bl-md bg-slate-100 text-slate-700"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {aiChatLoading && (
                  <div className="flex justify-start">
                    <span className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-[12px] text-slate-500">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      현재 안전정보를 확인해 답변하고 있습니다...
                    </div>
                  </div>
                )}

                <div ref={aiChatEndRef} />
              </div>
            </div>

            <div className="border-t border-slate-100 bg-white px-4 py-3">
              {!weatherLocation && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  <span>서울·화성시처럼 지역을 직접 물어볼 수 있어요. "내 주변" 질문은 위치 확인이 필요합니다.</span>
                  <button
                    type="button"
                    onClick={requestWeatherLocation}
                    className="shrink-0 cursor-pointer font-bold underline underline-offset-2"
                  >
                    내 위치 확인
                  </button>
                </div>
              )}

              {aiChatError && (
                <p className="mb-2 text-[11px] text-rose-500">{aiChatError}</p>
              )}

              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-300 focus-within:bg-white">
                <textarea
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value.slice(0, 1200))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendAiChatMessage();
                    }
                  }}
                  disabled={aiChatLoading}
                  rows={2}
                  placeholder="재난·안전과 관련해 궁금한 내용을 입력하세요..."
                  className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[12px] leading-5 text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => sendAiChatMessage()}
                  disabled={!aiChatInput.trim() || aiChatLoading}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  aria-label="질문 보내기"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400">
                <span>현재 상황은 SafeTrace 수집 데이터 기준이며 긴급 상황에서는 공식 안내를 우선하세요.</span>
                <span>{aiChatInput.length}/1200</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 대응상황 추적 모달 - 목록 모드 / 상세(타임라인) 모드 겸용 */}
      {trackingOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {(detailIncidentId || detailPendingReportId) && (
                  <button
                    onClick={() => { setDetailIncidentId(null); setDetailPendingReportId(null); }}
                    className="text-slate-400 hover:text-[#0F2540] -ml-1 p-1 shrink-0 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {detailIncidentId ? (
                  <h2 className="font-bold text-[#0F2540]">대응상황 상세</h2>
                ) : detailPendingReportId ? (
                  <h2 className="font-bold text-[#0F2540]">제보 상세</h2>
                ) : (
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-[#0B2A52] flex items-center gap-2"><Camera className="w-5 h-5 text-blue-600 shrink-0" /> 내 현장제보 목록</h2>
                    <p className="text-xs text-slate-400 mt-0.5">내가 제보한 현장의 처리 현황을 한눈에 확인할 수 있습니다.</p>
                  </div>
                )}
              </div>
              <button onClick={closeTracking} className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {/* 목록 모드: 연결된 사건이 여러 개일 때 */}
              {!detailIncidentId && !detailPendingReportId && (
                <div>
                  {/* 필터 + 정렬 */}
                  <div className="flex items-center flex-wrap gap-2 mb-4">
                    {[
                      ["all", `전체 ${groupedIncidents.length + pendingReports.length}`],
                      ["progress", `진행중 ${trackingProgressCount}`],
                      ["closed", `완료 ${trackingClosedCount}`],
                      ["rejected", `반려 ${trackingRejectedCount}`],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setTrackingStatusFilter(key)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition ${
                          trackingStatusFilter === key ? "bg-[#0B2A52] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        } cursor-pointer`}
                      >
                        {label}
                      </button>
                    ))}
                    {trackingDisasterTypes.length > 0 && (
                      <>
                        <span className="w-px h-5 bg-slate-200 shrink-0" />
                        <div className="relative shrink-0">
                          <select
                            value={trackingTypeFilter || ""}
                            onChange={(e) => setTrackingTypeFilter(e.target.value || null)}
                            className="appearance-none text-xs font-bold text-slate-500 border border-slate-200 rounded-full pl-3 pr-7 py-1.5 outline-none"
                          >
                            <option value="">재난유형: 전체</option>
                            {trackingDisasterTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </>
                    )}
                    <div className="relative ml-auto shrink-0">
                      <select
                        value={trackingSort}
                        onChange={(e) => setTrackingSort(e.target.value)}
                        className="appearance-none text-xs font-bold text-slate-500 border border-slate-200 rounded-full pl-3 pr-7 py-1.5 outline-none"
                      >
                        <option value="newest">최신순</option>
                        <option value="oldest">오래된순</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {filteredTrackingItems.map((item) => {
                      if (item.kind === "report") {
                        const report = item.report;
                        const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;
                        const reportState = reportStateOf(report);

                        return (
                          <li
                            key={item.key}
                            onClick={() => setDetailPendingReportId(report.reportId)}
                            className="rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition p-3 flex items-center gap-4"
                          >
                            <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {report.photoUrl ? (
                                <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <DisasterIcon className="w-6 h-6 text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <b className="text-sm text-[#0B2A52] truncate">{report.content || `${report.disasterType} 제보`}</b>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${reportState.style}`}>
                                  {reportState.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                {formatDateTimeFull(report.createdAt)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{pendingReportAddresses[report.reportId] || "주소 확인 중..."}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                          </li>
                        );
                      }

                      const { incidentId, incident, reports } = item;
                      const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                      const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || ShieldAlert;
                      const STEP_BY_STATUS = { RECEIVED: 1, CONFIRMING: 2, RESPONDING: 3, RECOVERING: 4, CLOSED: 5 };
                      const activeStep = STEP_BY_STATUS[incident?.status] || 1;

                      return (
                        <li
                          key={item.key}
                          onClick={() => openIncidentDetail(incidentId)}
                          className="rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition p-3 flex items-center gap-4"
                        >
                          <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {photoUrl ? (
                              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-6 h-6 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <b className="text-sm text-[#0B2A52] truncate">{incident?.title || `사건 #${incidentId}`}</b>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"}`}>
                                {incident ? STATUS_LABEL[incident.status] || incident.status : "확인 중"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}
                              {incident?.updatedAt && <span> · 마지막 업데이트 {formatRelativeTime(incident.updatedAt)}</span>}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{incident?.region}</span>
                            </div>
                          </div>
                          <div className="hidden md:block w-[200px] shrink-0">
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((step) => (
                                <React.Fragment key={step}>
                                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${step <= activeStep ? "bg-blue-600" : "bg-slate-300"}`} />
                                  {step < 5 && <div className={`h-[2px] flex-1 ${step < activeStep ? "bg-blue-600" : "bg-slate-200"}`} />}
                                </React.Fragment>
                              ))}
                            </div>
                            <div className="grid grid-cols-5 text-[9px] text-slate-400 mt-1 text-center leading-tight">
                              <span>접수</span><span>확인중</span><span>대응중</span><span>복구중</span><span>종료</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </li>
                      );
                    })}

                    {filteredTrackingItems.length === 0 && (
                      <p className="text-sm text-slate-400 py-8 text-center">조건에 맞는 제보가 없습니다.</p>
                    )}
                  </ul>

                  <div className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-400">
                    <Bell className="w-3.5 h-3.5 shrink-0" /> 최대 1년 전까지의 제보 내역을 확인할 수 있습니다.
                  </div>
                </div>
              )}

              {/* 상세 모드: 사진+설명 배너 + 6단계 진행바 + 타임라인(정렬 가능) + 담당부서/번호/최근업데이트/지도 정보패널 */}
              {/* 검토 대기중 제보 상세 - 아직 Incident가 없어서 타임라인/진행바 없이 제보 원본만 보여줌 */}
              {detailPendingReportId && detailPendingReport && (() => {
                const DetailDisasterIcon = DISASTER_ICON[detailPendingReport.disasterType] || ShieldAlert;
                const detailReportState = reportStateOf(detailPendingReport);
                return (
                  <div>
                    <div className="rounded-xl overflow-hidden mb-5 bg-slate-50 border border-slate-200">
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/60 flex items-center justify-center shrink-0">
                          {detailPendingReport.photoUrl ? (
                            <img src={detailPendingReport.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <DetailDisasterIcon className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${detailReportState.style}`}>
                              {detailReportState.label}
                            </span>
                            <span className="text-[11px] text-slate-500">#{detailPendingReport.reportId}</span>
                          </div>
                          <h3 className="font-bold text-[#0F2540] text-base mb-1">{detailPendingReport.disasterType} 제보</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{pendingReportAddresses[detailPendingReport.reportId] || "주소 확인 중..."}</span>
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 shrink-0" /> {formatDateTimeFull(detailPendingReport.createdAt)} 등록
                          </p>
                        </div>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-[#0F2540] mb-2">제보 내용</h4>
                    <p className="text-sm text-slate-600 leading-6 whitespace-pre-wrap mb-5">
                      {detailPendingReport.content || "작성된 상세 설명이 없습니다."}
                    </p>

                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-[12px] text-blue-700">
                      <Bell className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {detailReportState.code === "REVIEWING"
                        ? "담당자가 제보 내용을 검토하고 있어요. 사건으로 연결되면 여기서 사건 처리 진행상황을 확인할 수 있어요."
                        : detailReportState.code === "REJECTED"
                          ? "이 제보는 반려된 상태입니다. 자세한 사유는 내 제보 내역에서 확인할 수 있어요."
                          : "제보가 등록되었습니다. 담당자 검토 후 사건으로 연결되면 여기서 처리 진행상황을 확인할 수 있어요."}
                    </div>
                  </div>
                );
              })()}

              {detailIncidentId && (
                <div>
                  {detailIncident && (() => {
                    const DetailDisasterIcon = DISASTER_ICON[detailReports[0]?.disasterType || detailIncident.disasterType] || ShieldAlert;
                    return (
                      <div className={`rounded-xl overflow-hidden mb-5 ${STATUS_BANNER[detailIncident.status] || "bg-slate-50 border border-slate-200"}`}>
                        <div className="flex gap-4 p-4">
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/60 flex items-center justify-center shrink-0">
                            {detailPhotoUrl ? (
                              <img src={detailPhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DetailDisasterIcon className="w-8 h-8 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${STATUS_STYLE[detailIncident.status] || ""}`}>
                                {STATUS_LABEL[detailIncident.status] || detailIncident.status}
                              </span>
                              <span className="text-[11px] text-slate-500">#{detailIncident.incidentId}</span>
                            </div>
                            <h3 className="font-bold text-[#0F2540] text-base mb-1 truncate">{detailIncident.title}</h3>
                            {/* 정확한 도로명 주소 필드가 없어서 region으로 표시 - 한 줄 고정(줄바꿈 시 아이콘과 텍스트가 어긋나 보여서) */}
                            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{detailIncident.region}</span>
                            </p>
                            {/* 제보 주소 바로 밑에 현재 진행상황 멘트 - 사진 영역을 침범하지 않도록 텍스트 컬럼 안에 위치 */}
                            {detailDescription && (
                              <p className="text-xs text-slate-600 leading-5 mt-1.5 line-clamp-2">{detailDescription}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 6단계 진행바 - RECEIVED/CONFIRMING/RESPONDING/RECOVERING/CLOSED를 접수~완료 6칸에 배치 */}
                  {detailIncident && (() => {
                    const activeStep = DETAIL_STEP_BY_STATUS[detailIncident.status] || 1;
                    return (
                      <div className="mb-5">
                        <div className="flex items-center">
                          {DETAIL_PROGRESS_STEPS.map((label, idx) => {
                            const step = idx + 1;
                            const reached = step <= activeStep;
                            return (
                              <React.Fragment key={label}>
                                <div
                                  className={`w-3.5 h-3.5 rounded-full shrink-0 ${reached ? "bg-blue-600" : "bg-slate-300"} ${
                                    step === activeStep ? "ring-4 ring-blue-100" : ""
                                  }`}
                                />
                                {step < DETAIL_PROGRESS_STEPS.length && (
                                  <div className={`h-[3px] flex-1 ${step < activeStep ? "bg-blue-600" : "bg-slate-200"}`} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-6 text-[10px] text-slate-400 mt-1.5 text-center leading-tight">
                          {DETAIL_PROGRESS_STEPS.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-[#0F2540]">처리 타임라인</h4>
                    <div className="relative">
                      <select
                        value={detailTimelineSort}
                        onChange={(e) => setDetailTimelineSort(e.target.value)}
                        className="appearance-none text-[11px] font-bold text-slate-500 border border-slate-200 rounded-full pl-3 pr-6 py-1 outline-none cursor-pointer"
                      >
                        <option value="oldest">오래된순</option>
                        <option value="newest">최신순</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  {detailTimelineLoading ? (
                    <p className="text-xs text-slate-400">불러오는 중...</p>
                  ) : detailTimeline.length === 0 ? (
                    <p className="text-xs text-slate-400">아직 기록이 없습니다.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detailTimelineSorted.map((log, i) => {
                        const isLast = i === detailTimelineSorted.length - 1;
                        return (
                          <div key={log.logId} className="flex gap-2">
                            <div className="flex flex-col items-center shrink-0">
                              <span
                                className={`w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm ${
                                  STATUS_DOT[log.newStatus] || "bg-slate-400"
                                } ${log.logId === latestDetailLog?.logId ? "ring-2 ring-offset-1 ring-slate-200" : ""}`}
                              />
                              {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                            </div>
                            <div className="min-w-0 flex-1 rounded-lg border border-slate-100 px-2.5 py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[#0F2540]">
                                  {STATUS_LABEL[log.newStatus] || log.newStatus}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.changedAt)}</span>
                              </div>
                              {/* memo가 비어있는 로그도 단계별 설명이 안 보이는 일이 없도록 상태별 기본 문구로 대체 */}
                              <div className="text-xs text-slate-600 mt-0.5">
                                {log.memo || STATUS_LOG_FALLBACK_TEXT[log.newStatus] || "-"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SiteFooter onNavigate={goTo} />
    </div>
  );
}
