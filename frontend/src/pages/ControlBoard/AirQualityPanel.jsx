import { useState } from "react";
import { Smile, Meh, Frown } from "lucide-react";
import { gradeForValue } from "./publicInfoUtils";

const GRADE_ORDER = { 좋음: 1, 보통: 2, 나쁨: 3, 매우나쁨: 4 };

export default function AirQualityPanel({ rows }) {
  const [metric, setMetric] = useState("pm25");
  const values = rows
    .map((item) => item?.[metric])
    .filter((value) => value != null && value !== "")
    .map(Number)
    .filter(Number.isFinite);
  const average = values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
  const summaryGrade = gradeForValue(average, metric);
  const availableCount = values.length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMetric("pm10")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
            metric === "pm10" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500"
          }`}
        >
          미세먼지 (PM10)
        </button>
        <button
          type="button"
          onClick={() => setMetric("pm25")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
            metric === "pm25" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500"
          }`}
        >
          초미세먼지 (PM2.5)
        </button>
        <div className="ml-auto flex items-center gap-2">
          <AirFace grade={summaryGrade} size="sm" />
          <div className="text-right">
            <p className="text-[10px] font-medium text-slate-400">{availableCount === 17 ? "전국 17개 시도 평균" : `조회 가능 ${availableCount}개 시도 평균`}</p>
            <p className="text-[12px] font-extrabold text-[#0F2540]">
              {average == null ? "대기질 정보 확인불가" : `${summaryGrade} · ${average}㎍/㎥`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
        {rows.map((item) => {
          const value = item?.[metric];
          const grade = gradeForValue(value, metric);
          return (
            <div key={item.sido} className="rounded-xl border border-slate-100 bg-white px-2.5 py-[5px] min-h-[58px]">
              <div className="flex items-center gap-2">
                <AirFace grade={grade} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-slate-700">{item.label}</span>
                    <span className="text-[9px] font-bold text-slate-500">{GRADE_ORDER[grade] ? grade : "정보없음"}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <strong className="text-[15px] font-extrabold text-[#0F2540] leading-none">{value ?? "-"}</strong>
                    <span className="text-[9px] font-medium text-slate-400">㎍/㎥</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AirLegend metric={metric} />
    </div>
  );
}

function AirLegend({ metric }) {
  const ranges = metric === "pm25"
    ? [
        ["좋음", "0~15"],
        ["보통", "16~35"],
        ["나쁨", "36~75"],
        ["매우나쁨", "76~"],
      ]
    : [
        ["좋음", "0~30"],
        ["보통", "31~80"],
        ["나쁨", "81~150"],
        ["매우나쁨", "151~"],
      ];

  const colors = {
    좋음: "bg-cyan-500",
    보통: "bg-emerald-500",
    나쁨: "bg-orange-500",
    매우나쁨: "bg-rose-500",
  };

  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
        <span className="text-[11px] sm:text-[12px] font-extrabold text-slate-700 whitespace-nowrap">등급 기준</span>
        {ranges.map(([grade, range]) => (
          <span key={grade} className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-semibold text-slate-600 whitespace-nowrap">
            <span className={`w-3 h-3 rounded-full ${colors[grade]}`} />
            <span>{grade}</span>
            <span className="text-slate-400">{range}</span>
          </span>
        ))}
        <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 whitespace-nowrap">단위 ㎍/㎥</span>
      </div>
    </div>
  );
}

export function AirFace({ grade, size = "md" }) {
  const config = {
    좋음: { Icon: Smile, wrap: "bg-cyan-500 text-white" },
    보통: { Icon: Smile, wrap: "bg-emerald-500 text-white" },
    나쁨: { Icon: Meh, wrap: "bg-orange-500 text-white" },
    매우나쁨: { Icon: Frown, wrap: "bg-rose-500 text-white" },
  }[grade] || { Icon: Meh, wrap: "bg-slate-400 text-white" };

  const sizeClass = {
    lg: "w-10 h-10",
    md: "w-8 h-8",
    sm: "w-7 h-7",
    xs: "w-6 h-6",
  }[size] || "w-8 h-8";

  const iconClass = {
    lg: "w-6 h-6",
    md: "w-[18px] h-[18px]",
    sm: "w-4 h-4",
    xs: "w-3.5 h-3.5",
  }[size] || "w-[18px] h-[18px]";

  const { Icon } = config;
  return (
    <div className={`${sizeClass} shrink-0 rounded-full flex items-center justify-center shadow-sm ${config.wrap}`}>
      <Icon className={iconClass} strokeWidth={2.5} />
    </div>
  );
}
