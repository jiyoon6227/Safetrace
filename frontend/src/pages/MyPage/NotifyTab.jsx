import { useEffect, useState } from "react";
import { Bell, AlertTriangle, Users, FileText, X, Trash2 } from "lucide-react";
import { authFetch } from "../../api/client";
import { NOTIFICATION_FILTERS, NOTIFICATION_META, notificationTime, formatDateTimeFull } from "./constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";

// ---- 알림 설정 --------------------------------------------------------------

export default function NotifyTab({
  member: initialMember,
  memberLoading,
  memberError,
  onSaved,
  notifications = [],
  readNotificationIds = [],
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onDismissAll,
}) {
  const [draft, setDraft] = useState(initialMember);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [notificationPage, setNotificationPage] = useState(1);
  // 클릭한 알림 - 상세 내용을 팝업으로 보여줄 때 사용 (null이면 팝업 닫힘)
  const [selectedNotification, setSelectedNotification] = useState(null);
  useEscapeKey(!!selectedNotification, () => setSelectedNotification(null));

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

  // 최근 알림 영역은 현재 시각 기준 최근 7일 이내 알림만 보여준다.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;

  const recentNotifications = notifications.filter((n) => {
    if (!n.createdAt) return false;
    const createdAt = new Date(n.createdAt).getTime();
    return !Number.isNaN(createdAt) && createdAt >= sevenDaysAgo;
  });

  const filteredNotifications =
    filter === "all"
      ? recentNotifications
      : recentNotifications.filter((n) => n.type === filter);

  const NOTIFICATION_PAGE_SIZE = 5;
  const notificationTotalPages = Math.max(
    1,
    Math.ceil(filteredNotifications.length / NOTIFICATION_PAGE_SIZE)
  );

  const pagedNotifications = filteredNotifications.slice(
    (notificationPage - 1) * NOTIFICATION_PAGE_SIZE,
    notificationPage * NOTIFICATION_PAGE_SIZE
  );

  useEffect(() => {
    setNotificationPage(1);
  }, [filter]);

  useEffect(() => {
    if (notificationPage > notificationTotalPages) {
      setNotificationPage(notificationTotalPages);
    }
  }, [notificationPage, notificationTotalPages]);

  // 상단 필터 숫자도 최근 7일 기준으로 표시
  const countByType = (key) =>
    key === "all"
      ? recentNotifications.length
      : recentNotifications.filter((n) => n.type === key).length;

  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  if (memberLoading) return <p className="text-sm text-slate-400">불러오는 중...</p>;
  if (!draft) return <p className="text-sm text-red-500">{memberError || "정보를 불러오지 못했습니다."}</p>;

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
                  최근 7일 동안 받은 재난·안전확인·제보 관련 알림을 확인합니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onMarkAllRead}
                disabled={notifications.length === 0 || unreadCount === 0}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-default cursor-pointer whitespace-nowrap"
              >
                모두 읽음 표시
              </button>
              <button
                type="button"
                onClick={() => {
                  if (notifications.length === 0) return;
                  if (window.confirm("최근 알림을 전부 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
                    onDismissAll?.();
                  }
                }}
                disabled={notifications.length === 0}
                className="text-[11px] font-bold text-red-500 hover:text-red-600 disabled:text-slate-300 disabled:cursor-default cursor-pointer whitespace-nowrap"
              >
                전체 삭제
              </button>
            </div>
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
            {pagedNotifications.map((n) => {
              const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.etc;
              const Icon = meta.icon;
              const unread = !readNotificationIds.includes(n.id);

              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onMarkRead?.(n.id);
                    setSelectedNotification(n);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onMarkRead?.(n.id);
                      setSelectedNotification(n);
                    }
                  }}
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
                    <div className="text-right leading-tight">
                      <p className="text-[10px] text-slate-500 whitespace-nowrap">
                        {notificationTime(n.createdAt)}
                      </p>
                      <p className="text-[9px] text-slate-400 whitespace-nowrap">
                        {formatDateTimeFull(n.createdAt)}
                      </p>
                    </div>
                    {unread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss?.(n.id);
                      }}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md p-1.5 -m-1 cursor-pointer shrink-0 transition"
                      aria-label="알림 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredNotifications.length > NOTIFICATION_PAGE_SIZE && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setNotificationPage((prev) => Math.max(1, prev - 1))}
              disabled={notificationPage === 1}
              className="w-8 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-default cursor-pointer transition"
            >
              ‹
            </button>

            {Array.from({ length: notificationTotalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setNotificationPage(pageNumber)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                  notificationPage === pageNumber
                    ? "bg-[#0F2540] text-white"
                    : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setNotificationPage((prev) => Math.min(notificationTotalPages, prev + 1))
              }
              disabled={notificationPage === notificationTotalPages}
              className="w-8 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-default cursor-pointer transition"
            >
              ›
            </button>
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

      {/* 알림 상세 팝업 - 목록에서 알림 클릭하면 뜸 */}
      {selectedNotification && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedNotification(null)}
        >
          {(() => {
            const meta = NOTIFICATION_META[selectedNotification.type] || NOTIFICATION_META.etc;
            const Icon = meta.icon;
            return (
              <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.iconWrap}`}>
                      <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${meta.iconWrap} ${meta.iconColor}`}>
                      {meta.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-[#0F2540] mb-1.5">{selectedNotification.title}</h3>
                <p className="text-[13px] text-slate-600 leading-relaxed mb-3 whitespace-pre-line">
                  {selectedNotification.desc}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                  <span>{formatDateTimeFull(selectedNotification.createdAt)}</span>
                  {selectedNotification.incidentId && <span>관련 사건 #{selectedNotification.incidentId}</span>}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
