import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Home,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "../api/client";

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

const STATUS_LABEL = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};

const DEFAULT_CENTER = { lat: 36.5, lng: 127.8 };

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) return "거리 정보 없음";
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)}km`;
  return `${Math.round(distance)}m`;
}

function makeMarkerElement(type) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.setAttribute("aria-label", type === "incident" ? "현장 상황" : "대피시설");
  marker.style.width = "32px";
  marker.style.height = "32px";
  marker.style.borderRadius = "50%";
  marker.style.border = "3px solid #fff";
  marker.style.boxShadow = "0 5px 14px rgba(15, 35, 65, .28)";
  marker.style.cursor = "pointer";
  marker.style.display = "flex";
  marker.style.alignItems = "center";
  marker.style.justifyContent = "center";
  marker.style.fontFamily = "Arial, sans-serif";
  marker.style.fontWeight = "900";
  marker.style.color = "#fff";
  marker.style.fontSize = "16px";
  marker.style.background = type === "incident" ? "#ef4444" : "#10b981";
  marker.textContent = type === "incident" ? "!" : "⌂";
  return marker;
}

function makeMyLocationElement() {
  const marker = document.createElement("div");
  marker.style.width = "22px";
  marker.style.height = "22px";
  marker.style.borderRadius = "50%";
  marker.style.border = "4px solid #fff";
  marker.style.background = "#2563eb";
  marker.style.boxShadow =
    "0 0 0 7px rgba(37, 99, 235, .16), 0 4px 12px rgba(15, 35, 65, .28)";
  return marker;
}

export default function NearbySafetyMap({ mode = "compact", onOpenFullMap }) {
  const compact = mode === "compact";

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapObjectsRef = useRef([]);

  const [sdkReady, setSdkReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const [location, setLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("현재 위치 확인 중");
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(true);
  const [locationNotice, setLocationNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [shelters, setShelters] = useState([]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [radiusKm, setRadiusKm] = useState(3);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showShelters, setShowShelters] = useState(true);

  /*
   * index.html에서 Kakao SDK를 autoload=false로 불러오고 있으므로
   * React가 렌더링된 시점에 SDK 로딩이 아주 조금 늦어도 지도가 죽지 않도록 기다린다.
   */
  useEffect(() => {
    let cancelled = false;
    let timerId = null;
    let attempts = 0;

    const waitForKakaoSdk = () => {
      if (cancelled) return;

      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => {
          if (cancelled) return;

          if (window.kakao?.maps?.Map) {
            setSdkReady(true);
            setMapError("");
          } else {
            setMapError("카카오 지도 SDK를 초기화하지 못했습니다.");
          }
        });
        return;
      }

      attempts += 1;
      if (attempts >= 50) {
        setMapError(
          "카카오 지도를 불러오지 못했습니다. Kakao Developers의 JavaScript 키와 Web 도메인 설정을 확인해주세요."
        );
        return;
      }

      timerId = window.setTimeout(waitForKakaoSdk, 100);
    };

    waitForKakaoSdk();

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, []);

  /* 실제 Kakao Map 객체는 한 번만 만든다. */
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const center = location || DEFAULT_CENTER;
      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level: location ? (compact ? 5 : 4) : 12,
      });

      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

      mapInstanceRef.current = map;
      setMapReady(true);
      setMapError("");

      window.setTimeout(() => {
        map.relayout();
        map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      }, 0);
    } catch (error) {
      console.error("Kakao map init failed", error);
      setMapError("카카오 지도를 초기화하지 못했습니다.");
    }
  }, [sdkReady, compact, location]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationError("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      setLocationNotice("");
      return;
    }

    setLocating(true);
    setLocationError("");
    setLocationNotice("현재 위치를 다시 확인하고 있어요.");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocation(nextLocation);
        setLocating(false);
        setLocationNotice("현재 위치를 다시 확인했어요.");
        setRefreshKey((value) => value + 1);

        if (mapInstanceRef.current && window.kakao?.maps) {
          const nextPosition = new window.kakao.maps.LatLng(
            nextLocation.lat,
            nextLocation.lng
          );
          mapInstanceRef.current.panTo(nextPosition);
          mapInstanceRef.current.setLevel(compact ? 5 : 4);
          mapInstanceRef.current.relayout();
        }
      },
      (error) => {
        setLocating(false);
        setLocationNotice("");
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("현재 위치를 확인하면 주변 안전정보를 볼 수 있어요.");
        } else if (error.code === error.TIMEOUT) {
          setLocationError("위치 확인 시간이 초과됐습니다. 다시 시도해주세요.");
        } else {
          setLocationError("현재 위치를 확인하지 못했습니다. 다시 시도해주세요.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [compact]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  /* 위치가 잡히면 실제 Kakao 지도의 중심을 현재 위치로 옮긴다. */
  useEffect(() => {
    if (!mapReady || !location || !mapInstanceRef.current) return;

    const position = new window.kakao.maps.LatLng(location.lat, location.lng);
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setLevel(compact ? 5 : 4);
    mapInstanceRef.current.relayout();
  }, [mapReady, location, compact]);

  const fetchShelters = useCallback(
    async (lat, lng) => {
      if (!sdkReady || !window.kakao?.maps?.services) return [];

      const region = await new Promise((resolve) => {
        const geocoder = new window.kakao.maps.services.Geocoder();

        geocoder.coord2RegionCode(lng, lat, (result, status) => {
          if (status !== window.kakao.maps.services.Status.OK || !result?.length) {
            resolve(null);
            return;
          }

          resolve(result.find((item) => item.region_type === "H") || result[0]);
        });
      });

      const sido = region?.region_1depth_name;
      const gu = region?.region_2depth_name;
      if (!sido) return [];

      const queries = [
        gu ? `${sido} ${gu}` : sido,
        gu || null,
        gu && SIDO_SHORT_NAME[sido] ? `${SIDO_SHORT_NAME[sido]} ${gu}` : null,
      ].filter(Boolean);

      for (const guName of queries) {
        try {
          const data = await authFetch(
            `/api/environment/shelters?guName=${encodeURIComponent(guName)}&lat=${lat}&lng=${lng}&limit=50`
          );
          if (Array.isArray(data) && data.length > 0) return data;
        } catch (error) {
          console.warn("Shelter request failed", guName, error);
        }
      }

      return [];
    },
    [sdkReady]
  );

  /* 현재 위치의 주소명 + 주변 사건/대피시설 실제 데이터 조회 */
  useEffect(() => {
    if (!location || !sdkReady) return;

    let cancelled = false;

    setDataLoading(true);
    setDataError("");

    try {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(location.lng, location.lat, (result, status) => {
        if (cancelled) return;

        if (status === window.kakao.maps.services.Status.OK && result?.[0]) {
          const address =
            result[0].road_address?.address_name || result[0].address?.address_name;
          setLocationLabel(address || "현재 위치");
        } else {
          setLocationLabel("현재 위치");
        }
      });
    } catch {
      setLocationLabel("현재 위치");
    }

    Promise.allSettled([
      authFetch(
        `/api/incidents/nearby?lat=${location.lat}&lng=${location.lng}&radiusKm=${radiusKm}`
      ),
      fetchShelters(location.lat, location.lng),
    ]).then(([incidentResult, shelterResult]) => {
      if (cancelled) return;

      const nextIncidents =
        incidentResult.status === "fulfilled" && Array.isArray(incidentResult.value)
          ? incidentResult.value
          : [];

      const nextShelters =
        shelterResult.status === "fulfilled" && Array.isArray(shelterResult.value)
          ? shelterResult.value
          : [];

      setIncidents(nextIncidents);
      setShelters(nextShelters);

      if (incidentResult.status === "rejected" && shelterResult.status === "rejected") {
        setDataError("주변 안전정보를 불러오지 못했습니다. 백엔드 실행 상태를 확인해주세요.");
      } else {
        setDataError("");
      }

      setDataLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [location, radiusKm, fetchShelters, sdkReady, refreshKey]);

  const normalizedItems = useMemo(() => {
    if (!location) return [];

    const incidentItems = incidents
      .map((item) => {
        const lat = toNumber(item.latitude);
        const lng = toNumber(item.longitude);
        if (lat == null || lng == null) return null;

        const distanceM = distanceMeters(location.lat, location.lng, lat, lng);
        if (distanceM > radiusKm * 1000) return null;

        return {
          key: `incident-${item.incidentId}`,
          type: "incident",
          id: item.incidentId,
          title: item.title || `${item.disasterType || "현장"} 상황`,
          address: item.region || "위치 정보 없음",
          status: STATUS_LABEL[item.status] || item.status || "진행중",
          lat,
          lng,
          distanceM,
          original: item,
        };
      })
      .filter(Boolean);

    const shelterItems = shelters
      .map((item, index) => {
        const lat = toNumber(item.latitude ?? item.lat);
        const lng = toNumber(item.longitude ?? item.lng);
        if (lat == null || lng == null) return null;

        const distanceM = Number.isFinite(Number(item.distanceM))
          ? Number(item.distanceM)
          : distanceMeters(location.lat, location.lng, lat, lng);

        if (distanceM > radiusKm * 1000) return null;

        return {
          key: `shelter-${item.id ?? item.shelterId ?? index}-${lat}-${lng}`,
          type: "shelter",
          id: item.id ?? item.shelterId ?? index,
          title: item.name || "대피시설",
          address: item.address || "주소 정보 없음",
          status: "운영중",
          lat,
          lng,
          distanceM,
          original: item,
        };
      })
      .filter(Boolean);

    return [...incidentItems, ...shelterItems].sort(
      (a, b) => a.distanceM - b.distanceM
    );
  }, [incidents, shelters, location, radiusKm]);

  const visibleItems = useMemo(
    () =>
      normalizedItems.filter(
        (item) =>
          (item.type === "incident" && showIncidents) ||
          (item.type === "shelter" && showShelters)
      ),
    [normalizedItems, showIncidents, showShelters]
  );

  /* 데이터가 바뀌어도 지도 자체를 재생성하지 않고 마커/반경만 갱신한다. */
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !location) return;

    mapObjectsRef.current.forEach((object) => object?.setMap?.(null));
    mapObjectsRef.current = [];

    const map = mapInstanceRef.current;
    const currentPosition = new window.kakao.maps.LatLng(location.lat, location.lng);

    const currentOverlay = new window.kakao.maps.CustomOverlay({
      map,
      position: currentPosition,
      content: makeMyLocationElement(),
      yAnchor: 0.5,
      zIndex: 5,
    });
    mapObjectsRef.current.push(currentOverlay);

    const radiusCircle = new window.kakao.maps.Circle({
      map,
      center: currentPosition,
      radius: radiusKm * 1000,
      strokeWeight: 2,
      strokeColor: "#2563eb",
      strokeOpacity: 0.28,
      fillColor: "#60a5fa",
      fillOpacity: 0.055,
    });
    mapObjectsRef.current.push(radiusCircle);

    visibleItems.forEach((item) => {
      const markerElement = makeMarkerElement(item.type);
      markerElement.addEventListener("click", () => setSelectedItem(item));

      const overlay = new window.kakao.maps.CustomOverlay({
        map,
        position: new window.kakao.maps.LatLng(item.lat, item.lng),
        content: markerElement,
        yAnchor: 1,
        zIndex: 6,
      });

      mapObjectsRef.current.push(overlay);
    });

    return () => {
      mapObjectsRef.current.forEach((object) => object?.setMap?.(null));
      mapObjectsRef.current = [];
    };
  }, [mapReady, location, radiusKm, visibleItems]);

  const refreshNearbyData = useCallback(() => {
    setSelectedItem(null);
    setDataError("");

    if (!location) {
      requestLocation();
      return;
    }

    setDataLoading(true);
    setRefreshKey((value) => value + 1);
  }, [location, requestLocation]);

  const moveToItem = (item) => {
    setSelectedItem(item);

    if (mapInstanceRef.current && window.kakao?.maps) {
      mapInstanceRef.current.panTo(
        new window.kakao.maps.LatLng(item.lat, item.lng)
      );
    }
  };

  const moveToCurrentLocation = () => {
    if (!location || !mapInstanceRef.current || !window.kakao?.maps) {
      requestLocation();
      return;
    }

    mapInstanceRef.current.panTo(
      new window.kakao.maps.LatLng(location.lat, location.lng)
    );
  };

  const openDirections = (item) => {
    if (!item) return;

    const name = encodeURIComponent(item.title || "목적지");
    window.open(
      `https://map.kakao.com/link/to/${name},${item.lat},${item.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const renderMapProblem = () => {
    if (!mapError) return null;

    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-[390px] rounded-2xl border border-red-100 bg-red-50 p-5 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-7 w-7 text-red-500" />
          <p className="mt-2 text-[13px] font-extrabold text-[#0B2A52]">
            실제 지도를 불러오지 못했어요.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-slate-600">{mapError}</p>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="min-h-[430px] overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-[#0B2A52]">
              <MapPin className="h-5 w-5 text-blue-600" /> 내 주변 안전지도
            </h2>
            <p className="mt-1 max-w-[250px] truncate text-[10px] font-medium text-slate-400">
              {location ? locationLabel : "현재 위치 기준으로 주변 안전정보를 확인합니다."}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenFullMap}
            className="flex cursor-pointer items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-semibold text-[#0B2A52] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm"
          >
            더보기 <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mx-3 mb-3 h-[338px] overflow-hidden rounded-[14px] border border-slate-200 bg-[#eef2f7]">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {!mapReady && !mapError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#eef2f7]">
              <div className="rounded-xl bg-white px-4 py-3 text-[11px] font-bold text-slate-500 shadow-sm">
                실제 Kakao 지도 불러오는 중...
              </div>
            </div>
          )}

          {renderMapProblem()}

          {mapReady && (
            <div className="absolute right-3 top-3 z-10 rounded-full bg-white/95 px-3.5 py-2 text-[11px] font-extrabold text-[#0B2A52] shadow-md">
              내 위치 반경 {radiusKm}km
            </div>
          )}

          {mapReady && location && (
            <button
              type="button"
              onClick={moveToCurrentLocation}
              className="absolute bottom-14 right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white text-blue-600 shadow-md transition-all duration-200 hover:-translate-y-1 hover:bg-blue-50 hover:shadow-lg active:translate-y-0 active:scale-95"
              title="내 위치"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          )}

          {mapReady && (locating || locationError) && !location && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/72 px-6 backdrop-blur-[1px]">
              <div className="w-full max-w-[300px] rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xl">
                <MapPin className="mx-auto h-7 w-7 text-blue-600" />
                <p className="mt-2 text-[13px] font-extrabold text-[#0B2A52]">
                  {locating ? "현재 위치를 확인하고 있어요." : "현재 위치를 확인해주세요."}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {locating ? "주변 안전정보를 준비 중입니다." : locationError}
                </p>
                {!locating && (
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="mt-3 h-9 cursor-pointer rounded-lg bg-[#0B2A52] px-4 text-[11px] font-bold text-white transition-all duration-200 hover:bg-[#173b65] hover:shadow-md active:scale-[0.98]"
                  >
                    내 위치 확인
                  </button>
                )}
              </div>
            </div>
          )}

          {mapReady && selectedItem && (
            <div className="absolute left-3 top-3 z-20 w-[245px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                    selectedItem.type === "incident" ? "bg-red-500" : "bg-emerald-500"
                  }`}
                >
                  {selectedItem.type === "incident" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Home className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold text-[#0B2A52]">
                    {selectedItem.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {selectedItem.address}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-blue-600">
                    {formatDistance(selectedItem.distanceM)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {mapReady && (
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2.5 rounded-full bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow">
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-blue-600" />내 위치
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-red-500" />현장 상황
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />대피시설
              </span>
            </div>
          )}

          {mapReady && dataLoading && location && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-white/95 px-3 py-2 text-[10px] font-bold text-slate-600 shadow">
              주변 정보 불러오는 중...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-400">현재 위치</p>
              <p className="mt-1 line-clamp-2 text-[14px] font-extrabold text-[#0B2A52]">
                {locationLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 text-xs font-bold text-blue-700 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-100 hover:shadow-md active:translate-y-0 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
          >
            {locating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            {locating ? "위치 확인 중..." : "내 위치 다시 찾기"}
          </button>

          {(locationNotice || locationError) && (
            <p
              className={`mt-2 text-center text-[10px] leading-4 ${
                locationError ? "text-red-500" : "text-blue-600"
              }`}
            >
              {locationError || locationNotice}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-[14px] font-extrabold text-[#0B2A52]">지도에 표시할 정보</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowIncidents((value) => !value)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${
                showIncidents
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <span className="h-3 w-3 rounded-full bg-red-500" /> 현장 상황
            </button>

            <button
              type="button"
              onClick={() => setShowShelters((value) => !value)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${
                showShelters
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <span className="h-3 w-3 rounded-full bg-emerald-500" /> 대피시설
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-[14px] font-extrabold text-[#0B2A52]">검색 반경</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 3, 5].map((radius) => (
              <button
                key={radius}
                type="button"
                onClick={() => setRadiusKm(radius)}
                className={`h-10 cursor-pointer rounded-xl text-xs font-extrabold transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${
                  radiusKm === radius
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {radius}km
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-[14px] font-extrabold text-[#0B2A52]">주변 정보</h3>
              <p className="mt-0.5 text-[10px] text-slate-400">총 {visibleItems.length}건</p>
            </div>
            <button
              type="button"
              onClick={refreshNearbyData}
              disabled={dataLoading}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-500 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              title="주변 정보 새로고침"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${dataLoading ? "animate-spin" : ""}`}
              />
              {dataLoading ? "불러오는 중" : "새로고침"}
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {!location ? (
              <div className="p-6 text-center text-xs text-slate-400">
                내 위치를 확인하면 주변 정보를 표시합니다.
              </div>
            ) : dataError ? (
              <div className="p-6 text-center text-xs leading-5 text-red-500">{dataError}</div>
            ) : visibleItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                선택한 반경에 표시할 정보가 없습니다.
              </div>
            ) : (
              visibleItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => moveToItem(item)}
                  className={`flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-all duration-150 last:border-0 hover:-translate-y-[2px] hover:bg-blue-50/70 hover:shadow-sm hover:z-10 ${
                    selectedItem?.key === item.key ? "bg-blue-50/70" : "bg-white"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                      item.type === "incident" ? "bg-red-500" : "bg-emerald-500"
                    }`}
                  >
                    {item.type === "incident" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Home className="h-4 w-4" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[12px] text-[#0B2A52]">
                      {item.title}
                    </b>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                      {item.address}
                    </span>
                  </span>

                  <span className="shrink-0 text-[10px] font-bold text-blue-600">
                    {formatDistance(item.distanceM)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="relative h-[570px] overflow-hidden rounded-2xl border border-slate-200 bg-[#eef2f7] shadow-sm">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {!mapReady && !mapError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#eef2f7]">
              <div className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-slate-500 shadow-sm">
                실제 Kakao 지도 불러오는 중...
              </div>
            </div>
          )}

          {renderMapProblem()}

          {mapReady && (
            <div className="absolute right-4 top-4 z-10 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-[#0B2A52] shadow-md">
              내 위치 반경 {radiusKm}km
            </div>
          )}

          {mapReady && (
            <button
              type="button"
              onClick={moveToCurrentLocation}
              className="absolute bottom-5 right-5 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white text-blue-600 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl active:translate-y-0 active:scale-95"
              title="내 위치"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          )}

          {mapReady && (locating || locationError) && !location && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/65 px-6 backdrop-blur-[1px]">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
                <MapPin className="mx-auto h-8 w-8 text-blue-600" />
                <h3 className="mt-3 text-base font-extrabold text-[#0B2A52]">
                  {locating ? "현재 위치 확인 중" : "내 위치를 확인해주세요"}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {locating
                    ? "주변 현장 상황과 대피시설을 불러오고 있습니다."
                    : locationError}
                </p>
                {!locating && (
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="mt-4 h-10 cursor-pointer rounded-xl bg-[#0B2A52] px-5 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-1 hover:bg-[#173b65] hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
                  >
                    내 위치 확인
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedItem ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
                selectedItem.type === "incident" ? "bg-red-500" : "bg-emerald-500"
              }`}
            >
              {selectedItem.type === "incident" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Home className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[17px] font-extrabold text-[#0B2A52]">
                  {selectedItem.title}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                  {selectedItem.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{selectedItem.address}</p>
              <p className="mt-1 text-xs font-bold text-blue-600">
                현재 위치에서 약 {formatDistance(selectedItem.distanceM)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => openDirections(selectedItem)}
              className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0B2A52] px-5 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-1 hover:bg-[#173b65] hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" /> 길찾기
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 shadow-sm">
            지도 마커나 왼쪽 목록을 선택하면 위치 정보를 확인할 수 있습니다.
          </div>
        )}
      </section>
    </div>
  );
}
