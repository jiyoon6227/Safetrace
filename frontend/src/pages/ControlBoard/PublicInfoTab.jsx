import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Cloud,
  CloudRain,
  Home,
  Loader2,
  Megaphone,
  RefreshCw,
  Smile,
  Meh,
  Frown,
  Wind,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { authFetch } from "../../api/client";
import { SIDO_CENTER } from "./constants";

const CACHE_KEY = "safetrace:public-info:nationwide:v9";
const CACHE_TTL = 10 * 60 * 1000;

// 에어코리아 17개 시도 요청을 한꺼번에 몰아치지 않도록 배치 조회한다.
// 일부 지역이 일시적으로 실패하면 그 지역만 재시도하고, 마지막으로 성공했던 캐시값을 유지한다.
const AIR_BATCH_SIZE = 4;
const AIR_BATCH_DELAY = 220;
const AIR_RETRY_DELAY = 700;
const AIR_RETRY_BATCH_SIZE = 2;

const DISPLAY_REGIONS = [
  { sido: "서울특별시", label: "서울" },
  { sido: "인천광역시", label: "인천" },
  { sido: "대전광역시", label: "대전" },
  { sido: "광주광역시", label: "광주" },
  { sido: "대구광역시", label: "대구" },
  { sido: "부산광역시", label: "부산" },
  { sido: "강원특별자치도", label: "강원" },
  { sido: "제주특별자치도", label: "제주" },
];

const AIR_REGIONS = [
  { sido: "서울특별시", label: "서울" },
  { sido: "경기도", label: "경기" },
  { sido: "인천광역시", label: "인천" },
  { sido: "강원특별자치도", label: "강원" },
  { sido: "세종특별자치시", label: "세종" },
  { sido: "충청북도", label: "충북" },
  { sido: "충청남도", label: "충남" },
  { sido: "대전광역시", label: "대전" },
  { sido: "경상북도", label: "경북" },
  { sido: "대구광역시", label: "대구" },
  { sido: "전북특별자치도", label: "전북" },
  { sido: "광주광역시", label: "광주" },
  { sido: "전라남도", label: "전남" },
  { sido: "경상남도", label: "경남" },
  { sido: "울산광역시", label: "울산" },
  { sido: "부산광역시", label: "부산" },
  { sido: "제주특별자치도", label: "제주" },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAirRegion(region) {
  try {
    const data = await authFetch(
      `/api/environment/air-quality?sido=${encodeURIComponent(region.sido)}`
    );
    if (!data?.available) return null;
    return { ...region, ...data, available: true };
  } catch {
    return null;
  }
}

async function fetchAirQualityStable(previousRows = []) {
  const successMap = new Map();
  const failed = [];

  // 1차: 17개 시도를 4개씩 나눠 조회
  for (let i = 0; i < AIR_REGIONS.length; i += AIR_BATCH_SIZE) {
    const batch = AIR_REGIONS.slice(i, i + AIR_BATCH_SIZE);
    const batchRows = await Promise.all(batch.map(fetchAirRegion));

    batchRows.forEach((row, index) => {
      const region = batch[index];
      if (row) successMap.set(region.sido, row);
      else failed.push(region);
    });

    if (i + AIR_BATCH_SIZE < AIR_REGIONS.length) {
      await sleep(AIR_BATCH_DELAY);
    }
  }

  // 2차: 실패한 지역만 잠깐 기다렸다가 2개씩 재시도
  if (failed.length > 0) {
    await sleep(AIR_RETRY_DELAY);

    for (let i = 0; i < failed.length; i += AIR_RETRY_BATCH_SIZE) {
      const batch = failed.slice(i, i + AIR_RETRY_BATCH_SIZE);
      const retryRows = await Promise.all(batch.map(fetchAirRegion));

      retryRows.forEach((row, index) => {
        if (row) successMap.set(batch[index].sido, row);
      });

      if (i + AIR_RETRY_BATCH_SIZE < failed.length) {
        await sleep(AIR_BATCH_DELAY);
      }
    }
  }

  // 재시도까지 실패한 지역은 이전에 성공했던 값이 있으면 유지한다.
  const previousMap = new Map(
    (Array.isArray(previousRows) ? previousRows : [])
      .filter((row) => row?.sido && row?.available !== false)
      .map((row) => [row.sido, row])
  );

  return AIR_REGIONS.flatMap((region) => {
    const fresh = successMap.get(region.sido);
    if (fresh) return [fresh];

    const previous = previousMap.get(region.sido);
    if (previous) {
      return [{ ...region, ...previous, available: true, cachedFallback: true }];
    }

    return [];
  });
}

const SHELTER_REGIONS = [
  { sido: "서울특별시", label: "서울" },
  { sido: "인천광역시", label: "인천" },
  { sido: "대전광역시", label: "대전" },
  { sido: "부산광역시", label: "부산" },
  { sido: "광주광역시", label: "광주" },
  { sido: "대구광역시", label: "대구" },
  { sido: "제주특별자치도", label: "제주" },
  { sido: "세종특별자치시", label: "세종" },
];

// 카카오맵 자체 마커 대신 대시보드용 날씨 카드 위치를 고정해서
// 서울/인천 등 인접 지역 카드가 서로 겹치지 않게 한다.
const WEATHER_MAP_POSITIONS = {
  서울: { left: "39%", top: "23%" },
  인천: { left: "23%", top: "33%" },
  강원: { left: "66%", top: "20%" },
  대전: { left: "44%", top: "43%" },
  대구: { left: "65%", top: "52%" },
  광주: { left: "34%", top: "61%" },
  부산: { left: "69%", top: "68%" },
  제주: { left: "28%", top: "83%" },
};

const GRADE_ORDER = { 좋음: 1, 보통: 2, 나쁨: 3, 매우나쁨: 4 };

const REGION_OPTIONS = [
  { sido: "서울특별시", label: "서울" },
  { sido: "경기도", label: "경기" },
  { sido: "인천광역시", label: "인천" },
  { sido: "강원특별자치도", label: "강원" },
  { sido: "세종특별자치시", label: "세종" },
  { sido: "충청북도", label: "충북" },
  { sido: "충청남도", label: "충남" },
  { sido: "대전광역시", label: "대전" },
  { sido: "경상북도", label: "경북" },
  { sido: "대구광역시", label: "대구" },
  { sido: "전북특별자치도", label: "전북" },
  { sido: "광주광역시", label: "광주" },
  { sido: "전라남도", label: "전남" },
  { sido: "경상남도", label: "경남" },
  { sido: "울산광역시", label: "울산" },
  { sido: "부산광역시", label: "부산" },
  { sido: "제주특별자치도", label: "제주" },
];

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

    // 최근 재난문자는 백엔드에서 전국 데이터를 한 번에 받아 정확히 최근 48시간만 사용한다.
    // 새 백엔드 엔드포인트가 아직 반영되지 않은 경우에는 기존 지역별 API로 자동 폴백한다.
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
    () => AIR_REGIONS.map((region) =>
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
              {updatedAt ? `${formatDate(updatedAt)} 업데이트` : "데이터 확인 중"}
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

function SummaryCard({ icon: Icon, tone, label, value, badge, badgeTone, sub, loading, extra }) {
  return (
    <div className="h-[88px] bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-[0_1px_2px_rgba(15,37,64,0.03)]">
      <div className="h-full flex items-center gap-3.5">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className="w-6 h-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            <strong className="text-[22px] leading-none text-[#0F2540] whitespace-nowrap">
              {loading ? "-" : value}
            </strong>
            {!loading && badge ? (
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold whitespace-nowrap ${badgeTone || "text-slate-500 bg-slate-50"}`}>
                {badge}
              </span>
            ) : null}
            <div className="ml-auto">{extra}</div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(15,37,64,0.03)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[#0F2540]">{title}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function NationwideWeatherMap({ weatherRows }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayRefs = useRef([]);
  const [selectedSido, setSelectedSido] = useState(weatherRows[0]?.sido || "서울특별시");
  const [mapReady, setMapReady] = useState(false);

  const selected = weatherRows.find((item) => item.sido === selectedSido) || weatherRows[0];

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const initMap = () => {
      if (cancelled) return;
      if (!mapRef.current || !window.kakao?.maps) {
        retryTimer = window.setTimeout(initMap, 200);
        return;
      }

      window.kakao.maps.load(() => {
        if (cancelled || !mapRef.current) return;

        const map = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(36.2, 127.8),
          level: 13,
        });

        // 공공정보 화면에서도 일반 지도처럼 직접 이동/확대할 수 있게 둔다.
        map.setDraggable(true);
        map.setZoomable(true);

        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        // 제주까지 포함한 주요 8개 권역이 첫 화면에 들어오도록 자동 맞춤한다.
        const bounds = new window.kakao.maps.LatLngBounds();
        DISPLAY_REGIONS.forEach((region) => {
          const center = SIDO_CENTER[region.sido];
          if (center) bounds.extend(new window.kakao.maps.LatLng(center.lat, center.lng));
        });
        map.setBounds(bounds, 36, 36, 36, 36);

        mapInstanceRef.current = map;
        setMapReady(true);
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map || !window.kakao?.maps) return;

    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

    // 수도권처럼 실제 좌표가 가까운 곳은 화면에서만 살짝 벌려 겹침을 줄인다.
    const visualOffset = {
      서울: { x: 18, y: -18 },
      인천: { x: -24, y: 8 },
      대전: { x: -4, y: -5 },
      광주: { x: -12, y: 4 },
      대구: { x: 14, y: -5 },
      부산: { x: 16, y: 12 },
      강원: { x: 8, y: -8 },
      제주: { x: 0, y: 6 },
    };

    weatherRows.forEach((item) => {
      const center = SIDO_CENTER[item.sido];
      if (!center) return;

      const active = item.sido === selected?.sido;
      const offset = visualOffset[item.label] || { x: 0, y: 0 };
      const content = document.createElement("button");
      content.type = "button";
      content.setAttribute("aria-label", `${item.label} 날씨 상세 보기`);
      content.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:5px",
        "min-width:58px",
        "height:34px",
        "padding:0 8px",
        "border-radius:17px",
        `border:${active ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,.95)"}`,
        "background:rgba(255,255,255,.96)",
        "box-shadow:0 3px 10px rgba(15,37,64,.18)",
        "font-family:inherit",
        "cursor:pointer",
        "white-space:nowrap",
        `transform:translate(${offset.x}px, ${offset.y}px)`,
      ].join(";");

      const city = document.createElement("span");
      city.textContent = item.label;
      city.style.cssText = "font-size:10px;font-weight:800;color:#475569;";

      const icon = document.createElement("span");
      icon.textContent = weatherEmoji(item);
      icon.style.cssText = "font-size:14px;line-height:1;";

      const temp = document.createElement("strong");
      temp.textContent = `${item.temperature ?? "-"}℃`;
      temp.style.cssText = "font-size:11px;font-weight:800;color:#0F2540;";

      content.append(city, icon, temp);
      content.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedSido(item.sido);
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        map,
        position: new window.kakao.maps.LatLng(center.lat, center.lng),
        content,
        xAnchor: 0.5,
        yAnchor: 0.5,
        clickable: true,
        zIndex: active ? 4 : 3,
      });

      overlayRefs.current.push(overlay);
    });

    return () => {
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
    };
  }, [mapReady, weatherRows, selected?.sido]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.38fr_0.62fr] gap-3 md:h-[340px]">
      <div className="relative min-h-[300px] md:min-h-0 overflow-hidden rounded-xl border border-slate-100 bg-[#dcebfa]">
        <div ref={mapRef} className="absolute inset-0" />

        {!mapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-sky-50">
            <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
          </div>
        ) : null}

        <div className="absolute left-2.5 bottom-2.5 rounded-lg border border-white/80 bg-white/90 px-2 py-1 shadow-sm pointer-events-none">
          <span className="text-[9px] font-semibold text-slate-500">마커 선택 · 지도 이동/확대 가능</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/65 px-3.5 py-3 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-[14px] font-extrabold text-[#0F2540]">{selected?.label || "-"}</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">{formatWeatherBaseTime(selected)}</p>
          </div>
          <span className="text-[32px] leading-none">{weatherEmoji(selected)}</span>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <strong className="text-[30px] leading-none text-[#0F2540]">{selected?.temperature ?? "-"}℃</strong>
          <span className="text-[11px] font-semibold text-slate-500 pb-0.5">{selected?.precipitationType || "-"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <WeatherMetric label="습도" value={`${selected?.humidity ?? "-"}%`} />
          <WeatherMetric label="풍속" value={`${selected?.windSpeed ?? "-"}m/s`} />
          <WeatherMetric label="1시간 강수" value={formatRainfall(selected?.hourlyRainfall)} />
          <WeatherMetric label="관측" value="초단기실황" />
        </div>

      </div>
    </div>
  );
}

function WeatherAlertPanel({ available, alerts }) {
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

function WeatherMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
      <p className="text-[9px] text-slate-400">{label}</p>
      <p className="text-[12px] font-bold text-slate-700 mt-0.5 whitespace-nowrap">{value}</p>
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

function ShelterTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-slate-100 text-[12px] font-bold text-slate-500">
            <th className="pb-2.5 pr-4">시설명</th>
            <th className="pb-2.5 pr-4">주소</th>
            <th className="pb-2.5 pr-4 text-right w-[100px]">수용인원</th>
            <th className="pb-2.5 text-right w-[80px]">거리</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((item, index) => (
            <tr key={`${item.region}-${item.name}-${index}`} className="border-b border-slate-50 last:border-0">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Home className="w-3.5 h-3.5" strokeWidth={2.3} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#0F2540] truncate">{item.name || "-"}</p>
                    <p className="text-[10.5px] font-medium text-slate-400 mt-0.5">{item.region || "-"}</p>
                  </div>
                </div>
              </td>
              <td className="py-2 pr-4 text-[12px] leading-5 text-slate-500 max-w-[360px] truncate">{item.address || "-"}</td>
              <td className="py-2 pr-4 text-[12px] font-semibold text-slate-600 text-right whitespace-nowrap">{formatCapacity(item.capacity)}</td>
              <td className="py-2 text-[12px] font-medium text-slate-500 text-right whitespace-nowrap">{formatDistance(item.distanceM)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children, maxWidth = "max-w-[900px]" }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${maxWidth} max-h-[86vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[18px] font-extrabold text-[#0F2540]">{title}</h3>
            <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DisasterMessageModal({ rows, onClose }) {
  const PAGE_SIZE = 10;
  const [typeFilter, setTypeFilter] = useState("전체");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    return (rows || []).filter((message) => {
      const category = getMessageCategory(message.disasterType);
      if (typeFilter !== "전체" && category !== typeFilter) return false;
      if (regionFilter !== "ALL") {
        const region = REGION_OPTIONS.find((item) => item.sido === regionFilter);
        const text = String(message.region || "");
        if (region && !text.includes(region.sido) && !text.includes(region.label)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, regionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, regionFilter]);

  return (
    <ModalShell title="최근 재난문자 전체보기" subtitle={`전국 · 최근 48시간 · ${filteredRows.length}건`} onClose={onClose} maxWidth="max-w-[860px]">
      <div className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {["전체", "풍랑", "호우", "산불", "기타"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  typeFilter === type
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <select
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="ALL">전체 지역</option>
            {REGION_OPTIONS.map((region) => (
              <option key={region.sido} value={region.sido}>{region.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[84px_150px_102px_minmax(0,1fr)] bg-slate-50 px-3 py-2 text-[10px] font-extrabold text-slate-500">
            <span>재난유형</span>
            <span>지역</span>
            <span>발송시각</span>
            <span>내용</span>
          </div>
          <div className="divide-y divide-slate-100">
            {pageRows.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-[12px] text-slate-400">조건에 맞는 재난문자가 없습니다.</div>
            ) : pageRows.map((message, index) => (
              <div key={message.sn || `${message.createdAt}-${index}`} className="grid min-h-[48px] grid-cols-[84px_150px_102px_minmax(0,1fr)] items-center px-3 py-2">
                <span className={`w-fit rounded-md px-2 py-1 text-[9px] font-bold ${messageBadgeTone(message.disasterType)}`}>
                  {message.disasterType || "기타"}
                </span>
                <span className="truncate pr-2 text-[10px] font-bold text-slate-700" title={message.region || "전국"}>{message.region || "전국"}</span>
                <span className="text-[9px] text-slate-400">{formatExternalDate(message.createdAt)}</span>
                <span className="line-clamp-2 pr-1 text-[10px] leading-4 text-slate-600" title={message.message || ""}>{message.message || "내용 없음"}</span>
              </div>
            ))}
          </div>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>
    </ModalShell>
  );
}

function ShelterModal({ onClose }) {
  const PAGE_SIZE = 10;
  const [region, setRegion] = useState("");
  const [inputKeyword, setInputKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
      });
      if (region) params.set("region", region);
      if (keyword) params.set("keyword", keyword);
      const data = await authFetch(`/api/environment/shelters/search?${params.toString()}`);
      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotalCount(Number(data?.totalCount) || 0);
    } catch (err) {
      setRows([]);
      setTotalCount(0);
      setError(err?.message || "대피시설을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [region, keyword, page]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <ModalShell title="대피시설 전체보기" subtitle={`전국 등록 민방위 대피시설 · ${totalCount.toLocaleString()}곳 조회`} onClose={onClose} maxWidth="max-w-[920px]">
      <div className="px-5 py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setKeyword(inputKeyword.trim());
          }}
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="">전체 지역</option>
            {REGION_OPTIONS.map((item) => (
              <option key={item.sido} value={item.sido}>{item.label}</option>
            ))}
          </select>

          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={inputKeyword}
              onChange={(event) => setInputKeyword(event.target.value)}
              placeholder="시설명 검색"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>
          <button type="submit" className="h-10 rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white hover:bg-blue-700">검색</button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[minmax(190px,1fr)_110px_minmax(270px,1.35fr)_110px] bg-slate-50 px-4 py-2.5 text-[12px] font-extrabold text-slate-500">
            <span>시설명</span>
            <span>지역</span>
            <span>주소</span>
            <span className="text-right">수용인원</span>
          </div>

          {loading ? (
            <div className="flex h-[360px] items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-[11px]">대피시설을 조회하는 중입니다.</span>
            </div>
          ) : error ? (
            <div className="flex h-[360px] items-center justify-center text-center text-[11px] text-rose-500">{error}</div>
          ) : rows.length === 0 ? (
            <div className="flex h-[360px] items-center justify-center text-[11px] text-slate-400">조건에 맞는 대피시설이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((item, index) => (
                <div key={`${item.name}-${item.address}-${index}`} className="grid min-h-[50px] grid-cols-[minmax(190px,1fr)_110px_minmax(270px,1.35fr)_110px] items-center px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Home className="h-3.5 w-3.5" strokeWidth={2.3} />
                    </span>
                    <span className="truncate text-[12px] font-bold text-[#0F2540]" title={item.name || ""}>{item.name || "-"}</span>
                  </div>
                  <span className="text-[12px] text-slate-500">{item.region || "-"}</span>
                  <span className="truncate pr-2 text-[12px] text-slate-500" title={item.address || ""}>{item.address || "-"}</span>
                  <span className="text-right text-[12px] font-semibold text-slate-600">{formatCapacity(item.capacity)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
      </div>
    </ModalShell>
  );
}

function Pagination({ page, totalPages, onChange, disabled = false }) {
  const pages = paginationNumbers(page, totalPages);
  return (
    <div className="mt-4 flex items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((item, index) => item === "…" ? (
        <span key={`ellipsis-${index}`} className="flex h-8 min-w-6 items-center justify-center text-[11px] text-slate-400">…</span>
      ) : (
        <button
          key={item}
          type="button"
          disabled={disabled}
          onClick={() => onChange(item)}
          className={`h-8 min-w-8 rounded-lg px-2 text-[11px] font-bold ${
            item === page ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {item}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function paginationNumbers(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
}

function getMessageCategory(type) {
  const text = String(type || "");
  if (text.includes("풍랑") || text.includes("강풍")) return "풍랑";
  if (text.includes("호우") || text.includes("홍수")) return "호우";
  if (text.includes("산불") || text.includes("화재")) return "산불";
  return "기타";
}

function AirQualityPanel({ rows }) {
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

function AirFace({ grade, size = "md" }) {
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

function LoadingBlock({ compact = false }) {
  return (
    <div className={`flex items-center justify-center text-slate-400 ${compact ? "min-h-[150px]" : "min-h-[340px]"}`}>
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-[11px] font-medium">공공데이터를 불러오는 중입니다.</span>
    </div>
  );
}

function EmptyBlock({ icon: Icon, title, compact = false }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50 flex flex-col items-center justify-center text-center ${compact ? "min-h-[150px]" : "min-h-[340px]"}`}>
      <Icon className="w-5 h-5 text-slate-400 mb-2" />
      <p className="text-[11px] font-bold text-slate-600">{title}</p>
      <p className="text-[9px] text-slate-400 mt-1">새로고침 후 다시 확인해주세요.</p>
    </div>
  );
}

async function fetchNationwideMessagesFallback() {
  const results = await Promise.allSettled(
    Object.keys(SIDO_CENTER).map((sido) =>
      authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(sido)}&limit=12`)
    )
  );

  return dedupeMessages(
    results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => Array.isArray(result.value) ? result.value : [])
  ).sort((a, b) => parseExternalDate(b.createdAt) - parseExternalDate(a.createdAt));
}

function pickRepresentativeShelters(results) {
  const rows = [];
  results.forEach((result) => {
    if (result.status !== "fulfilled" || !Array.isArray(result.value) || result.value.length === 0) return;
    rows.push(result.value[0]);
  });
  return rows.slice(0, 8);
}

function getTemperatureTrend(delta) {
  if (delta == null || !Number.isFinite(Number(delta))) {
    return { badge: null, tone: "", text: "8개 대표 권역 실시간 평균" };
  }

  const value = Number(delta);
  if (Math.abs(value) < 0.1) {
    return { badge: "±0.0℃", tone: "text-slate-500 bg-slate-50", text: "이전 조회와 비슷해요" };
  }

  if (value > 0) {
    return {
      badge: `▲ ${Math.abs(value).toFixed(1)}℃`,
      tone: "text-rose-500 bg-rose-50",
      text: "이전 조회보다 조금 높아요",
    };
  }

  return {
    badge: `▼ ${Math.abs(value).toFixed(1)}℃`,
    tone: "text-blue-500 bg-blue-50",
    text: "이전 조회보다 조금 낮아요",
  };
}

function averageTemperature(rows) {
  const values = (rows || [])
    .map((item) => Number(item.temperature))
    .filter(Number.isFinite);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function gradeForValue(value, metric) {
  // null/빈값은 Number(null) === 0 이라서 잘못 "좋음"으로 판정될 수 있으므로 먼저 차단한다.
  if (value == null || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";

  if (metric === "pm10") {
    if (number <= 30) return "좋음";
    if (number <= 80) return "보통";
    if (number <= 150) return "나쁨";
    return "매우나쁨";
  }

  if (number <= 15) return "좋음";
  if (number <= 35) return "보통";
  if (number <= 75) return "나쁨";
  return "매우나쁨";
}

function weatherEmoji(item) {
  const type = String(item?.precipitationType || "");
  if (type.includes("눈")) return "❄️";
  if (type.includes("비") || type.includes("소나기") || type.includes("빗방울")) return "🌧️";
  if (type.includes("흐림") || type.includes("구름")) return "☁️";
  return "☀️";
}

function formatWeatherBaseTime(item) {
  if (!item?.baseTime) return "현재 관측";
  const raw = String(item.baseTime).padStart(4, "0");
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)} 기준`;
}

function formatRainfall(value) {
  if (value == null || value === "") return "-";
  const text = String(value);
  if (text.includes("없음") || text === "0" || text === "0.0") return "강수없음";
  return text.includes("mm") ? text : `${text}mm`;
}

function messageBadgeTone(type) {
  const text = String(type || "");
  if (text.includes("호우") || text.includes("태풍") || text.includes("폭염") || text.includes("대설")) {
    return "bg-orange-50 text-orange-700";
  }
  if (text.includes("산불") || text.includes("화재")) return "bg-red-50 text-red-700";
  if (text.includes("지진")) return "bg-rose-50 text-rose-700";
  if (text.includes("풍랑") || text.includes("강풍")) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function dedupeMessages(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = item.sn || `${item.createdAt}|${item.region}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseExternalDate(value) {
  if (!value) return 0;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length >= 12) {
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6)) - 1;
    const day = Number(digits.slice(6, 8));
    const hour = Number(digits.slice(8, 10));
    const minute = Number(digits.slice(10, 12));
    return new Date(year, month, day, hour, minute).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatExternalDate(value) {
  const time = parseExternalDate(value);
  if (!time) return "-";
  const date = new Date(time);
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDistance(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  const meters = Number(value);
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}

function formatCapacity(value) {
  if (value == null || value === "") return "-";
  const number = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(number)) return String(value);
  return `${number.toLocaleString()}명`;
}

function normalizeWeatherAlerts(data) {
  return {
    available: data?.available === true,
    active: Array.isArray(data?.active) ? data.active : [],
    recentlyCleared: Array.isArray(data?.recentlyCleared) ? data.recentlyCleared : [],
  };
}

function splitWeatherAlertRegions(value) {
  return String(value || "")
    .split(/[,;/\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function flattenWeatherAlertRegions(alerts) {
  if (!Array.isArray(alerts)) return [];

  const regionMap = new Map();

  alerts.forEach((alert, alertIndex) => {
    const regions = splitWeatherAlertRegions(alert?.regionId || alert?.region);
    const normalizedRegions = regions.length > 0 ? regions : [alert?.region || ""];
    const typeLabel = weatherAlertTypeLabel(alert);

    normalizedRegions.forEach((region, regionIndex) => {
      const key = region || `unknown-${alertIndex}-${regionIndex}`;
      const previous = regionMap.get(key);

      if (previous) {
        const types = new Set([...(previous.types || []), typeLabel]);
        regionMap.set(key, { ...previous, types: [...types] });
        return;
      }

      regionMap.set(key, {
        ...alert,
        region,
        types: [typeLabel],
        key: `${alert?.announcedAt || alertIndex}-${regionIndex}-${region}`,
      });
    });
  });

  return [...regionMap.values()];
}

function weatherAlertTypeLabel(alert) {
  const text = [alert?.type, alert?.warningType, alert?.level, alert?.title]
    .filter(Boolean)
    .join(" ");
  const match = text.match(/(지진해일|풍랑|호우|강풍|폭염|한파|대설|건조|태풍|해일)\s*(주의보|경보)?/);
  if (match) return `${match[1]}${match[2] || ""}`;

  const title = String(alert?.title || "기상특보").trim();
  return title.split(/[:·]/)[0].trim() || "기상특보";
}

function summarizeWeatherAlert(title) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (!text) return "발효 중인 기상특보가 있습니다";
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

function formatWeatherAlertTime(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return "발표 시각 확인 중";
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.length >= 10 ? digits.slice(8, 10) : "";
  const minute = digits.length >= 12 ? digits.slice(10, 12) : "";
  return hour ? `${month}.${day} ${hour}:${minute || "00"} 발표` : `${month}.${day} 발표`;
}

function readCache(allowExpired = false) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt) return null;

    const expired = Date.now() - parsed.savedAt > CACHE_TTL;
    if (expired && !allowExpired) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 저장공간을 사용할 수 없는 환경에서는 캐시 없이 동작한다.
  }
}
