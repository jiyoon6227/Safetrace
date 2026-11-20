import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileDown,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { authFetch } from "../../api/client";
import { escapeCsv } from "../../utils/escapeCsv";
import { escapeHtml } from "../../utils/escapeHtml";
import ChartDetailModal from "./ChartDetailModal";
import { Card, DataTable, KpiCard } from "./StatisticsBlocks";
import { CompareBars, DonutChart, HorizontalBars, LineChart, MultiLineChart, StatusBars } from "./StatisticsCharts";
import { TAB_ITEMS, STATUS_META, formatNumber, formatHour, percent, changePercent, getPresetRange } from "./statisticsReportUtils";

export default function StatisticsReportTab() {
  const defaultRange = useMemo(() => getPresetRange(30), []);
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ from: defaultRange.from, to: defaultRange.to, region: "ALL", type: "ALL" });
  const [applied, setApplied] = useState({ from: defaultRange.from, to: defaultRange.to, region: "ALL", type: "ALL" });

  // 집계는 서버에서 끝내고, 조회 조건이 바뀌거나 새로고침할 때만 다시 받아온다.
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams(applied).toString();
    authFetch(`/api/incidents/stats/report?${query}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setUpdatedAt(new Date());
        setError("");
      })
      .catch(() => { if (!cancelled) setError("통계 데이터를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applied, reloadKey]);

  const reload = () => { setLoading(true); setReloadKey((k) => k + 1); };

  const { regionOptions = [], typeOptions = [], current = {}, previous = {} } = data || {};
  const typeRows = data?.types ?? [];
  const regionRows = data?.regions ?? [];
  const durationRows = data?.durations ?? [];
  const trend = data?.trend ?? [];
  const compareCurrent = data?.compareCurrent ?? [];
  const comparePrevious = data?.comparePrevious ?? [];
  const statusRows = (data?.statuses ?? []).map((r) => ({ status: r.label, value: r.value }));

  const totalIncidents = current.total ?? 0;
  const closed = current.closed ?? 0;
  const high = current.high ?? 0;
  const avgHours = current.avgCloseHours;
  const prevAvgHours = previous.avgCloseHours;

  const kpis = [
    {
      icon: ShieldAlert, label: "총 사건 수", value: `${formatNumber(totalIncidents)}건`, tone: "blue",
      delta: changePercent(totalIncidents, previous.total), sub: "선택 기간 내 등록 사건 · 전 기간 대비",
    },
    {
      icon: CheckCircle2, label: "처리 완료", value: `${formatNumber(closed)}건`, tone: "green",
      delta: changePercent(closed, previous.closed), sub: `종료율 ${percent(closed, totalIncidents).toFixed(1)}%`,
    },
    {
      icon: Clock3, label: "평균 처리시간", value: formatHour(avgHours), tone: "orange", goodWhenDown: true,
      delta: avgHours == null || prevAvgHours == null ? 0 : changePercent(avgHours, prevAvgHours), sub: "종료 사건의 접수→최종 업데이트 기준",
    },
    {
      icon: AlertTriangle, label: "긴급 사건", value: `${formatNumber(high)}건`, tone: "red",
      delta: changePercent(high, previous.high), sub: `전체 사건의 ${percent(high, totalIncidents).toFixed(1)}%`,
    },
    {
      icon: BarChart3, label: "시민 제보", value: `${formatNumber(current.reports)}건`, tone: "purple",
      delta: changePercent(current.reports ?? 0, previous.reports), sub: "선택 기간 내 접수된 제보",
    },
  ];

  const topTypes = typeRows.slice(0, 4).map((r) => r.label);
  const typeTrend = trend;

  const typeDetailRows = (data?.typeDetails ?? []).map((r) => ({
    ...r,
    pct: percent(r.value, totalIncidents),
    inProgress: Math.max(0, r.value - r.closed),
    closeRate: percent(r.closed, r.value),
    avgHours: r.avgCloseHours,
    delta: changePercent(r.value, r.previousValue),
  }));
  const regionDetailRows = (data?.regionDetails ?? []).map((r) => ({
    ...r,
    pct: percent(r.value, totalIncidents),
    delta: changePercent(r.value, r.previousValue),
  }));

  const quickRange = (days) => setFilters((f) => ({ ...f, ...getPresetRange(days) }));
  const applyFilters = () => {
    if (!filters.from || !filters.to || filters.from > filters.to) return;
    setLoading(true);
    setApplied({ ...filters });
  };
  const resetFilters = () => {
    const range = getPresetRange(30);
    const next = { ...range, region: "ALL", type: "ALL" };
    setFilters(next); setLoading(true); setApplied(next);
  };

  const openPrintWindow = (autoPrint = true) => {
    const topType = typeRows.slice(0, 6);
    const topRegion = regionRows.slice(0, 8);
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>SafeTrace 재난·안전 통계보고서</title>
      <style>body{font-family:Arial,'Noto Sans KR',sans-serif;color:#0f2540;margin:36px}h1{font-size:26px;margin:0}small{color:#64748b}.head{border-bottom:2px solid #0f2540;padding-bottom:18px;margin-bottom:22px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.k{border:1px solid #e2e8f0;border-radius:12px;padding:12px}.k b{display:block;font-size:20px;margin-top:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}.box{border:1px solid #e2e8f0;border-radius:12px;padding:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc}.bar{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#3b82f6}@media print{button{display:none}body{margin:16mm}}</style></head><body>
      <div class="head"><h1>SafeTrace 재난·안전 통계보고서</h1><small>${escapeHtml(applied.from)} ~ ${escapeHtml(applied.to)} · 지역 ${applied.region === "ALL" ? "전체" : escapeHtml(applied.region)} · 유형 ${applied.type === "ALL" ? "전체" : escapeHtml(applied.type)}</small></div>
      <div class="kpis">${kpis.map((k) => `<div class="k"><small>${escapeHtml(k.label)}</small><b>${escapeHtml(k.value)}</b><small>${escapeHtml(k.sub)}</small></div>`).join("")}</div>
      <div class="grid"><div class="box"><h3>재난 유형별</h3><table><tr><th>유형</th><th>건수</th><th>비율</th></tr>${topType.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td><td>${percent(r.value,totalIncidents).toFixed(1)}%</td></tr>`).join("")}</table></div>
      <div class="box"><h3>지역별</h3><table><tr><th>지역</th><th>건수</th><th>비율</th></tr>${topRegion.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td><td>${percent(r.value,totalIncidents).toFixed(1)}%</td></tr>`).join("")}</table></div></div>
      <div class="box" style="margin-top:18px"><h3>대응 상태</h3>${statusRows.map((r) => `<p style="display:grid;grid-template-columns:90px 1fr 55px;gap:10px;align-items:center;font-size:12px"><span>${escapeHtml(STATUS_META[r.status]?.label ?? r.status)}</span><span class="bar"><i style="width:${percent(r.value,Math.max(1,totalIncidents))}%"></i></span><b>${escapeHtml(r.value)}건</b></p>`).join("")}</div>
      <p style="margin-top:22px;font-size:10px;color:#94a3b8">※ 평균 처리시간은 종료 사건의 CREATED_AT부터 최종 UPDATED_AT까지를 기준으로 계산합니다.</p>
      <script>window.onload=()=>{${autoPrint ? "setTimeout(()=>window.print(),250);" : ""}}</script></body></html>`;
    const win = window.open("", "_blank", "width=1100,height=850");
    if (!win) return;
    win.document.open(); win.document.write(html); win.document.close();
  };

  const downloadExcel = () => {
    const rows = [
      ["SafeTrace 통계보고서"],
      ["기간", applied.from, applied.to],
      ["지역", applied.region], ["재난유형", applied.type], [],
      ["구분", "값"], ...kpis.map((k) => [k.label, k.value]), [],
      ["재난유형", "사건수", "비율"], ...typeRows.map((r) => [r.label, r.value, `${percent(r.value,totalIncidents).toFixed(1)}%`]), [],
      ["지역", "사건수", "비율"], ...regionRows.map((r) => [r.label, r.value, `${percent(r.value,totalIncidents).toFixed(1)}%`]), [],
      ["상태", "사건수"], ...statusRows.map((r) => [STATUS_META[r.status]?.label || r.status, r.value]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SafeTrace_통계보고서_${applied.from}_${applied.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeColumns = [
    { key: "rank", label: "순위", render: (_, idx) => <span className="font-bold text-slate-400">{idx + 1}</span> },
    { key: "label", label: "재난 유형", render: (r) => <span className="font-extrabold text-[#0F2540]">{r.label}</span> },
    { key: "value", label: "사건 수", align: "right", render: (r) => `${formatNumber(r.value)}건` },
    { key: "pct", label: "비율", align: "right", render: (r) => `${r.pct.toFixed(1)}%` },
    { key: "high", label: "긴급", align: "right", render: (r) => <span className={r.high > 0 ? "font-bold text-red-500" : "text-slate-500"}>{r.high}건</span> },
    { key: "closed", label: "처리 완료", align: "right", render: (r) => `${r.closed}건` },
    { key: "inProgress", label: "진행 중", align: "right", render: (r) => `${r.inProgress}건` },
    { key: "closeRate", label: "종료율", align: "right", render: (r) => `${r.closeRate.toFixed(1)}%` },
    { key: "avgHours", label: "평균 처리시간", align: "right", render: (r) => formatHour(r.avgHours) },
    { key: "topRegion", label: "주요 지역", render: (r) => <span className="font-semibold text-slate-700">{r.topRegion}</span> },
    { key: "delta", label: "전 기간 대비", align: "right", render: (r) => <span className={r.delta > 0 ? "font-bold text-red-500" : r.delta < 0 ? "font-bold text-blue-500" : "text-slate-400"}>{r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "-"} {Math.abs(r.delta).toFixed(0)}%</span> },
  ];
  const regionColumns = [
    { key: "rank", label: "순위", render: (_, idx) => <span className="font-bold text-slate-400">{idx + 1}</span> },
    { key: "label", label: "지역", render: (r) => <span className="font-bold text-[#0F2540]">{r.label}</span> },
    { key: "value", label: "사건", align: "right", render: (r) => `${r.value}건` },
    { key: "closed", label: "종료", align: "right", render: (r) => `${r.closed}건` },
    { key: "high", label: "긴급", align: "right", render: (r) => `${r.high}건` },
    { key: "pct", label: "비율", align: "right", render: (r) => `${r.pct.toFixed(1)}%` },
    { key: "delta", label: "전 기간 대비", align: "right", render: (r) => <span className={r.delta > 0 ? "font-bold text-red-500" : r.delta < 0 ? "font-bold text-blue-500" : "text-slate-400"}>{r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "-"} {Math.abs(r.delta).toFixed(0)}%</span> },
  ];


  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-blue-600">통계 보고서</p>
          <h1 className="mt-0.5 text-[26px] font-extrabold tracking-tight text-[#0F2540]">재난·안전 통계 분석</h1>
          <p className="mt-1 text-[12px] text-slate-600">사건·시민 제보 데이터를 기간, 지역, 재난 유형별로 분석합니다.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {updatedAt && <span className="mr-1 text-[10px] text-slate-400">{updatedAt.toLocaleString("ko-KR")} 업데이트</span>}
          <button onClick={() => openPrintWindow(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer hover:bg-slate-50 hover:border-slate-300"><FileDown className="h-4 w-4 text-red-500" />PDF 내보내기</button>
          <button onClick={downloadExcel} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer hover:bg-slate-50 hover:border-slate-300"><FileSpreadsheet className="h-4 w-4 text-emerald-600" />엑셀 다운로드</button>
          <button onClick={reload} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />새로고침</button>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
          {TAB_ITEMS.map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`cursor-pointer rounded-lg px-4 py-2.5 text-[12px] font-bold transition ${activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}>{tab.label}</button>)}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[142px] flex-1 max-w-[190px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">시작일</span><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({...f, from:e.target.value}))} className="w-full cursor-pointer rounded-xl border border-slate-200 py-2.5 pl-9 pr-2 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"/></div></label>
          <label className="min-w-[142px] flex-1 max-w-[190px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">종료일</span><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({...f, to:e.target.value}))} className="w-full cursor-pointer rounded-xl border border-slate-200 py-2.5 pl-9 pr-2 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"/></div></label>
          <div className="flex items-center gap-1 pb-[1px]">{[[1,"오늘"],[7,"7일"],[30,"30일"],[90,"3개월"],[365,"1년"]].map(([d,l]) => <button key={d} onClick={() => quickRange(d)} className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600">{l}</button>)}</div>
          <label className="min-w-[135px] flex-1 max-w-[185px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">지역</span><div className="relative"><select value={filters.region} onChange={(e) => setFilters((f)=>({...f,region:e.target.value}))} className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 px-3 py-2.5 pr-8 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"><option value="ALL">전체 지역</option>{regionOptions.map((r)=><option key={r} value={r}>{r}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div></label>
          <label className="min-w-[145px] flex-1 max-w-[200px]"><span className="mb-1 block text-[10px] font-bold text-slate-500">재난 유형</span><div className="relative"><select value={filters.type} onChange={(e) => setFilters((f)=>({...f,type:e.target.value}))} className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 px-3 py-2.5 pr-8 text-[12px] text-slate-700 outline-none transition-colors hover:border-blue-300 focus:border-blue-400"><option value="ALL">전체 유형</option>{typeOptions.map((t)=><option key={t} value={t}>{t}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/></div></label>
          <button onClick={applyFilters} className="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-[12px] font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.97]"><Search className="h-3.5 w-3.5"/>조회하기</button>
          <button onClick={resetFilters} className="h-[38px] cursor-pointer rounded-xl border border-slate-200 px-4 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97]">초기화</button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-700">{error}</div>}
      {loading && !data ? <div className="flex h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div> : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">{kpis.map((k)=><KpiCard key={k.label} {...k}/>)}</div>

          {activeTab === "overview" && <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr]">
              <Card title="사건 발생 추이" sub="선택 기간 내 사건 접수 건수" onClick={() => setModal({type:"trend",title:"사건 발생 추이 상세"})}><LineChart data={trend}/><p className="mt-1 text-right text-[9px] text-slate-400">차트를 클릭하면 크게 볼 수 있습니다.</p></Card>
              <Card title="재난 유형별 비율" sub="사건의 재난 유형 구성" onClick={() => setModal({type:"type",title:"재난 유형별 비율 상세"})}><DonutChart rows={typeRows} total={totalIncidents}/></Card>
              <Card title="지역별 사건 현황" sub="사건 발생 지역 상위 순" onClick={() => setModal({type:"region",title:"지역별 사건 현황 상세"})}><HorizontalBars rows={regionRows} total={totalIncidents}/></Card>
            </div>
            <div className="grid items-start gap-3 xl:grid-cols-[1.15fr_1fr_0.9fr]">
              <Card
                title={
                  <span className="inline-flex items-center gap-1.5">
                    최근 7일 비교
                    <span className="group relative inline-flex" onClick={(e) => e.stopPropagation()}>
                      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-blue-100 text-[10px] font-extrabold text-blue-600">?</span>
                      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-800 px-3 py-2.5 text-left text-[10px] font-medium leading-5 text-white shadow-xl group-hover:block">
                        선택한 종료일을 기준으로 최근 7일과 그 직전 7일의 사건 발생 건수를 날짜별로 비교합니다.
                      </span>
                    </span>
                  </span>
                }
                sub="최근 7일과 직전 7일의 사건 발생 건수를 날짜별로 비교합니다."
                onClick={() => setModal({type:"compare",title:"최근 7일 비교 상세"})}
              ><CompareBars currentRows={compareCurrent} previousRows={comparePrevious}/></Card>
              <Card title="처리 상태별 현황" sub="현재 선택 기간 사건의 진행 상태" className="self-start" onClick={() => setModal({type:"status",title:"처리 상태별 현황 상세"})}><StatusBars rows={statusRows}/></Card>
              <Card title="주요 재난 유형" sub="발생 건수 기준 상위 유형" className="self-start"><div className="divide-y divide-slate-100">{typeDetailRows.slice(0,5).map((r,idx)=><div key={r.label} className="flex items-center gap-2 rounded-lg px-1.5 py-3 text-[12px] transition-colors hover:bg-slate-50"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold ${idx<3?"bg-blue-50 text-blue-600":"bg-slate-100 text-slate-600"}`}>{idx+1}</span><span className="min-w-0 flex-1 truncate font-extrabold text-[#0F2540]">{r.label}</span><span className="font-bold text-slate-700">{r.value}건</span><span className={`w-12 text-right text-[10px] font-bold ${r.delta>0?"text-red-500":r.delta<0?"text-blue-500":"text-slate-400"}`}>{r.delta>0?"▲":r.delta<0?"▼":"-"} {Math.abs(r.delta).toFixed(0)}%</span></div>)}</div></Card>
            </div>
          </div>}

          {activeTab === "type" && <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
              <Card title="재난 유형별 사건 추이" sub="상위 4개 재난 유형의 기간별 변화" onClick={() => setModal({type:"typeTrend",title:"재난 유형별 사건 추이 상세"})}><MultiLineChart data={typeTrend} series={topTypes}/></Card>
              <Card title="재난 유형별 구성" sub="현재 필터 기준"><DonutChart rows={typeRows} total={totalIncidents}/></Card>
            </div>
            <Card title="재난 유형별 상세 통계" sub="유형별 건수·긴급·처리 현황·주요 지역·전 기간 대비" className="w-full mr-auto">
              <DataTable columns={typeColumns} rows={typeDetailRows}/>
            </Card>
          </div>}

          {activeTab === "region" && <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
            <Card title="지역별 발생 순위" sub="전국 시·도 수준 요약" onClick={() => setModal({type:"region",title:"지역별 발생 현황 상세"})}><HorizontalBars rows={regionRows} total={totalIncidents} maxRows={17}/></Card>
            <Card title="지역별 상세 통계" sub="사건·종료·긴급 현황"><DataTable columns={regionColumns} rows={regionDetailRows}/></Card>
          </div>}

          {activeTab === "status" && <div className="grid gap-3 xl:grid-cols-2">
            <Card title="처리 상태별 현황" sub="접수 → 확인 → 대응 → 복구 → 종료" onClick={() => setModal({type:"status",title:"대응 상태 상세"})}><StatusBars rows={statusRows}/></Card>
            <Card title="종료 사건 처리시간 분포" sub="종료 사건의 접수부터 최종 업데이트까지"><HorizontalBars rows={durationRows} total={Math.max(1,closed)} maxRows={5}/></Card>
            <Card title="대응 요약" sub="현재 선택 기간" className="xl:col-span-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {statusRows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const ratio = percent(r.value, totalIncidents);
                  return (
                    <div key={r.status} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${meta.chip}`}>{meta.label}</span>
                        <span className="text-[11px] font-bold text-slate-500">{ratio.toFixed(1)}%</span>
                      </div>
                      <strong className="mt-3 block text-[28px] leading-none font-extrabold tracking-tight text-[#0F2540]">{r.value}건</strong>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">전체 대비 {ratio.toFixed(1)}%</p>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                        <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${r.value > 0 ? Math.max(ratio, 8) : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>}


        </>
      )}

      <ChartDetailModal modal={modal} onClose={() => setModal(null)} trend={trend} typeRows={typeRows} regionRows={regionRows} statusRows={statusRows} compareCurrent={compareCurrent} comparePrevious={comparePrevious} typeTrend={typeTrend} topTypes={topTypes}/>
    </div>
  );
}
