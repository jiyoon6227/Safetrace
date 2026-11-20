import { AlertTriangle } from "lucide-react";
import { flattenWeatherAlertRegions, weatherAlertTypeLabel, formatWeatherAlertTime } from "./publicInfoUtils";

export default function WeatherAlertPanel({ available, alerts }) {
  if (!available) {
    return (
      <div className="min-h-[330px] rounded-xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center text-center px-5">
        <AlertTriangle className="w-6 h-6 text-slate-400 mb-2" />
        <p className="text-[12px] font-bold text-slate-600">기상특보 정보를 확인하지 못했습니다.</p>
        <p className="text-[10px] text-slate-400 mt-1">새로고침 후 다시 확인해주세요.</p>
      </div>
    );
  }

  const regionRows = flattenWeatherAlertRegions(alerts);

  if (regionRows.length === 0) {
    return (
      <div className="min-h-[330px] rounded-xl border border-emerald-100 bg-emerald-50/60 flex flex-col items-center justify-center text-center px-5">
        <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[16px] font-black">✓</span>
        <p className="text-[12px] font-extrabold text-slate-700 mt-2">현재 발효 중인 기상특보가 없습니다.</p>
        <p className="text-[10px] text-slate-400 mt-1">전국 기준 현재 발효 상태입니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[330px] max-h-[390px] overflow-y-auto pr-1 divide-y divide-slate-100">
      {regionRows.map((item, index) => (
        <div key={item.key || `${item.region}-${index}`} className="py-3 first:pt-1.5 last:pb-1.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-600">
                  {item.types?.join(" · ") || weatherAlertTypeLabel(item)}
                </span>
                <span className="shrink-0 text-[9px] text-slate-400">{formatWeatherAlertTime(item?.announcedAt)}</span>
              </div>
              <p className="mt-1.5 text-[11px] font-bold leading-[16px] text-slate-700 break-words">
                {item.region || "발효 구역 확인 중"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
