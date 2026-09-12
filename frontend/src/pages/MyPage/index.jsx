import { useEffect, useState, useRef } from "react";
import { ShieldAlert, Bell, ChevronRight, Sun, Users, ClipboardList, User, Heart } from "lucide-react";
import { authFetch, getNotifications, deleteNotification, deleteAllNotifications } from "../../api/client";
import { connectSafetyCheckSocket, connectIncidentSocket } from "../../api/socket";
import {
  TABS, ROLE_LABEL, NOTIFICATION_META, notificationTime, buildNotificationItems,
  loadDaumPostcodeScript,
} from "./constants";
import InfoTab from "./InfoTab";
import FamilyTab from "./FamilyTab";
import SafetyTab from "./SafetyTab";
import ReportsTab from "./ReportsTab";
import RegionsTab from "./RegionsTab";
import NotifyTab from "./NotifyTab";
import WithdrawModal from "./WithdrawModal";

export default function MyPage({ onBackToHome, onLogout, onOpenShelters, onOpenSafetyNews }) {
  // 새로고침해도 보고 있던 탭(가족 관리 등)이 유지되도록 history.state에서 복원.
  // history.state는 새로고침해도 남아있으므로, 탭을 바꿀 때마다 같이 기록해둔다 (아래 selectTab).
  const [activeTab, setActiveTab] = useState(window.history.state?.mypageTab || "info");
  // 탭을 다시 눌렀을 때 매번 값이 바뀌는 카운터 - RegionsTab처럼 "데이터 자체는 새로 받아와도
  // 화면에 실제로 그걸 다시 그리는 로직은 별도 조건(선택된 지역 좌표 등)에 걸려있는 탭이 있어서,
  // 그런 탭들이 이 값을 자기 useEffect 의존성에 넣어두면 탭 재클릭마다 확실히 다시 그려지게 됨
  const [refreshSignal, setRefreshSignal] = useState(0);
  const selectTab = (key) => {
    if (key === activeTab) {
      // 이미 활성화된 탭을 다시 누른 경우 - activeTab 값이 그대로라 setActiveTab만으론
      // 리렌더가 안 일어나므로 새로고침 함수를 직접 호출해야 함.
      // 처음엔 "이 탭엔 이 데이터만" 식으로 탭별로 좁혀서 새로고침했는데, 화면 하나가
      // 여러 데이터 소스를 같이 쓰는 경우가 많아서(가족관리 탭이 안전확인 상태까지 같이
      // 보여주거나, 알림 탭이 알림설정까지 같이 보여주는 식) 계속 하나씩 빠뜨렸음.
      // 그래서 그냥 전부 다 새로고침하는 걸로 통일 - 전부 가벼운 GET이라 부담 없음.
      loadMember();
      loadFamilies();
      loadSafetyChecks();
      loadReports();
      loadRegions();
      loadNotifications();
      setRefreshSignal((s) => s + 1);
      return;
    }
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
  // 삭제한 알림 id 목록 - 제보등록/관심지역등록 같은 항목은 실제 DB row가 없는 "합성" 알림이라
  // 서버에서 지울 게 없어서, 읽음처리와 동일하게 localStorage에 "숨김 목록"으로 관리함
  // (DB에 실제로 있는 재난/제보 알림은 여기에 추가하는 것과 별개로 서버에서도 진짜로 삭제함)
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("safeTraceDismissedNotifications") || "[]");
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

  // 재난 알림(관심지역 반경 매칭)/제보 알림(내 제보 상태변경) - 서버가 실제 이벤트
  // 시점에 만들어둔 진짜 알림 목록. 나머지(안전확인/기타)는 기존처럼 다른 상태들로부터 조합함.
  const [dbNotifications, setDbNotifications] = useState([]);

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

  const loadNotifications = () => {
    getNotifications().then(setDbNotifications).catch(() => {});
  };

  useEffect(() => {
    loadMember();
    loadFamilies();
    loadSafetyChecks();
    loadRegions();
    loadReports();
    loadNotifications();
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
  // 내가 보낸 요청에 응답이 오면 새로고침 없이 "안전확인 이력" 탭이 자동 갱신됨 (MainPage.jsx 홈 화면과 동일한 패턴)
  useEffect(() => {
    const socket = connectSafetyCheckSocket(() => {
      loadSafetyChecks();
    });
    return () => socket.close();
  }, []);

  // Incident WebSocket - 재난 알림(관심지역 반경 매칭)/제보 알림(내 제보 상태변경)은
  // 새 Incident가 생기거나 상태가 바뀌는 그 순간에 서버가 DB에 만들어두는 거라, 이 broadcast가
  // 오는 타이밍이 곧 "새 알림이 생겼을 수도 있는 타이밍"임. 이 신호가 나랑 무관한 Incident여도
  // 서버가 로그인한 나(memberId) 기준으로만 알림을 내려주므로 그냥 다시 조회해도 손해가 없음.
  useEffect(() => {
    const socket = connectIncidentSocket(() => {
      loadNotifications();
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
    dbNotifications,
  }).filter((n) => !dismissedNotificationIds.includes(n.id));

  const unreadCount = notificationItems.filter(
    (n) => !readNotificationIds.includes(n.id)
  ).length;

  const persistReadIds = (ids) => {
    const next = [...new Set(ids)];
    setReadNotificationIds(next);
    localStorage.setItem("safeTraceReadNotifications", JSON.stringify(next));
  };

  const persistDismissedIds = (ids) => {
    const next = [...new Set(ids)];
    setDismissedNotificationIds(next);
    localStorage.setItem("safeTraceDismissedNotifications", JSON.stringify(next));
  };

  // 알림 개별 삭제 - "db-123" 형태(진짜 DB에 있는 재난/제보 알림)면 서버에서도 실제로 지움.
  // 서버 삭제가 실패해도(이미 지워졌거나 네트워크 문제) 화면에서는 일단 숨겨줌.
  const dismissNotification = (id) => {
    persistDismissedIds([...dismissedNotificationIds, id]);
    if (id.startsWith("db-")) {
      const notificationId = id.replace("db-", "");
      deleteNotification(notificationId).catch(() => {});
    }
  };

  // 전체 삭제 - 서버에 있는 진짜 알림(재난/제보)은 통째로 지우고, 지금 화면에 보이는 전체 id를
  // 숨김 목록에 넣어서 제보등록/관심지역등록 같은 합성 알림까지 같이 안 보이게 함
  const dismissAllNotifications = () => {
    persistDismissedIds([...dismissedNotificationIds, ...notificationItems.map((n) => n.id)]);
    deleteAllNotifications().catch(() => {});
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
            key={refreshSignal}
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
          <FamilyTab key={refreshSignal} families={families} familiesLoading={familiesLoading} onChanged={loadFamilies} latestStatusFor={latestStatusFor} />
        )}
        {activeTab === "safety" && <SafetyTab key={refreshSignal} sentChecks={sentChecks} receivedChecks={receivedChecks} families={families} onChanged={loadSafetyChecks} />}
        {activeTab === "reports" && <ReportsTab key={refreshSignal} reports={myReports} loading={reportsLoading} onChanged={loadReports} />}
        {activeTab === "regions" && <RegionsTab key={refreshSignal} regions={regions} onChanged={loadRegions} member={member} onOpenShelters={onOpenShelters} onOpenSafetyNews={onOpenSafetyNews} refreshSignal={refreshSignal} />}
        {activeTab === "notify" && (
          <NotifyTab
            key={refreshSignal}
            member={member}
            memberLoading={memberLoading}
            memberError={memberError}
            onSaved={loadMember}
            notifications={notificationItems}
            readNotificationIds={readNotificationIds}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            onDismiss={dismissNotification}
            onDismissAll={dismissAllNotifications}
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
