import React, { useEffect, useState, useRef } from "react";
import {
  ShieldAlert, ArrowLeft, User, Users, Bell, MapPin, Camera,
  CheckCircle2, AlertTriangle, Trash2, UserPlus, Lock, X, ClipboardList, Sun, ChevronRight, Home, TreePine, Heart,
  Clock, Flame, Droplets, Mountain, Wind, Thermometer, Snowflake, Image as ImageIcon, Search, Send, FileText,
  RefreshCw, Smile, Cloud, Building2, Map
} from "lucide-react";
import { authFetch, authUpload } from "../api/client";
import { connectSafetyCheckSocket } from "../api/socket";

const TABS = [
  { key: "info", label: "내 정보", icon: User },
  { key: "family", label: "가족 관리", icon: Users },
  { key: "safety", label: "안전확인 이력", icon: ShieldAlert },
  { key: "reports", label: "내 제보 내역", icon: Camera },
  { key: "regions", label: "관심 지역", icon: MapPin },
  { key: "notify", label: "알림", icon: Bell },
];

const RELATION_TYPES = ["배우자", "자녀", "부모님", "형제자매", "가족"];

// 관심지역 라벨 - 자유 텍스트지만 UI에서는 흔히 쓰는 3개를 버튼으로 제공
const REGION_LABELS = [
  { value: "우리집", icon: Home },
  { value: "부모님댁", icon: Users },
  { value: "회사", icon: Building2 },
  { value: "가족 보호", icon: Heart },
  { value: "관심지역", icon: MapPin },
];

// 숫자만 입력해도 010-1234-5678 형태로 자동 변환. 02(서울 지역번호)는 2자리로 처리
const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

const ROLE_LABEL = { USER: "시민 사용자", STAFF: "담당 직원", ADMIN: "관리자" };

const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// 연도까지 표시 - "2026.09.10 04:48" 형식, 표에서 숫자 자리가 흔들리지 않도록 2자리 고정
const formatDateTimeFull = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SAFETY_STATUS_LABEL = { PENDING: "응답 대기중", SAFE: "안전 확인 완료", HELP: "도움 필요" };
const SAFETY_STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  SAFE: "bg-emerald-100 text-emerald-700",
  HELP: "bg-red-100 text-red-700",
};
const SAFETY_STATUS_ICON = { PENDING: Clock, SAFE: CheckCircle2, HELP: AlertTriangle };

const NOTIFICATION_FILTERS = [
  { key: "all", label: "전체" },
  { key: "disaster", label: "재난 알림" },
  { key: "safety", label: "안전확인" },
  { key: "report", label: "제보 알림" },
  { key: "etc", label: "기타" },
];

const NOTIFICATION_META = {
  disaster: { label: "재난 알림", icon: AlertTriangle, iconWrap: "bg-red-50", iconColor: "text-red-500" },
  safety: { label: "안전확인", icon: Users, iconWrap: "bg-emerald-50", iconColor: "text-emerald-600" },
  report: { label: "제보 알림", icon: FileText, iconWrap: "bg-blue-50", iconColor: "text-blue-600" },
  etc: { label: "기타", icon: Bell, iconWrap: "bg-slate-100", iconColor: "text-slate-500" },
};

const notificationTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
};

const buildNotificationItems = ({ sentChecks, receivedChecks, myReports, regions }) => {
  const items = [];

  receivedChecks.forEach((c) => {
    items.push({
      id: `safety-received-${c.checkId}`,
      type: "safety",
      title: c.status === "PENDING"
        ? `${c.requesterName || "가족"}님이 안전확인을 요청했습니다.`
        : "안전확인 요청에 응답했습니다.",
      desc: c.incidentTitle
        ? `${c.incidentTitle} 관련 안전확인 요청입니다.`
        : "안전 여부를 확인해 주세요.",
      createdAt: c.requestedAt,
    });
  });

  sentChecks
    .filter((c) => c.status === "SAFE" || c.status === "HELP")
    .forEach((c) => {
      items.push({
        id: `safety-sent-${c.checkId}-${c.status}`,
        type: "safety",
        title: c.status === "SAFE"
          ? `${c.targetMemberName || "가족"}님이 안전하다고 응답했습니다.`
          : `${c.targetMemberName || "가족"}님이 도움이 필요하다고 응답했습니다.`,
        desc: c.incidentTitle
          ? `${c.incidentTitle} 관련 안전확인 응답입니다.`
          : "안전확인 응답이 도착했습니다.",
        createdAt: c.confirmedAt || c.requestedAt,
      });
    });

  myReports.forEach((r) => {
    items.push({
      id: `report-${r.reportId}`,
      type: "report",
      title: `${r.disasterType || "재난"} 제보가 등록되었습니다.`,
      desc: r.content
        ? `제보 #${r.reportId} · ${r.content}`
        : `제보 #${r.reportId}의 처리 현황을 확인할 수 있습니다.`,
      createdAt: r.createdAt,
    });
  });

  regions.forEach((r) => {
    items.push({
      id: `region-${r.memberRegionId}`,
      type: "etc",
      title: `${r.regionLabel || "관심지역"}이 등록되어 있습니다.`,
      desc: r.regionName || "관심지역 알림 대상 지역입니다.",
      createdAt: r.createdAt || null,
    });
  });

  return items
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);
};

// 사건(Incident) 상태 한글 라벨 - 홈화면/관제탭과 동일한 기준
const STATUS_LABEL_KO = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};

// Daum(다음) 우편번호 서비스 - 무료 공개 위젯, API 키 불필요
function loadDaumPostcodeScript() {
  if (window.daum && window.daum.Postcode) return;
  if (document.getElementById("daum-postcode-script")) return;
  const script = document.createElement("script");
  script.id = "daum-postcode-script";
  script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
  script.async = true;
  document.body.appendChild(script);
}

export default function MyPage({ onBackToHome, onLogout, onOpenShelters }) {
  // 새로고침해도 보고 있던 탭(가족 관리 등)이 유지되도록 history.state에서 복원.
  // history.state는 새로고침해도 남아있으므로, 탭을 바꿀 때마다 같이 기록해둔다 (아래 selectTab).
  const [activeTab, setActiveTab] = useState(window.history.state?.mypageTab || "info");
  const selectTab = (key) => {
    setActiveTab(key);
    window.history.replaceState({ ...window.history.state, mypageTab: key }, "");
  };
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationPopupRef = useRef(null);
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("safeTraceReadNotifications") || "[]");
    } catch {
      return [];
    }
  });

  const [member, setMember] = useState(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberError, setMemberError] = useState("");

  const [families, setFamilies] = useState([]);
  const [familiesLoading, setFamiliesLoading] = useState(true);

  const [sentChecks, setSentChecks] = useState([]);
  const [receivedChecks, setReceivedChecks] = useState([]);

  const [regions, setRegions] = useState([]);

  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const loadMember = () => {
    setMemberLoading(true);
    setMemberError("");
    authFetch("/api/mypage")
      .then(setMember)
      .catch((err) => setMemberError(err.message))
      .finally(() => setMemberLoading(false));
  };

  const loadFamilies = () => {
    setFamiliesLoading(true);
    authFetch("/api/family")
      .then(setFamilies)
      .catch(() => {})
      .finally(() => setFamiliesLoading(false));
  };

  const loadSafetyChecks = () => {
    authFetch("/api/safety-checks/sent").then(setSentChecks).catch(() => {});
    authFetch("/api/safety-checks/received").then(setReceivedChecks).catch(() => {});
  };

  const loadRegions = () => {
    authFetch("/api/mypage/regions").then(setRegions).catch(() => {});
  };

  const loadReports = () => {
    setReportsLoading(true);
    authFetch("/api/reports/my")
      .then(setMyReports)
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  };

  useEffect(() => {
    loadMember();
    loadFamilies();
    loadSafetyChecks();
    loadRegions();
    loadReports();
    loadDaumPostcodeScript();
  }, []);


  useEffect(() => {
    const handleOutside = (e) => {
      if (notificationPopupRef.current && !notificationPopupRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // 안전확인 WebSocket - 이 화면에 머무는 동안 누가 나한테 요청을 보내거나
  // 내가 보낸 요청에 응답이 오면 새로고침 없이 "안전확인 이력" 탭이 자동 갱신됨 (App.jsx 홈 화면과 동일한 패턴)
  useEffect(() => {
    const socket = connectSafetyCheckSocket(() => {
      loadSafetyChecks();
    });
    return () => socket.close();
  }, []);

  // 가족 한 명에 대해 내가 마지막으로 보낸 안전확인 요청의 상태 (없으면 null)
  const latestStatusFor = (familyMemberId) => {
    const relevant = sentChecks
      .filter((c) => c.targetMemberId === familyMemberId)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    return relevant[0]?.status || null;
  };

  const safetyCheckTotal = sentChecks.length + receivedChecks.length;

  const notificationItems = buildNotificationItems({
    sentChecks,
    receivedChecks,
    myReports,
    regions,
  });

  const unreadCount = notificationItems.filter(
    (n) => !readNotificationIds.includes(n.id)
  ).length;

  const persistReadIds = (ids) => {
    const next = [...new Set(ids)];
    setReadNotificationIds(next);
    localStorage.setItem("safeTraceReadNotifications", JSON.stringify(next));
  };

  const markNotificationRead = (id) => {
    if (!readNotificationIds.includes(id)) {
      persistReadIds([...readNotificationIds, id]);
    }
  };

  const markAllNotificationsRead = () => {
    persistReadIds(notificationItems.map((n) => n.id));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBackToHome} className="flex items-center gap-2.5 hover:opacity-80 cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-[#0F2540] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="leading-tight text-left">
              <div className="font-extrabold text-[#0F2540] text-lg tracking-tight">세이프트레이스</div>
              <div className="text-[10px] text-slate-400">함께 만드는 더 안전한 일상</div>
            </div>
          </button>

          <div className="flex items-center gap-2 font-bold text-[#0F2540] text-base">
            <ShieldAlert className="w-5 h-5 text-amber-500" /> 마이페이지
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onBackToHome} className="text-xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer transition">홈으로</button>
            <div className="relative" ref={notificationPopupRef}>
              <button
                type="button"
                onClick={() => setNotificationOpen((v) => !v)}
                className="relative cursor-pointer group p-1"
                aria-label="알림 열기"
              >
                <Bell className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-8 w-[360px] bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-[#0F2540] text-sm">알림</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        안 읽은 알림 {unreadCount}건
                      </p>
                    </div>
                    {notificationItems.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        모두 읽음
                      </button>
                    )}
                  </div>

                  <div className="max-h-[330px] overflow-y-auto">
                    {notificationItems.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">아직 도착한 알림이 없습니다.</p>
                      </div>
                    ) : (
                      notificationItems.slice(0, 5).map((n) => {
                        const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.etc;
                        const Icon = meta.icon;
                        const unread = !readNotificationIds.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              markNotificationRead(n.id);
                              setNotificationOpen(false);
                              selectTab("notify");
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition flex gap-3 cursor-pointer ${unread ? "bg-blue-50/30" : "bg-white"}`}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.iconWrap}`}>
                              <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className="text-xs font-bold text-[#0F2540] leading-snug flex-1 line-clamp-2">
                                  {n.title}
                                </p>
                                <span className="text-[9px] text-slate-400 whitespace-nowrap shrink-0">
                                  {notificationTime(n.createdAt)}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 truncate">{n.desc}</p>
                            </div>
                            {unread && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNotificationOpen(false);
                      selectTab("notify");
                    }}
                    className="w-full py-3 text-xs font-extrabold text-blue-600 hover:bg-blue-50 cursor-pointer border-t border-slate-100"
                  >
                    전체 알림 보기
                  </button>
                </div>
              )}
            </div>
            <span className="w-px h-4 bg-slate-200" />
            <button onClick={onLogout} className="text-xs font-semibold text-slate-500 hover:text-red-500 cursor-pointer transition">로그아웃</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 요약 배너 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-[#0F2540] to-[#1B3A5C] rounded-2xl p-5 flex flex-wrap items-center gap-6 shadow-sm relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-amber-500/10" />
            <div className="flex items-center gap-3 relative">
              <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center shrink-0">
                {member?.profileImageUrl ? (
                  <img src={`http://localhost:8080${member.profileImageUrl}`} alt="프로필" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-slate-300" />
                )}
              </div>
              <div>
                {memberLoading ? (
                  <p className="text-sm text-slate-300">불러오는 중...</p>
                ) : memberError ? (
                  <p className="text-sm text-red-300">{memberError}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{member?.name}</span>
                      <span className="text-[10px] font-bold text-[#0F2540] bg-amber-400 px-1.5 py-0.5 rounded">
                        {ROLE_LABEL[member?.role] || member?.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{member?.email || "이메일 미등록"}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto relative">
              {[
                { icon: Users, label: "가족", value: `${families.length}명`, onClick: () => selectTab("family") },
                { icon: ShieldAlert, label: "안전확인", value: `${safetyCheckTotal}건`, onClick: () => selectTab("safety") },
                { icon: ClipboardList, label: "내 제보", value: `${myReports.length}건`, onClick: () => selectTab("reports") },
              ].map(({ icon: Icon, label, value, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={!onClick}
                  className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2 hover:bg-white/20 transition disabled:cursor-default cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-400 text-[#0F2540] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-sm font-bold text-white">{value}</div>
                    <div className="text-[10px] text-slate-300">{label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl p-5 flex items-center gap-3 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute right-8 top-2 w-10 h-10 rounded-full bg-white/10" />
            <Sun className="w-8 h-8 text-white shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#0F2540]">오늘도, 더 안전한 내일을 위해</p>
              <p className="text-xs text-[#0F2540]/70 mt-0.5">세이프트레이스가 함께합니다</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
          {/* 왼쪽 사이드바 메뉴 */}
          <aside className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <h2 className="font-bold text-[#0F2540] px-2 py-1.5 mb-1">마이페이지</h2>
              <nav className="space-y-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => selectTab(key)}
                    className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                      activeTab === key
                        ? "bg-sky-100 text-sky-700"
                        : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"
                    } cursor-pointer`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
                        activeTab === key ? "bg-sky-500 text-white" : "text-slate-400 group-hover:text-sky-500"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      {label}
                    </span>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 ${activeTab === key ? "text-sky-500" : "text-slate-400 group-hover:text-sky-500"}`} />
                  </button>
                ))}
              </nav>
            </div>

            <div className="bg-gradient-to-br from-[#0F2540] to-[#1B3A5C] rounded-2xl p-5 relative overflow-hidden shadow-sm">
              <Heart className="w-28 h-28 text-white/10 fill-white/10 absolute -right-6 -bottom-6 rotate-[-12deg]" />
              <p className="text-sm font-bold text-white leading-snug relative mb-4">
                소중한 사람들의<br />안전을<br />함께 지켜요
              </p>
              <button
                onClick={() => selectTab("family")}
                className="relative w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center text-[#0F2540] shadow-md hover:bg-amber-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </aside>

          {/* 오른쪽 컨텐츠 */}
          <div className="min-w-0">
        {activeTab === "info" && (
          <InfoTab
            member={member}
            memberLoading={memberLoading}
            memberError={memberError}
            onSaved={loadMember}
            families={families}
            familiesLoading={familiesLoading}
            latestStatusFor={latestStatusFor}
            regions={regions}
            onGoToFamily={() => selectTab("family")}
            onGoToRegions={() => selectTab("regions")}
            onGoToNotify={() => selectTab("notify")}
          />
        )}
        {activeTab === "family" && (
          <FamilyTab families={families} familiesLoading={familiesLoading} onChanged={loadFamilies} latestStatusFor={latestStatusFor} />
        )}
        {activeTab === "safety" && <SafetyTab sentChecks={sentChecks} receivedChecks={receivedChecks} families={families} onChanged={loadSafetyChecks} />}
        {activeTab === "reports" && <ReportsTab reports={myReports} loading={reportsLoading} onChanged={loadReports} />}
        {activeTab === "regions" && <RegionsTab regions={regions} onChanged={loadRegions} member={member} onOpenShelters={onOpenShelters} />}
        {activeTab === "notify" && (
          <NotifyTab
            member={member}
            memberLoading={memberLoading}
            memberError={memberError}
            onSaved={loadMember}
            notifications={notificationItems}
            readNotificationIds={readNotificationIds}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
          />
        )}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="border-t border-slate-200 mt-6">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-extrabold text-[#0F2540]">세이프트레이스</span>
            <span className="text-slate-400">재난으로부터 안전한 사회, 지금 함께 만들어요.</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <button className="hover:text-slate-600 cursor-pointer">이용약관</button>
            <button className="hover:text-slate-600 cursor-pointer">개인정보처리방침</button>
            <button className="hover:text-slate-600 cursor-pointer">고객센터</button>
            <button onClick={() => setShowWithdrawModal(true)} className="hover:text-red-500 cursor-pointer">회원탈퇴</button>
          </div>
        </div>
      </footer>

      {showWithdrawModal && <WithdrawModal onClose={() => setShowWithdrawModal(false)} />}
    </div>
  );
}

function WithdrawModal({ onClose }) {
  const [error, setError] = useState("");

  const handleWithdraw = async () => {
    try {
      await authFetch("/api/mypage", { method: "DELETE" });
      localStorage.removeItem("token");
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-red-600">회원탈퇴</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-600 bg-red-50 rounded-lg p-3 mb-4">
          탈퇴하면 다시 로그인할 수 없습니다. 작성한 제보/사건 이력은 삭제되지 않고 그대로 보존됩니다. 정말 탈퇴하시겠습니까?
        </p>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleWithdraw} className="flex-1 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg py-2.5 cursor-pointer">
            탈퇴 확정
          </button>
          <button onClick={onClose} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 cursor-pointer">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 내 정보 --------------------------------------------------------------

function InfoTab({
  member: initialMember, memberLoading, memberError, onSaved,
  families, familiesLoading, latestStatusFor, regions,
  onGoToFamily, onGoToRegions, onGoToNotify,
}) {
  const [draft, setDraft] = useState(initialMember);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (initialMember) setDraft(initialMember);
  }, [initialMember]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await authFetch("/api/mypage", {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone,
          address: draft.address,
          addressDetail: draft.addressDetail,
          profileImageUrl: draft.profileImageUrl,
        }),
      });
      setSuccess("저장되었습니다.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(initialMember);
    setError("");
    setSuccess("");
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await authUpload("/api/uploads", formData);
      setDraft((prev) => ({ ...prev, profileImageUrl: url }));
      // 프로필 사진은 바로 저장 - 폼 전체 저장 누르기 전까지 기다릴 필요 없게
      await authFetch("/api/mypage", {
        method: "PUT",
        body: JSON.stringify({ ...draft, profileImageUrl: url }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const openAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소 검색 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        setDraft((prev) => ({ ...prev, address: data.roadAddress || data.address }));
      },
    }).open();
  };

  if (memberLoading) return <p className="text-sm text-slate-400">불러오는 중...</p>;
  if (!draft) return <p className="text-sm text-red-500">{memberError || "정보를 불러오지 못했습니다."}</p>;

  const previewFamilies = families.slice(0, 3);
  const previewRegions = regions.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 왼쪽: 프로필 정보 요약 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0F2540] mb-1 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center"><User className="w-4 h-4" /></span>
            프로필 정보
          </h3>
          <p className="text-xs text-slate-400 mb-5 ml-9">내 프로필 정보를 관리할 수 있습니다.</p>

          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 overflow-hidden flex items-center justify-center shrink-0 border-2 border-slate-200">
              {draft.profileImageUrl ? (
                <img src={`http://localhost:8080${draft.profileImageUrl}`} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-sky-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0F2540]">{draft.name}</span>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                  {ROLE_LABEL[draft.role] || draft.role}
                </span>
              </div>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-slate-600 mb-6">
            <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">이메일</span>{draft.email || "-"}</li>
            <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">전화번호</span>{draft.phone || "-"}</li>
            <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">거주 지역</span>{draft.address || "-"}</li>
            {draft.addressDetail && (
              <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">상세주소</span>{draft.addressDetail}</li>
            )}
          </ul>

          <div className="flex gap-2 mt-6">
            <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 cursor-pointer hover:bg-sky-50 hover:border-sky-200">
              <Camera className="w-3.5 h-3.5" /> 프로필 이미지 변경
              <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
            </label>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-sky-50 hover:border-sky-200 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> 비밀번호 변경
            </button>
          </div>
        </div>

        {/* 오른쪽: 기본 정보 수정 폼 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0F2540] mb-1 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center"><Lock className="w-4 h-4" /></span>
            기본 정보
          </h3>
          <p className="text-xs text-slate-400 mb-5 ml-9">정확한 정보는 재난 상황 시 신속한 도움을 받을 수 있도록 도와줍니다.</p>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">이름</label>
                <input
                  type="text"
                  value={draft.name || ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">이메일</label>
                <input
                  type="email"
                  value={draft.email || ""}
                  disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                  placeholder="example@email.com"
                />
                <p className="text-[11px] text-slate-400 mt-1 px-3">이메일은 변경할 수 없습니다.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">전화번호</label>
              <input
                type="text"
                value={draft.phone || ""}
                onChange={(e) => setDraft({ ...draft, phone: formatPhoneNumber(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                placeholder="010-1234-5678"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">주소</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={draft.address || ""}
                  onClick={openAddressSearch}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white"
                  placeholder="클릭해서 주소 검색"
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg px-3 hover:bg-slate-50 shrink-0 cursor-pointer"
                >
                  주소 검색
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">상세주소</label>
              <input
                type="text"
                value={draft.addressDetail || ""}
                onChange={(e) => setDraft({ ...draft, addressDetail: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              />
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 미리보기 3분할 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0F2540] flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center"><Users className="w-3.5 h-3.5" /></span>
              가족 관리 미리보기
            </h3>
            <button onClick={onGoToFamily} className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">등록된 가족 {families.length}명의 안전을 지켜주세요.</p>
          {familiesLoading ? (
            <p className="text-xs text-slate-400">불러오는 중...</p>
          ) : previewFamilies.length === 0 ? (
            <p className="text-xs text-slate-400">등록된 가족이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {previewFamilies.map((f, i) => {
                const status = latestStatusFor(f.familyMemberId);
                const avatarColors = ["from-sky-100 to-blue-100 text-sky-500", "from-rose-100 to-pink-100 text-rose-500", "from-amber-100 to-orange-100 text-amber-500"];
                return (
                  <li key={f.relationId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 ${avatarColors[i % avatarColors.length]}`}>
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-slate-700 truncate">{f.familyMemberName} <span className="text-slate-400 font-normal">({f.familyMemberLoginId})</span></span>
                          <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1 py-0.5 rounded">{f.relationType}</span>
                        </div>
                        {f.familyMemberPhone && <p className="text-[10px] text-slate-400">{f.familyMemberPhone}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${status ? SAFETY_STATUS_STYLE[status] : "bg-slate-100 text-slate-400"}`}>
                      {status ? SAFETY_STATUS_LABEL[status] : "기록 없음"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0F2540] flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center"><MapPin className="w-3.5 h-3.5" /></span>
              관심 지역
            </h3>
            <button onClick={onGoToRegions} className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">재난 정보를 받고 싶은 지역을 설정하세요.</p>
          <div className="flex flex-wrap gap-1.5">
            {previewRegions.length === 0 ? (
              <p className="text-xs text-slate-400">등록된 관심지역이 없습니다.</p>
            ) : (
              previewRegions.map((r) => (
                <span key={r.memberRegionId} className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5">
                  {r.regionName}
                </span>
              ))
            )}
          </div>
          <button onClick={onGoToRegions} className="mt-3 text-xs font-semibold text-[#0F2540] hover:underline cursor-pointer">
            + 관심지역 추가
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0F2540] flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center"><Bell className="w-3.5 h-3.5" /></span>
              알림 설정
            </h3>
            <button onClick={onGoToNotify} className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">중요한 재난 정보와 가족의 안전 알림을 받아보세요.</p>
          <ul className="space-y-2.5 text-xs">
            {[
              ["가족 안전확인 이메일", draft.emailNotifyEnabled],
              ["재난 알림", draft.disasterNotifyEnabled],
              ["내 제보 상태변경", draft.reportNotifyEnabled],
            ].map(([label, val]) => (
              <li key={label} className="flex items-center justify-between">
                <span className="text-slate-600">{label}</span>
                <span className={`inline-block w-8 h-[18px] rounded-full relative ${val === "Y" ? "bg-[#0F2540]" : "bg-slate-200"}`}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition ${val === "Y" ? "right-0.5" : "left-0.5"}`} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showPasswordModal && <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

function PasswordChangeModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    try {
      await authFetch("/api/mypage/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      alert("비밀번호가 변경되었습니다.");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#0F2540]">비밀번호 변경</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              required
            />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
          >
            {saving ? "변경 중..." : "변경하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- 가족 관리 --------------------------------------------------------------

function FamilyTab({ families, familiesLoading, onChanged, latestStatusFor }) {
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [relationType, setRelationType] = useState("가족");
  const [requestingSafetyId, setRequestingSafetyId] = useState(null);

  const loadRequests = () => {
    setLoading(true);
    setError("");
    Promise.all([authFetch("/api/family/sent"), authFetch("/api/family/received")])
      .then(([s, r]) => {
        setSent(s);
        setReceived(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadRequests, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await authFetch(`/api/family/search?loginId=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetLoginId) => {
    setError("");
    try {
      await authFetch("/api/family/request", {
        method: "POST",
        body: JSON.stringify({ targetLoginId, relationType }),
      });
      setSearchResults([]);
      setSearchQuery("");
      loadRequests();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const accept = async (relationId) => {
    try {
      await authFetch(`/api/family/${relationId}/accept`, { method: "PATCH" });
      loadRequests();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (relationId) => {
    try {
      await authFetch(`/api/family/${relationId}`, { method: "DELETE" });
      loadRequests();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  // 이 사람 한 명한테만 바로 안전확인 요청 (일반 요청, 특정 사건과 무관)
  const requestSafetyCheck = async (targetMemberId) => {
    setRequestingSafetyId(targetMemberId);
    try {
      await authFetch("/api/safety-checks", {
        method: "POST",
        body: JSON.stringify({ targetMemberIds: [targetMemberId], incidentId: null }),
      });
      alert("안전확인 요청을 보냈습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestingSafetyId(null);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>;

  const pendingSentCount = sent.filter((s) => s.status === "PENDING").length;

  // 화면에 한 목록으로 합쳐서 보여줄 항목들: 등록된 가족(ACCEPTED) + 내가 보낸 대기중 요청(PENDING)
  const combinedList = [
    ...families.map((f) => ({ ...f, kind: "ACCEPTED" })),
    ...sent.filter((s) => s.status === "PENDING").map((s) => ({ ...s, kind: "PENDING_SENT" })),
  ];

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div>
        <h2 className="text-xl font-extrabold text-[#0F2540]">가족 관리</h2>
        <p className="text-sm text-slate-500">가족을 등록하고 안전확인 요청을 보낼 수 있습니다.</p>
      </div>

      {/* 통계 카드 2개 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">등록된 가족</p>
            <p className="text-xl font-extrabold text-[#0F2540]">{families.length}명</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">대기 중인 요청</p>
            <p className="text-xl font-extrabold text-[#0F2540]">{received.length}건</p>
          </div>
        </div>
      </div>

      {/* 나한테 온 요청 - 수락 필요 (실사용에 꼭 필요한 부분이라 별도로 눈에 띄게) */}
      {received.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-5">
          <h3 className="font-bold text-[#0F2540] mb-3">나한테 온 요청 - 수락 대기</h3>
          <ul className="space-y-2">
            {received.map((r) => (
              <li key={r.relationId} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-700">
                  {r.familyMemberName} <span className="text-slate-400">({r.familyMemberLoginId})</span> · {r.relationType}(으)로 등록 요청
                </span>
                <button
                  onClick={() => accept(r.relationId)}
                  className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 cursor-pointer"
                >
                  수락
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 가족 추가하기 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-[#0F2540] mb-1 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center"><UserPlus className="w-4 h-4" /></span>
          가족 추가하기
        </h3>
        <p className="text-xs text-slate-400 mb-3 ml-9">함께할 가족의 로그인 ID를 검색하여 가족 등록 요청을 보낼 수 있습니다.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="상대방 로그인ID를 입력하세요"
              className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
            />
            {(searchQuery || searchResults.length > 0) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 text-sm focus:outline-none focus:border-[#0F2540]"
          >
            {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="text-sm font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-lg px-4 disabled:opacity-50 cursor-pointer"
          >
            검색
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">검색 결과</p>
            <ul className="space-y-2">
              {searchResults.map((m) => (
                <li key={m.memberId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-500">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{m.name} ({m.loginId})</span>
                  </div>
                  <button
                    onClick={() => sendRequest(m.loginId)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> 가족 요청 보내기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 등록된 가족 + 보낸 요청(대기중) 통합 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#0F2540]">등록된 가족 {families.length > 0 && `${families.length}명`}</h3>
        </div>
        {familiesLoading ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : combinedList.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 가족이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {combinedList.map((f) => {
              const isPending = f.kind === "PENDING_SENT";
              const status = !isPending ? latestStatusFor(f.familyMemberId) : null;
              return (
                <li key={f.relationId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-700">
                          {f.familyMemberName} <span className="text-slate-400 font-normal">({f.familyMemberLoginId})</span>
                        </span>
                        {isPending ? (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">대기중</span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">가족</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {f.relationType} · {formatDateTime(f.createdAt)} {isPending ? "요청" : "등록"}
                        {f.familyMemberPhone && ` · ${f.familyMemberPhone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isPending && status && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SAFETY_STATUS_STYLE[status]}`}>
                        {SAFETY_STATUS_LABEL[status]}
                      </span>
                    )}
                    {isPending ? (
                      <button
                        onClick={() => remove(f.relationId)}
                        className="text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 cursor-pointer"
                      >
                        요청 취소
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => requestSafetyCheck(f.familyMemberId)}
                          disabled={requestingSafetyId === f.familyMemberId}
                          className="flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> 안전확인 요청
                        </button>
                        <button
                          onClick={() => remove(f.relationId)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 안내 박스 */}
      <div className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
        <h3 className="font-bold text-[#0F2540] mb-2">가족 관리 안내</h3>
        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
          <li>가족 등록은 상대방의 동의(수락)가 필요합니다.</li>
          <li>등록된 가족에게는 언제든지 안전확인 요청을 보낼 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}


// ---- 안전확인 이력 --------------------------------------------------------------

// 상태별 아이콘 + 색이 있는 배지 (보낸/받은 요청 표에서 공용으로 사용)
function SafetyStatusBadge({ status }) {
  const Icon = SAFETY_STATUS_ICON[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${SAFETY_STATUS_STYLE[status] || "bg-slate-100 text-slate-500"}`}>
      <Icon className="w-3 h-3 shrink-0" />{SAFETY_STATUS_LABEL[status] || status}
    </span>
  );
}

const SAFETY_HISTORY_FILTERS = [
  { key: "all", label: "전체" },
  { key: "sent", label: "보낸 요청" },
  { key: "received", label: "받은 요청" },
];

function SafetyTab({ sentChecks, receivedChecks, families, onChanged }) {
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const respond = async (checkId, status) => {
    try {
      await authFetch(`/api/safety-checks/${checkId}/respond`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  // 상대방 id로 가족 관계 라벨(형제자매/친구 등)을 찾아 이름 아래 보조 텍스트로 표시
  const relationOf = (memberId) => families.find((f) => f.familyMemberId === memberId)?.relationType;

  const showSent = filter !== "received";
  const showReceived = filter !== "sent";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#0F2540] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" /> 안전확인 이력
        </h2>
        <p className="text-sm text-slate-500 mt-1">가족과 지인에게 보낸 요청과 받은 요청을 확인할 수 있습니다.</p>
      </div>

      <div className="flex gap-2">
        {SAFETY_HISTORY_FILTERS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`text-sm font-bold px-4 py-2 rounded-full transition cursor-pointer ${
              filter === t.key ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {showSent && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#0F2540]">내가 보낸 요청</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">내가 보낸 안전확인 요청 내역입니다.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">총 {sentChecks.length}건</span>
          </div>

          {sentChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
              <FileText className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">아직 보낸 안전확인 요청이 없어요.</p>
              <p className="text-xs text-slate-300 mt-0.5">가족이나 지인에게 안전 여부를 확인해보세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[28%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 tracking-wide">
                    <th className="pl-[70px] pr-5 py-3 align-middle text-left">대상</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">요청 시간</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">상태</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">응답 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {sentChecks.map((c) => (
                    <tr key={c.checkId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                      <td className="px-7 py-3 align-middle">
                        <div className="flex items-center justify-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {c.targetMemberName} <span className="text-xs font-medium text-slate-400">({relationOf(c.targetMemberId) || "지인"})</span>
                            </p>
                            {c.incidentTitle && (
                              <p className="text-[11px] text-slate-400 truncate">{c.incidentTitle}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{formatDateTimeFull(c.requestedAt)}</td>
                      <td className="px-5 py-3 align-middle text-center whitespace-nowrap"><div className="flex justify-center"><SafetyStatusBadge status={c.status} /></div></td>
                      <td className="px-5 py-3 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{c.confirmedAt ? formatDateTimeFull(c.confirmedAt) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showReceived && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#0F2540]">내가 받은 요청</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">다른 사람이 나에게 보낸 안전확인 요청 내역입니다.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">총 {receivedChecks.length}건</span>
          </div>

          {receivedChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
              <Users className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">아직 받은 안전확인 요청이 없어요.</p>
              <p className="text-xs text-slate-300 mt-0.5">요청이 오면 여기서 확인하고 응답할 수 있어요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[28%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 tracking-wide">
                    <th className="pl-[70px] pr-5 py-3 align-middle text-left">요청자</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">요청 시간</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">상태</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedChecks.map((c) => (
                    <tr key={c.checkId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                      <td className="px-7 py-3 align-middle">
                        <div className="flex items-center justify-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {c.requesterName} <span className="text-xs font-medium text-slate-400">({relationOf(c.requesterId) || "지인"})</span>
                            </p>
                            {c.incidentTitle && (
                              <p className="text-[11px] text-slate-400 truncate">{c.incidentTitle}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{formatDateTimeFull(c.requestedAt)}</td>
                      <td className="px-5 py-3 align-middle text-center whitespace-nowrap"><div className="flex justify-center"><SafetyStatusBadge status={c.status} /></div></td>
                      <td className="px-5 py-3 align-middle text-center whitespace-nowrap">
                        {c.status === "PENDING" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => respond(c.checkId, "SAFE")}
                              className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> 안전해요
                            </button>
                            <button
                              onClick={() => respond(c.checkId, "HELP")}
                              className="flex items-center gap-1 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 cursor-pointer"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> 도움이 필요해요
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- 관심 지역 --------------------------------------------------------------

// ---- 내 제보 내역 --------------------------------------------------------------

const DISASTER_ICON = {
  화재: Flame,
  침수: Droplets,
  산사태: Mountain,
  강풍: Wind,
  폭염: Thermometer,
  한파: Snowflake,
};

const REPORT_STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "접수 대기" },
  { key: "progress", label: "진행중" },
  { key: "closed", label: "종료" },
];

// 유형별 배지 색상
const DISASTER_TYPE_STYLE = {
  화재: "bg-orange-50 text-orange-600",
  침수: "bg-blue-50 text-blue-600",
  폭염: "bg-rose-50 text-rose-600",
  산사태: "bg-amber-50 text-amber-700",
  강풍: "bg-slate-100 text-slate-600",
  한파: "bg-sky-50 text-sky-600",
};

// 유형별 글자 색상 - 제보 내역 표에서 배지 없이 텍스트만 표시할 때 사용
const DISASTER_TYPE_TEXT_COLOR = {
  화재: "text-orange-600",
  침수: "text-blue-600",
  폭염: "text-rose-600",
  산사태: "text-amber-700",
  강풍: "text-slate-600",
  한파: "text-sky-600",
};

// 위험도 배지 - STAFF 관제판(SEVERITY_COLOR)과 같은 기준(HIGH=빨강/MEDIUM=주황/LOW=파랑)
const SEVERITY_LABEL_KO = { HIGH: "위험도 높음", MEDIUM: "위험도 보통", LOW: "위험도 낮음" };
const SEVERITY_STYLE = {
  HIGH: "bg-red-50 text-red-600",
  MEDIUM: "bg-amber-50 text-amber-600",
  LOW: "bg-blue-50 text-blue-600",
};

// 처리상태별 배지 색상 - 회색 배경 + 흰 글씨로 통일 (홈화면과 같은 상태값 기준)
const REPORT_STATUS_STYLE = {
  RECEIVED: "bg-gray-600 text-white",
  CONFIRMING: "bg-gray-600 text-white",
  RESPONDING: "bg-gray-600 text-white",
  RECOVERING: "bg-gray-600 text-white",
  CLOSED: "bg-gray-600 text-white",
};

// 처리 타임라인 상태 점 색상 (상세보기 모달용)
const REPORT_STATUS_DOT = {
  RECEIVED: "bg-slate-300",
  CONFIRMING: "bg-amber-400",
  RESPONDING: "bg-emerald-400",
  RECOVERING: "bg-sky-400",
  CLOSED: "bg-slate-400",
};

function ReportsTab({ reports, loading, onChanged }) {
  const [incidentInfo, setIncidentInfo] = useState({});
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" | "oldest"
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null); // 사진 확대 모달
  const [detailReportId, setDetailReportId] = useState(null); // 상세보기 모달
  const [detailTimeline, setDetailTimeline] = useState([]);
  const [detailTimelineLoading, setDetailTimelineLoading] = useState(false);
  // 사건에 아직 연결 안 된 제보는 incident.region이 없어서(사건 자체가 없음) 위치가 항상 "-"로 뜸.
  // 제보 자체엔 위경도만 있어서, 카카오 리버스 지오코딩으로 좌표 -> 주소 문자열을 따로 조회해둠.
  const [reportAddresses, setReportAddresses] = useState({});

  useEffect(() => {
    const uniqueIds = [...new Set(reports.filter((r) => r.incidentId).map((r) => r.incidentId))];
    uniqueIds.forEach((id) => {
      if (!incidentInfo[id]) {
        authFetch(`/api/incidents/${id}`)
          .then((data) => setIncidentInfo((prev) => ({ ...prev, [id]: data })))
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  useEffect(() => {
    const targets = reports.filter((r) => !r.incidentId && !reportAddresses[r.reportId]);
    if (targets.length === 0 || !window.kakao?.maps) return;
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      targets.forEach((r) => {
        if (r.latitude == null || r.longitude == null) return;
        geocoder.coord2Address(r.longitude, r.latitude, (result, status) => {
          const addr =
            status === window.kakao.maps.services.Status.OK && result[0]
              ? result[0].road_address?.address_name || result[0].address?.address_name || "주소 확인 불가"
              : "주소 확인 불가";
          setReportAddresses((prev) => ({ ...prev, [r.reportId]: addr }));
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const statusOf = (report) => {
    if (!report.incidentId) return { code: "RECEIVED", label: "접수 대기", style: REPORT_STATUS_STYLE.RECEIVED, group: "pending" };
    const incident = incidentInfo[report.incidentId];
    if (!incident) return { code: "RECEIVED", label: "확인 중...", style: "bg-slate-100 text-slate-400", group: "progress" };
    if (incident.status === "CLOSED") return { code: "CLOSED", label: "종료", style: REPORT_STATUS_STYLE.CLOSED, group: "closed" };
    return {
      code: incident.status,
      label: STATUS_LABEL_KO[incident.status] || incident.status,
      style: REPORT_STATUS_STYLE[incident.status] || REPORT_STATUS_STYLE.RECEIVED,
      group: "progress",
    };
  };

  const q = searchQuery.trim();
  const filtered = reports
    .filter((r) => filter === "all" || statusOf(r).group === filter)
    .filter((r) => {
      if (!q) return true;
      const incident = r.incidentId ? incidentInfo[r.incidentId] : null;
      const haystack = `${incident?.title || ""} ${r.content || ""} ${incident?.region || ""} ${r.disasterType}`;
      return haystack.includes(q);
    });
  const sorted = [...filtered].sort((a, b) =>
    sortOrder === "newest" ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt)
  );

  const countOf = (group) => reports.filter((r) => group === "all" || statusOf(r).group === group).length;

  const openDetail = async (report) => {
    setDetailReportId(report.reportId);
    if (!report.incidentId) {
      setDetailTimeline([]);
      return;
    }
    setDetailTimelineLoading(true);
    try {
      const data = await authFetch(`/api/incidents/${report.incidentId}/timeline`);
      setDetailTimeline(data);
    } catch {
      setDetailTimeline([]);
    } finally {
      setDetailTimelineLoading(false);
    }
  };

  const detailReport = sorted.find((r) => r.reportId === detailReportId) || reports.find((r) => r.reportId === detailReportId);
  const detailIncident = detailReport?.incidentId ? incidentInfo[detailReport.incidentId] : null;
  const detailStatus = detailReport ? statusOf(detailReport) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F2540]">내 제보 내역</h2>
        <p className="text-sm text-slate-500">내가 등록한 현장제보와 처리 상태를 확인할 수 있습니다.</p>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {REPORT_STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition cursor-pointer ${
              filter === key ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {label}
            <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center bg-blue-500 text-white">
              {countOf(key)}
            </span>
          </button>
        ))}

        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3.5 py-2 ml-auto">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제보 제목이나 내용을 검색하세요."
            className="w-full bg-transparent outline-none text-xs placeholder:text-slate-400"
          />
        </div>

        <div className="relative shrink-0">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="appearance-none text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full pl-3.5 pr-8 py-2 outline-none cursor-pointer"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-400 p-5">불러오는 중...</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">해당하는 제보가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 tracking-wide">
                  <th className="px-5 py-4 align-middle">제보 내용</th>
                  <th className="px-4 py-4 align-middle whitespace-nowrap text-center">유형</th>
                  <th className="px-4 py-4 align-middle whitespace-nowrap text-center">등록일시</th>
                  <th className="px-4 py-4 align-middle text-center">위치</th>
                  <th className="px-4 py-4 align-middle whitespace-nowrap text-center">상태</th>
                  <th className="px-5 py-4 align-middle whitespace-nowrap text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const status = statusOf(r);
                  const incident = r.incidentId ? incidentInfo[r.incidentId] : null;
                  const DisasterIcon = DISASTER_ICON[r.disasterType] || Camera;
                  const d = new Date(r.createdAt);
                  const dateLabel = d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
                  const timeLabel = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={r.reportId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition align-middle">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => r.photoUrl && setPreviewPhotoUrl(`http://localhost:8080${r.photoUrl}`)}
                            className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                            aria-label="사진 확대"
                          >
                            {r.photoUrl ? (
                              <img src={`http://localhost:8080${r.photoUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-[#0F2540] truncate">{incident?.title || `${r.disasterType} 제보`}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">#{r.reportId}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5 max-w-[260px]">{r.content || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${DISASTER_TYPE_TEXT_COLOR[r.disasterType] || "text-slate-600"}`}>
                          <DisasterIcon className="w-3.5 h-3.5 shrink-0" />{r.disasterType}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>
                            <span className="block tabular-nums">{dateLabel}</span>
                            <span className="block tabular-nums text-slate-400">{timeLabel}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle max-w-[190px]">
                        <span className="flex items-start justify-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                          <span className="leading-snug">{incident?.region || reportAddresses[r.reportId] || "주소 확인 중..."}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-center">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${status.style}`}>{status.label}</span>
                      </td>
                      <td className="px-5 py-4 align-middle text-center whitespace-nowrap">
                        <button
                          onClick={() => openDetail(r)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 hover:text-blue-600 transition cursor-pointer"
                        >
                          상세보기 <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 첨부사진 확대 미리보기 모달 */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white cursor-pointer"
              aria-label="닫기"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewPhotoUrl} alt="첨부사진" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* 상세보기 모달 - 제보 내용 + 처리 타임라인 */}
      {detailReportId && detailReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setDetailReportId(null)}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="font-extrabold text-[#0F2540]">제보 상세</h2>
              <button onClick={() => setDetailReportId(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${detailStatus.style}`}>{detailStatus.label}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${DISASTER_TYPE_STYLE[detailReport.disasterType] || "bg-slate-100 text-slate-600"}`}>
                  {detailReport.disasterType}
                </span>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">#{detailReport.reportId}</span>
              </div>

              {detailReport.photoUrl && (
                <img
                  src={`http://localhost:8080${detailReport.photoUrl}`}
                  alt=""
                  className="w-full h-44 object-cover rounded-xl cursor-pointer"
                  onClick={() => setPreviewPhotoUrl(`http://localhost:8080${detailReport.photoUrl}`)}
                />
              )}

              <div>
                <h3 className="font-bold text-[#0F2540] text-sm mb-1">{detailIncident?.title || `${detailReport.disasterType} 제보`}</h3>
                <p className="text-sm text-slate-600 leading-6">{detailReport.content || "등록된 내용이 없습니다."}</p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {formatDateTimeFull(detailReport.createdAt)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {detailIncident?.region || reportAddresses[detailReport.reportId] || "주소 확인 중..."}
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#0F2540] mb-2">처리 타임라인</h4>
                {!detailReport.incidentId ? (
                  <p className="text-xs text-slate-400">아직 담당자 확인 전입니다.</p>
                ) : detailTimelineLoading ? (
                  <p className="text-xs text-slate-400">불러오는 중...</p>
                ) : detailTimeline.length === 0 ? (
                  <p className="text-xs text-slate-400">아직 기록이 없습니다.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailTimeline.map((log, i) => (
                      <div key={log.logId} className="flex gap-2">
                        <div className="flex flex-col items-center shrink-0">
                          <span className={`w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm ${REPORT_STATUS_DOT[log.newStatus] || "bg-slate-400"}`} />
                          {i < detailTimeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                        </div>
                        <div className="min-w-0 flex-1 rounded-lg border border-slate-100 px-2.5 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#0F2540]">{STATUS_LABEL_KO[log.newStatus] || log.newStatus}</span>
                            <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.changedAt)}</span>
                          </div>
                          {log.memo && <div className="text-xs text-slate-600 mt-0.5">{log.memo}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function RegionsTab({ regions, onChanged, member, onOpenShelters }) {
  const [selectedLabel, setSelectedLabel] = useState("관심지역");
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [incidentListOpen, setIncidentListOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [incidentTimelines, setIncidentTimelines] = useState({});
  const [incidentTimelineLoading, setIncidentTimelineLoading] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapOverlaysRef = useRef([]);
  const searchInputRef = useRef(null);

  // 처음 로딩되면 대표 지역(없으면 첫번째)을 자동 선택
  useEffect(() => {
    if (regions.length === 0) {
      setSelectedRegionId(null);
      return;
    }
    if (!regions.some((r) => r.memberRegionId === selectedRegionId)) {
      const primary = regions.find((r) => r.isPrimary === "Y") || regions[0];
      setSelectedRegionId(primary.memberRegionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  const selectedRegion = regions.find((r) => r.memberRegionId === selectedRegionId) || null;

  // 등록된 관심지역을 지도에 표시.
  // 기본 마커 위에 "우리집 / 부모님댁 / 회사 / 관심지역" 라벨을 CustomOverlay로 함께 보여준다.
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const withCoords = regions.filter(
      (r) => r.latitude != null && r.longitude != null
    );
    if (withCoords.length === 0) return;

    let resizeObserver;
    let disposed = false;

    window.kakao.maps.load(() => {
      if (disposed || !mapRef.current) return;

      // 이전 마커 / 라벨 제거
      mapOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      mapOverlaysRef.current = [];

      const selected =
        withCoords.find((r) => r.memberRegionId === selectedRegionId) ||
        withCoords.find((r) => r.isPrimary === "Y") ||
        withCoords[0];

      const center = new window.kakao.maps.LatLng(
        Number(selected.latitude),
        Number(selected.longitude)
      );

      const map = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 6,
      });
      mapInstanceRef.current = map;
      map.setDraggable(true);
      map.setZoomable(true);

      const escapeHtml = (value = "") =>
        String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const labelMeta = (label) => {
        if (label === "우리집") return { symbol: "⌂", bg: "#1687F8", fg: "#ffffff" };
        if (label === "부모님댁") return { symbol: "♥", bg: "#22A447", fg: "#ffffff" };
        if (label === "회사") return { symbol: "▦", bg: "#183B67", fg: "#ffffff" };
        if (label === "가족 보호") return { symbol: "♥", bg: "#22A447", fg: "#ffffff" };
        return { symbol: "●", bg: "#1687F8", fg: "#ffffff" };
      };

      withCoords.forEach((r) => {
        const position = new window.kakao.maps.LatLng(
          Number(r.latitude),
          Number(r.longitude)
        );

        const marker = new window.kakao.maps.Marker({ position, map });
        window.kakao.maps.event.addListener(marker, "click", () =>
          setSelectedRegionId(r.memberRegionId)
        );
        mapOverlaysRef.current.push(marker);

        const meta = labelMeta(r.regionLabel);
        const label = escapeHtml(r.regionLabel || "관심지역");
        const active = r.memberRegionId === selectedRegionId;

        const content = `
          <button
            type="button"
            data-region-id="${r.memberRegionId}"
            style="
              display:flex;
              align-items:center;
              gap:6px;
              padding:6px 10px 6px 6px;
              border:${active ? "2px solid #0F2540" : "1px solid #dbe5f0"};
              border-radius:999px;
              background:#ffffff;
              box-shadow:0 3px 10px rgba(15,37,64,.15);
              color:#0F2540;
              font-size:11px;
              font-weight:800;
              white-space:nowrap;
              cursor:pointer;
              font-family:Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            "
          >
            <span style="
              width:24px;
              height:24px;
              border-radius:999px;
              display:flex;
              align-items:center;
              justify-content:center;
              background:${meta.bg};
              color:${meta.fg};
              font-size:13px;
              font-weight:900;
            ">${meta.symbol}</span>
            <span>${label}</span>
          </button>
        `;

        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          content,
          yAnchor: 2.15,
          zIndex: active ? 10 : 3,
        });
        overlay.setMap(map);
        mapOverlaysRef.current.push(overlay);
      });

      // CustomOverlay 내부 버튼 클릭 처리
      const onOverlayClick = (event) => {
        const button = event.target.closest?.("[data-region-id]");
        if (!button || !mapRef.current?.contains(button)) return;
        const id = Number(button.dataset.regionId);
        setSelectedRegionId(Number.isNaN(id) ? button.dataset.regionId : id);
      };
      mapRef.current.addEventListener("click", onOverlayClick);

      resizeObserver = new ResizeObserver(() => {
        map.relayout();
        map.setCenter(center);
      });
      resizeObserver.observe(mapRef.current);

      requestAnimationFrame(() => {
        map.relayout();
        map.setCenter(center);
      });

      // cleanup에서 참조하기 위해 저장
      map.__safeTraceOverlayClick = onOverlayClick;
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (mapRef.current && mapInstanceRef.current?.__safeTraceOverlayClick) {
        mapRef.current.removeEventListener(
          "click",
          mapInstanceRef.current.__safeTraceOverlayClick
        );
      }
      mapOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      mapOverlaysRef.current = [];
    };
  }, [regions, selectedRegionId]);

  // 선택된 지역 좌표 근처의 진행중인 재난 조회 ("현재 상황" 패널)
  useEffect(() => {
    if (!selectedRegion?.latitude || !selectedRegion?.longitude) {
      setNearbyIncidents([]);
      return;
    }
    setNearbyLoading(true);
    authFetch(`/api/incidents/nearby?lat=${selectedRegion.latitude}&lng=${selectedRegion.longitude}&radiusKm=5`)
      .then(setNearbyIncidents)
      .catch(() => setNearbyIncidents([]))
      .finally(() => setNearbyLoading(false));
  }, [selectedRegion?.memberRegionId, selectedRegion?.latitude, selectedRegion?.longitude]);

  // 목록에서 특정 사건을 눌러 상세보기를 열 때 - 그 사건의 처리 타임라인(조치사항)만 조회 (이미 불러온 건 재요청 안 함)
  // /api/incidents/{id}/timeline은 로그인만 하면 누구나 볼 수 있는 엔드포인트라 시민도 그대로 재사용
  useEffect(() => {
    if (!selectedIncidentId || incidentTimelines[selectedIncidentId]) return;
    setIncidentTimelineLoading(true);
    authFetch(`/api/incidents/${selectedIncidentId}/timeline`)
      .then((logs) => setIncidentTimelines((prev) => ({ ...prev, [selectedIncidentId]: logs })))
      .catch(() => setIncidentTimelines((prev) => ({ ...prev, [selectedIncidentId]: [] })))
      .finally(() => setIncidentTimelineLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId]);

  // 선택된 지역의 현재 날씨(기상청) + 대기질(에어코리아) + 근처 대피시설(민방위대피시설)
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [airQuality, setAirQuality] = useState(null);
  const [airQualityLoading, setAirQualityLoading] = useState(false);
  const [shelters, setShelters] = useState([]);
  const [sheltersLoading, setSheltersLoading] = useState(false);
  const [disasterMessages, setDisasterMessages] = useState([]);
  const [disasterMessagesLoading, setDisasterMessagesLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);

  const refreshCurrentStatus = (region) => {
    if (!region?.latitude || !region?.longitude) {
      setWeather(null);
      setAirQuality(null);
      setShelters([]);
      setDisasterMessages([]);
      return;
    }
    const lat = region.latitude;
    const lng = region.longitude;

    setWeatherLoading(true);
    authFetch(`/api/environment/weather?lat=${lat}&lng=${lng}`)
      .then(setWeather)
      .catch(() => setWeather({ available: false }))
      .finally(() => setWeatherLoading(false));

    // 대기질(시/도 단위)/대피시설/긴급재난문자 셋 다 행정구역명이 필요해서
    // 좌표 -> 행정구역명 변환(카카오 리버스 지오코딩)을 한 번만 하고 같이 씀
    if (window.kakao?.maps) {
      setAirQualityLoading(true);
      setSheltersLoading(true);
      setDisasterMessagesLoading(true);
      window.kakao.maps.load(() => {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2RegionCode(lng, lat, (result, status) => {
          const regionCode = status === window.kakao.maps.services.Status.OK
            ? result.find((r) => r.region_type === "H") || result[0]
            : null;
          const sido = regionCode?.region_1depth_name;
          const gu = regionCode?.region_2depth_name;

          if (!sido) {
            setAirQuality({ available: false });
            setAirQualityLoading(false);
          } else {
            authFetch(`/api/environment/air-quality?sido=${encodeURIComponent(sido)}`)
              .then(setAirQuality)
              .catch(() => setAirQuality({ available: false }))
              .finally(() => setAirQualityLoading(false));
          }

          if (!gu) {
            setShelters([]);
            setSheltersLoading(false);
            setDisasterMessages([]);
            setDisasterMessagesLoading(false);
          } else {
            // "중구", "동구"처럼 여러 시/도에 같은 이름의 구가 있어서, 시도명까지 같이 넣어 좁혀줌.
            // 근데 "성남시 분당구"처럼 시+구가 겹친 주소는 표기가 API마다 다를 수 있어서,
            // 좁힌 검색이 0건이면 구 이름만으로 한 번 더 재시도(fallback)함.
            const guQuery = sido ? `${sido} ${gu}` : gu;
            authFetch(`/api/environment/shelters?guName=${encodeURIComponent(guQuery)}&lat=${lat}&lng=${lng}&limit=3`)
              .then((data) => {
                if (data.length > 0) return data;
                return authFetch(`/api/environment/shelters?guName=${encodeURIComponent(gu)}&lat=${lat}&lng=${lng}&limit=3`);
              })
              .then(setShelters)
              .catch(() => setShelters([]))
              .finally(() => setSheltersLoading(false));

            // 실제 발송된 긴급재난문자 - 행정안전부(재난안전데이터공유플랫폼)
            authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(guQuery)}&limit=5`)
              .then((data) => {
                if (data.length > 0) return data;
                return authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(gu)}&limit=5`);
              })
              .then(setDisasterMessages)
              .catch(() => setDisasterMessages([]))
              .finally(() => setDisasterMessagesLoading(false));
          }
        });
      });
    }
    setLastUpdatedAt(new Date());
  };

  useEffect(() => {
    refreshCurrentStatus(selectedRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion?.memberRegionId, selectedRegion?.latitude, selectedRegion?.longitude]);

  // 입력창에 타이핑하면 300ms 후에 카카오 장소검색(키워드검색)으로 후보 목록을 띄움.
  // Places 검색 결과는 x(경도)/y(위도)를 바로 주기 때문에, 목록에서 고르는 즉시
  // 별도 지오코딩 없이 바로 등록까지 끝낼 수 있음.
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (!window.kakao?.maps) return;

    setSearchLoading(true);
    const timer = setTimeout(() => {
      window.kakao.maps.load(() => {
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(searchQuery, (data, status) => {
          setSearchLoading(false);
          if (status === window.kakao.maps.services.Status.OK) {
            setSuggestions(data.slice(0, 6));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 카카오 실시간 검색 선택, 다음 우편번호 검색 선택 둘 다 여기로 모여서 등록됨
  const submitRegion = async (regionName, lat, lng) => {
    setError("");
    setGeocoding(true);
    try {
      await authFetch("/api/mypage/regions", {
        method: "POST",
        body: JSON.stringify({
          regionName,
          latitude: lat,
          longitude: lng,
          regionLabel: selectedLabel,
          isPrimary: regions.length === 0,
        }),
      });
      setSearchQuery("");
      setSuggestions([]);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setGeocoding(false);
    }
  };

  const selectSuggestion = (place) => {
    setShowSuggestions(false);
    submitRegion(place.road_address_name || place.address_name, Number(place.y), Number(place.x));
  };

  // 다음(Daum) 우편번호 검색 팝업 - 정확한 도로명/지번 주소를 직접 찾고 싶을 때를 위한 대안 경로.
  // 카카오 실시간 검색(장소/건물명 위주)과 달리 정확한 지번 주소 검색에 강함.
  const openAddressSearch = () => {
    setError("");
    if (!window.daum || !window.daum.Postcode) {
      setError("주소 검색 서비스를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        if (!window.kakao?.maps) {
          setError("지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        setGeocoding(true);
        window.kakao.maps.load(() => {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.addressSearch(fullAddress, (result, status) => {
            if (status !== window.kakao.maps.services.Status.OK || !result[0]) {
              setGeocoding(false);
              setError("선택한 주소의 좌표를 찾지 못했습니다. 다시 검색해주세요.");
              return;
            }
            submitRegion(fullAddress, Number(result[0].y), Number(result[0].x));
          });
        });
      },
    }).open({ q: searchQuery });
  };

  const removeRegion = async (memberRegionId) => {
    try {
      await authFetch(`/api/mypage/regions/${memberRegionId}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const setPrimary = async (memberRegionId) => {
    try {
      await authFetch(`/api/mypage/regions/${memberRegionId}/primary`, { method: "PATCH" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4 items-start">
        <div className="space-y-4">
        {/* 관심 지역 추가 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-[#0F2540] mb-1">관심 지역 추가</h3>
          <p className="text-xs text-slate-400 mb-4">등록한 지역의 재난 알림을 우선적으로 받습니다.</p>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

          <div className="relative mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-[#0F2540]">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="지역, 건물명, 주소로 검색"
                  className="flex-1 text-sm outline-none"
                  disabled={geocoding}
                />
                {searchLoading && <span className="text-[10px] text-slate-300 shrink-0">검색중</span>}
                {searchQuery && !searchLoading && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setSuggestions([]); }}
                    className="text-slate-300 hover:text-slate-500 shrink-0 cursor-pointer"
                    aria-label="검색어 지우기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={openAddressSearch}
                disabled={geocoding}
                className="text-sm font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-lg px-4 py-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                검색
              </button>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-[76px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => selectSuggestion(place)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-[#0F2540] truncate">{place.place_name}</p>
                    <p className="text-xs text-slate-400 truncate">{place.road_address_name || place.address_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 shrink-0">라벨</span>
            {REGION_LABELS.map(({ value, icon: Icon }) => {
              const labelIconTone =
                value === "우리집"
                  ? "bg-blue-100 text-blue-600 ring-blue-200"
                  : value === "부모님댁" || value === "가족 보호"
                    ? "bg-emerald-100 text-emerald-600 ring-emerald-200"
                    : value === "회사"
                      ? "bg-indigo-100 text-indigo-700 ring-indigo-200"
                      : "bg-slate-200 text-[#0F2540] ring-slate-300";

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedLabel(value)}
                  className={`group flex items-center gap-1.5 text-xs font-semibold rounded-full pr-3 pl-1.5 py-1.5 cursor-pointer transition-all ${
                    selectedLabel === value
                      ? "bg-[#0F2540] text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center ring-1 transition ${
                      selectedLabel === value
                        ? "bg-white/15 text-white ring-white/20"
                        : labelIconTone
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        {/* 내 관심 지역 - 시안과 동일한 구성: 제목/설명/개수 + 큰 지도 + 지역목록 + 추가 버튼 */}
        {regions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-sm text-slate-400">등록된 관심지역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            {/* 상단 제목 영역 */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="font-extrabold text-[#0F2540] text-[15px] whitespace-nowrap">
                  내 관심 지역
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  등록한 지역을 클릭하면 상세한 정보를 확인할 수 있습니다.
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                {regions.length}개 지역
              </span>
            </div>

            {/* 지도 + 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,0.95fr)_minmax(280px,1.2fr)] gap-3 items-stretch">
              {/* 지도 - 기존보다 넓고 높게 */}
              <div className="relative rounded-xl overflow-hidden border border-slate-100 bg-slate-100 min-h-[265px]">
                <div ref={mapRef} className="absolute inset-0 w-full h-full" />
              </div>

              {/* 관심지역 목록 */}
              <div className="flex flex-col min-h-[265px]">
                <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 max-h-[217px]">
                  {regions.map((r) => {
                    const LabelIcon =
                      REGION_LABELS.find((l) => l.value === r.regionLabel)?.icon || MapPin;
                    const active = r.memberRegionId === selectedRegionId;

                    const iconTone =
                      r.regionLabel === "우리집"
                        ? "bg-blue-100 text-blue-600 ring-1 ring-blue-200 shadow-sm"
                        : r.regionLabel === "부모님댁" || r.regionLabel === "가족 보호"
                          ? "bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 shadow-sm"
                          : r.regionLabel === "회사"
                            ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 shadow-sm"
                            : "bg-slate-200 text-[#0F2540] ring-1 ring-slate-300 shadow-sm";

                    return (
                      <div
                        key={r.memberRegionId}
                        onClick={() => setSelectedRegionId(r.memberRegionId)}
                        className={`group rounded-xl border px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all ${
                          active
                            ? "border-[#0F2540] shadow-[0_0_0_1px_rgba(15,37,64,0.06)] bg-white"
                            : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/20"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconTone}`}>
                          <LabelIcon className="w-4.5 h-4.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-extrabold text-[#0F2540] truncate">
                              {r.regionLabel || "관심지역"}
                            </span>
                            {r.isPrimary === "Y" && (
                              <span className="shrink-0 text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                대표
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {r.regionName}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {r.isPrimary !== "Y" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimary(r.memberRegionId);
                              }}
                              className="text-[9px] font-bold text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full px-2 py-1 cursor-pointer transition"
                            >
                              대표설정
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRegion(r.memberRegionId);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition"
                            aria-label="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 시안의 하단 관심지역 추가 버튼 */}
                <button
                  type="button"
                  onClick={openAddressSearch}
                  disabled={geocoding}
                  className="mt-3 h-11 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-base leading-none font-light">＋</span>
                  관심 지역 추가하기
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* 관심 지역 현재 상황 - 날씨/재난특보/대기질 3칸 타일 */}
        <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-1.5 mb-3 whitespace-nowrap">
            <h4 className="font-bold text-[#0F2540] text-[12px] whitespace-nowrap shrink-0">관심 지역 현재 상황</h4>
            {regions.length > 0 && selectedRegion && (
              <div className="flex items-center gap-1 min-w-0 shrink-0">
                <span className="text-[9px] text-slate-400 whitespace-nowrap leading-none">
                  {lastUpdatedAt
                    ? `${lastUpdatedAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} ${lastUpdatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => refreshCurrentStatus(selectedRegion)}
                  disabled={weatherLoading || airQualityLoading || sheltersLoading}
                  className="text-slate-400 hover:text-[#0F2540] p-0.5 cursor-pointer disabled:opacity-40 shrink-0"
                  aria-label="새로고침"
                >
                  <RefreshCw className={`w-3 h-3 ${(weatherLoading || airQualityLoading || sheltersLoading) ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}
          </div>

          {regions.length === 0 || !selectedRegion ? (
            <p className="text-xs text-slate-400">지역을 등록하면 현재 상황을 볼 수 있어요.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <button
                  type="button"
                  onClick={() => setRegionPickerOpen((v) => !v)}
                  className="w-full flex items-center gap-2.5 border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 cursor-pointer"
                >
                  {(() => {
                    const SelIcon = REGION_LABELS.find((l) => l.value === selectedRegion.regionLabel)?.icon || MapPin;
                    return (
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                        <SelIcon className="w-4 h-4 text-white" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0 text-left flex items-baseline gap-2">
                    <span className="text-sm font-extrabold text-[#0F2540] shrink-0">{selectedRegion.regionLabel}</span>
                    <span className="text-xs text-slate-400 truncate">{selectedRegion.regionName}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${regionPickerOpen ? "-rotate-90" : "rotate-90"}`} />
                </button>

                {regionPickerOpen && regions.length > 1 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {regions.map((r) => {
                      const Icon = REGION_LABELS.find((l) => l.value === r.regionLabel)?.icon || MapPin;
                      return (
                        <button
                          key={r.memberRegionId}
                          type="button"
                          onClick={() => { setSelectedRegionId(r.memberRegionId); setRegionPickerOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                        >
                          <Icon className="w-4 h-4 text-[#0F2540] shrink-0" />
                          <div className="text-left min-w-0">
                            <p className="text-sm font-semibold text-[#0F2540] truncate">{r.regionLabel}</p>
                            <p className="text-[11px] text-slate-400 truncate">{r.regionName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 날씨 - 위쪽 가로 풀폭: 칸을 나눠 쓰지 않아서 글씨를 넉넉하게 키울 수 있음 */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 mb-2 flex items-center justify-center gap-3 text-center">
                {(() => {
                  const WeatherIcon =
                    weather?.precipitationType?.includes("눈") ? Snowflake :
                    weather?.precipitationType?.includes("비") || weather?.precipitationType?.includes("빗") ? Droplets :
                    weather?.precipitationType === "맑음" ? Sun : Cloud;
                  return weatherLoading ? (
                    <p className="text-xs text-slate-300">불러오는 중...</p>
                  ) : weather?.available ? (
                    <>
                      <WeatherIcon className="w-9 h-9 text-amber-500 shrink-0" />
                      <div className="shrink-0 text-left">
                        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                          <span className="text-2xl font-bold text-[#0F2540] leading-none whitespace-nowrap">{weather.temperature}°C</span>
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">{weather.precipitationType}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">습도 {weather.humidity}% · 풍속 {weather.windSpeed}m/s</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-300">날씨 정보없음</p>
                  );
                })()}
              </div>

              {/* 재난특보 / 대기질 - 아래쪽 2칸: 3칸일 때보다 칸당 폭이 넓어서 글씨를 줄이지 않아도 됨 */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center ${
                    nearbyIncidents.length > 0 ? "cursor-pointer hover:bg-slate-100 transition-colors" : ""
                  }`}
                  onClick={() => nearbyIncidents.length > 0 && setIncidentListOpen(true)}
                >
                  <p className="text-xs text-slate-400 mb-1.5">재난 특보</p>
                  {nearbyLoading ? (
                    <p className="text-xs text-slate-300">...</p>
                  ) : nearbyIncidents.length === 0 ? (
                    <>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-[14px] font-bold text-emerald-600 whitespace-nowrap">특보 없음</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">현재 특보가 없습니다.</p>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <span className="text-[14px] font-bold text-red-600 whitespace-nowrap">진행중 {nearbyIncidents.length}건</span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
                  <p className="text-xs text-slate-400 mb-1.5">대기질</p>
                  {airQualityLoading ? (
                    <p className="text-xs text-slate-300">...</p>
                  ) : airQuality?.available ? (
                    <>
                      {(() => {
                        const good = airQuality.pm25Grade === "좋음" || airQuality.pm25Grade === "보통";
                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${good ? "bg-emerald-100" : "bg-amber-100"}`}>
                              <Smile className={`w-4 h-4 ${good ? "text-emerald-600" : "text-amber-600"}`} />
                            </div>
                            <span className={`text-[14px] font-bold whitespace-nowrap ${good ? "text-emerald-600" : "text-amber-600"}`}>
                              {airQuality.pm25Grade}
                            </span>
                          </div>
                        );
                      })()}
                      <p className="text-[11px] text-slate-400 mt-1.5">PM2.5 {airQuality.pm25} µg/m³</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-300">정보없음</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {regions.length > 0 && selectedRegion && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h4 className="font-bold text-[#0F2540] text-sm mb-3">최근 안전·재난 소식</h4>
            {disasterMessagesLoading ? (
              <p className="text-xs text-slate-400">불러오는 중...</p>
            ) : disasterMessages.length === 0 ? (
              <p className="text-xs text-slate-400">최근 발송된 재난문자가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {disasterMessages.slice(0, 5).map((msg, i) => {
                  const Icon = DISASTER_ICON[msg.disasterType] || AlertTriangle;
                  return (
                    <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50">
                      <Icon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-red-600 shrink-0">{msg.disasterType}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{msg.createdAt}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-snug">{msg.message}</p>
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

      {/* 주변 대피시설 - 선택한 지역 기준 (독립 카드, 전체너비) */}
      {regions.length > 0 && selectedRegion && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h4 className="font-extrabold text-[#0F2540] text-[15px]">주변 대피시설</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {selectedRegion.regionLabel} 주변 가까운 대피시설입니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenShelters?.(selectedRegion.memberRegionId)}
              className="text-[11px] font-semibold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              더보기
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {sheltersLoading ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400">주변 대피시설을 불러오는 중...</p>
            </div>
          ) : shelters.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <Building2 className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">근처 대피시설 정보를 찾지 못했습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {shelters.map((s, i) => {
                const distance =
                  s.distanceM >= 1000
                    ? `${(s.distanceM / 1000).toFixed(1)}km`
                    : `${Math.round(s.distanceM)}m`;

                const openKakaoMap = () => {
                  const keyword = encodeURIComponent(s.address || s.name);
                  window.open(`https://map.kakao.com/link/search/${keyword}`, "_blank", "noopener,noreferrer");
                };

                return (
                  <div
                    key={i}
                    className="group w-full flex items-center border border-slate-100 rounded-xl px-4 py-3 bg-white hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mr-3 group-hover:bg-blue-100 transition-colors">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-[#0F2540] truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">{s.address}</p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mx-5 shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      {distance}
                    </div>

                    <button
                      type="button"
                      onClick={openKakaoMap}
                      className="h-8 px-3 rounded-lg border border-blue-100 bg-white text-blue-500 text-[11px] font-bold flex items-center gap-1.5 shrink-0 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all cursor-pointer"
                    >
                      <Map className="w-3.5 h-3.5" />
                      지도보기
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 재난 특보 상세 - 근처 진행중인 Incident 목록 → 클릭하면 그 사건 상세로 */}
      {incidentListOpen && (() => {
        const selectedIncident = nearbyIncidents.find((i) => i.incidentId === selectedIncidentId) || null;
        const closeAll = () => {
          setIncidentListOpen(false);
          setSelectedIncidentId(null);
        };
        const timeline = selectedIncident ? incidentTimelines[selectedIncident.incidentId] || [] : [];
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={closeAll}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {!selectedIncident ? (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                      <h2 className="font-extrabold text-[#0F2540]">진행중인 재난 {nearbyIncidents.length}건</h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">관심지역 반경 5km 이내 · 눌러서 상세 상황을 확인하세요</p>
                    </div>
                    <button onClick={closeAll} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 space-y-2">
                    {nearbyIncidents.map((incident) => {
                      const Icon = DISASTER_ICON[incident.disasterType] || AlertTriangle;
                      return (
                        <button
                          key={incident.incidentId}
                          onClick={() => setSelectedIncidentId(incident.incidentId)}
                          className="w-full text-left rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${DISASTER_TYPE_STYLE[incident.disasterType] || "bg-slate-100 text-slate-600"}`}>
                                <Icon className="w-3 h-3 shrink-0" />{incident.disasterType}
                              </span>
                              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${SEVERITY_STYLE[incident.severity] || "bg-slate-100 text-slate-600"}`}>
                                {SEVERITY_LABEL_KO[incident.severity] || incident.severity}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-600 text-white">
                                {STATUS_LABEL_KO[incident.status] || incident.status}
                              </span>
                            </div>
                            <h3 className="font-bold text-[#0F2540] text-sm mb-1 truncate">{incident.title}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{incident.region}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 shrink-0">
                    <button onClick={() => setSelectedIncidentId(null)} className="text-slate-400 hover:text-slate-600 p-1 -ml-1 cursor-pointer shrink-0">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="font-extrabold text-[#0F2540] flex-1 truncate">사건 상세</h2>
                    <button onClick={closeAll} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 space-y-4">
                    <div>
                      {(() => {
                        const Icon = DISASTER_ICON[selectedIncident.disasterType] || AlertTriangle;
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${DISASTER_TYPE_STYLE[selectedIncident.disasterType] || "bg-slate-100 text-slate-600"}`}>
                              <Icon className="w-3 h-3 shrink-0" />{selectedIncident.disasterType}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${SEVERITY_STYLE[selectedIncident.severity] || "bg-slate-100 text-slate-600"}`}>
                              {SEVERITY_LABEL_KO[selectedIncident.severity] || selectedIncident.severity}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-600 text-white">
                              {STATUS_LABEL_KO[selectedIncident.status] || selectedIncident.status}
                            </span>
                          </div>
                        );
                      })()}
                      <h3 className="font-bold text-[#0F2540] text-base mb-1.5">{selectedIncident.title}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {selectedIncident.region}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        최초 접수 {formatDateTimeFull(selectedIncident.createdAt)}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#0F2540] mb-2">대응 이력</h4>
                      {incidentTimelineLoading && timeline.length === 0 ? (
                        <p className="text-xs text-slate-400">불러오는 중...</p>
                      ) : timeline.length === 0 ? (
                        <p className="text-xs text-slate-400">아직 등록된 조치 내용이 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {timeline.map((log, i) => (
                            <div key={log.logId} className="flex gap-2">
                              <div className="flex flex-col items-center shrink-0">
                                <span className={`w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm ${REPORT_STATUS_DOT[log.newStatus] || "bg-slate-400"}`} />
                                {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                              </div>
                              <div className="min-w-0 flex-1 rounded-lg border border-slate-100 px-2.5 py-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-[#0F2540]">{STATUS_LABEL_KO[log.newStatus] || log.newStatus}</span>
                                  <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.changedAt)}</span>
                                </div>
                                {log.memo && <div className="text-xs text-slate-600 mt-0.5">{log.memo}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---- 알림 설정 --------------------------------------------------------------

function NotifyTab({
  member: initialMember,
  memberLoading,
  memberError,
  onSaved,
  notifications = [],
  readNotificationIds = [],
  onMarkRead,
  onMarkAllRead,
}) {
  const [draft, setDraft] = useState(initialMember);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (initialMember) setDraft(initialMember);
  }, [initialMember]);

  const toggle = (field) => {
    setDraft((prev) => ({ ...prev, [field]: prev[field] === "Y" ? "N" : "Y" }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await authFetch("/api/mypage/notifications", {
        method: "PUT",
        body: JSON.stringify({
          emailNotifyEnabled: draft.emailNotifyEnabled,
          disasterNotifyEnabled: draft.disasterNotifyEnabled,
          reportNotifyEnabled: draft.reportNotifyEnabled,
        }),
      });
      setSuccess("저장되었습니다.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (memberLoading) return <p className="text-sm text-slate-400">불러오는 중...</p>;
  if (!draft) return <p className="text-sm text-red-500">{memberError || "정보를 불러오지 못했습니다."}</p>;

  const settingItems = [
    {
      field: "emailNotifyEnabled",
      label: "가족 안전확인 이메일 알림",
      desc: "가족이 안전확인을 요청하거나 응답하면 이메일로 알림을 받습니다.",
      icon: Users,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      field: "disasterNotifyEnabled",
      label: "관심지역 재난 알림",
      desc: "등록한 관심지역에 재난 상황이 발생하면 알림을 받습니다.",
      icon: AlertTriangle,
      tone: "bg-red-50 text-red-500",
    },
    {
      field: "reportNotifyEnabled",
      label: "내 제보 상태변경 알림",
      desc: "내가 등록한 제보의 처리 상태가 바뀌면 알림을 받습니다.",
      icon: FileText,
      tone: "bg-blue-50 text-blue-600",
    },
  ];

  const filteredNotifications =
    filter === "all" ? notifications : notifications.filter((n) => n.type === filter);

  const countByType = (key) =>
    key === "all" ? notifications.length : notifications.filter((n) => n.type === key).length;

  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_320px] gap-4 items-start">
      {/* 왼쪽: 최근 알림 */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-[#0F2540]">최근 알림</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  재난·안전확인·제보 관련 알림을 한곳에서 확인합니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={notifications.length === 0 || unreadCount === 0}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-default cursor-pointer whitespace-nowrap"
            >
              모두 읽음 표시
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {NOTIFICATION_FILTERS.map((item) => {
              const active = filter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`h-8 px-3 rounded-full text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-[#0F2540] text-white border-[#0F2540] shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {item.label}
                  <span className={`text-[9px] ${active ? "text-white/70" : "text-slate-400"}`}>
                    {countByType(item.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            <Bell className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-400">
              {filter === "all" ? "아직 도착한 알림이 없습니다." : "이 종류의 알림이 없습니다."}
            </p>
            <p className="text-[11px] text-slate-300 mt-1">
              새로운 알림이 오면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((n) => {
              const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.etc;
              const Icon = meta.icon;
              const unread = !readNotificationIds.includes(n.id);

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onMarkRead?.(n.id)}
                  className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition flex items-center gap-3 cursor-pointer ${
                    unread ? "bg-blue-50/25" : "bg-white"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.iconWrap}`}>
                    <Icon className={`w-4.5 h-4.5 ${meta.iconColor}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${meta.iconWrap} ${meta.iconColor}`}>
                        {meta.label}
                      </span>
                      {unread && <span className="text-[9px] font-bold text-red-500">NEW</span>}
                    </div>
                    <p className="text-sm font-bold text-[#0F2540] truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{n.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {notificationTime(n.createdAt)}
                    </span>
                    {unread && <span className="w-2 h-2 rounded-full bg-red-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 오른쪽: 오늘의 알림 + 알림 설정 */}
      <aside className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="font-extrabold text-[#0F2540] text-[14px] leading-none">오늘의 알림</h3>
            </div>
            <span className="text-[9px] font-semibold text-slate-400 leading-none whitespace-nowrap">
              {new Date().toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-blue-50 ring-1 ring-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-[0_3px_10px_rgba(59,130,246,0.08)]">
              <Bell className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-[18px] font-extrabold text-[#0F2540]">{unreadCount}</span>
                <span className="text-[10px] font-bold text-slate-500">건</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">새로운 알림이 있습니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ["재난 알림", "disaster", "text-red-500", AlertTriangle],
              ["안전확인 알림", "safety", "text-emerald-600", Users],
              ["제보 알림", "report", "text-blue-600", FileText],
              ["기타 알림", "etc", "text-slate-600", Bell],
            ].map(([label, key, color, Icon]) => (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                className="rounded-xl px-3 py-2.5 text-left bg-slate-50 border border-slate-100 hover:bg-slate-100/80 hover:border-slate-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3.5 h-3.5 shrink-0 stroke-[2.1] ${color}`} />
                  <p className="text-[9px] font-semibold text-slate-500 truncate">{label}</p>
                </div>
                <p className={`text-[15px] leading-none font-extrabold ${color}`}>{countByType(key)}건</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-extrabold text-[#0F2540]">알림 설정</h3>
            <p className="text-[10px] text-slate-400 mt-1">
              받고 싶은 알림 종류를 설정할 수 있습니다.
            </p>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
          {success && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{success}</p>}

          <div className="space-y-3 mb-4">
            {settingItems.map(({ field, label, desc, icon: Icon, tone }) => (
              <div key={field} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-700">{label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggle(field)}
                  className={`shrink-0 w-10 h-5 rounded-full transition relative cursor-pointer ${
                    draft[field] === "Y" ? "bg-[#0F2540]" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                      draft[field] === "Y" ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer transition"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </aside>
    </div>
  );
}

