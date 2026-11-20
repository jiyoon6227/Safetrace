import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Cloud,
  CloudRain,
  Home,
  Megaphone,
  RefreshCw,
  Wind,
  ChevronRight,
} from "lucide-react";
import { authFetch } from "../../api/client";
import { formatDotDateTime } from "../../utils/dateFormat";
import { SIDO_CENTER } from "./constants";
import { DISPLAY_REGIONS, SHELTER_REGIONS, SIDO_REGIONS } from "./publicInfoConstants";
import {
  readCache,
  writeCache,
  pickRepresentativeShelters,
  getTemperatureTrend,
  averageTemperature,
  gradeForValue,
  messageBadgeTone,
  dedupeMessages,
  parseExternalDate,
  formatExternalDate,
  formatCapacity,
  normalizeWeatherAlerts,
  splitWeatherAlertRegions,
  summarizeWeatherAlert,
} from "./publicInfoUtils";
import { fetchAirQualityStable, fetchNationwideMessagesFallback } from "./publicInfoApi";
import { SummaryCard, Panel, LoadingBlock, EmptyBlock } from "./PublicInfoBlocks";
import AirQualityPanel, { AirFace } from "./AirQualityPanel";
import NationwideWeatherMap from "./NationwideWeatherMap";
import WeatherAlertPanel from "./WeatherAlertPanel";
import DisasterMessageModal from "./DisasterMessageModal";
import ShelterModal from "./ShelterModal";

export default function PublicInfoTab() {
  const [weatherRows, setWeatherRows] = useState([]);
  const [messageRows, setMessageRows] = useState([]);
  const [shelterRows, setShelterRows] = useState([]);
  const [shelterTotal, setShelterTotal] = useState(null);
  const [airRows, setAirRows] = useState([]);
  const [weatherAlerts, setWeatherAlerts] = useState({ available: false, active: [], recentlyCleared: [] });
  const [temperatureDelta, setTemperatureDelta] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingShelters, setLoadingShelters] = useState(true);
  const [loadingAir, setLoadingAir] = useState(true);
  const [loadingWeatherAlerts, setLoadingWeatherAlerts] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [shelterModalOpen, setShelterModalOpen] = useState(false);

  const loadDashboard = useCallback(async ({ force = false } = {}) => {
    const previousCache = readCache(true);

    if (!force) {
      const cached = readCache(false);
      if (cached) {
        setWeatherRows(cached.weatherRows || []);
        setMessageRows(cached.messageRows || []);
        setShelterRows(cached.shelterRows || []);
        setShelterTotal(cached.shelterTotal ?? null);
        setAirRows(cached.airRows || []);
        setWeatherAlerts(normalizeWeatherAlerts(cached.weatherAlerts));
        setTemperatureDelta(cached.temperatureDelta ?? null);
        setUpdatedAt(new Date(cached.savedAt));
        setLoadingWeather(false);
        setLoadingMessages(false);
        setLoadingShelters(false);
        setLoadingAir(false);
        setLoadingWeatherAlerts(false);
        return;
      }
    }

    setLoadingWeather(true);
    setLoadingMessages(true);
    setLoadingShelters(true);
    setLoadingAir(true);
    setLoadingWeatherAlerts(true);

    let nextWeather = [];
    let nextMessages = [];
    let nextShelters = [];
    let nextShelterTotal = null;
    let nextAir = [];
    let nextWeatherAlerts = { available: false, active: [], recentlyCleared: [] };

    const weatherJob = Promise.allSettled(
      DISPLAY_REGIONS.map(async (region) => {
        const center = SIDO_CENTER[region.sido];
        if (!center) return null;
        const data = await authFetch(`/api/environment/weather?lat=${center.lat}&lng=${center.lng}`);
        return { ...region, ...data };
      })
    ).then((results) => {
      nextWeather = results
        .filter((result) => result.status === "fulfilled" && result.value?.available)
        .map((result) => result.value);
      setWeatherRows(nextWeather);
      setLoadingWeather(false);
    });

    // 최근 재난문자: 전국 API로 최근 48시간 조회 (실패 시 지역별 API로 폴백)
    const messageJob = authFetch("/api/environment/disaster-messages/nationwide?limit=100")
      .catch(() => fetchNationwideMessagesFallback())
      .then((data) => {
        nextMessages = dedupeMessages(Array.isArray(data) ? data : [])
          .sort((a, b) => parseExternalDate(b.createdAt) - parseExternalDate(a.createdAt));
        setMessageRows(nextMessages);
        setLoadingMessages(false);
      })
      .catch(() => {
        nextMessages = [];
        setMessageRows([]);
        setLoadingMessages(false);
      });

    const shelterSummaryJob = authFetch("/api/environment/shelters/summary")
      .then((data) => {
        nextShelterTotal = data?.available && Number.isFinite(Number(data.totalCount))
          ? Number(data.totalCount)
          : null;
        setShelterTotal(nextShelterTotal);
      })
      .catch(() => {
        nextShelterTotal = null;
        setShelterTotal(null);
      });

    // 표에는 전국 시설을 전부 펼치지 않고 권역별 대표 시설만 보여준다.
    // 상단 카드의 '전국 대피시설' 숫자는 위 summary API의 실제 totalCount를 사용한다.
    const shelterListJob = Promise.allSettled(
      SHELTER_REGIONS.map(async (region) => {
        const center = SIDO_CENTER[region.sido];
        if (!center) return [];
        const data = await authFetch(
          `/api/environment/shelters?guName=${encodeURIComponent(center.guName)}&lat=${center.lat}&lng=${center.lng}&limit=2`
        );
        return (Array.isArray(data) ? data : []).map((item) => ({ ...item, region: region.label }));
      })
    ).then((results) => {
      nextShelters = pickRepresentativeShelters(results);
      setShelterRows(nextShelters);
      setLoadingShelters(false);
    });

    // 기상특보는 전국 기준 최근 3일 발표/해제 이력을 받아 현재 발효 상태를 요약한다.
    const weatherAlertJob = authFetch("/api/environment/weather-alerts?lookbackDays=3")
      .then((data) => {
        nextWeatherAlerts = normalizeWeatherAlerts(data);
        setWeatherAlerts(nextWeatherAlerts);
        setLoadingWeatherAlerts(false);
      })
      .catch(() => {
        nextWeatherAlerts = { available: false, active: [], recentlyCleared: [] };
        setWeatherAlerts(nextWeatherAlerts);
        setLoadingWeatherAlerts(false);
      });

    const airJob = fetchAirQualityStable(previousCache?.airRows || [])
      .then((rows) => {
        nextAir = rows;
        setAirRows(rows);
        setLoadingAir(false);
      })
      .catch(() => {
        // 전체 조회 자체가 예외로 끝나더라도 기존 성공 데이터는 화면에서 유지한다.
        nextAir = Array.isArray(previousCache?.airRows) ? previousCache.airRows : [];
        setAirRows(nextAir);
        setLoadingAir(false);
      });

    await Promise.allSettled([
      weatherJob,
      messageJob,
      shelterSummaryJob,
      shelterListJob,
      weatherAlertJob,
      airJob,
    ]);

    const previousAverage = averageTemperature(previousCache?.weatherRows || []);
    const nextAverage = averageTemperature(nextWeather);
    const nextDelta = previousAverage != null && nextAverage != null
      ? Number((nextAverage - previousAverage).toFixed(1))
      : previousCache?.temperatureDelta ?? null;

    const now = Date.now();
    setTemperatureDelta(nextDelta);
    setUpdatedAt(new Date(now));
    writeCache({
      weatherRows: nextWeather,
      messageRows: nextMessages,
      shelterRows: nextShelters,
      shelterTotal: nextShelterTotal,
      airRows: nextAir,
      weatherAlerts: nextWeatherAlerts,
      temperatureDelta: nextDelta,
      savedAt: now,
    });
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const averageTemp = useMemo(() => averageTemperature(weatherRows), [weatherRows]);

  const averagePm25 = useMemo(() => {
    const values = airRows.map((item) => Number(item.pm25)).filter(Number.isFinite);
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [airRows]);

  const overallAirGrade = useMemo(
    () => gradeForValue(averagePm25, "pm25"),
    [averagePm25]
  );

  const completeAirRows = useMemo(
    () => SIDO_REGIONS.map((region) =>
      airRows.find((item) => item.sido === region.sido) || { ...region, available: false }
    ),
    [airRows]
  );

  const weatherTrend = getTemperatureTrend(temperatureDelta);
  const activeWeatherAlerts = Array.isArray(weatherAlerts?.active) ? weatherAlerts.active : [];
  const activeWeatherAlertRegionCount = new Set(
    activeWeatherAlerts.flatMap((alert) => splitWeatherAlertRegions(alert?.regionId || alert?.region))
  ).size;
  const weatherAlertAvailable = weatherAlerts?.available === true;
  const refreshing = loadingWeather || loadingMessages || loadingShelters || loadingAir || loadingWeatherAlerts;

  return (
    <div className="min-h-[calc(100vh-57px)] bg-[#F6F9FC]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-5 space-y-3.5">
        <section className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold text-blue-600 mb-0.5">공공 정보</p>
            <h2 className="text-[24px] leading-tight font-extrabold tracking-tight text-[#0F2540]">
              전국 공공안전 정보
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">
              기상·기상특보·재난문자·대피시설·대기질 정보를 한 화면에서 확인합니다.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="text-[11px] text-slate-400">
              {updatedAt ? `${formatDotDateTime(updatedAt)} 업데이트` : "데이터 확인 중"}
            </span>
            <button
              type="button"
              onClick={() => loadDashboard({ force: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              새로고침
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <SummaryCard
            icon={Cloud}
            tone="bg-sky-100 text-sky-600"
            label="전국 평균 기온"
            value={averageTemp == null ? "-" : `${averageTemp.toFixed(1)}℃`}
            badge={weatherTrend.badge}
            badgeTone={weatherTrend.tone}
            sub={weatherTrend.text}
            loading={loadingWeather}
          />
          <SummaryCard
            icon={AlertTriangle}
            tone={activeWeatherAlerts.length > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}
            label="발효 중 기상특보"
            value={weatherAlertAvailable ? `${activeWeatherAlertRegionCount}개 구역` : "확인불가"}
            sub={
              weatherAlertAvailable
                ? activeWeatherAlerts.length > 0
                  ? summarizeWeatherAlert(activeWeatherAlerts[0]?.title)
                  : "현재 발효 중인 특보 없음"
                : "기상특보 조회 상태를 확인해주세요"
            }
            loading={loadingWeatherAlerts}
          />
          <SummaryCard
            icon={Megaphone}
            tone="bg-indigo-100 text-indigo-600"
            label="최근 재난문자"
            value={`${messageRows.length}건`}
            badge="48시간"
            badgeTone="text-blue-600 bg-blue-50"
            sub="전국 발송 기준"
            loading={loadingMessages}
          />
          <SummaryCard
            icon={Home}
            tone="bg-emerald-100 text-emerald-600"
            label="전국 대피시설"
            value={shelterTotal == null ? "-" : `${shelterTotal.toLocaleString()}곳`}
            sub="전국 등록 민방위 대피시설"
            loading={loadingShelters}
          />
          <SummaryCard
            icon={Wind}
            tone="bg-violet-100 text-violet-600"
            label="대기질"
            value={averagePm25 == null ? "확인불가" : overallAirGrade}
            sub={averagePm25 == null ? "대기질 정보를 불러오지 못했습니다" : `주요지역 평균 PM2.5 ${averagePm25}㎍/㎥`}
            loading={loadingAir}
            extra={!loadingAir && averagePm25 != null ? <AirFace grade={overallAirGrade} size="sm" /> : null}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.16fr_0.84fr] gap-3.5 items-stretch">
          <Panel
            title="전국 날씨 현황"
            subtitle="전국 주요 지역의 현재 날씨를 지도에서 한눈에 확인합니다."
          >
            {loadingWeather ? (
              <LoadingBlock />
            ) : weatherRows.length === 0 ? (
              <EmptyBlock icon={CloudRain} title="날씨 정보를 불러오지 못했습니다" />
            ) : (
              <NationwideWeatherMap weatherRows={weatherRows} />
            )}
          </Panel>

          <Panel
            title="최근 재난문자"
            subtitle="전국 · 최근 48시간"
            action={
              <button
                type="button"
                onClick={() => setMessageModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
              >
                전체보기 <ChevronRight className="w-3 h-3" />
              </button>
            }
          >
            {loadingMessages ? (
              <LoadingBlock />
            ) : messageRows.length === 0 ? (
              <EmptyBlock icon={Megaphone} title="최근 조회된 재난문자가 없습니다" />
            ) : (
              <DisasterMessageList rows={messageRows} />
            )}
          </Panel>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[0.88fr_1.32fr_0.92fr] gap-3.5 items-stretch">
          <Panel
            title="기상특보 현황"
            subtitle="현재 전국에 발효 중인 기상특보를 구역별로 확인합니다."
            action={
              weatherAlertAvailable ? (
                <span className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold ${
                  activeWeatherAlertRegionCount > 0
                    ? "bg-rose-50 text-rose-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}>
                  전국 {activeWeatherAlertRegionCount}개 구역
                </span>
              ) : null
            }
          >
            {loadingWeatherAlerts ? (
              <LoadingBlock compact />
            ) : (
              <WeatherAlertPanel available={weatherAlertAvailable} alerts={activeWeatherAlerts} />
            )}
          </Panel>

          <Panel
            title="대기질 현황"
            subtitle="전국 17개 시도의 실시간 대기질을 한눈에 확인합니다."
          >
            {loadingAir ? (
              <LoadingBlock compact />
            ) : (
              <AirQualityPanel rows={completeAirRows} />
            )}
          </Panel>

          <Panel
            title="대피시설"
            subtitle="주요 권역의 대표 대피시설을 간단히 표시합니다."
            action={
              <button
                type="button"
                onClick={() => setShelterModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
              >
                전체보기 <ChevronRight className="w-3 h-3" />
              </button>
            }
          >
            {loadingShelters ? (
              <LoadingBlock compact />
            ) : shelterRows.length === 0 ? (
              <EmptyBlock icon={Building2} title="조회된 대피시설이 없습니다" compact />
            ) : (
              <ShelterCompactList rows={shelterRows} />
            )}
          </Panel>
        </section>

        <footer className="px-1 pb-1">
          <p className="text-[10px] text-slate-400">
            공공기관 제공 데이터를 기반으로 하며 실제 재난 상황에서는 해당 기관의 공식 안내를 우선 확인하세요.
          </p>
        </footer>
      </div>

      {messageModalOpen ? (
        <DisasterMessageModal rows={messageRows} onClose={() => setMessageModalOpen(false)} />
      ) : null}

      {shelterModalOpen ? (
        <ShelterModal onClose={() => setShelterModalOpen(false)} />
      ) : null}
    </div>
  );
}

function DisasterMessageList({ rows }) {
  const visibleRows = rows.slice(0, 6);

  return (
    <div
      className="h-[340px] divide-y divide-slate-100 overflow-hidden grid"
      style={{ gridTemplateRows: `repeat(${visibleRows.length}, minmax(0, 1fr))` }}
    >
      {visibleRows.map((message, index) => (
        <div key={message.sn || `${message.createdAt}-${index}`} className="py-2 px-0.5 flex flex-col justify-center overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold ${messageBadgeTone(message.disasterType)}`}>
                {message.disasterType || "안전안내"}
              </span>
              <span className="text-[10px] font-bold text-slate-700 truncate">
                {message.region || "전국"}
              </span>
            </div>
            <span className="shrink-0 text-[9px] text-slate-400">{formatExternalDate(message.createdAt)}</span>
          </div>
          <p
            className="text-[11px] leading-[16px] text-slate-600 truncate"
            title={message.message || "내용 없음"}
          >
            {message.message || "내용 없음"}
          </p>
        </div>
      ))}
    </div>
  );
}

function ShelterCompactList({ rows }) {
  return (
    <div className="h-[376px] divide-y divide-slate-100 overflow-hidden">
      {rows.slice(0, 8).map((item, index) => (
        <div key={`${item.region}-${item.name}-${index}`} className="h-[47px] py-1.5 flex items-center">
          <div className="flex items-center gap-2.5 w-full min-w-0">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4" strokeWidth={2.3} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold leading-[15px] text-[#0F2540] truncate" title={item.name || ""}>
                  {item.name || "-"}
                </p>
                <span className="shrink-0 text-[10px] font-bold text-slate-600">{formatCapacity(item.capacity)}</span>
              </div>
              <p className="mt-0.5 text-[9.5px] leading-[13px] text-slate-400 truncate" title={item.address || ""}>
                {item.region ? `${item.region} · ` : ""}{item.address || "주소 정보 없음"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
