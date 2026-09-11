import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldAlert,
  Bell,
  ChevronRight,
  ChevronLeft,
  Home,
  Users,
  ClipboardList,
  MapPin,
  Building2,
  Map as MapIcon,
  Heart,
  ArrowLeft,
  Navigation,
  Search,
  Info,
  LocateFixed,
} from "lucide-react";
import { authFetch } from "../api/client";

const PAGE_SIZE = 8;

const TABS = [
  { key: "info", label: "내 정보", icon: Home },
  { key: "family", label: "가족 관리", icon: Users },
  { key: "safety", label: "안전확인 이력", icon: ShieldAlert },
  { key: "reports", label: "내 제보 내역", icon: ClipboardList },
  { key: "regions", label: "관심 지역", icon: MapPin },
  { key: "notify", label: "알림 설정", icon: Bell },
];

function formatDistance(distanceM) {
  const value = Number(distanceM);
  if (!Number.isFinite(value)) return "거리 정보 없음";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
  return `${Math.round(value)}m`;
}

function shelterKey(shelter) {
  return String(
    shelter.id ??
      shelter.shelterId ??
      `${shelter.name || "대피시설"}|${shelter.address || ""}`
  );
}

function openKakaoMap(shelter) {
  const keyword = encodeURIComponent(shelter.address || shelter.name || "대피시설");
  window.open(
    `https://map.kakao.com/link/search/${keyword}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export default function ShelterPage({
  initialRegionId,
  onBackToHome,
  onLogout,
  onGoToMyPageTab,
}) {
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId ?? null);
  const [shelters, setShelters] = useState([]);
  const [sheltersLoading, setSheltersLoading] = useState(false);
  const [error, setError] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [sort, setSort] = useState("distance");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedShelterKey, setSelectedShelterKey] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapObjectsRef = useRef([]);
  const shelterPositionsRef = useRef(new Map());

  useEffect(() => {
    setRegionsLoading(true);
    authFetch("/api/mypage/regions")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setRegions(list);

        if (list.length === 0) {
          setSelectedRegionId(null);
          return;
        }

        const initial = list.find(
          (r) => String(r.memberRegionId) === String(initialRegionId)
        );
        const primary = list.find((r) => r.isPrimary === "Y");
        const chosen = initial || primary || list[0];
        setSelectedRegionId(chosen.memberRegionId);
      })
      .catch((err) => setError(err.message || "관심 지역을 불러오지 못했습니다."))
      .finally(() => setRegionsLoading(false));
  }, [initialRegionId]);

  const selectedRegion = useMemo(
    () => regions.find((r) => String(r.memberRegionId) === String(selectedRegionId)) || null,
    [regions, selectedRegionId]
  );

  useEffect(() => {
    setPage(1);
    setSelectedShelterKey(null);

    if (!selectedRegion?.latitude || !selectedRegion?.longitude) {
      setShelters([]);
      return;
    }

    if (!window.kakao?.maps) {
      setError("카카오 지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setError("");
    setSheltersLoading(true);

    const lat = Number(selectedRegion.latitude);
    const lng = Number(selectedRegion.longitude);

    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2RegionCode(lng, lat, (result, status) => {
        const regionCode =
          status === window.kakao.maps.services.Status.OK
            ? result.find((r) => r.region_type === "H") || result[0]
            : null;

        const sido = regionCode?.region_1depth_name;
        const gu = regionCode?.region_2depth_name;

        if (!gu) {
          setShelters([]);
          setSheltersLoading(false);
          setError("선택한 관심 지역의 행정구역을 확인하지 못했습니다.");
          return;
        }

        const guQuery = sido ? `${sido} ${gu}` : gu;

        authFetch(
          `/api/environment/shelters?guName=${encodeURIComponent(guQuery)}&lat=${lat}&lng=${lng}&limit=50`
        )
          .then((data) => {
            const first = Array.isArray(data) ? data : [];
            if (first.length > 0) return first;
            return authFetch(
              `/api/environment/shelters?guName=${encodeURIComponent(gu)}&lat=${lat}&lng=${lng}&limit=50`
            );
          })
          .then((data) => setShelters(Array.isArray(data) ? data : []))
          .catch((err) => {
            setShelters([]);
            setError(err.message || "대피시설 정보를 불러오지 못했습니다.");
          })
          .finally(() => setSheltersLoading(false));
      });
    });
  }, [selectedRegion?.memberRegionId, selectedRegion?.latitude, selectedRegion?.longitude]);

  const filteredShelters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let list = shelters.filter((s) => {
      const distance = Number(s.distanceM);
      const inRadius = !Number.isFinite(distance) || distance <= radiusKm * 1000;
      if (!inRadius) return false;

      if (!normalizedQuery) return true;
      const target = `${s.name || ""} ${s.address || ""}`.toLowerCase();
      return target.includes(normalizedQuery);
    });

    list = [...list].sort((a, b) => {
      if (sort === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "ko");
      }
      return (Number(a.distanceM) || Number.MAX_SAFE_INTEGER) - (Number(b.distanceM) || Number.MAX_SAFE_INTEGER);
    });

    return list;
  }, [shelters, radiusKm, sort, query]);

  const totalPages = Math.max(1, Math.ceil(filteredShelters.length / PAGE_SIZE));
  const visibleShelters = filteredShelters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!mapRef.current || !selectedRegion?.latitude || !selectedRegion?.longitude || !window.kakao?.maps) return;

    let disposed = false;
    let resizeObserver;

    window.kakao.maps.load(() => {
      if (disposed || !mapRef.current) return;

      mapObjectsRef.current.forEach((obj) => obj.setMap?.(null));
      mapObjectsRef.current = [];
      shelterPositionsRef.current = new Map();

      const center = new window.kakao.maps.LatLng(
        Number(selectedRegion.latitude),
        Number(selectedRegion.longitude)
      );

      const map = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 5,
      });
      mapInstanceRef.current = map;

      const homeContent = document.createElement("button");
      homeContent.type = "button";
      homeContent.className = "flex items-center gap-2 bg-white border border-blue-200 rounded-full px-3 py-2 shadow-lg font-extrabold text-[#0F2540] text-xs";
      homeContent.innerHTML = `<span style="display:flex;width:28px;height:28px;border-radius:9999px;background:#3b82f6;color:#fff;align-items:center;justify-content:center;font-size:14px;">⌂</span><span>${selectedRegion.regionLabel || "선택 지역"}</span>`;

      const homeOverlay = new window.kakao.maps.CustomOverlay({
        position: center,
        content: homeContent,
        yAnchor: 1.6,
        zIndex: 20,
      });
      homeOverlay.setMap(map);
      mapObjectsRef.current.push(homeOverlay);

      const circle = new window.kakao.maps.Circle({
        center,
        radius: radiusKm * 1000,
        strokeWeight: 2,
        strokeColor: "#60A5FA",
        strokeOpacity: 0.55,
        strokeStyle: "solid",
        fillColor: "#93C5FD",
        fillOpacity: 0.12,
      });
      circle.setMap(map);
      mapObjectsRef.current.push(circle);

      const geocoder = new window.kakao.maps.services.Geocoder();

      const addShelterMarker = (shelter, index, position) => {
        if (disposed) return;

        const key = shelterKey(shelter);
        shelterPositionsRef.current.set(key, position);

        const marker = new window.kakao.maps.Marker({ position, map });
        mapObjectsRef.current.push(marker);

        window.kakao.maps.event.addListener(marker, "click", () => {
          setSelectedShelterKey(key);
          map.panTo(position);
        });
      };

      filteredShelters.slice(0, 30).forEach((shelter, index) => {
        const lat = Number(shelter.latitude ?? shelter.lat);
        const lng = Number(shelter.longitude ?? shelter.lng);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          addShelterMarker(shelter, index, new window.kakao.maps.LatLng(lat, lng));
          return;
        }

        if (!shelter.address) return;
        geocoder.addressSearch(shelter.address, (result, status) => {
          if (status !== window.kakao.maps.services.Status.OK || !result[0]) return;
          const position = new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x));
          addShelterMarker(shelter, index, position);
        });
      });

      resizeObserver = new ResizeObserver(() => {
        map.relayout();
        map.setCenter(center);
      });
      resizeObserver.observe(mapRef.current);

      requestAnimationFrame(() => {
        map.relayout();
        map.setCenter(center);
      });
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mapObjectsRef.current.forEach((obj) => obj.setMap?.(null));
      mapObjectsRef.current = [];
    };
  }, [selectedRegion, filteredShelters, radiusKm]);

  const moveToShelter = (shelter) => {
    const key = shelterKey(shelter);
    setSelectedShelterKey(key);
    const position = shelterPositionsRef.current.get(key);
    if (position && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(position);
      mapInstanceRef.current.setLevel(3);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBackToHome} className="flex items-center gap-2.5 hover:opacity-80 cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-[#0F2540] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="leading-tight text-left">
              <div className="font-extrabold text-[#0F2540] text-lg tracking-tight">세이프트레이스</div>
              <div className="text-[10px] text-slate-400">함께 만드는 더 안전한 일상</div>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <button onClick={onBackToHome} className="text-xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer">홈으로</button>
            <button type="button" className="relative cursor-pointer">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <span className="w-px h-4 bg-slate-200" />
            <button onClick={onLogout} className="text-xs font-semibold text-slate-500 hover:text-red-500 cursor-pointer">로그아웃</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
          <aside className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <h2 className="font-bold text-[#0F2540] px-2 py-1.5 mb-1">마이페이지</h2>
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
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${key === "regions" ? "bg-sky-500 text-white" : "text-slate-400"}`}>
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
                소중한 사람들의<br />안전을<br />함께 지켜요
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
              <button onClick={() => onGoToMyPageTab?.("regions")} className="hover:text-blue-600 cursor-pointer">마이페이지</button>
              <ChevronRight className="w-3 h-3" />
              <button onClick={() => onGoToMyPageTab?.("regions")} className="hover:text-blue-600 cursor-pointer">관심 지역</button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-600 font-semibold">주변 대피시설</span>
            </div>

            <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onGoToMyPageTab?.("regions")}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 shadow-sm cursor-pointer"
                  aria-label="관심 지역으로 돌아가기"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-[#0F2540]">주변 대피시설</h1>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 ml-11">
                    선택한 관심 지역 주변의 대피시설을 지도와 목록으로 확인할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3 lg:max-w-[300px]">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F2540]">위급한 상황에 대비해</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">가까운 대피시설 위치를 미리 확인해두세요.</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Home className="w-5 h-5" />
                  </div>
                  <select
                    value={selectedRegionId ?? ""}
                    onChange={(e) => setSelectedRegionId(e.target.value)}
                    disabled={regionsLoading || regions.length === 0}
                    className="flex-1 min-w-0 outline-none text-sm font-bold text-[#0F2540] bg-transparent cursor-pointer"
                  >
                    {regions.map((region) => (
                      <option key={region.memberRegionId} value={region.memberRegionId}>
                        {region.regionLabel || "관심지역"} · {region.regionName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Navigation className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400 mb-0.5">검색 반경</p>
                  <select
                    value={radiusKm}
                    onChange={(e) => {
                      setRadiusKm(Number(e.target.value));
                      setPage(1);
                    }}
                    className="w-full outline-none text-sm font-bold text-[#0F2540] bg-transparent cursor-pointer"
                  >
                    <option value={1}>1km</option>
                    <option value={3}>3km</option>
                    <option value={5}>5km</option>
                    <option value={10}>10km</option>
                  </select>
                </div>
              </div>
            </section>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-4 items-stretch">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 min-h-[610px]">
                <div className="relative h-full min-h-[584px] rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                  <div ref={mapRef} className="absolute inset-0 w-full h-full" />

                  <div className="absolute left-3 top-3 z-10 bg-white/95 border border-slate-200 rounded-xl shadow-sm p-3 text-[10px] text-slate-600 space-y-2 pointer-events-none">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />선택한 지역</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" />대피시설</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-200 ring-1 ring-blue-300" />검색 반경 ({radiusKm}km)</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!mapInstanceRef.current || !selectedRegion) return;
                      const center = new window.kakao.maps.LatLng(Number(selectedRegion.latitude), Number(selectedRegion.longitude));
                      mapInstanceRef.current.panTo(center);
                      mapInstanceRef.current.setLevel(5);
                    }}
                    className="absolute right-3 bottom-3 z-10 w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 cursor-pointer"
                    title="선택 지역으로 이동"
                  >
                    <LocateFixed className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-h-[610px] flex flex-col">
                <div className="flex flex-col gap-3 mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#0F2540]">
                        총 {filteredShelters.length}개의 대피시설이 있습니다.
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{selectedRegion?.regionLabel || "선택 지역"} 기준 · 반경 {radiusKm}km</p>
                    </div>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                      className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-2 outline-none cursor-pointer bg-white"
                    >
                      <option value="distance">거리순</option>
                      <option value="name">이름순</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-blue-300">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="시설명 또는 주소 검색"
                      className="flex-1 min-w-0 text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {sheltersLoading ? (
                    <div className="h-full min-h-[420px] flex items-center justify-center text-xs text-slate-400">주변 대피시설을 불러오는 중...</div>
                  ) : filteredShelters.length === 0 ? (
                    <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <Building2 className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">조건에 맞는 대피시설이 없습니다.</p>
                      <p className="text-[11px] text-slate-400 mt-1">검색 반경을 넓히거나 검색어를 변경해보세요.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {visibleShelters.map((shelter, index) => {
                        const key = shelterKey(shelter);
                        const active = selectedShelterKey === key;

                        return (
                          <div
                            key={key}
                            onClick={() => moveToShelter(shelter)}
                            className={`group flex items-center gap-3 py-3 px-1 cursor-pointer transition-colors ${active ? "bg-blue-50/60" : "hover:bg-slate-50"}`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                              <Building2 className="w-5 h-5 text-blue-500" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-extrabold text-[#0F2540] truncate">{shelter.name}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-1">{shelter.address}</p>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 shrink-0">
                              <MapPin className="w-3.5 h-3.5 text-blue-500" />
                              {formatDistance(shelter.distanceM)}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openKakaoMap(shelter);
                              }}
                              className="h-8 px-2.5 rounded-lg border border-blue-100 text-blue-600 text-[10px] font-bold flex items-center gap-1.5 shrink-0 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all cursor-pointer"
                            >
                              <MapIcon className="w-3.5 h-3.5" />
                              지도보기
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {filteredShelters.length > PAGE_SIZE && (
                  <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => totalPages <= 5 || Math.abs(p - page) <= 2)
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold cursor-pointer ${p === page ? "bg-blue-500 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                        >
                          {p}
                        </button>
                      ))}

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F2540]">대피시설 이용 시 유의사항</h3>
                  <div className="mt-2 space-y-1.5 text-[11px] text-slate-500 leading-relaxed">
                    <p>• 재난 발생 시에는 지자체·재난문자 등 최신 안내를 우선 확인해주세요.</p>
                    <p>• 시설 운영 여부와 실제 출입 가능 여부는 현장 상황에 따라 달라질 수 있습니다.</p>
                    <p>• 이동 전 주변 도로 통제, 침수, 화재 등 현재 위험요소를 함께 확인해주세요.</p>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
