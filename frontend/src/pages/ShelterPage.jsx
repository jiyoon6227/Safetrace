import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Home,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
} from "lucide-react";
import { authFetch } from "../api/client";
import ServicePageLayout from "../components/ServicePageLayout";

const LOCATION_CACHE_KEY = "safetrace:last-location";
const PAGE_SIZE = 6;

function readCachedLocation() {
  try {
    const raw = window.sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function formatDistance(distanceM) {
  const value = Number(distanceM);
  if (!Number.isFinite(value)) return "거리 정보 없음";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
  return `${Math.round(value)}m`;
}

function shelterKey(shelter) {
  return `${shelter.name || "대피시설"}|${shelter.address || ""}`;
}

function openKakaoRoute(shelter) {
  const lat = Number(shelter.latitude);
  const lng = Number(shelter.longitude);
  const name = encodeURIComponent(shelter.name || "대피시설");

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    window.open(
      `https://map.kakao.com/link/to/${name},${lat},${lng}`,
      "_blank",
      "noopener,noreferrer"
    );
    return;
  }

  const keyword = encodeURIComponent(shelter.address || shelter.name || "대피시설");
  window.open(
    `https://map.kakao.com/link/search/${keyword}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function createShelterMarker(active = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", "대피시설");
  el.style.width = active ? "38px" : "32px";
  el.style.height = active ? "38px" : "32px";
  el.style.borderRadius = "50%";
  el.style.border = "3px solid #fff";
  el.style.background = active ? "#ef4444" : "#10b981";
  el.style.color = "#fff";
  el.style.fontWeight = "900";
  el.style.fontSize = active ? "18px" : "15px";
  el.style.boxShadow = "0 5px 15px rgba(15,35,65,.28)";
  el.style.cursor = "pointer";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.textContent = "⌂";
  return el;
}

function createLocationMarker() {
  const el = document.createElement("div");
  el.style.width = "22px";
  el.style.height = "22px";
  el.style.borderRadius = "50%";
  el.style.border = "4px solid #fff";
  el.style.background = "#2563eb";
  el.style.boxShadow = "0 0 0 7px rgba(37,99,235,.16), 0 4px 12px rgba(15,35,65,.24)";
  return el;
}

export default function ShelterPage({ initialRegionId, initialFocusShelter, onBackToHome, onLogin, onNavigate }) {
  const [location, setLocation] = useState(() => readCachedLocation());
  const [locationLabel, setLocationLabel] = useState("현재 위치");
  const [locating, setLocating] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapObjectsRef = useRef([]);
  const shelterPositionsRef = useRef(new Map());

  // 마이페이지 관심지역에서 들어온 경우에는 그 관심지역 좌표를 우선 사용한다.
  // 메인 퀵메뉴에서 들어오면 initialRegionId가 없으므로 sessionStorage의 현재 위치를 그대로 사용한다.
  useEffect(() => {
    if (!initialRegionId) return;

    let active = true;
    authFetch("/api/mypage/regions")
      .then((data) => {
        if (!active) return;
        const regions = Array.isArray(data) ? data : [];
        const region = regions.find(
          (item) => String(item.memberRegionId) === String(initialRegionId)
        );
        const lat = Number(region?.latitude);
        const lng = Number(region?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setLocation({ lat, lng });
        setLocationLabel(
          [region?.regionLabel, region?.regionName].filter(Boolean).join(" · ") ||
            "관심 지역"
        );
      })
      .catch(() => {
        // 관심지역 조회 실패 시 현재 위치 기반 흐름을 그대로 사용한다.
      });

    return () => {
      active = false;
    };
  }, [initialRegionId]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        try {
          window.sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(next));
        } catch {
          // 저장소 사용 불가 환경에서는 현재 화면에서만 사용
        }
        setLocation(next);
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError("위치 권한을 허용하면 가까운 대피시설을 확인할 수 있습니다.");
        } else if (geoError.code === geoError.TIMEOUT) {
          setError("위치 확인 시간이 초과됐습니다. 다시 시도해주세요.");
        } else {
          setError("현재 위치를 확인하지 못했습니다.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!location) {
      setShelters([]);
      setRegionQuery("");
      setLocationLabel("현재 위치를 확인해주세요");
      return undefined;
    }

    let active = true;
    let timerId = null;
    let attempts = 0;

    const resolveRegionAndLoad = () => {
      if (!active) return;

      if (!window.kakao?.maps?.services?.Geocoder) {
        attempts += 1;
        if (attempts >= 40) {
          setError("카카오 지도 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        timerId = window.setTimeout(resolveRegionAndLoad, 100);
        return;
      }

      const { lat, lng } = location;
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2RegionCode(lng, lat, async (result, status) => {
        if (!active) return;
        if (status !== window.kakao.maps.services.Status.OK || !result?.length) {
          setError("현재 위치의 행정구역을 확인하지 못했습니다.");
          return;
        }

        const region = result.find((item) => item.region_type === "H") || result[0];
        const sido = region?.region_1depth_name || "";
        const gu = region?.region_2depth_name || "";
        const label = [sido, gu].filter(Boolean).join(" ");
        const primaryQuery = label || sido;
        const fallbackQuery = gu || sido;

        setLocationLabel(label || "현재 위치");
        setRegionQuery(primaryQuery);
        setLoading(true);
        setError("");

        try {
          let data = await authFetch(
            `/api/environment/shelters?guName=${encodeURIComponent(primaryQuery)}&lat=${lat}&lng=${lng}&limit=100`
          );

          if ((!Array.isArray(data) || data.length === 0) && fallbackQuery && fallbackQuery !== primaryQuery) {
            data = await authFetch(
              `/api/environment/shelters?guName=${encodeURIComponent(fallbackQuery)}&lat=${lat}&lng=${lng}&limit=100`
            );
          }

          if (!active) return;
          const list = Array.isArray(data) ? data : [];
          setShelters(list);

          const initialMatch = initialFocusShelter
            ? list.find((shelter) => {
                const sameName =
                  String(shelter.name || "") === String(initialFocusShelter.name || "");
                const sameAddress =
                  String(shelter.address || "") === String(initialFocusShelter.address || "");
                return sameName && sameAddress;
              })
            : null;

          setSelectedKey(
            initialMatch
              ? shelterKey(initialMatch)
              : list.length
                ? shelterKey(list[0])
                : null
          );
          setPage(1);
        } catch (e) {
          if (!active) return;
          setShelters([]);
          setError(e?.message || "대피시설 정보를 불러오지 못했습니다.");
        } finally {
          if (active) setLoading(false);
        }
      });
    };

    resolveRegionAndLoad();

    return () => {
      active = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [location, initialFocusShelter]);

  const filteredShelters = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return shelters
      .filter((shelter) => {
        const distance = Number(shelter.distanceM);
        if (Number.isFinite(distance) && distance > radiusKm * 1000) return false;
        if (!keyword) return true;
        return `${shelter.name || ""} ${shelter.address || ""}`
          .toLowerCase()
          .includes(keyword);
      })
      .sort(
        (a, b) =>
          (Number(a.distanceM) || Number.MAX_SAFE_INTEGER) -
          (Number(b.distanceM) || Number.MAX_SAFE_INTEGER)
      );
  }, [shelters, radiusKm, query]);

  const totalPages = Math.max(1, Math.ceil(filteredShelters.length / PAGE_SIZE));
  const visibleShelters = filteredShelters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedShelter =
    filteredShelters.find((shelter) => shelterKey(shelter) === selectedKey) ||
    filteredShelters[0] ||
    null;
  const oneKmCount = shelters.filter((s) => Number(s.distanceM) <= 1000).length;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!mapRef.current || !location || !window.kakao?.maps?.load) return undefined;

    let disposed = false;
    let timerId = null;
    let attempts = 0;

    const buildMap = () => {
      if (disposed) return;

      if (!window.kakao?.maps?.Map) {
        attempts += 1;
        if (attempts >= 40) return;
        timerId = window.setTimeout(buildMap, 100);
        return;
      }

      window.kakao.maps.load(() => {
        if (disposed || !mapRef.current) return;

        mapObjectsRef.current.forEach((obj) => obj.setMap?.(null));
        mapObjectsRef.current = [];
        shelterPositionsRef.current = new Map();

        const center = new window.kakao.maps.LatLng(location.lat, location.lng);
        let map = mapInstanceRef.current;
        if (!map) {
          map = new window.kakao.maps.Map(mapRef.current, { center, level: 5 });
          const zoomControl = new window.kakao.maps.ZoomControl();
          map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
          mapInstanceRef.current = map;
        } else {
          map.relayout();
          map.setCenter(center);
          map.setLevel(5);
        }

        const myLocation = new window.kakao.maps.CustomOverlay({
          position: center,
          content: createLocationMarker(),
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 10,
        });
        myLocation.setMap(map);
        mapObjectsRef.current.push(myLocation);

        filteredShelters.slice(0, 60).forEach((shelter) => {
          const lat = Number(shelter.latitude);
          const lng = Number(shelter.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          const key = shelterKey(shelter);
          const position = new window.kakao.maps.LatLng(lat, lng);
          shelterPositionsRef.current.set(key, position);

          const markerElement = createShelterMarker(key === selectedKey);
          markerElement.addEventListener("click", () => {
            setSelectedKey(key);
            map.panTo(position);
            map.setLevel(3);
          });

          const overlay = new window.kakao.maps.CustomOverlay({
            position,
            content: markerElement,
            yAnchor: 0.5,
            xAnchor: 0.5,
            zIndex: key === selectedKey ? 9 : 5,
          });
          overlay.setMap(map);
          mapObjectsRef.current.push(overlay);
        });

        requestAnimationFrame(() => {
          map.relayout();
          map.setCenter(center);
        });
      });
    };

    buildMap();

    return () => {
      disposed = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [location, filteredShelters, selectedKey]);

  const focusShelter = (shelter) => {
    const key = shelterKey(shelter);
    setSelectedKey(key);
    const position = shelterPositionsRef.current.get(key);
    if (position && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(position);
      mapInstanceRef.current.setLevel(3);
    }
  };

  const resetToMyLocation = () => {
    if (!location || !mapInstanceRef.current || !window.kakao?.maps) return;
    const center = new window.kakao.maps.LatLng(location.lat, location.lng);
    mapInstanceRef.current.panTo(center);
    mapInstanceRef.current.setLevel(5);
  };

  return (
    <ServicePageLayout
      activeNav="shelters"
      onNavigate={onNavigate}
      sectionTitle="서비스 안내"
      pageTitle="대피시설 찾기"
      breadcrumbParent="서비스 안내"
      description="현재 위치 주변의 실제 민방위 대피시설을 거리순으로 확인할 수 있습니다."
      wide
      headerAction={
        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="inline-flex min-w-[230px] cursor-pointer items-center gap-3 border border-slate-300 bg-white px-4 py-2.5 text-left disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
            <LocateFixed className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-[11px] font-extrabold text-[#0B2A52]">
              {locating ? "현재 위치 확인 중..." : "내 위치 다시 확인"}
            </strong>
            <span className="mt-0.5 block truncate text-[10px] text-slate-400">
              {locationLabel}
            </span>
          </span>
        </button>
      }
    >
        {!location ? (
          <section className="bg-white rounded-[22px] border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <LocateFixed className="w-7 h-7" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[#0B2A52]">현재 위치가 필요합니다</h2>
            <p className="mt-2 text-sm text-slate-500">위치를 확인하면 가까운 대피시설을 거리순으로 보여드려요.</p>
            <button
              onClick={requestLocation}
              disabled={locating}
              className="mt-5 px-5 h-11 rounded-xl bg-[#0B2A52] text-white text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {locating ? "위치 확인 중..." : "내 위치 확인하기"}
            </button>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
                <div><div className="text-[11px] text-slate-400">검색 결과</div><div className="text-2xl font-extrabold text-[#0B2A52]">{filteredShelters.length}<span className="text-sm ml-0.5">개</span></div></div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
                <div><div className="text-[11px] text-slate-400">1km 이내</div><div className="text-2xl font-extrabold text-emerald-600">{oneKmCount}<span className="text-sm ml-0.5">개</span></div></div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><Navigation className="w-5 h-5" /></div>
                <div><div className="text-[11px] text-slate-400">가장 가까운 시설</div><div className="text-xl font-extrabold text-[#0B2A52]">{shelters[0] ? formatDistance(shelters[0].distanceM) : "-"}</div></div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Home className="w-5 h-5" /></div>
                <div className="min-w-0"><div className="text-[11px] text-slate-400">현재 기준 지역</div><div className="text-base font-extrabold text-[#0B2A52] truncate">{locationLabel}</div></div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_320px] gap-4 items-stretch">
              <aside className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 min-h-[650px] flex flex-col">
                <div>
                  <h2 className="font-extrabold text-[#0B2A52]">위치 및 검색</h2>
                  <p className="text-[11px] text-slate-400 mt-1">{regionQuery || locationLabel}</p>
                </div>

                <div className="mt-4 flex items-center gap-2 border border-slate-200 rounded-xl px-3 h-11 focus-within:border-blue-300">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="시설명, 주소 검색"
                    className="flex-1 min-w-0 text-xs outline-none"
                  />
                </div>

                <div className="mt-4">
                  <div className="text-xs font-bold text-slate-600 mb-2">검색 반경</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 3, 5].map((km) => (
                      <button
                        key={km}
                        onClick={() => { setRadiusKm(km); setPage(1); }}
                        className={`h-9 rounded-lg text-xs font-bold cursor-pointer ${radiusKm === km ? "bg-[#0B2A52] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      >
                        {km}km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-extrabold text-[#0B2A52]">검색 결과 <span className="text-blue-600">{filteredShelters.length}개</span></div>
                  <button onClick={requestLocation} className="text-[11px] font-bold text-blue-600 cursor-pointer">위치 새로고침</button>
                </div>

                <div className="mt-2 flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
                  {loading ? (
                    <div className="py-12 text-center text-xs text-slate-400">대피시설을 불러오는 중...</div>
                  ) : filteredShelters.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">조건에 맞는 대피시설이 없습니다.</div>
                  ) : (
                    visibleShelters.map((shelter) => {
                      const key = shelterKey(shelter);
                      const active = key === selectedKey;
                      return (
                        <button
                          key={key}
                          onClick={() => focusShelter(shelter)}
                          className={`w-full text-left py-3 px-2 rounded-xl cursor-pointer transition-colors ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-extrabold text-xs text-[#0B2A52] line-clamp-1">{shelter.name}</div>
                            <div className="text-[11px] font-bold text-blue-600 shrink-0">{formatDistance(shelter.distanceM)}</div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{shelter.address}</div>
                        </button>
                      );
                    })
                  )}
                </div>

                {filteredShelters.length > PAGE_SIZE && (
                  <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-center gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-bold text-slate-500">{page} / {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
              </aside>

              <section className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-3 min-h-[650px]">
                <div className="relative h-full min-h-[624px] rounded-2xl overflow-hidden bg-slate-100">
                  <div ref={mapRef} className="absolute inset-0" />
                  <div className="absolute left-3 top-3 z-10 bg-white/95 border border-slate-200 shadow-sm rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-600 flex flex-wrap gap-3 pointer-events-none">
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-blue-500" />내 위치</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500" />대피시설</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-red-500" />선택 시설</span>
                  </div>
                  <button
                    onClick={resetToMyLocation}
                    className="absolute right-4 bottom-4 z-10 w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-md text-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-50"
                    title="내 위치로 이동"
                  >
                    <LocateFixed className="w-5 h-5" />
                  </button>
                </div>
              </section>

              <aside className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-5 min-h-[650px]">
                {selectedShelter ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">민방위 대피시설</span>
                      <span className="text-xs font-bold text-blue-600">{formatDistance(selectedShelter.distanceM)}</span>
                    </div>
                    <h2 className="mt-4 text-xl font-extrabold text-[#0B2A52] leading-snug">{selectedShelter.name}</h2>
                    <p className="mt-2 text-xs text-slate-500 leading-5">{selectedShelter.address}</p>

                    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">거리</span><strong className="text-[#0B2A52]">{formatDistance(selectedShelter.distanceM)}</strong></div>
                      <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">수용 인원</span><strong className="text-[#0B2A52]">{selectedShelter.capacity ? `${selectedShelter.capacity}명` : "정보 없음"}</strong></div>
                      <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">시설 위치</span><strong className="text-[#0B2A52]">{selectedShelter.floorType || "정보 없음"}</strong></div>
                    </div>

                    <button
                      onClick={() => openKakaoRoute(selectedShelter)}
                      className="mt-6 w-full h-11 rounded-xl bg-[#0B2A52] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#173b65]"
                    >
                      <Navigation className="w-4 h-4" /> 길찾기
                    </button>

                    <div className="mt-5 rounded-xl bg-blue-50 border border-blue-100 p-3 text-[11px] text-slate-600 leading-5">
                      재난 발생 시에는 재난문자·지자체 안내와 현장 통제를 우선 확인해주세요. 실제 출입 가능 여부는 현장 상황에 따라 달라질 수 있습니다.
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <Building2 className="w-8 h-8 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-500">대피시설을 선택해주세요.</p>
                  </div>
                )}
              </aside>
            </section>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">{error}</div>
            )}
          </>
        )}
    </ServicePageLayout>
  );
}