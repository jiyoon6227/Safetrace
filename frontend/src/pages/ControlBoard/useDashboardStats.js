import { useEffect, useState } from "react";
import {
  Clock3, AlertTriangle, CheckCircle2, Activity, ClipboardList, Search,
  TrendingUp, TrendingDown, Minus, UserPlus, FilePlus, UserRound, FileSearch, RefreshCw,
} from "lucide-react";
import { authFetch } from "../../api/client";
import { toDateInputValue, sameDay, DISASTER_TYPE_COLOR } from "./constants";

// 통계는 지금 불러온 incidents 배열로 클라이언트에서 즉석 계산
export function useDashboardStats({
  incidents, dashboardReports, today, currentUser, setActiveNav, setSelectedIncidentId,
  setIncidentSearchQuery, setIncidentStatusFilter, setIncidentTypeFilter, setIncidentRegionFilter,
  setIncidentSeverityFilter, setIncidentSortOrder, setIncidentPage,
}) {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // "해결 완료" 카드는 상태변경 이력 기준 백엔드 API 사용 (updatedAt 기준 시 종료 후 수정도 집계)
  const [closedCountStats, setClosedCountStats] = useState({ today: 0, yesterday: 0 });
  useEffect(() => {
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    Promise.all([
      authFetch(`/api/incidents/stats/closed-count?date=${toDateInputValue(today)}`),
      authFetch(`/api/incidents/stats/closed-count?date=${toDateInputValue(yesterdayDate)}`),
    ])
      .then(([todayCount, yesterdayCount]) => setClosedCountStats({ today: todayCount, yesterday: yesterdayCount }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  const createdToday = incidents.filter((i) => sameDay(i.createdAt, today)).length;
  const createdYesterday = incidents.filter((i) => sameDay(i.createdAt, yesterday)).length;
  const receivedToday = incidents.filter((i) => i.status === "RECEIVED" && sameDay(i.updatedAt, today)).length;
  const receivedYesterday = incidents.filter((i) => i.status === "RECEIVED" && sameDay(i.updatedAt, yesterday)).length;
  const respondingToday = incidents.filter((i) => i.status === "RESPONDING" && sameDay(i.updatedAt, today)).length;
  const respondingYesterday = incidents.filter((i) => i.status === "RESPONDING" && sameDay(i.updatedAt, yesterday)).length;
  const recoveringToday = incidents.filter((i) => i.status === "RECOVERING" && sameDay(i.updatedAt, today)).length;
  const recoveringYesterday = incidents.filter((i) => i.status === "RECOVERING" && sameDay(i.updatedAt, yesterday)).length;

  // dashboardReports는 사건화 전 원본 제보량이 필요한 곳(내 업무 카드)에만 사용
  const dashboardReceivedCount = dashboardReports.filter((r) => r.status === "RECEIVED").length;
  const confirmingToday = incidents.filter((i) => i.status === "CONFIRMING" && sameDay(i.updatedAt, today)).length;
  const confirmingYesterday = incidents.filter((i) => i.status === "CONFIRMING" && sameDay(i.updatedAt, yesterday)).length;

  // 상단 카드 - Incident.status 기준, 처리 흐름 순서로 배치 (긴급은 심각도라 제외)
  const stats = {
    received: incidents.filter((i) => i.status === "RECEIVED").length,
    confirming: incidents.filter((i) => i.status === "CONFIRMING").length,
    responding: incidents.filter((i) => i.status === "RESPONDING").length,
    recovering: incidents.filter((i) => i.status === "RECOVERING").length,
    // 지도 필터 칩 "긴급"용
    urgent: incidents.filter((i) => i.severity === "HIGH" && i.status !== "CLOSED").length,
    closedToday: closedCountStats.today,
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
    { icon: ClipboardList, label: "접수 대기", value: stats.received, color: "text-slate-600 bg-slate-100", trend: trendOf(receivedToday - receivedYesterday), onClick: () => goToIncidentsWithStatus("RECEIVED") },
    { icon: Search, label: "확인 중", value: stats.confirming, color: "text-blue-600 bg-blue-100", trend: trendOf(confirmingToday - confirmingYesterday), onClick: () => goToIncidentsWithStatus("CONFIRMING") },
    { icon: Activity, label: "대응 중", value: stats.responding, color: "text-orange-600 bg-orange-100", trend: trendOf(respondingToday - respondingYesterday), onClick: () => goToIncidentsWithStatus("RESPONDING") },
    { icon: RefreshCw, label: "복구 중", value: stats.recovering, color: "text-yellow-600 bg-yellow-100", trend: trendOf(recoveringToday - recoveringYesterday), onClick: () => goToIncidentsWithStatus("RECOVERING") },
    { icon: CheckCircle2, label: "오늘 해결 완료", value: stats.closedToday, color: "text-emerald-600 bg-emerald-100", trend: trendOf(closedCountStats.today - closedCountStats.yesterday), onClick: () => goToIncidentsWithStatus("CLOSED") },
  ];

  // "내 업무" 3카드 - 로그인한 STAFF 개인 기준
  const myAssignedCount = incidents.filter((i) => i.assignedStaffId === currentUser?.memberId && i.status !== "CLOSED").length;
  const needsReviewCount = dashboardReceivedCount;
  const LONG_PENDING_DAYS = 3; // 3일 이상 상태 변경 없는 진행중 사건 = 장기 미처리
  const longPendingCount = incidents.filter((i) => {
    if (i.status === "CLOSED") return false;
    const last = new Date(i.updatedAt || i.createdAt);
    return (today - last) / (1000 * 60 * 60 * 24) >= LONG_PENDING_DAYS;
  }).length;
  const myTaskCards = [
    { icon: UserRound, label: "내 담당 사건", value: myAssignedCount, sub: "나에게 배정된 진행 사건", tone: "text-blue-600 bg-blue-50", onClick: () => setActiveNav("incidents") },
    { icon: FileSearch, label: "확인 필요 제보", value: needsReviewCount, sub: "아직 검토하지 않은 제보", tone: "text-indigo-600 bg-indigo-50", onClick: () => setActiveNav("reports") },
    { icon: Clock3, label: "장기 미처리", value: longPendingCount, sub: `${LONG_PENDING_DAYS}일 이상 상태 변경 없음`, tone: "text-red-600 bg-red-50", onClick: () => setActiveNav("incidents") },
  ];

  // 지도 상태 필터 칩 - Incident.status 단일 분류 (개수 합계 = 전체)
  // 긴급은 심각도라 제외, mapUrgentOnly 토글로 별도 처리 (DashboardTab에서 렌더링)
  const mapStatusChips = [
    { key: null, label: "전체", count: incidents.length },
    { key: "RECEIVED", label: "접수대기", count: stats.received },
    { key: "CONFIRMING", label: "확인중", count: stats.confirming },
    { key: "RESPONDING", label: "대응중", count: stats.responding },
    { key: "RECOVERING", label: "복구중", count: stats.recovering },
    { key: "RESOLVED", label: "해결", count: incidents.filter((i) => i.status === "CLOSED").length },
  ];

  // 일별 사건 현황 - 최근 7일간 접수(생성) 건수 vs 처리완료(종료) 건수
  const dailyStats = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
      received: incidents.filter((inc) => sameDay(inc.createdAt, d)).length,
      resolved: incidents.filter((inc) => inc.status === "CLOSED" && sameDay(inc.updatedAt, d)).length,
    };
  });
  const dailyMax = Math.max(1, ...dailyStats.flatMap((d) => [d.received, d.resolved]));

  // 사건 유형별 통계 - 이번 달 등록된 사건 기준 도넛차트
  const monthIncidents = incidents.filter((inc) => {
    const d = new Date(inc.createdAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  });
  const typeCounts = monthIncidents.reduce((acc, i) => {
    acc[i.disasterType] = (acc[i.disasterType] || 0) + 1;
    return acc;
  }, {});
  const typeTotal = monthIncidents.length;
  const typeStats = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      pct: typeTotal ? Math.round((count / typeTotal) * 100) : 0,
      color: DISASTER_TYPE_COLOR[type] || "#94A3B8",
    }));

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
    dashboardReceivedCount, stats, statCards, myTaskCards, mapStatusChips, dailyStats, dailyMax, typeTotal,
    typeStats, recentActivity,
  };
}
