import { useMemo, useState } from "react";
import {
  RefreshCw, AlertTriangle, Plus, Minus, LocateFixed, Building2, Camera, MapPin, ShieldAlert, ChevronRight, CalendarDays,
} from "lucide-react";
import { STATUS_LABEL, STATUS_STYLE, markerColorOf, formatTimeAgo, STATIC_NOTICES, REPORT_DISASTER_TYPES, DISASTER_TYPE_COLOR } from "./constants";

export default function DashboardTab({
  error,
  currentUser,
  member,
  today,
  loadIncidents,
  statCards,
  myTaskCards,
  mapStatusChips,
  mapTypeFilter,
  setMapTypeFilter,
  mapUrgentOnly,
  setMapUrgentOnly,
  urgentCount,
  mapLayers,
  setMapLayers,
  mapType,
  setMapType,
  mapRef,
  handleZoom,
  handleLocateReset,
  loading,
  incidents,
  setActiveNav,
  openIncidentDetail,
  recentActivity,
  dailyStats,
  dailyMax,
  typeTotal,
  typeStats,
}) {
  const toggleLayer = (key) => setMapLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  // 사건 유형별 통계 - 선택 월 / 전월 비교 / 0건 유형 포함
  const baseToday = today instanceof Date ? today : new Date(today);
  const defaultStatsMonth = `${baseToday.getFullYear()}-${String(baseToday.getMonth() + 1).padStart(2, "0")}`;
  const [statsMonth, setStatsMonth] = useState(defaultStatsMonth);
  const [hoveredType, setHoveredType] = useState(null);

  const statsSummary = useMemo(() => {
    const fallbackTypes = ["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"];
    const allTypes = Array.isArray(REPORT_DISASTER_TYPES) && REPORT_DISASTER_TYPES.length
      ? REPORT_DISASTER_TYPES
      : fallbackTypes;

    const [year, month] = statsMonth.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);

    const current = Object.fromEntries(allTypes.map((type) => [type, 0]));
    const previous = Object.fromEntries(allTypes.map((type) => [type, 0]));

    incidents.forEach((incident) => {
      const createdAt = new Date(incident.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;

      const rawType = incident.disasterType || incident.type || "기타";
      const type = allTypes.includes(rawType) ? rawType : "기타";

      if (createdAt >= start && createdAt < end) current[type] += 1;
      if (createdAt >= prevStart && createdAt < start) previous[type] += 1;
    });

    const total = Object.values(current).reduce((sum, count) => sum + count, 0);

    const rows = allTypes.map((type) => {
      const count = current[type] || 0;
      const prevCount = previous[type] || 0;
      const diff = count - prevCount;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;

      return {
        type,
        count,
        pct,
        diff,
        changeText: diff > 0 ? `전월 +${diff}건` : diff < 0 ? `전월 ${diff}건` : "변동 없음",
        color: DISASTER_TYPE_COLOR?.[type] || typeStats.find((t) => t.type === type)?.color || "#94A3B8",
      };
    });

    const maxCount = Math.max(...rows.map((row) => row.count), 0);
    const topType = maxCount > 0 ? rows.find((row) => row.count === maxCount)?.type : "-";

    return { total, rows, topType };
  }, [incidents, statsMonth, typeStats]);


  return (
    <main className="p-6">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {/* 인사말 + 새로고침 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-[#0F2540]">{(currentUser?.name || member?.name || "담당자")}님, 안녕하세요!</h2>
          <p className="text-sm text-slate-500 mt-0.5">시민의 안전을 지키는 든든한 파트너, 세이프트레이스입니다.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400">
            {today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })} {today.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={loadIncidents}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {statCards.map(({ icon: Icon, label, value, color, trend, onClick }) => (
          <button
            type="button"
            key={label}
            onClick={onClick}
            className="text-left bg-white rounded-2xl border border-slate-200 px-4 py-3.5 min-h-[108px] flex flex-col justify-between shadow-[0_1px_2px_rgba(15,37,64,0.02)] hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-6 h-6" strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1 leading-none">
                  {loading ? (
                    <span className="inline-block h-6 w-10 rounded bg-slate-200 animate-pulse" />
                  ) : (
                    <span className="text-[25px] font-extrabold tracking-[-0.03em] text-[#0F2540]">{value}</span>
                  )}
                  <span className="text-[11px] font-bold text-slate-500">건</span>
                </div>
                <div className="mt-2 text-[16px] leading-none font-semibold text-slate-800 whitespace-nowrap">
                  {label}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={2.2} />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className={`text-[11px] leading-tight truncate ${trend.tone}`}>{trend.text}</p>
              <span className={`flex items-center shrink-0 ${trend.tone}`}>
                <trend.icon className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* 지도 + 목록 + 최근활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-[#0F2540]">실시간 사건 현황 지도</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">지도를 클릭하면 상세 정보를 확인할 수 있습니다.</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {mapStatusChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setMapTypeFilter(chip.key)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer ${
                    mapTypeFilter === chip.key ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {chip.label} ({loading ? "…" : chip.count})
                </button>
              ))}
              {/* 긴급은 상태가 아니라 심각도라 위 상태 칩들과 다른 디자인(점선 테두리, 토글형)으로 분리 -
                  다른 상태 칩과 동시에 눌러도 겹쳐 적용됨(예: 대응중 + 긴급만 같이 보기) */}
              <button
                type="button"
                onClick={() => setMapUrgentOnly((v) => !v)}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition cursor-pointer ${
                  mapUrgentOnly ? "bg-red-600 border-red-600 text-white" : "bg-white border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> 긴급만 보기 ({loading ? "…" : urgentCount})
              </button>
            </div>
          </div>
          <div className="relative mt-3">
            <div ref={mapRef} className="w-full rounded-xl overflow-hidden" style={{ height: 480 }} />

            {/* 지도 유형(일반/위성) + 표시 항목 - 대응자원/대피소/CCTV는 아직 실데이터 연동 전이라 비활성 처리 */}
            <div className="absolute right-2.5 top-2.5 bg-white rounded-xl border border-slate-200 shadow-sm p-2.5 w-32 text-[11px]">
              <p className="font-bold text-slate-500 mb-1">지도 유형</p>
              <div className="flex bg-slate-100 rounded-lg p-0.5 mb-2.5">
                <button
                  type="button"
                  onClick={() => setMapType("normal")}
                  className={`flex-1 py-1 rounded-md font-bold transition cursor-pointer ${mapType === "normal" ? "bg-[#0F2540] text-white" : "text-slate-500"}`}
                >
                  일반
                </button>
                <button
                  type="button"
                  onClick={() => setMapType("skyview")}
                  className={`flex-1 py-1 rounded-md font-bold transition cursor-pointer ${mapType === "skyview" ? "bg-[#0F2540] text-white" : "text-slate-500"}`}
                >
                  위성
                </button>
              </div>
              <p className="font-bold text-slate-500 mb-1">표시 항목</p>
              <label className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                <input type="checkbox" checked={mapLayers.reports} onChange={() => toggleLayer("reports")} className="w-3 h-3" />
                제보 위치
              </label>
              <label className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                <input type="checkbox" checked={mapLayers.incidents} onChange={() => toggleLayer("incidents")} className="w-3 h-3" />
                사건 위치
              </label>
              <label className="flex items-center gap-1.5 py-0.5 text-slate-300 cursor-not-allowed" title="아직 연동 전인 항목입니다.">
                <input type="checkbox" disabled className="w-3 h-3" />
                대응 자원
              </label>
              <label className="flex items-center gap-1.5 py-0.5 text-slate-300 cursor-not-allowed" title="아직 연동 전인 항목입니다.">
                <input type="checkbox" disabled className="w-3 h-3" />
                대피소
              </label>
              <label className="flex items-center gap-1.5 py-0.5 text-slate-300 cursor-not-allowed" title="아직 연동 전인 항목입니다.">
                <input type="checkbox" disabled className="w-3 h-3" />
                CCTV
              </label>
            </div>

            <div className="absolute right-2.5 bottom-2.5 flex flex-col gap-1">
              <button type="button" onClick={() => handleZoom(-1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer">
                <Plus className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => handleZoom(1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer">
                <Minus className="w-4 h-4" />
              </button>
              <button type="button" onClick={handleLocateReset} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer">
                <LocateFixed className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
            {[
              ["#64748B", "접수"],
              ["#3B82F6", "확인중"],
              ["#F59E0B", "대응중"],
              ["#8B5CF6", "복구중"],
              ["#10B981", "해결"],
            ].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
            {/* 긴급은 상태 색상이 아니라 마커 테두리 링으로 표시되니 범례도 점선 링 아이콘으로 맞춤 */}
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-red-600" />
              긴급(테두리)
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="mb-1">
              <h3 className="font-bold text-[#0F2540]">내 업무</h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">지금 확인해야 할 업무를 모아봤습니다.</p>
            <div className="grid grid-cols-3 gap-2">
              {myTaskCards.map(({ icon: Icon, label, value, sub, tone, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="text-left rounded-xl border border-slate-100 p-2.5 hover:border-slate-200 hover:bg-slate-50/60 transition cursor-pointer"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${tone}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-lg font-extrabold text-[#0F2540]">
                    {loading ? (
                      <span className="inline-block h-4 w-6 rounded bg-slate-200 animate-pulse align-middle" />
                    ) : (
                      <>{value}건</>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#0F2540]">최근 활동</h3>
              <button onClick={() => setActiveNav("incidents")} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">전체보기 →</button>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400">최근 활동이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((a) => (
                  <li key={a.key} className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.tone}`}>
                      <a.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 leading-snug">{a.text}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{a.sub}</p>
                    </div>
                    <span className="text-[10px] text-slate-300 shrink-0">{formatTimeAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 일별 사건 현황 + 유형별 통계 + 공지사항 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-1 gap-2">
            <h3 className="font-extrabold text-[#0F2540] text-[15px] truncate">일별 사건 현황</h3>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" />접수</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />처리 완료</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">최근 7일간 사건 접수 및 처리 현황입니다.</p>
          <div className="flex items-end justify-between gap-2 h-32">
            {dailyStats.map((d) => (
              <div key={d.label} className="flex-1 flex items-end justify-center gap-1.5 h-full">
                <div className="w-4 bg-sky-400 rounded-t-md cursor-pointer hover:opacity-80 transition" style={{ height: `${(d.received / dailyMax) * 100}%` }} title={`접수 ${d.received}건`} />
                <div className="w-4 bg-emerald-500 rounded-t-md cursor-pointer hover:opacity-80 transition" style={{ height: `${(d.resolved / dailyMax) * 100}%` }} title={`처리완료 ${d.resolved}건`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {dailyStats.map((d) => (
              <span key={d.label} className="flex-1 text-center text-[11px] font-semibold text-slate-600">{d.label}</span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="font-bold text-[#0F2540] text-sm mb-1 truncate">사건 유형별 통계</h3>
              <p className="text-[10px] text-slate-400 truncate">선택한 월의 사건 유형별 현황입니다.</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-7 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px]">
                <span className="text-slate-400">최다 유형</span>
                <span className="font-extrabold text-[#0F2540]">{statsSummary.topType}</span>
              </div>

              <label className="h-7 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-500 cursor-pointer">
                <CalendarDays className="w-3 h-3 text-slate-400" />
                <input
                  type="month"
                  value={statsMonth}
                  onChange={(e) => setStatsMonth(e.target.value)}
                  className="w-[82px] bg-transparent outline-none cursor-pointer text-[10px] text-slate-500"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 min-h-[150px]">
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {statsSummary.total === 0 ? (
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                ) : (
                  (() => {
                    let offset = 0;
                    return statsSummary.rows
                      .filter((row) => row.count > 0)
                      .map((row) => {
                        const dash = (row.count / statsSummary.total) * 100;
                        const circle = (
                          <circle
                            key={row.type}
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            stroke={row.color}
                            strokeWidth="5"
                            strokeDasharray={`${dash} ${100 - dash}`}
                            strokeDashoffset={-offset}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredType(row)}
                            onMouseLeave={() => setHoveredType(null)}
                          />
                        );
                        offset += dash;
                        return circle;
                      });
                  })()
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-medium text-slate-400">총</span>
                <span className="text-[19px] leading-tight font-extrabold text-[#0F2540]">{statsSummary.total}건</span>
                <span className="text-[10px] text-slate-400 mt-0.5">이번 달</span>
              </div>

              {hoveredType && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-30 whitespace-nowrap rounded-md bg-[#0F2540] px-2 py-1 text-[10px] font-semibold text-white shadow-lg pointer-events-none">
                  {hoveredType.type} {hoveredType.count}건
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-[54px_minmax(72px,1fr)_56px_70px] items-center gap-2 border-b border-slate-100 px-1 pb-1 text-[8px] font-semibold text-slate-400">
                <span>사건 유형</span>
                <span>비율</span>
                <span className="text-right">건수</span>
                <span className="text-right">전월 대비</span>
              </div>

              <ul className="divide-y divide-slate-100">
                {statsSummary.rows.map((row) => (
                  <li
                    key={row.type}
                    className="grid grid-cols-[54px_minmax(72px,1fr)_56px_70px] items-center gap-2 px-1 py-[3px] text-[9px]"
                  >
                    <span className="flex items-center gap-1.5 min-w-0 font-semibold text-slate-700">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="truncate">{row.type}</span>
                    </span>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                        />
                      </div>
                      <span className="w-7 text-right text-slate-500 tabular-nums">{row.pct}%</span>
                    </div>

                    <span className="text-right font-extrabold text-[#0F2540] tabular-nums whitespace-nowrap">
                      {row.count}건
                    </span>

                    <span className="text-right text-[8px] font-medium text-slate-400 whitespace-nowrap">
                      {row.changeText}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#0F2540] text-sm">주요 공지사항</h3>
            <button className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <ul className="space-y-3">
            {STATIC_NOTICES.map((n) => (
              <li key={n.title} className="flex items-start gap-2.5">
                <n.icon className={`w-4 h-4 mt-0.5 shrink-0 ${n.tone}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-600 leading-snug truncate">{n.title}</p>
                </div>
                <span className="text-[10px] text-slate-300 shrink-0">{n.date}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
