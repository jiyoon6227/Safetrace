import { useEffect, useState } from "react";
import {
  Clock3, AlertTriangle, CheckCircle2, Activity, ClipboardList, Search,
  TrendingUp, TrendingDown, Minus, UserPlus, FilePlus, UserRound, FileSearch, RefreshCw,
} from "lucide-react";
import { authFetch } from "../../api/client";
import { toDateInputValue } from "./constants";

const LONG_PENDING_DAYS = 3; // 서버 장기 미처리 기준과 같은 값 (카드 설명 문구용)
const DAILY_STAT_DAYS = 7;

const EMPTY_DASHBOARD_STATS = {
  total: 0, receivedCount: 0, confirmingCount: 0, respondingCount: 0, recoveringCount: 0, closedCount: 0,
  urgentCount: 0, myAssignedCount: 0, longPendingCount: 0,
  receivedToday: 0, receivedYesterday: 0, confirmingToday: 0, confirmingYesterday: 0,
  respondingToday: 0, respondingYesterday: 0, recoveringToday: 0, recoveringYesterday: 0,
  daily: [],
};

// 서버 시간대와 어긋나지 않도록 화면 기준 현재 시각을 그대로 보냄 (예: 2026-11-11T14:30:00)
const toLocalDateTimeValue = (date) =>
  `${toDateInputValue(date)}T${[date.getHours(), date.getMinutes(), date.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":")}`;

// "2026-11-05" → "11. 5." (차트 x축 라벨)
const toDayLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
};

// 건수 집계는 서버 통계 API, 최근 활동 목록만 불러온 incidents로 구성
export function useDashboardStats({
  incidents, dashboardReports, today, setActiveNav, setSelectedIncidentId,
  setIncidentSearchQuery, setIncidentStatusFilter, setIncidentTypeFilter, setIncidentRegionFilter,
  setIncidentSeverityFilter, setIncidentSortOrder, setIncidentPage,
}) {
  // 사건 목록이 새로 들어올 때(새로고침·소켓 갱신)마다 통계도 다시 조회
  const [dashboardStats, setDashboardStats] = useState(EMPTY_DASHBOARD_STATS);
  useEffect(() => {
    authFetch(`/api/incidents/stats/dashboard?now=${encodeURIComponent(toLocalDateTimeValue(today))}`)
      .then((data) => setDashboardStats({ ...EMPTY_DASHBOARD_STATS, ...data }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  // dashboardReports는 사건화 전 원본 제보량이 필요한 곳(내 업무 카드)에만 사용
  const dashboardReceivedCount = dashboardReports.filter((r) => r.status === "RECEIVED").length;

  // 일별 통계 응답이 오기 전에도 7일 빈 막대가 보이도록 0건으로 채움
  const daily = dashboardStats.daily.length
    ? dashboardStats.daily
    : Array.from({ length: DAILY_STAT_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (DAILY_STAT_DAYS - 1 - i));
      return { date: toDateInputValue(d), received: 0, resolved: 0 };
    });
  const closedToday = daily[daily.length - 1].resolved;
  const closedYesterday = daily[daily.length - 2].resolved;

  // 상단 카드 - Incident.status 기준, 처리 흐름 순서로 배치 (긴급은 심각도라 제외)
  const stats = {
    received: dashboardStats.receivedCount,
    confirming: dashboardStats.confirmingCount,
    responding: dashboardStats.respondingCount,
    recovering: dashboardStats.recoveringCount,
    // 지도 필터 칩 "긴급"용
    urgent: dashboardStats.urgentCount,
    closedToday,
  };

  // 카드별 "전일 대비" - 실데이터 있는 카드만 계산, 나머지는 시점 스냅샷이 없어 변동표시를 생략
  const trendOf = (diff) =>
    diff > 0
      ? { icon: TrendingUp, text: `전일 대비 +${diff}건`, tone: "text-emerald-600" }
      : diff < 0
      ? { icon: TrendingDown, text: `전일 대비 ${diff}건`, tone: "text-red-500" }
      : { icon: Minus, text: "변동 없음", tone: "text-slate-400" };

  // 상단 KPI 카드 클릭 시 사건관리 탭으로 이동 + 해당 상태로 필터링
  const goToIncidentsWithStatus = (status) => {
    setSelectedIncidentId(null);
    setIncidentSearchQuery("");
    setIncidentStatusFilter(status);
    setIncidentTypeFilter("ALL");
    setIncidentRegionFilter("ALL");
    setIncidentSeverityFilter("ALL");
    setIncidentSortOrder("newest");
    setIncidentPage(1);
    setActiveNav("incidents");
  };

  const statCards = [
    { icon: ClipboardList, label: "접수 대기", value: stats.received, color: "text-slate-600 bg-slate-100", trend: trendOf(dashboardStats.receivedToday - dashboardStats.receivedYesterday), onClick: () => goToIncidentsWithStatus("RECEIVED") },
    { icon: Search, label: "확인 중", value: stats.confirming, color: "text-blue-600 bg-blue-100", trend: trendOf(dashboardStats.confirmingToday - dashboardStats.confirmingYesterday), onClick: () => goToIncidentsWithStatus("CONFIRMING") },
    { icon: Activity, label: "대응 중", value: stats.responding, color: "text-orange-600 bg-orange-100", trend: trendOf(dashboardStats.respondingToday - dashboardStats.respondingYesterday), onClick: () => goToIncidentsWithStatus("RESPONDING") },
    { icon: RefreshCw, label: "복구 중", value: stats.recovering, color: "text-yellow-600 bg-yellow-100", trend: trendOf(dashboardStats.recoveringToday - dashboardStats.recoveringYesterday), onClick: () => goToIncidentsWithStatus("RECOVERING") },
    { icon: CheckCircle2, label: "오늘 해결 완료", value: stats.closedToday, color: "text-emerald-600 bg-emerald-100", trend: trendOf(closedToday - closedYesterday), onClick: () => goToIncidentsWithStatus("CLOSED") },
  ];

  // "내 업무" 3카드 - 로그인한 STAFF 개인 기준 (담당자 ID는 서버가 로그인 정보에서 꺼냄)
  const myTaskCards = [
    { icon: UserRound, label: "내 담당 사건", value: dashboardStats.myAssignedCount, sub: "나에게 배정된 진행 사건", tone: "text-blue-600 bg-blue-50", onClick: () => setActiveNav("incidents") },
    { icon: FileSearch, label: "확인 필요 제보", value: dashboardReceivedCount, sub: "아직 검토하지 않은 제보", tone: "text-indigo-600 bg-indigo-50", onClick: () => setActiveNav("reports") },
    { icon: Clock3, label: "장기 미처리", value: dashboardStats.longPendingCount, sub: `${LONG_PENDING_DAYS}일 이상 상태 변경 없음`, tone: "text-red-600 bg-red-50", onClick: () => setActiveNav("incidents") },
  ];

  // 지도 상태 필터 칩 - Incident.status 단일 분류 (개수 합계 = 전체)
  // 긴급은 심각도라 제외, mapUrgentOnly 토글로 별도 처리 (DashboardTab에서 렌더링)
  const mapStatusChips = [
    { key: null, label: "전체", count: dashboardStats.total },
    { key: "RECEIVED", label: "접수대기", count: stats.received },
    { key: "CONFIRMING", label: "확인중", count: stats.confirming },
    { key: "RESPONDING", label: "대응중", count: stats.responding },
    { key: "RECOVERING", label: "복구중", count: stats.recovering },
    { key: "RESOLVED", label: "해결", count: dashboardStats.closedCount },
  ];

  // 일별 사건 현황 - 최근 7일간 접수(생성) 건수 vs 처리완료(상태변경 이력) 건수
  const dailyStats = daily.map((d) => ({ label: toDayLabel(d.date), received: d.received, resolved: d.resolved }));
  const dailyMax = Math.max(1, ...dailyStats.flatMap((d) => [d.received, d.resolved]));

  // 최근 활동 - 사건 상태변화(생성/배정/상태전환) + 제보 접수를 합쳐 최신순 정렬
  const recentActivity = [
    ...incidents.map((inc) => {
      if (inc.status === "CLOSED") {
        return { key: `inc-closed-${inc.incidentId}`, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600", text: "사건이 해결 완료되었습니다.", sub: `${inc.disasterType} · ${inc.title}`, at: inc.updatedAt };
      }
      if (inc.status === "RESPONDING") {
        return { key: `inc-resp-${inc.incidentId}`, icon: AlertTriangle, tone: "bg-red-100 text-red-500", text: "화재 사건이 대응중으로 변경되었습니다.".replace("화재", inc.disasterType), sub: inc.region, at: inc.updatedAt };
      }
      if (inc.assignedStaffId != null) {
        return { key: `inc-assign-${inc.incidentId}`, icon: UserPlus, tone: "bg-blue-100 text-blue-600", text: "담당자 배정이 완료되었습니다.", sub: `${inc.disasterType} · ${inc.title}`, at: inc.updatedAt };
      }
      return { key: `inc-new-${inc.incidentId}`, icon: FilePlus, tone: "bg-blue-100 text-blue-600", text: `${inc.disasterType} 사건이 접수되었습니다.`, sub: inc.region, at: inc.createdAt };
    }),
    ...dashboardReports
      .filter((r) => !r.incidentId)
      .map((r) => ({ key: `report-${r.reportId}`, icon: FilePlus, tone: "bg-blue-100 text-blue-600", text: "시민 제보가 등록되었습니다.", sub: `${r.disasterType} · 제보 #${r.reportId}`, at: r.createdAt })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);

  return {
    dashboardReceivedCount, stats, statCards, myTaskCards, mapStatusChips, dailyStats, dailyMax, recentActivity,
  };
}
