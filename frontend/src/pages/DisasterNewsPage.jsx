import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert, Bell, ChevronRight, ArrowLeft, MapPin, Home, Users,
  Camera, User, FileText, Search, CalendarDays, RefreshCw, Heart,
  CloudRain, Flame, Waves, Car, Info, AlertTriangle, X, SlidersHorizontal
} from "lucide-react";
import { authFetch } from "../api/client";
import { useEscapeKey } from "../hooks/useEscapeKey";

// 행안부 쪽 지역명 표기가 정식명/약칭으로 들쭉날쭉해서 재시도용으로 쓰는 시/도 약칭 매핑
// (MyPage.jsx의 SIDO_SHORT_NAME과 동일 - 세종처럼 "구" 단위가 없는 지역까지 커버하기 위함)
const SIDO_SHORT_NAME = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

const TABS = [
  { key: "info", label: "내 정보", icon: User },
  { key: "family", label: "가족 관리", icon: Users },
  { key: "safety", label: "안전확인 이력", icon: ShieldAlert },
  { key: "reports", label: "내 제보 내역", icon: Camera },
  { key: "regions", label: "관심 지역", icon: MapPin },
  { key: "notify", label: "알림", icon: Bell },
];

const CATEGORY_FILTERS = [
  { key: "all", label: "전체" },
  { key: "weather", label: "기상", icon: CloudRain },
  { key: "fire", label: "화재·산불", icon: Flame },
  { key: "earthquake", label: "지진", icon: Waves },
  { key: "traffic", label: "교통", icon: Car },
  { key: "life", label: "생활안전", icon: Info },
  { key: "etc", label: "기타", icon: SlidersHorizontal },
];

const categoryOf = (msg) => {
  const text = `${msg?.disasterType || ""} ${msg?.emergencyLevel || ""} ${msg?.message || ""}`;

  if (/호우|태풍|폭염|한파|대설|강풍|풍랑|홍수|침수|기상|폭설|낙뢰|황사|가뭄/.test(text)) {
    return "weather";
  }
  if (/화재|산불|불길|연기/.test(text)) {
    return "fire";
  }
  if (/지진|여진/.test(text)) {
    return "earthquake";
  }
  if (/교통|도로|통제|차량|운전|결빙/.test(text)) {
    return "traffic";
  }
  if (/식중독|감염|응급|의료|대피|안전|실종|정전|단수|시설/.test(text)) {
    return "life";
  }
  return "etc";
};

const CATEGORY_META = {
  weather: {
    label: "기상",
    icon: CloudRain,
    badge: "bg-blue-50 text-blue-600",
    iconWrap: "bg-blue-50 text-blue-600",
  },
  fire: {
    label: "화재·산불",
    icon: Flame,
    badge: "bg-red-50 text-red-600",
    iconWrap: "bg-red-50 text-red-600",
  },
  earthquake: {
    label: "지진",
    icon: Waves,
    badge: "bg-violet-50 text-violet-600",
    iconWrap: "bg-violet-50 text-violet-600",
  },
  traffic: {
    label: "교통",
    icon: Car,
    badge: "bg-amber-50 text-amber-700",
    iconWrap: "bg-amber-50 text-amber-700",
  },
  life: {
    label: "생활안전",
    icon: Info,
    badge: "bg-emerald-50 text-emerald-600",
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  etc: {
    label: "기타",
    icon: AlertTriangle,
    badge: "bg-slate-100 text-slate-600",
    iconWrap: "bg-slate-100 text-slate-600",
  },
};

const parseMessageDate = (value) => {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .replace(/\./g, "-")
    .replace(/\//g, "-")
    .replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatMessageDate = (value) => {
  const date = parseMessageDate(value);
  if (!date) return value || "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toDateInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default function DisasterNewsPage({
  initialRegionId,
  onBackToHome,
  onLogout,
  onGoToMyPageTab,
}) {
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId ?? null);

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState(null);
  useEscapeKey(!!selectedMessage, () => setSelectedMessage(null));

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  // 더보기 페이지는 날짜 단위 조회이므로 기본값은 어제 ~ 오늘로 잡는다.
  // 메인 화면의 최근 48시간 표시는 백엔드의 /disaster-messages에서 별도로 유지된다.
  const [startDate, setStartDate] = useState(toDateInputValue(yesterday));
  const [endDate, setEndDate] = useState(toDateInputValue(today));

  const selectedRegion = regions.find(
    (r) => String(r.memberRegionId) === String(selectedRegionId)
  ) || regions[0] || null;

  useEffect(() => {
    setRegionsLoading(true);
    authFetch("/api/mypage/regions")
      .then((data) => {
        setRegions(data || []);
        if ((data || []).length > 0) {
          const exists = (data || []).some(
            (r) => String(r.memberRegionId) === String(initialRegionId)
          );
          setSelectedRegionId(
            exists ? initialRegionId : data[0].memberRegionId
          );
        }
      })
      .catch(() => setRegions([]))
      .finally(() => setRegionsLoading(false));
  }, [initialRegionId]);

  const loadMessages = (region) => {
    if (!region?.latitude || !region?.longitude) {
      setMessages([]);
      return;
    }

    if (!startDate || !endDate) {
      setError("조회할 기간을 선택해주세요.");
      return;
    }

    if (startDate > endDate) {
      setMessages([]);
      setError("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    if (!window.kakao?.maps) {
      setError("지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setError("");
    setMessagesLoading(true);

    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2RegionCode(
        Number(region.longitude),
        Number(region.latitude),
        async (result, status) => {
          try {
            const regionCode =
              status === window.kakao.maps.services.Status.OK
                ? result.find((r) => r.region_type === "H") || result[0]
                : null;

            const sido = regionCode?.region_1depth_name;
            const gu = regionCode?.region_2depth_name;

            if (!sido) {
              setMessages([]);
              setError("선택한 지역의 행정구역 정보를 찾지 못했습니다.");
              return;
            }

            const regionQuery = gu ? `${sido} ${gu}` : sido;
            const regionFallback = gu || null;
            const regionShortFallback =
              gu && SIDO_SHORT_NAME[sido]
                ? `${SIDO_SHORT_NAME[sido]} ${gu}`
                : null;
            // 구 단위가 아니라 시/도 전체에 동시 발송되는 재난문자(예: 물놀이 안전수칙 안내처럼
            // 여러 광역시도에 한꺼번에 나가는 문자)는 원본 지역명이 구 없이 시/도명만 있어서
            // 위 세 조합으로는 안 걸림 -> 시/도명만으로도 별도 조회해서 합쳐야 함
            const regionSidoOnlyFallback = gu ? sido : null;

            const buildHistoryUrl = (rgnNm) =>
              `/api/environment/disaster-messages/history` +
              `?rgnNm=${encodeURIComponent(rgnNm)}` +
              `&startDate=${encodeURIComponent(startDate)}` +
              `&endDate=${encodeURIComponent(endDate)}` +
              `&limit=500`;

            // 구 단위 문자(당진시 등)랑 시/도 전체 문자(충청남도 전체 등)는 서로 다른 문자라
            // 둘 다 보여줘야 함. 구 단위에서 결과가 나왔다고 시/도 전체 조회를 건너뛰면
            // (예전 방식) 당진시처럼 자체 발송 문자가 있는 지역은 시/도 전체 문자가 계속 안 보임
            // -> 구 단위 fallback 체인 결과 + 시/도 전체 결과를 병렬로 가져와서 합친다.

            // 1차: 부산광역시 서구
            let districtData = await authFetch(buildHistoryUrl(regionQuery));

            // 2차: 서구
            if (!districtData?.length && regionFallback) {
              districtData = await authFetch(buildHistoryUrl(regionFallback));
            }

            // 3차: 부산 서구
            if (!districtData?.length && regionShortFallback) {
              districtData = await authFetch(buildHistoryUrl(regionShortFallback));
            }

            // 시/도 전체 발송 문자는 구 단위 결과 유무와 상관없이 항상 별도로 조회
            // 단, rgnNm="충청남도"로 조회하면 API가 "충청남도"로 시작하는 모든 시군 문자를
            // 다 돌려주므로, "진짜 시/도 전체 대상" 문자만 남긴다.
            // 주의: 여러 시/도에 동시발송된 문자는 region 필드에 "강원도,경기도,...,충청남도,..."
            // 처럼 콤마로 여러 지역이 나열돼서 옴 - 그래서 전체 문자열이 "충청남도"와 똑같은지가
            // 아니라, 콤마로 쪼갠 목록 안에 "충청남도"라는 토큰이 정확히 있는지로 판단해야 함.
            const sidoData = regionSidoOnlyFallback
              ? await authFetch(buildHistoryUrl(regionSidoOnlyFallback))
                  .then((data) =>
                    data.filter((msg) =>
                      (msg.region || "")
                        .split(",")
                        .map((r) => r.trim())
                        .includes(regionSidoOnlyFallback)
                    )
                  )
                  .catch(() => [])
              : [];

            const seen = new Set();
            const merged = [...(districtData || []), ...(sidoData || [])].filter((msg) => {
              // 백엔드가 SN 있으면 SN으로, 없으면 시각+지역+내용 조합으로 중복 판단하는 것과 동일한 기준
              const key = msg.sn ? `SN:${msg.sn}` : `${msg.createdAt}|${msg.region}|${msg.message}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            // CRT_DT가 "2026-09-12 12:10:00"처럼 공백으로 와서 Date()가 브라우저에 따라
            // 못 알아먹을 수 있어, "T"로 바꿔서 안전하게 파싱(백엔드 parseCrtDt와 같은 이유)
            const toTimestamp = (msg) => {
              const normalized = (msg.createdAt || "").replace(/\//g, "-").replace(" ", "T");
              const time = new Date(normalized).getTime();
              return Number.isNaN(time) ? 0 : time;
            };
            merged.sort((a, b) => toTimestamp(b) - toTimestamp(a));

            setMessages(merged);
          } catch (e) {
            setMessages([]);
            setError(e?.message || "안전·재난 소식을 불러오지 못했습니다.");
          } finally {
            setMessagesLoading(false);
          }
        }
      );
    });
  };

  useEffect(() => {
    setCategory("all");
    setQuery("");
    setPage(1);
    loadMessages(selectedRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion?.memberRegionId]);

  const messagesWithCategory = useMemo(
    () =>
      messages.map((message, index) => ({
        ...message,
        _id: `${message.createdAt || "time"}-${index}`,
        _category: categoryOf(message),
      })),
    [messages]
  );

  // 날짜 범위는 백엔드에서 실제 조회 조건으로 사용한다.
  // 프론트에서는 조회된 결과에 대해 검색어/카테고리/정렬만 적용한다.
  const matchesSearch = (msg) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const haystack = `${msg.message || ""} ${msg.region || ""} ${msg.disasterType || ""} ${msg.emergencyLevel || ""}`.toLowerCase();
    return haystack.includes(q);
  };

  const categoryCount = (key) =>
    messagesWithCategory.filter(
      (m) => (key === "all" || m._category === key) && matchesSearch(m)
    ).length;

  const filteredMessages = useMemo(() => {
    return messagesWithCategory
      .filter((msg) => {
        if (category !== "all" && msg._category !== category) return false;
        return matchesSearch(msg);
      })
      .sort((a, b) => {
        const ta = parseMessageDate(a.createdAt)?.getTime() || 0;
        const tb = parseMessageDate(b.createdAt)?.getTime() || 0;
        return sort === "oldest" ? ta - tb : tb - ta;
      });
  }, [messagesWithCategory, category, query, sort]);

  useEffect(() => {
    setPage(1);
  }, [category, query, sort]);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedMessages = filteredMessages.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const visiblePages = useMemo(() => {
    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    const result = [];
    for (let i = start; i <= Math.min(totalPages, start + 4); i += 1) {
      result.push(i);
    }
    return result;
  }, [safePage, totalPages]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2.5 hover:opacity-80 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-[#0F2540] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="leading-tight text-left">
              <div className="font-extrabold text-[#0F2540] text-lg tracking-tight">
                세이프트레이스
              </div>
              <div className="text-[10px] text-slate-400">
                함께 만드는 더 안전한 일상
              </div>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
            >
              홈으로
            </button>
            <button type="button" className="relative cursor-pointer">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <span className="w-px h-4 bg-slate-200" />
            <button
              onClick={onLogout}
              className="text-xs font-semibold text-slate-500 hover:text-red-500 cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
          <aside className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <h2 className="font-bold text-[#0F2540] px-2 py-1.5 mb-1">
                마이페이지
              </h2>
              <nav className="space-y-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => onGoToMyPageTab?.(key)}
                    className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer ${
                      key === "regions"
                        ? "bg-sky-100 text-sky-700"
                        : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          key === "regions"
                            ? "bg-sky-500 text-white"
                            : "text-slate-400"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      {label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </nav>
            </div>

            <div className="bg-gradient-to-br from-[#0F2540] to-[#1B3A5C] rounded-2xl p-5 relative overflow-hidden shadow-sm">
              <Heart className="w-28 h-28 text-white/10 fill-white/10 absolute -right-6 -bottom-6 rotate-[-12deg]" />
              <p className="text-sm font-bold text-white leading-snug relative mb-4">
                소중한 사람들의
                <br />
                안전을
                <br />
                함께 지켜요
              </p>
              <button
                onClick={() => onGoToMyPageTab?.("family")}
                className="relative w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center text-[#0F2540] shadow-md hover:bg-amber-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <button
                onClick={() => onGoToMyPageTab?.("regions")}
                className="hover:text-blue-600 cursor-pointer"
              >
                마이페이지
              </button>
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => onGoToMyPageTab?.("regions")}
                className="hover:text-blue-600 cursor-pointer"
              >
                관심 지역
              </button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-600 font-semibold">안전·재난 소식</span>
            </div>

            <section className="flex items-center gap-3">
              <button
                onClick={() => onGoToMyPageTab?.("regions")}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 shadow-sm cursor-pointer shrink-0"
                aria-label="관심 지역으로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <h1 className="text-2xl font-extrabold text-[#0F2540]">
                  안전·재난 소식
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  선택한 관심지역에 발송된 재난문자를 기간별로 확인할 수 있습니다.
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 mb-1">선택한 관심 지역</p>
                  <select
                    value={selectedRegionId ?? ""}
                    onChange={(e) => setSelectedRegionId(e.target.value)}
                    disabled={regionsLoading || regions.length === 0}
                    className="w-full bg-transparent outline-none text-sm font-extrabold text-[#0F2540] cursor-pointer truncate"
                  >
                    {regions.map((region) => (
                      <option
                        key={region.memberRegionId}
                        value={region.memberRegionId}
                      >
                        {region.regionLabel || "관심지역"} · {region.regionName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-[#0F2540]" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs text-slate-600 outline-none bg-transparent"
                  />
                  <span className="text-xs text-slate-300">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs text-slate-600 outline-none bg-transparent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 rounded-lg border border-slate-200 px-3 flex items-center gap-2 focus-within:border-blue-300">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="내용 또는 지역으로 검색"
                      className="w-full text-xs outline-none bg-transparent"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="text-slate-300 hover:text-slate-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      loadMessages(selectedRegion);
                    }}
                    disabled={messagesLoading}
                    className="h-9 px-4 rounded-lg bg-[#0F2540] hover:bg-[#1B3A5C] text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    검색
                  </button>
                </div>
              </div>
            </section>

            <section className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map(({ key, label, icon: Icon }) => {
                  const active = category === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={`h-8 px-3 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        active
                          ? "bg-[#0F2540] text-white border-[#0F2540]"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {label}
                      <span
                        className={`text-[9px] ${
                          active ? "text-white/70" : "text-slate-400"
                        }`}
                      >
                        {categoryCount(key)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 outline-none cursor-pointer self-end"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold text-[#0F2540]">
                    안전·재난 소식
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    검색 결과 {filteredMessages.length}건
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => loadMessages(selectedRegion)}
                  disabled={messagesLoading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-40"
                  aria-label="새로고침"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${
                      messagesLoading ? "animate-spin" : ""
                    }`}
                  />
                </button>
              </div>

              {error && (
                <div className="mx-5 mt-4 rounded-xl bg-red-50 text-red-600 text-xs px-3 py-2">
                  {error}
                </div>
              )}

              {messagesLoading ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">
                    안전·재난 소식을 불러오는 중...
                  </p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="py-16 text-center">
                  <AlertTriangle className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">
                    조건에 맞는 소식이 없습니다.
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    기간 또는 검색 조건을 변경해보세요.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pagedMessages.map((msg) => {
                    const meta =
                      CATEGORY_META[msg._category] || CATEGORY_META.etc;
                    const Icon = meta.icon;

                    return (
                      <button
                        key={msg._id}
                        type="button"
                        onClick={() => setSelectedMessage(msg)}
                        className="w-full text-left px-5 py-4 hover:bg-slate-50 transition flex items-center gap-3 cursor-pointer group"
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${meta.iconWrap}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                            {msg.emergencyLevel && (
                              <span className="text-[10px] font-semibold text-red-500">
                                {msg.emergencyLevel}
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-bold text-[#0F2540] leading-snug line-clamp-1">
                            {msg.message || "재난 안전 안내"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 truncate">
                            {msg.region || selectedRegion?.regionName || ""}
                          </p>
                        </div>

                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-[11px] text-slate-500 whitespace-nowrap">
                            {formatMessageDate(msg.createdAt)}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate">
                            {msg.disasterType || meta.label}
                          </p>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredMessages.length > 0 && (
                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <p className="text-[10px] text-slate-400">
                    총 {filteredMessages.length}건
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                      ‹
                    </button>

                    {visiblePages.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold cursor-pointer ${
                          p === safePage
                            ? "bg-blue-500 text-white"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={safePage === totalPages}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                      ›
                    </button>
                  </div>

                  <span className="w-[50px]" />
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {selectedMessage && (() => {
        const meta =
          CATEGORY_META[selectedMessage._category] || CATEGORY_META.etc;
        const Icon = meta.icon;

        return (
          <div
            className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-4"
            onClick={() => setSelectedMessage(null)}
          >
            <div
              className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.iconWrap}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-[#0F2540]">
                      안전·재난 소식 상세
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatMessageDate(selectedMessage.createdAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span
                    className={`text-[10px] font-extrabold px-2 py-1 rounded-full ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                  {selectedMessage.disasterType && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {selectedMessage.disasterType}
                    </span>
                  )}
                  {selectedMessage.emergencyLevel && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      {selectedMessage.emergencyLevel}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedMessage.message}
                </p>

                <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">수신 지역</p>
                      <p className="text-xs font-semibold text-slate-600">
                        {selectedMessage.region || selectedRegion?.regionName || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">발송 시각</p>
                      <p className="text-xs font-semibold text-slate-600">
                        {formatMessageDate(selectedMessage.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
