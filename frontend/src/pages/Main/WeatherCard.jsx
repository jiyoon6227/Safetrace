import {
  MapPin, RefreshCw,
} from "lucide-react";
import { weatherEmoji, normalizeRainfall, airGradeClass, formatWeatherObservationTime } from "./utils";

// 현재 날씨 카드
export default function WeatherCard({
  weatherLocation,
  weatherLocationLabel,
  currentWeather,
  currentAirQuality,
  weatherLoading,
  weatherError,
  setWeatherError,
  setWeatherRefreshKey,
  weatherLocating,
  requestWeatherLocation,
}) {
  return (
    <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold text-[#0B2A52]">현재 날씨</h2>

        <button
          type="button"
          onClick={() => {
            if (!weatherLocation || weatherLoading) return;
            setWeatherError("");
            setWeatherRefreshKey((value) => value + 1);
          }}
          disabled={weatherLoading || !weatherLocation}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          title="날씨 새로고침"
          aria-label="날씨 새로고침"
        >
          <RefreshCw className={`w-4 h-4 ${weatherLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!weatherLocation ? (
        <div className="mt-3 flex min-h-[112px] items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-[#0B2A52]">내 위치의 날씨를 확인해보세요.</p>
            <p className="mt-1 text-[10px] text-slate-400">위치 권한은 버튼을 누를 때만 요청합니다.</p>
          </div>
          <button
            type="button"
            onClick={requestWeatherLocation}
            disabled={weatherLocating}
            className="h-9 shrink-0 cursor-pointer rounded-lg border border-blue-100 bg-blue-50 px-3 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
          >
            {weatherLocating ? "확인 중..." : "내 위치 확인"}
          </button>
        </div>
      ) : weatherLoading && !currentWeather ? (
        <div className="mt-3 flex min-h-[112px] items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          날씨 정보를 불러오는 중...
        </div>
      ) : currentWeather ? (
        <>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="text-[46px] leading-none">{weatherEmoji(currentWeather)}</div>

              <div className="min-w-0">
                <div className="flex items-end gap-1">
                  <span className="text-[31px] leading-none font-black tracking-tight text-[#0B2A52]">
                    {currentWeather.temperature ?? "-"}°C
                  </span>
                </div>

                <div className="mt-1.5 text-[12px] font-bold text-slate-600">
                  {currentWeather.precipitationType || "현재 상태"}
                </div>

                <div className="mt-0.5 text-[10px] text-slate-400">
                  풍속 {currentWeather.windSpeed ?? "-"}m/s
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1.5 border-l border-slate-100 pl-4 text-[11px]">
              <span className="text-slate-500">미세먼지</span>
              <b className={airGradeClass(currentAirQuality?.pm10Grade)}>
                {currentAirQuality?.pm10Grade || "-"}
              </b>

              <span className="text-slate-500">1시간 강수</span>
              <b className="text-[#0B2A52]">
                {normalizeRainfall(currentWeather.hourlyRainfall)}
              </b>

              <span className="text-slate-500">습도</span>
              <b className="text-[#0B2A52]">{currentWeather.humidity ?? "-"}%</b>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{weatherLocationLabel}</span>
            {formatWeatherObservationTime(currentWeather) && (
              <>
                <span className="text-slate-300">·</span>
                <span className="shrink-0">{formatWeatherObservationTime(currentWeather)}</span>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 flex min-h-[112px] items-center justify-between gap-3">
          <p className="text-[11px] text-red-500">
            {weatherError || "날씨 정보를 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            onClick={() => setWeatherRefreshKey((value) => value + 1)}
            className="h-8 shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            다시 시도
          </button>
        </div>
      )}

      {weatherError && currentWeather && (
        <p className="mt-2 text-[9px] text-slate-400">일부 환경정보를 불러오지 못했습니다.</p>
      )}
    </section>
  );
}
