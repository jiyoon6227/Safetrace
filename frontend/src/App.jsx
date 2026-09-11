import React, { useState, useEffect, useRef } from "react";
import {
  Home, MapPin, ShieldAlert, Camera, GraduationCap, Users,
  Search, Menu, Bell, ChevronRight, ChevronLeft, ChevronDown, CloudRain, Wind, Waves,
  Thermometer, Mountain, CloudFog, Fish, Snowflake, Flame, Droplets,
  CheckCircle2, Clock, Truck, Construction, ArrowRight, Navigation, X, Hash
} from "lucide-react";
import LoginPage from "./pages/LoginPage";
import ControlBoard from "./pages/ControlBoard";
import ReportForm from "./pages/ReportForm";
import MyPage from "./pages/MyPage";
import SafetyCheckResponsePage from "./pages/SafetyCheckResponsePage";
import ShelterPage from "./pages/ShelterPage";
import { getCurrentUser, authFetch } from "./api/client";
import { connectIncidentSocket, connectSafetyCheckSocket } from "./api/socket";
import mainBg from "./assets/main.png";

// ---- 색상/토큰 -----------------------------------------------------------
// 신뢰감 있는 네이비(공공/안전) + 경보용 레드 + 대응중 앰버 + 완료 그린
// 정보 제공형 사이트가 아니라 "추적형" 서비스라는 걸 타임라인 컴포넌트로 강조

const quickMenu = [
  { icon: Home, label: "대피시설" },
  { icon: ShieldAlert, label: "위험지역" },
  { icon: Camera, label: "현장제보", highlight: true },
  { icon: GraduationCap, label: "행동요령" },
  { icon: Users, label: "가족확인" },
  { icon: Navigation, label: "안전지도" },
];

const disasterMessages = [
  { type: "호우", level: "red", region: "주요 도로 침수 발생", time: "10:24", text: "도로 일부 구간 통제 중" },
  { type: "산사태", level: "red", region: "산사태 주의보 발효", time: "09:50", text: "주변 지역 접근을 자제해주세요." },
  { type: "강풍", level: "blue", region: "강풍주의보 발효", time: "08:15", text: "시설물 낙하에 주의하세요." },
  { type: "지진", level: "red", region: "지진 발생", time: "07:30", text: "현재 피해 상황 확인 중" },
  { type: "기타", level: "amber", region: "도로 결빙 주의", time: "07:30", text: "출근길 안전운전하세요." },
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

export default function App() {
  const currentUser = getCurrentUser();
  const isStaff = currentUser?.role === "STAFF" || currentUser?.role === "ADMIN";

  const [tab, setTab] = useState("nearby");
  // 이메일 안전확인 링크(?safetyCheckToken=xxx)로 들어온 거면 그 응답 화면부터 바로 보여줌
  const safetyCheckTokenFromUrl = new URLSearchParams(window.location.search).get("safetyCheckToken");
  // 새로고침(F5)을 해도 지금 보던 화면이 유지되도록, history.state에 남아있던 페이지가 있으면 그걸 먼저 씀.
  // (history.state는 새로고침해도 그대로 남아있음 - 지금까지는 이걸 안 읽어서 새로고침할 때마다 무조건 "home"으로 튕겼었음)
  const [page, setPage] = useState(
    safetyCheckTokenFromUrl ? "safety-check-response" : window.history.state?.page || "home"
  ); // "home" | "login" | "mypage" | "shelters" | "safety-check-response"
  const [selectedShelterRegionId, setSelectedShelterRegionId] = useState(
    window.history.state?.shelterRegionId ?? null
  );
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // 헤더 검색 - "실시간 재난·안전 정보" 목록을 지역/키워드로 필터링
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const headerSearchInputRef = useRef(null);
  const disasterListRef = useRef(null);

  // 브라우저 뒤로가기/앞으로가기가 앱 내 페이지 전환도 따라가게 함.
  // 지금까지는 setPage만 써서 화면은 바뀌어도 URL 히스토리엔 기록이 안 남았고,
  // 그래서 뒤로가기를 누르면 앱 안으로 안 돌아오고 이 탭을 열기 전 페이지(구글 등)로 튀어버렸음.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, page }, "");
    const handlePopState = (e) => {
      setPage(e.state?.page || "home");
      setSelectedShelterRegionId(e.state?.shelterRegionId ?? null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 페이지 전환: 추가 state도 같이 저장해두면 새로고침/뒤로가기에서도 선택 정보를 유지할 수 있음
  const goTo = (nextPage, extraState = {}) => {
    setPage(nextPage);
    if (Object.prototype.hasOwnProperty.call(extraState, "shelterRegionId")) {
      setSelectedShelterRegionId(extraState.shelterRegionId);
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
      if (page === "mypage" || page === "shelters") {
        goTo("home");
      }
    };
    window.addEventListener("auth:invalid", handleAuthInvalid);
    return () => window.removeEventListener("auth:invalid", handleAuthInvalid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 연결된 사건들의 현재 상태 (incidentId -> Incident 객체)
  const [incidentInfo, setIncidentInfo] = useState({});
  // 연결된 사건들의 처리 타임라인 (incidentId -> IncidentLog[]) - 사이드바 카드에 바로 보여주기 위함
  const [incidentTimelines, setIncidentTimelines] = useState({});

  // 대응상황 추적 모달 상태
  // trackingOpen=true & detailIncidentId=null  -> "내 연결된 사건 목록" 모드 (전체보기용)
  // trackingOpen=true & detailIncidentId=있음  -> 그 사건의 상태+타임라인 상세 모드
  const [trackingOpen, setTrackingOpen] = useState(false);
  // 제보 목록 모달의 필터/정렬 (상태 전체·진행중·완료 / 재난유형 / 정렬)
  const [trackingStatusFilter, setTrackingStatusFilter] = useState("all"); // "all" | "progress" | "closed"
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
    if (targets.length === 0 || !window.kakao?.maps?.services) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    targets.forEach((report) => {
      if (report.latitude == null || report.longitude == null) return;
      geocoder.coord2Address(report.longitude, report.latitude, (result, status) => {
        const addr =
          status === window.kakao.maps.services.Status.OK && result[0]
            ? result[0].road_address?.address_name || result[0].address?.address_name || "주소 확인 불가"
            : "주소 확인 불가";
        setPendingReportAddresses((prev) => ({ ...prev, [report.reportId]: addr }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReports]);

  // 로그인 상태일 때 WebSocket 연결 - STAFF가 내가 추적 중인 사건 상태를 바꾸면
  // 새로고침 없이 뱃지/타임라인이 자동으로 갱신됨
  useEffect(() => {
    if (!token) return;

    const socket = connectIncidentSocket((data) => {
      const changedId = data.incident?.incidentId;
      if (!changedId) return;

      // 내가 추적 중인(=이미 incidentInfo에 있는) 사건일 때만 반응 - 남의 사건까지 다 받아서 처리할 필요 없음
      setIncidentInfo((prev) => {
        if (!prev[changedId]) return prev;
        return { ...prev, [changedId]: data.incident };
      });

      setIncidentTimelines((prev) => {
        if (!(changedId in prev)) return prev; // 추적 중인 사건이 아니면 굳이 새로 안 가져옴
        authFetch(`/api/incidents/${changedId}/timeline`)
          .then((timeline) => setIncidentTimelines((p) => ({ ...p, [changedId]: timeline })))
          .catch(() => {});
        return prev;
      });

      // 지금 이 사건의 상세 모달이 열려있으면 그 타임라인도 같이 갱신
      if (detailIncidentIdRef.current === changedId) {
        authFetch(`/api/incidents/${changedId}/timeline`)
          .then(setDetailTimeline)
          .catch(() => {});
      }
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

  // 로그인 안 한 상태에서 현장제보 누르면 로그인부터 하도록 유도
  const handleReportClick = () => {
    if (!token) {
      goTo("login");
      return;
    }
    setShowReportForm(true);
  };

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

  // "담당기관 대응상황 전체보기" - 연결된 사건이 하나뿐이면 바로 상세로, 여러 개면 목록으로
  const openTrackingOverview = () => {
    if (!token) {
      goTo("login");
      return;
    }
    const uniqueIds = [...new Set(myReports.filter((r) => r.incidentId).map((r) => r.incidentId))];
    if (uniqueIds.length === 1) {
      openIncidentDetail(uniqueIds[0]);
    } else {
      setTrackingOpen(true);
      setDetailIncidentId(null);
    }
  };

  const closeTracking = () => {
    setTrackingOpen(false);
    setDetailIncidentId(null);
    setDetailTimeline([]);
    setDetailPendingReportId(null);
  };

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

  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const visibleGroups = showAllIncidents ? groupedIncidents : groupedIncidents.slice(0, 3);
  const hiddenCount = groupedIncidents.length - visibleGroups.length;

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

  // 제보 목록 모달용 - 내가 낸 제보에 실제로 등장하는 재난유형만 필터 칩으로 보여줌
  const trackingDisasterTypes = [...new Set(groupedIncidents.map((g) => g.reports[0]?.disasterType).filter(Boolean))];

  const trackingProgressCount = groupedIncidents.filter((g) => g.incident?.status !== "CLOSED").length;
  const trackingClosedCount = groupedIncidents.filter((g) => g.incident?.status === "CLOSED").length;

  // 아직 담당자가 검토해서 사건에 연결하지 않은 제보들("접수됨" 상태). 이런 제보는 연결된
  // Incident가 없어서 groupedIncidents에 안 잡히는데, 그렇다고 목록에서 아예 빠지면
  // 홈 화면 위젯의 "접수된 제보 N건" 카운트와 이 모달의 실제 표시 개수가 안 맞아 혼란스러움.
  // 그래서 별도로 "검토 대기중" 항목으로 같이 보여줌.
  const pendingReports = myReports.filter((r) => !r.incidentId);
  const filteredPendingReports = pendingReports
    .filter((r) => {
      if (trackingStatusFilter === "closed") return false; // 대기중인 건 "완료"일 수 없음
      if (trackingTypeFilter && r.disasterType !== trackingTypeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return trackingSort === "newest" ? tb - ta : ta - tb;
    });

  const filteredTrackingIncidents = groupedIncidents
    .filter((g) => {
      if (trackingStatusFilter === "progress" && g.incident?.status === "CLOSED") return false;
      if (trackingStatusFilter === "closed" && g.incident?.status !== "CLOSED") return false;
      if (trackingTypeFilter && g.reports[0]?.disasterType !== trackingTypeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = a.incident?.updatedAt ? new Date(a.incident.updatedAt).getTime() : 0;
      const tb = b.incident?.updatedAt ? new Date(b.incident.updatedAt).getTime() : 0;
      return trackingSort === "newest" ? tb - ta : ta - tb;
    });

  if (page === "safety-check-response") {
    return (
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
    return <LoginPage onLoginSuccess={handleLoginSuccess} onBackToHome={() => goTo("home")} />;
  }

  if (page === "mypage") {
    return (
      <MyPage
        onBackToHome={() => goTo("home")}
        onLogout={handleLogout}
        onOpenShelters={(regionId) => goTo("shelters", { shelterRegionId: regionId })}
      />
    );
  }

  if (page === "shelters") {
    return (
      <ShelterPage
        initialRegionId={selectedShelterRegionId}
        onBackToHome={() => goTo("home")}
        onLogout={handleLogout}
        onGoToMyPageTab={(tab) => goTo("mypage", { mypageTab: tab })}
      />
    );
  }

  if (page === "staff" && isStaff) {
    return <ControlBoard onBackToHome={() => goTo("home")} onLogout={handleLogout} />;
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

          <nav className="hidden lg:flex items-center gap-10 text-[15px] font-semibold text-[#0B2A52]">
            <button className="hover:text-blue-600 cursor-pointer transition">서비스 소개</button>
            <button className="hover:text-blue-600 cursor-pointer transition">내 주변 재난</button>
            <button onClick={handleReportClick} className="hover:text-blue-600 cursor-pointer transition">현장 제보</button>
            <button className="hover:text-blue-600 cursor-pointer transition">안전지도</button>
            <button className="hover:text-blue-600 cursor-pointer transition">행동요령</button>
            <button className="hover:text-blue-600 cursor-pointer transition">소식 · 알림</button>
          </nav>

          <div className="flex items-center gap-4 text-[#0B2A52]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                disasterListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
                            className="hidden md:flex items-center"
            >
              <div className="flex items-center bg-slate-100 rounded-full pl-3 pr-1 py-1.5">
                <input
                  ref={headerSearchInputRef}
                  value={headerSearchQuery}
                  onChange={(e) => setHeaderSearchQuery(e.target.value)}
                  placeholder="지역, 재난 유형 검색"
                  className="w-36 lg:w-44 bg-transparent outline-none text-sm placeholder:text-slate-400"
                />
                {headerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHeaderSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5"
                    aria-label="검색어 지우기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="w-7 h-7 rounded-full hover:bg-slate-200 transition text-[#0B2A52] flex items-center justify-center cursor-pointer shrink-0"
                  aria-label="검색"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>
            <div className="relative">
              <Bell className="w-5 h-5 cursor-pointer" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </div>
           {token ? (
  <>
    {isStaff && (
  <button onClick={() => goTo("staff")} className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 cursor-pointer">
    {currentUser?.role === "ADMIN" ? "관리자 대시보드" : "담당자 대시보드"}
  </button>
)}
    <div className="relative hidden sm:block" ref={profileMenuRef}>
      <button onClick={() => setProfileMenuOpen((v) => !v)} className="flex items-center gap-2 font-bold text-sm cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-[#0B2A52] text-white flex items-center justify-center overflow-hidden shrink-0">
          {myProfile?.profileImageUrl ? (
            <img src={`http://localhost:8080${myProfile.profileImageUrl}`} alt="" className="w-full h-full object-cover" />
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
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0"><ShieldAlert className="w-5 h-5 text-red-500" /></div>
                지금, 내 주변에 발생한 재난
              </div>
              <button className="text-xs sm:text-sm text-slate-500 flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer shrink-0">더보기 <ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-[26px] sm:text-[31px] font-extrabold tracking-tight text-[#0B2A52]">내 주변 침수 위험</h2>
              <span className="px-3 py-1 rounded-full bg-red-50 text-red-500 text-xs font-bold">호우</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="w-4 h-4 text-[#0B2A52] shrink-0" /> 내 위치에서 약 1.3km
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              현재 도로 일부 구간이 침수되어 통제되고 있습니다.<br className="hidden sm:block" /> 가까운 대피시설을 확인하고, 안전에 유의하세요.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button className="h-12 rounded-xl bg-[#0B2A52] hover:bg-[#173b65] transition text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Navigation className="w-4 h-4" /> 주변 재난지도 보기 <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={handleReportClick} className="h-12 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-[#0B2A52] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" /> 현장 제보하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 퀵 메뉴 */}
      <section className="relative z-20 -mt-7 max-w-[1450px] mx-auto px-6">
        <div className="bg-white rounded-[22px] shadow-lg shadow-slate-900/8 border border-slate-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 overflow-hidden">
          {quickMenu.map(({ icon: Icon, label }, index) => {
            const iconStyles = [
              "bg-blue-50 text-blue-600",
              "bg-orange-50 text-orange-500",
              "bg-blue-50 text-blue-600",
              "bg-blue-50 text-blue-600",
              "bg-blue-50 text-blue-600",
              "bg-emerald-50 text-emerald-500",
            ];
            const sub = {
              대피시설: "가까운 대피소를 확인하세요",
              위험지역: "재난 위험지역을 확인하세요",
              현장제보: "지금, 바로 제보해주세요",
              행동요령: "상황별 행동요령을 확인하세요",
              가족확인: "사랑하는 가족의 안전을 확인하세요",
              안전지도: "지도에서 한눈에 확인하세요",
            }[label];
            return (
              <button key={label} onClick={label === "현장제보" ? handleReportClick : undefined} className={`px-5 py-6 flex items-center gap-4 text-left hover:bg-slate-50 transition cursor-pointer ${index !== 5 ? "lg:border-r border-slate-100" : ""}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconStyles[index]}`}><Icon className="w-6 h-6" /></div>
                <div>
                  <div className="font-bold text-[#0B2A52] text-sm">{label === "가족확인" ? "가족 안전확인" : label === "대피시설" ? "대피시설 찾기" : label === "현장제보" ? "현장 제보하기" : label === "안전지도" ? "안전지도" : label}</div>
                  <div className="text-[11px] text-slate-400 mt-1 whitespace-nowrap">{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 하단 대시보드 */}
      <main className="max-w-[1450px] mx-auto px-6 py-5 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr_0.95fr] gap-4 items-start">
          {/* 실시간 재난 정보 */}
          <section ref={disasterListRef} className="bg-white rounded-[18px] border border-slate-200 shadow-sm overflow-hidden min-h-[470px]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold text-[#0B2A52] flex items-center gap-2"><span className="text-red-500">◉</span> 실시간 재난 · 안전 정보</h2>
              <button className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">더보기 <ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="px-5 flex gap-2 pb-3">
              {["전체", "호우", "태풍", "지진", "화재", "기타"].map((x, i) => <button key={x} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition ${i === 0 ? "bg-[#0B2A52] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{x}</button>)}
            </div>
            <ul className="px-5">
              {disasterMessages
                .filter((m) => {
                  const q = headerSearchQuery.trim();
                  if (!q) return true;
                  return (m.region + m.type + m.text).includes(q);
                })
                .map((m, i) => (
                <li key={i} className="py-4 border-t border-slate-100 flex gap-4 items-start cursor-pointer hover:bg-slate-50 transition -mx-5 px-5">
                  <span className={`min-w-[56px] text-center rounded-lg px-2 py-1.5 text-xs font-bold ${m.level === "red" ? "bg-red-50 text-red-500" : m.level === "blue" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"}`}>{m.type}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] text-[#0B2A52] truncate">{m.region}</div>
                    <div className="text-[13px] text-slate-400 mt-1">{m.text}</div>
                  </div>
                  <span className="text-xs text-slate-400">{m.time}</span>
                </li>
              ))}
              {headerSearchQuery.trim() && disasterMessages.filter((m) => (m.region + m.type + m.text).includes(headerSearchQuery.trim())).length === 0 && (
                <li className="py-8 text-center text-sm text-slate-400">'{headerSearchQuery}'에 대한 검색 결과가 없습니다.</li>
              )}
            </ul>
          </section>

          {/* 안전지도 */}
          <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm overflow-hidden min-h-[470px]">
            <div className="px-5 py-5 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold text-[#0B2A52] flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600" /> 내 주변 안전지도</h2>
              <button className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">더보기 <ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="mx-3 mb-3 h-[390px] rounded-[14px] overflow-hidden relative border border-slate-100 bg-[#E9F0E7]">
              <div className="absolute inset-0 opacity-90" style={{ backgroundImage: 'linear-gradient(25deg, transparent 44%, rgba(255,255,255,.95) 45%, rgba(255,255,255,.95) 49%, transparent 50%), linear-gradient(-32deg, transparent 46%, rgba(255,255,255,.95) 47%, rgba(255,255,255,.95) 51%, transparent 52%), linear-gradient(90deg, transparent 31%, rgba(88,174,226,.45) 32%, rgba(88,174,226,.45) 47%, transparent 48%)', backgroundSize: '180px 160px, 210px 180px, 100% 100%' }} />
              <div className="absolute top-3 right-3 bg-white rounded-full px-4 py-2 text-xs font-bold text-[#0B2A52] shadow">내 위치 반경 3km</div>
              <div className="absolute left-[50%] top-[43%] -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 rounded-full border-4 border-white shadow-lg" />
              <div className="absolute left-[50%] top-[50%] -translate-x-1/2 bg-white px-3 py-1.5 rounded-full text-[11px] font-bold text-[#0B2A52] shadow">현재 위치</div>
              {[['26%','22%'],['72%','30%'],['21%','55%'],['70%','57%']].map(([l,t],i)=><div key={i} className="absolute" style={{left:l,top:t}}><div className="w-9 h-9 rounded-full bg-red-500 border-4 border-white shadow flex items-center justify-center text-white font-black">!</div></div>)}
              {[['61%','18%'],['28%','78%']].map(([l,t],i)=><div key={i} className="absolute" style={{left:l,top:t}}><div className="w-9 h-9 rounded-full bg-blue-600 border-4 border-white shadow flex items-center justify-center"><Home className="w-4 h-4 text-white" /></div></div>)}
              
            </div>
          </section>

          {/* 오른쪽 카드들 */}
          <div className="space-y-4">
            <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2"><h2 className="text-[18px] font-extrabold text-[#0B2A52]">현재 날씨</h2><button className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">더보기 <ChevronRight className="w-4 h-4" /></button></div>
              <div className="text-xs text-slate-400 mb-2">내 위치 기준</div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3"><div className="text-5xl">🌤️</div><div><div className="text-[38px] leading-none font-black text-[#0B2A52]">28°C</div><div className="text-xs text-slate-500 mt-2">구름 조금 · 체감온도 30°C</div></div></div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500"><span>미세먼지</span><b className="text-blue-600">좋음</b><span>강수확률</span><b>30%</b><span>습도</span><b>65%</b></div>
              </div>
            </section>

            <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[18px] font-extrabold text-[#0B2A52] flex items-center gap-2"><Camera className="w-5 h-5 text-blue-600" /> 내 현장제보 추적</h2><button onClick={openTrackingOverview} className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">더보기 <ChevronRight className="w-4 h-4" /></button></div>
              {!token ? <p className="text-sm text-slate-400 py-6 text-center">로그인하면 내가 등록한 제보를 확인할 수 있습니다.</p> : myReportsLoading ? <p className="text-sm text-slate-400 py-6 text-center">불러오는 중...</p> : myReports.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">아직 등록한 제보가 없습니다.</p> : (
                <div className="space-y-4">
                  {visibleGroups.slice(0,1).map(({ incidentId, incident, reports }) => {
                    const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                    const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || Droplets;
                    // 4단계 진행바(접수/담당자배정/현장확인/처리완료)를 실제 사건 상태에 맞춰 계산
                    const STEP_BY_STATUS = { RECEIVED: 1, CONFIRMING: 2, RESPONDING: 3, RECOVERING: 3, CLOSED: 4 };
                    const activeStep = STEP_BY_STATUS[incident?.status] || 1;
                    return (
                    <button key={incidentId} onClick={() => openIncidentDetail(incidentId)} className="w-full text-left rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition cursor-pointer p-3">
                      <div className="flex gap-3 items-center">
                        <div className="w-[74px] h-[58px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {photoUrl ? (
                            <img src={`http://localhost:8080${photoUrl}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <DisasterIcon className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2"><b className="text-[#0B2A52] truncate">{incident?.title || '도로 침수 위험'}</b><span className={`text-[11px] px-2 py-1 rounded-full font-bold shrink-0 ${STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"}`}>{incident ? STATUS_LABEL[incident.status] || incident.status : '접수완료'}</span></div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1"><Clock className="w-3 h-3 shrink-0" />{formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{incident?.region || '내 주변 신고 위치'}</span></div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center">
                        {[1, 2, 3, 4].map((step) => (
                          <React.Fragment key={step}>
                            <div className={`w-3 h-3 rounded-full shrink-0 ${step <= activeStep ? "bg-blue-600" : "bg-slate-300"}`} />
                            {step < 4 && <div className={`h-[3px] flex-1 ${step < activeStep ? "bg-blue-600" : "bg-slate-200"}`} />}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 text-[10px] text-slate-400 mt-1 text-center"><span>접수</span><span>담당자 배정</span><span>현장 확인</span><span>처리 완료</span></div>
                    </button>
                    );
                  })}

                  {/* 다른 제보 현황 - 내 사건이 2건 이상 연결돼있으면 나머지를 요약 목록으로 */}
                  {groupedIncidents.length > 1 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-500">다른 제보 현황</h3>
                        <span className="text-[11px] text-slate-400">
                          진행 중 <b className="text-blue-600">{groupedIncidents.filter((g) => g.incident?.status !== "CLOSED").length}건</b>
                          {" · "}완료 <b className="text-emerald-600">{groupedIncidents.filter((g) => g.incident?.status === "CLOSED").length}건</b>
                        </span>
                      </div>
                      <div className="space-y-2">
                        {groupedIncidents.slice(1, 4).map(({ incidentId, incident, reports }) => {
                          const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                          const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || Droplets;
                          return (
                            <button key={incidentId} onClick={() => openIncidentDetail(incidentId)} className="w-full text-left flex items-center gap-3 rounded-lg border border-slate-100 p-2 hover:border-slate-200 cursor-pointer">
                              <div className="w-11 h-11 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {photoUrl ? (
                                  <img src={`http://localhost:8080${photoUrl}`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <DisasterIcon className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <b className="text-xs text-[#0B2A52] truncate">{incident?.title || `사건 #${incidentId}`}</b>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"}`}>{incident ? STATUS_LABEL[incident.status] || incident.status : "확인 중"}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)} · {incident?.region}</div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {groupedIncidents.length === 0 && (
                    unlinkedReports.length > 0 ? (
                      <div className="flex gap-3 items-center rounded-xl border border-slate-100 p-3">
                        <div className="w-[74px] h-[58px] rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          <Camera className="w-6 h-6 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <b className="text-[#0B2A52] text-sm">접수된 제보 {unlinkedReports.length}건</b>
                            <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-bold shrink-0">확인 대기중</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">담당자가 검토 후 사건으로 연결하면 여기서 진행 상황을 볼 수 있어요.</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">연결된 사건이 아직 없습니다.</p>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[18px] font-extrabold text-[#0B2A52] flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" /> 가족 안전확인</h2><button onClick={() => goTo(token ? "mypage" : "login")} className="text-sm text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer">더보기 <ChevronRight className="w-4 h-4" /></button></div>
              {!token ? <p className="text-sm text-slate-400 py-3">로그인하면 가족 안전확인을 이용할 수 있습니다.</p> : families.length === 0 ? <p className="text-sm text-slate-400 py-3">등록된 가족이 없습니다. 마이페이지에서 가족을 등록해보세요.</p> : (
                <div className="space-y-3">
                  {families.slice(0,2).map((f) => {
                    // 나와 이 가족 사이의 가장 최근 안전확인 기록(방향 무관) 하나로 배지 결정.
                    // 단, 그 기록이 "PENDING + 그 가족이 나한테 보낸 것"이면 내가 응답할 차례라는 뜻이라
                    // 같은 PENDING이라도 "응답 대기"(내가 기다리는 중)와 구분해서 "응답 필요"로 표시
                    const entry = latestCheckByMember[f.familyMemberId];
                    const needsMyResponse = entry?.check.status === "PENDING" && entry.direction === "received";
                    const meta = needsMyResponse ? NEEDS_MY_RESPONSE_META : entry ? SAFETY_STATUS_META[entry.check.status] : null;
                    const timestamp = entry?.check.confirmedAt || entry?.check.requestedAt;
                    return (
                      <div key={f.relationId} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {f.familyMemberProfileImageUrl ? (
                            <img src={`http://localhost:8080${f.familyMemberProfileImageUrl}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <b className="text-sm text-[#0B2A52] truncate">{f.relationType} {f.familyMemberName}</b>
                            {meta && <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold shrink-0 ${meta.badgeStyle}`}>{meta.badge}</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {meta ? `${formatTimeOnly(timestamp)} · ${meta.message}` : "아직 요청한 적 없어요"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => setShowSafetyCheckModal(true)} className="w-full h-11 rounded-xl bg-[#0B2A52] hover:bg-[#173b65] transition text-white text-sm font-bold flex items-center justify-center gap-2 mt-3 cursor-pointer">가족에게 안전확인 요청하기 <ArrowRight className="w-4 h-4" /></button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 bg-white">세이프트레이스 · 재난 상황관리·대응 플랫폼 (개인 프로젝트 데모)</footer>

      {showReportForm && (
        <ReportForm onClose={() => setShowReportForm(false)} onSuccess={handleReportSuccess} />
      )}

      {reportSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F2540] text-white text-sm font-semibold rounded-lg px-4 py-3 shadow-lg z-50">
          제보가 접수되었습니다. 담당자가 확인 후 처리할 예정입니다.
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
                      ["progress", `진행중 ${trackingProgressCount + pendingReports.length}`],
                      ["closed", `완료 ${trackingClosedCount}`],
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
                    {filteredPendingReports.map((report) => {
                      const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;
                      return (
                        <li
                          key={`pending-${report.reportId}`}
                          onClick={() => setDetailPendingReportId(report.reportId)}
                          className="rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition p-3 flex items-center gap-4"
                        >
                          <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {report.photoUrl ? (
                              <img src={`http://localhost:8080${report.photoUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-6 h-6 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <b className="text-sm text-[#0B2A52] truncate">{report.content || `${report.disasterType} 제보`}</b>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 bg-slate-200 text-slate-600">
                                접수됨 · 검토 대기중
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
                    })}
                    {filteredTrackingIncidents.map(({ incidentId, incident, reports }) => {
                      const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                      const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || ShieldAlert;
                      const STEP_BY_STATUS = { RECEIVED: 1, CONFIRMING: 2, RESPONDING: 3, RECOVERING: 3, CLOSED: 4 };
                      const activeStep = STEP_BY_STATUS[incident?.status] || 1;
                      return (
                        <li
                          key={incidentId}
                          onClick={() => openIncidentDetail(incidentId)}
                          className="rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition p-3 flex items-center gap-4"
                        >
                          <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {photoUrl ? (
                              <img src={`http://localhost:8080${photoUrl}`} alt="" className="w-full h-full object-cover" />
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
                              {[1, 2, 3, 4].map((step) => (
                                <React.Fragment key={step}>
                                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${step <= activeStep ? "bg-blue-600" : "bg-slate-300"}`} />
                                  {step < 4 && <div className={`h-[2px] flex-1 ${step < activeStep ? "bg-blue-600" : "bg-slate-200"}`} />}
                                </React.Fragment>
                              ))}
                            </div>
                            <div className="grid grid-cols-4 text-[9px] text-slate-400 mt-1 text-center leading-tight">
                              <span>접수</span><span>담당자 배정</span><span>현장 확인</span><span>처리 완료</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </li>
                      );
                    })}
                    {filteredTrackingIncidents.length === 0 && filteredPendingReports.length === 0 && (
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
                return (
                  <div>
                    <div className="rounded-xl overflow-hidden mb-5 bg-slate-50 border border-slate-200">
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/60 flex items-center justify-center shrink-0">
                          {detailPendingReport.photoUrl ? (
                            <img src={`http://localhost:8080${detailPendingReport.photoUrl}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <DetailDisasterIcon className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                              접수됨 · 검토 대기중
                            </span>
                            <span className="text-[11px] text-slate-500">#{detailPendingReport.reportId}</span>
                          </div>
                          <h3 className="font-bold text-[#0F2540] text-base mb-1">{detailPendingReport.disasterType} 제보</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{pendingReportAddresses[detailPendingReport.reportId] || "주소 확인 중..."}</span>
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 shrink-0" /> {formatDateTimeFull(detailPendingReport.createdAt)} 접수
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
                      아직 담당자가 검토 전이에요. 검토 후 사건으로 연결되면 여기서 처리 진행상황을 확인할 수 있어요.
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
                              <img src={`http://localhost:8080${detailPhotoUrl}`} alt="" className="w-full h-full object-cover" />
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
    </div>
  );
}
