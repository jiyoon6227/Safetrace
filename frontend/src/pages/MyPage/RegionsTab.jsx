import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, MapPin, CheckCircle2, AlertTriangle, Trash2, X, Sun, ChevronRight,
  Clock, Droplets, Snowflake, Search, RefreshCw, Smile, Cloud, Building2, Map,
} from "lucide-react";
import { authFetch } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  REGION_LABELS, SIDO_SHORT_NAME, DISASTER_ICON, DISASTER_TYPE_STYLE,
  SEVERITY_LABEL_KO, SEVERITY_STYLE, STATUS_LABEL_KO, REPORT_STATUS_DOT,
  formatDateTime, formatDateTimeFull,
} from "./constants";

// ---- 관심 지역 --------------------------------------------------------------

export default function RegionsTab({ regions = [], onChanged, member, onOpenShelters, onOpenSafetyNews, refreshSignal }) {
  const [selectedLabel, setSelectedLabel] = useState("관심지역");
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [incidentListOpen, setIncidentListOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  useEscapeKey(incidentListOpen, () => {
    setIncidentListOpen(false);
    setSelectedIncidentId(null);
  });
  const [incidentTimelines, setIncidentTimelines] = useState({});
  const [incidentTimelineLoading, setIncidentTimelineLoading] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapOverlaysRef = useRef([]);
  const searchInputRef = useRef(null);

  // 처음 로딩되면 대표 지역(없으면 첫번째)을 자동 선택
  useEffect(() => {
    if (regions.length === 0) {
      setSelectedRegionId(null);
      return;
    }
    if (!regions.some((r) => r.memberRegionId === selectedRegionId)) {
      const primary = regions.find((r) => r.isPrimary === "Y") || regions[0];
      setSelectedRegionId(primary.memberRegionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  const selectedRegion = regions.find((r) => r.memberRegionId === selectedRegionId) || null;

  // 등록된 관심지역을 지도에 표시.
  // 기본 마커 위에 "우리집 / 부모님댁 / 회사 / 관심지역" 라벨을 CustomOverlay로 함께 보여준다.
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const withCoords = regions.filter(
      (r) => r.latitude != null && r.longitude != null
    );
    if (withCoords.length === 0) return;

    let resizeObserver;
    let disposed = false;

    window.kakao.maps.load(() => {
      if (disposed || !mapRef.current) return;

      // 이전 마커 / 라벨 제거
      mapOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      mapOverlaysRef.current = [];

      const selected =
        withCoords.find((r) => r.memberRegionId === selectedRegionId) ||
        withCoords.find((r) => r.isPrimary === "Y") ||
        withCoords[0];

      const center = new window.kakao.maps.LatLng(
        Number(selected.latitude),
        Number(selected.longitude)
      );

      const map = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 6,
      });
      mapInstanceRef.current = map;
      map.setDraggable(true);
      map.setZoomable(true);

      const escapeHtml = (value = "") =>
        String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const labelMeta = (label) => {
        if (label === "우리집") return { symbol: "⌂", bg: "#1687F8", fg: "#ffffff" };
        if (label === "부모님댁") return { symbol: "♥", bg: "#22A447", fg: "#ffffff" };
        if (label === "회사") return { symbol: "▦", bg: "#183B67", fg: "#ffffff" };
        if (label === "가족 보호") return { symbol: "♥", bg: "#22A447", fg: "#ffffff" };
        return { symbol: "●", bg: "#1687F8", fg: "#ffffff" };
      };

      withCoords.forEach((r) => {
        const position = new window.kakao.maps.LatLng(
          Number(r.latitude),
          Number(r.longitude)
        );

        const marker = new window.kakao.maps.Marker({ position, map });
        window.kakao.maps.event.addListener(marker, "click", () =>
          setSelectedRegionId(r.memberRegionId)
        );
        mapOverlaysRef.current.push(marker);

        const meta = labelMeta(r.regionLabel);
        const label = escapeHtml(r.regionLabel || "관심지역");
        const active = r.memberRegionId === selectedRegionId;

        const content = `
          <button
            type="button"
            data-region-id="${r.memberRegionId}"
            style="
              display:flex;
              align-items:center;
              gap:6px;
              padding:6px 10px 6px 6px;
              border:${active ? "2px solid #0F2540" : "1px solid #dbe5f0"};
              border-radius:999px;
              background:#ffffff;
              box-shadow:0 3px 10px rgba(15,37,64,.15);
              color:#0F2540;
              font-size:11px;
              font-weight:800;
              white-space:nowrap;
              cursor:pointer;
              font-family:Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            "
          >
            <span style="
              width:24px;
              height:24px;
              border-radius:999px;
              display:flex;
              align-items:center;
              justify-content:center;
              background:${meta.bg};
              color:${meta.fg};
              font-size:13px;
              font-weight:900;
            ">${meta.symbol}</span>
            <span>${label}</span>
          </button>
        `;

        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          content,
          yAnchor: 2.15,
          zIndex: active ? 10 : 3,
        });
        overlay.setMap(map);
        mapOverlaysRef.current.push(overlay);
      });

      // CustomOverlay 내부 버튼 클릭 처리
      const onOverlayClick = (event) => {
        const button = event.target.closest?.("[data-region-id]");
        if (!button || !mapRef.current?.contains(button)) return;
        const id = Number(button.dataset.regionId);
        setSelectedRegionId(Number.isNaN(id) ? button.dataset.regionId : id);
      };
      mapRef.current.addEventListener("click", onOverlayClick);

      resizeObserver = new ResizeObserver(() => {
        map.relayout();
        map.setCenter(center);
      });
      resizeObserver.observe(mapRef.current);

      requestAnimationFrame(() => {
        map.relayout();
        map.setCenter(center);
      });

      // cleanup에서 참조하기 위해 저장
      map.__safeTraceOverlayClick = onOverlayClick;
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (mapRef.current && mapInstanceRef.current?.__safeTraceOverlayClick) {
        mapRef.current.removeEventListener(
          "click",
          mapInstanceRef.current.__safeTraceOverlayClick
        );
      }
      mapOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      mapOverlaysRef.current = [];
    };
  }, [regions, selectedRegionId]);

  // 선택된 지역 좌표 근처의 진행중인 재난 조회 ("현재 상황" 패널)
  useEffect(() => {
    if (!selectedRegion?.latitude || !selectedRegion?.longitude) {
      setNearbyIncidents([]);
      return;
    }
    setNearbyLoading(true);
    authFetch(`/api/incidents/nearby?lat=${selectedRegion.latitude}&lng=${selectedRegion.longitude}&radiusKm=5`)
      .then(setNearbyIncidents)
      .catch(() => setNearbyIncidents([]))
      .finally(() => setNearbyLoading(false));
  }, [selectedRegion?.memberRegionId, selectedRegion?.latitude, selectedRegion?.longitude]);

  // 목록에서 특정 사건을 눌러 상세보기를 열 때 - 그 사건의 처리 타임라인(조치사항)만 조회 (이미 불러온 건 재요청 안 함)
  // /api/incidents/{id}/timeline은 로그인만 하면 누구나 볼 수 있는 엔드포인트라 시민도 그대로 재사용
  useEffect(() => {
    if (!selectedIncidentId || incidentTimelines[selectedIncidentId]) return;
    setIncidentTimelineLoading(true);
    authFetch(`/api/incidents/${selectedIncidentId}/timeline`)
      .then((logs) => setIncidentTimelines((prev) => ({ ...prev, [selectedIncidentId]: logs })))
      .catch(() => setIncidentTimelines((prev) => ({ ...prev, [selectedIncidentId]: [] })))
      .finally(() => setIncidentTimelineLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId]);

  // 선택된 지역의 현재 날씨(기상청) + 대기질(에어코리아) + 근처 대피시설(민방위대피시설)
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [airQuality, setAirQuality] = useState(null);
  const [airQualityLoading, setAirQualityLoading] = useState(false);
  const [uvIndex, setUvIndex] = useState(null);
  const [uvIndexLoading, setUvIndexLoading] = useState(false);
  const [shelters, setShelters] = useState([]);
  const [sheltersLoading, setSheltersLoading] = useState(false);
  const [disasterMessages, setDisasterMessages] = useState([]);
  const [disasterMessagesLoading, setDisasterMessagesLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);

  const refreshCurrentStatus = (region) => {
    if (!region?.latitude || !region?.longitude) {
      setWeather(null);
      setAirQuality(null);
      setUvIndex(null);
      setShelters([]);
      setDisasterMessages([]);
      return;
    }
    const lat = region.latitude;
    const lng = region.longitude;

    setWeatherLoading(true);
    authFetch(`/api/environment/weather?lat=${lat}&lng=${lng}`)
      .then(setWeather)
      .catch(() => setWeather({ available: false }))
      .finally(() => setWeatherLoading(false));

    // 대기질(시/도 단위)/대피시설/긴급재난문자 셋 다 행정구역명이 필요해서
    // 좌표 -> 행정구역명 변환(카카오 리버스 지오코딩)을 한 번만 하고 같이 씀
    if (window.kakao?.maps) {
      setAirQualityLoading(true);
      setUvIndexLoading(true);
      setSheltersLoading(true);
      setDisasterMessagesLoading(true);
      window.kakao.maps.load(() => {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2RegionCode(lng, lat, (result, status) => {
          const regionCode = status === window.kakao.maps.services.Status.OK
            ? result.find((r) => r.region_type === "H") || result[0]
            : null;
          const sido = regionCode?.region_1depth_name;
          const gu = regionCode?.region_2depth_name;

          if (!sido) {
            setAirQuality({ available: false });
            setAirQualityLoading(false);
            setUvIndex({ available: false });
            setUvIndexLoading(false);
          } else {
            authFetch(`/api/environment/air-quality?sido=${encodeURIComponent(sido)}`)
              .then(setAirQuality)
              .catch(() => setAirQuality({ available: false }))
              .finally(() => setAirQualityLoading(false));

            authFetch(`/api/environment/uv-index?sido=${encodeURIComponent(sido)}`)
              .then(setUvIndex)
              .catch(() => setUvIndex({ available: false }))
              .finally(() => setUvIndexLoading(false));
          }

          // 세종특별자치시처럼 "구" 단위 행정구역이 아예 없는 지역은 gu가 빈 문자열로 와서
          // 예전엔 여기서 바로 걸러져 재난문자/대피시설 조회 자체를 안 했음(=세종은 항상 빈 목록).
          // gu가 없으면 시도명 자체("세종특별자치시")를 지역 쿼리로 그대로 씀.
          const regionQuery = gu ? `${sido} ${gu}` : sido;
          // "성남시 분당구"처럼 표기가 API마다 다를 수 있어 재시도용으로 구 이름만 따로 두는데,
          // 세종은애초에 gu가 없으니 재시도할 것도 없음(=쓸데없는 API 호출 안 함, 호출량도 아낌)
          const regionFallback = gu || null;
          // 행안부 원본 데이터가 발송 기관마다 시도를 정식명("부산광역시")이 아니라 약칭("부산")으로
          // 적어둔 경우가 있어서(대전은 정식명으로 매칭됐는데 부산은 안 됐던 사례), 마지막으로 약칭까지 시도
          const regionShortFallback = gu && SIDO_SHORT_NAME[sido] ? `${SIDO_SHORT_NAME[sido]} ${gu}` : null;
          // 재난문자 중엔 구 단위가 아니라 시/도 전체에 동시 발송되는 것도 있음(예: 물놀이 안전수칙
          // 안내처럼 여러 광역시도에 한꺼번에 나가는 문자). 그런 문자는 원본 지역명이 "대전광역시"처럼
          // 시/도명만 있고 구는 안 붙어있어서, 위의 구 포함 조합들로는 하나도 안 걸림 -> 시/도명 단독으로도 시도
          const regionSidoOnlyFallback = gu ? sido : null;

          if (!regionQuery) {
            setShelters([]);
            setSheltersLoading(false);
            setDisasterMessages([]);
            setDisasterMessagesLoading(false);
          } else {
            authFetch(`/api/environment/shelters?guName=${encodeURIComponent(regionQuery)}&lat=${lat}&lng=${lng}&limit=3`)
              .then((data) => {
                if (data.length > 0 || !regionFallback) return data;
                return authFetch(`/api/environment/shelters?guName=${encodeURIComponent(regionFallback)}&lat=${lat}&lng=${lng}&limit=3`);
              })
              .then((data) => {
                if (data.length > 0 || !regionShortFallback) return data;
                return authFetch(`/api/environment/shelters?guName=${encodeURIComponent(regionShortFallback)}&lat=${lat}&lng=${lng}&limit=3`);
              })
              .then(setShelters)
              .catch(() => setShelters([]))
              .finally(() => setSheltersLoading(false));

            // 실제 발송된 긴급재난문자 - 행정안전부(재난안전데이터공유플랫폼)
            // 구 단위로 발송된 문자("당진시")랑 시/도 전체에 동시발송된 문자("충청남도" 전체 대상,
            // 예: 물놀이 안전수칙 안내)는 서로 다른 문자라 둘 다 보여줘야 함.
            // 예전엔 fallback 체인이라 구 단위 문자가 하나라도 있으면 거기서 멈추고
            // 시/도 전체 문자는 조회 자체를 안 했음(=당진시처럼 자체 발송 문자가 있는 지역은
            // 시/도 전체 문자가 계속 묻혀서 안 보이는 문제) -> 병렬로 둘 다 가져와서 합치는 걸로 변경.
            const fetchDistrictMessages = () =>
              authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(regionQuery)}&limit=20`)
                .then((data) => {
                  if (data.length > 0 || !regionFallback) return data;
                  return authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(regionFallback)}&limit=20`);
                })
                .then((data) => {
                  if (data.length > 0 || !regionShortFallback) return data;
                  return authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(regionShortFallback)}&limit=20`);
                })
                .catch(() => []);

            const fetchSidoWideMessages = () =>
              regionSidoOnlyFallback
                ? authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(regionSidoOnlyFallback)}&limit=20`)
                    // 행안부 API가 rgnNm="충청남도"로 조회하면 "충청남도"로 시작하는 모든 문자
                    // (당진시/태안군/서천군...)를 다 돌려줌. 그중 "진짜 시/도 전체 대상" 문자만 남긴다.
                    // 주의: 여러 시/도에 동시발송된 문자는 region 필드에 "강원도,경기도,...,충청남도,..."
                    // 처럼 콤마로 여러 지역이 나열돼서 옴 - 그래서 전체 문자열이 "충청남도"와 똑같은지가
                    // 아니라, 콤마로 쪼갠 목록 안에 "충청남도"라는 토큰이 정확히 있는지로 판단해야 함.
                    .then((data) =>
                      data.filter((msg) =>
                        (msg.region || "")
                          .split(",")
                          .map((r) => r.trim())
                          .includes(regionSidoOnlyFallback)
                      )
                    )
                    .catch(() => [])
                : Promise.resolve([]);

            // CRT_DT가 "2026-09-12 12:10:00"처럼 공백으로 와서 Date()가 브라우저에 따라
            // 못 알아먹을 수 있어, "T"로 바꿔서 안전하게 파싱(백엔드 parseCrtDt와 같은 이유)
            const toTimestamp = (msg) => {
              const normalized = (msg.createdAt || "").replace(/\//g, "-").replace(" ", "T");
              const time = new Date(normalized).getTime();
              return Number.isNaN(time) ? 0 : time;
            };

            Promise.all([fetchDistrictMessages(), fetchSidoWideMessages()])
              .then(([districtMessages, sidoMessages]) => {
                const seen = new Set();
                const merged = [...districtMessages, ...sidoMessages].filter((msg) => {
                  // 백엔드가 SN 있으면 SN으로, 없으면 시각+지역+내용 조합으로 중복 판단하는 것과 동일한 기준
                  const key = msg.sn ? `SN:${msg.sn}` : `${msg.createdAt}|${msg.region}|${msg.message}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                merged.sort((a, b) => toTimestamp(b) - toTimestamp(a));
                setDisasterMessages(merged.slice(0, 20));
              })
              .catch(() => setDisasterMessages([]))
              .finally(() => setDisasterMessagesLoading(false));
          }
        });
      });
    }
    setLastUpdatedAt(new Date());
  };

  useEffect(() => {
    refreshCurrentStatus(selectedRegion);
    // refreshSignal은 "관심지역" 탭을 다시 눌렀을 때만 바뀌는 값 - 선택된 지역이 그대로여도
    // 이 값이 바뀌면 날씨/대기질/재난특보 패널을 강제로 다시 불러오게 함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion?.memberRegionId, selectedRegion?.latitude, selectedRegion?.longitude, refreshSignal]);

  // 입력창에 타이핑하면 300ms 후에 카카오 장소검색(키워드검색)으로 후보 목록을 띄움.
  // Places 검색 결과는 x(경도)/y(위도)를 바로 주기 때문에, 목록에서 고르는 즉시
  // 별도 지오코딩 없이 바로 등록까지 끝낼 수 있음.
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (!window.kakao?.maps) return;

    setSearchLoading(true);
    const timer = setTimeout(() => {
      window.kakao.maps.load(() => {
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(searchQuery, (data, status) => {
          setSearchLoading(false);
          if (status === window.kakao.maps.services.Status.OK) {
            setSuggestions(data.slice(0, 6));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 카카오 실시간 검색 선택, 다음 우편번호 검색 선택 둘 다 여기로 모여서 등록됨
  const submitRegion = async (regionName, lat, lng) => {
    setError("");
    setGeocoding(true);
    try {
      await authFetch("/api/mypage/regions", {
        method: "POST",
        body: JSON.stringify({
          regionName,
          latitude: lat,
          longitude: lng,
          regionLabel: selectedLabel,
          isPrimary: regions.length === 0,
        }),
      });
      setSearchQuery("");
      setSuggestions([]);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setGeocoding(false);
    }
  };

  const selectSuggestion = (place) => {
    setShowSuggestions(false);
    submitRegion(place.road_address_name || place.address_name, Number(place.y), Number(place.x));
  };

  // 다음(Daum) 우편번호 검색 팝업 - 정확한 도로명/지번 주소를 직접 찾고 싶을 때를 위한 대안 경로.
  // 카카오 실시간 검색(장소/건물명 위주)과 달리 정확한 지번 주소 검색에 강함.
  const openAddressSearch = () => {
    setError("");
    if (!window.daum || !window.daum.Postcode) {
      setError("주소 검색 서비스를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        if (!window.kakao?.maps) {
          setError("지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        setGeocoding(true);
        window.kakao.maps.load(() => {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.addressSearch(fullAddress, (result, status) => {
            if (status !== window.kakao.maps.services.Status.OK || !result[0]) {
              setGeocoding(false);
              setError("선택한 주소의 좌표를 찾지 못했습니다. 다시 검색해주세요.");
              return;
            }
            submitRegion(fullAddress, Number(result[0].y), Number(result[0].x));
          });
        });
      },
    }).open({ q: searchQuery });
  };

  const removeRegion = async (memberRegionId) => {
    try {
      await authFetch(`/api/mypage/regions/${memberRegionId}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const setPrimary = async (memberRegionId) => {
    try {
      await authFetch(`/api/mypage/regions/${memberRegionId}/primary`, { method: "PATCH" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4 items-start">
        <div className="space-y-4">
        {/* 관심 지역 추가 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-[#0F2540] mb-1">관심 지역 추가</h3>
          <p className="text-xs text-slate-400 mb-4">등록한 지역의 재난 알림을 우선적으로 받습니다.</p>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

          <div className="relative mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-[#0F2540]">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="지역, 건물명, 주소로 검색"
                  className="flex-1 text-sm outline-none"
                  disabled={geocoding}
                />
                {searchLoading && <span className="text-[10px] text-slate-300 shrink-0">검색중</span>}
                {searchQuery && !searchLoading && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setSuggestions([]); }}
                    className="text-slate-300 hover:text-slate-500 shrink-0 cursor-pointer"
                    aria-label="검색어 지우기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={openAddressSearch}
                disabled={geocoding}
                className="text-sm font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-lg px-4 py-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                검색
              </button>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-[76px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => selectSuggestion(place)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-[#0F2540] truncate">{place.place_name}</p>
                    <p className="text-xs text-slate-400 truncate">{place.road_address_name || place.address_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 shrink-0">라벨</span>
            {REGION_LABELS.map(({ value, icon: Icon }) => {
              const labelIconTone =
                value === "우리집"
                  ? "bg-blue-100 text-blue-600 ring-blue-200"
                  : value === "부모님댁" || value === "가족 보호"
                    ? "bg-emerald-100 text-emerald-600 ring-emerald-200"
                    : value === "회사"
                      ? "bg-indigo-100 text-indigo-700 ring-indigo-200"
                      : "bg-slate-200 text-[#0F2540] ring-slate-300";

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedLabel(value)}
                  className={`group flex items-center gap-1.5 text-xs font-semibold rounded-full pr-3 pl-1.5 py-1.5 cursor-pointer transition-all ${
                    selectedLabel === value
                      ? "bg-[#0F2540] text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center ring-1 transition ${
                      selectedLabel === value
                        ? "bg-white/15 text-white ring-white/20"
                        : labelIconTone
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        {/* 내 관심 지역 - 시안과 동일한 구성: 제목/설명/개수 + 큰 지도 + 지역목록 + 추가 버튼 */}
        {regions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-sm text-slate-400">등록된 관심지역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            {/* 상단 제목 영역 */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h4 className="font-extrabold text-[#0F2540] text-[15px] whitespace-nowrap">
                  내 관심 지역
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  등록한 지역을 클릭하면 상세한 정보를 확인할 수 있습니다.
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                {regions.length}개 지역
              </span>
            </div>

            {/* 지도 + 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,0.95fr)_minmax(280px,1.2fr)] gap-3 items-stretch">
              {/* 지도 - 기존보다 넓고 높게 */}
              <div className="relative rounded-xl overflow-hidden border border-slate-100 bg-slate-100 min-h-[265px]">
                <div ref={mapRef} className="absolute inset-0 w-full h-full" />
              </div>

              {/* 관심지역 목록 */}
              <div className="flex flex-col min-h-[265px]">
                <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 max-h-[217px]">
                  {regions.map((r) => {
                    const LabelIcon =
                      REGION_LABELS.find((l) => l.value === r.regionLabel)?.icon || MapPin;
                    const active = r.memberRegionId === selectedRegionId;

                    const iconTone =
                      r.regionLabel === "우리집"
                        ? "bg-blue-100 text-blue-600 ring-1 ring-blue-200 shadow-sm"
                        : r.regionLabel === "부모님댁" || r.regionLabel === "가족 보호"
                          ? "bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 shadow-sm"
                          : r.regionLabel === "회사"
                            ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 shadow-sm"
                            : "bg-slate-200 text-[#0F2540] ring-1 ring-slate-300 shadow-sm";

                    return (
                      <div
                        key={r.memberRegionId}
                        onClick={() => setSelectedRegionId(r.memberRegionId)}
                        className={`group rounded-xl border px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all ${
                          active
                            ? "border-[#0F2540] shadow-[0_0_0_1px_rgba(15,37,64,0.06)] bg-white"
                            : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/20"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconTone}`}>
                          <LabelIcon className="w-4.5 h-4.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-extrabold text-[#0F2540] truncate">
                              {r.regionLabel || "관심지역"}
                            </span>
                            {r.isPrimary === "Y" && (
                              <span className="shrink-0 text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                대표
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {r.regionName}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {r.isPrimary !== "Y" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimary(r.memberRegionId);
                              }}
                              className="text-[9px] font-bold text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full px-2 py-1 cursor-pointer transition"
                            >
                              대표설정
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRegion(r.memberRegionId);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition"
                            aria-label="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 시안의 하단 관심지역 추가 버튼 */}
                <button
                  type="button"
                  onClick={openAddressSearch}
                  disabled={geocoding}
                  className="mt-3 h-11 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-base leading-none font-light">＋</span>
                  관심 지역 추가하기
                </button>
              </div>
            </div>
          </div>
        )}

          {/* 주변 대피시설 - 관심지역 카드 바로 아래 */}
        {regions.length > 0 && selectedRegion && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[#0F2540] text-[15px]">주변 대피시설</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedRegion.regionLabel} 주변 가까운 대피시설입니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenShelters?.(selectedRegion.memberRegionId)}
                className="text-[11px] font-semibold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                더보기
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {sheltersLoading ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400">주변 대피시설을 불러오는 중...</p>
              </div>
            ) : shelters.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center">
                <Building2 className="w-7 h-7 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">근처 대피시설 정보를 찾지 못했습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {shelters.map((s, i) => {
                  const distance =
                    s.distanceM >= 1000
                      ? `${(s.distanceM / 1000).toFixed(1)}km`
                      : `${Math.round(s.distanceM)}m`;

                  const openKakaoMap = () => {
                    const keyword = encodeURIComponent(s.address || s.name);
                    window.open(`https://map.kakao.com/link/search/${keyword}`, "_blank", "noopener,noreferrer");
                  };

                  return (
                    <div
                      key={i}
                      className="group w-full flex items-center border border-slate-100 rounded-xl px-3 py-3 bg-white hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mr-3 group-hover:bg-blue-100 transition-colors">
                        <Building2 className="w-5 h-5 text-blue-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#0F2540] truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">{s.address}</p>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mx-3 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        {distance}
                      </div>

                      <button
                        type="button"
                        onClick={openKakaoMap}
                        className="h-8 px-2.5 rounded-lg border border-blue-100 bg-white text-blue-500 text-[10px] font-bold flex items-center gap-1 shrink-0 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all cursor-pointer"
                      >
                        <Map className="w-3.5 h-3.5" />
                        지도보기
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        </div>

        {/* 관심 지역 현재 상황 - 날씨/재난특보/대기질 3칸 타일 */}
        <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-1.5 mb-3 whitespace-nowrap">
            <h4 className="font-bold text-[#0F2540] text-[12px] whitespace-nowrap shrink-0">관심 지역 현재 상황</h4>
            {regions.length > 0 && selectedRegion && (
              <div className="flex items-center gap-1 min-w-0 shrink-0">
                <span className="text-[9px] text-slate-400 whitespace-nowrap leading-none">
                  {lastUpdatedAt
                    ? `${lastUpdatedAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} ${lastUpdatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => refreshCurrentStatus(selectedRegion)}
                  disabled={weatherLoading || airQualityLoading || uvIndexLoading || sheltersLoading}
                  className="text-slate-400 hover:text-[#0F2540] p-0.5 cursor-pointer disabled:opacity-40 shrink-0"
                  aria-label="새로고침"
                >
                  <RefreshCw className={`w-3 h-3 ${(weatherLoading || airQualityLoading || uvIndexLoading || sheltersLoading) ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}
          </div>

          {regions.length === 0 || !selectedRegion ? (
            <p className="text-xs text-slate-400">지역을 등록하면 현재 상황을 볼 수 있어요.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <button
                  type="button"
                  onClick={() => setRegionPickerOpen((v) => !v)}
                  className="w-full flex items-center gap-2.5 border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 cursor-pointer"
                >
                  {(() => {
                    const SelIcon = REGION_LABELS.find((l) => l.value === selectedRegion.regionLabel)?.icon || MapPin;
                    return (
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                        <SelIcon className="w-4 h-4 text-white" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0 text-left flex items-baseline gap-2">
                    <span className="text-sm font-extrabold text-[#0F2540] shrink-0">{selectedRegion.regionLabel}</span>
                    <span className="text-xs text-slate-400 truncate">{selectedRegion.regionName}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${regionPickerOpen ? "-rotate-90" : "rotate-90"}`} />
                </button>

                {regionPickerOpen && regions.length > 1 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {regions.map((r) => {
                      const Icon = REGION_LABELS.find((l) => l.value === r.regionLabel)?.icon || MapPin;
                      return (
                        <button
                          key={r.memberRegionId}
                          type="button"
                          onClick={() => { setSelectedRegionId(r.memberRegionId); setRegionPickerOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                        >
                          <Icon className="w-4 h-4 text-[#0F2540] shrink-0" />
                          <div className="text-left min-w-0">
                            <p className="text-sm font-semibold text-[#0F2540] truncate">{r.regionLabel}</p>
                            <p className="text-[11px] text-slate-400 truncate">{r.regionName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 날씨 - 위쪽 가로 풀폭: 칸을 나눠 쓰지 않아서 글씨를 넉넉하게 키울 수 있음 */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 mb-2 flex items-center justify-center gap-3 text-center">
                {(() => {
                  const WeatherIcon =
                    weather?.precipitationType?.includes("눈") ? Snowflake :
                    weather?.precipitationType?.includes("비") || weather?.precipitationType?.includes("빗") ? Droplets :
                    weather?.precipitationType === "맑음" ? Sun : Cloud;
                  return weatherLoading ? (
                    <p className="text-xs text-slate-300">불러오는 중...</p>
                  ) : weather?.available ? (
                    <>
                      <WeatherIcon className="w-9 h-9 text-amber-500 shrink-0" />
                      <div className="shrink-0 text-left">
                        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                          <span className="text-2xl font-bold text-[#0F2540] leading-none whitespace-nowrap">{weather.temperature}°C</span>
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">{weather.precipitationType}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">습도 {weather.humidity}% · 풍속 {weather.windSpeed}m/s</p>
                        {(() => {
                          // "강수없음" 텍스트뿐 아니라 "0", "0.0" 같은 실질적으로 비가 안 오는 값도
                          // 다 걸러야 함 - 안 그러면 맑은 날에도 "시간당 강수량 0mm"가 계속 떠서
                          // 원래 의도(비 올 때만 표시)와 다르게 항상 한 줄이 더 붙어버림
                          const rainValue = parseFloat(weather.hourlyRainfall);
                          if (!rainValue || Number.isNaN(rainValue)) return null;
                          return (
                            <p className="text-[10px] text-blue-500 mt-0.5 whitespace-nowrap">시간당 강수량 {weather.hourlyRainfall}mm</p>
                          );
                        })()}
                        {uvIndex?.available && (() => {
                          // 낮음/보통은 눈에 안 띄는 회색, 높음부터는 주의를 끌도록 주황/빨강으로 구분
                          const strong = uvIndex.grade === "매우높음" || uvIndex.grade === "위험";
                          const color = strong ? "text-red-500" : uvIndex.grade === "높음" ? "text-amber-500" : "text-slate-400";
                          return (
                            <p className={`text-[10px] mt-0.5 whitespace-nowrap ${color}`}>
                              자외선 {uvIndex.grade}(지수 {uvIndex.value})
                            </p>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-300">날씨 정보없음</p>
                  );
                })()}
              </div>

              {/* 재난특보 / 대기질 - 아래쪽 2칸: 3칸일 때보다 칸당 폭이 넓어서 글씨를 줄이지 않아도 됨 */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center ${
                    nearbyIncidents.length > 0 ? "cursor-pointer hover:bg-slate-100 transition-colors" : ""
                  }`}
                  onClick={() => nearbyIncidents.length > 0 && setIncidentListOpen(true)}
                >
                  <p className="text-xs text-slate-400 mb-1.5">재난 특보</p>
                  {nearbyLoading ? (
                    <p className="text-xs text-slate-300">...</p>
                  ) : nearbyIncidents.length === 0 ? (
                    <>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-[14px] font-bold text-emerald-600 whitespace-nowrap">특보 없음</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">현재 특보가 없습니다.</p>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <span className="text-[14px] font-bold text-red-600 whitespace-nowrap">진행중 {nearbyIncidents.length}건</span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
                  <p className="text-xs text-slate-400 mb-1.5">대기질</p>
                  {airQualityLoading ? (
                    <p className="text-xs text-slate-300">...</p>
                  ) : airQuality?.available ? (
                    <>
                      {(() => {
                        // 미세먼지(PM10)·초미세먼지(PM2.5) 중 더 나쁜 등급을 기준으로 아이콘/색을 결정
                        // (하나는 "보통"인데 하나가 "나쁨"이면 전체적으로는 나쁨으로 보여줘야 함)
                        const GRADE_RANK = { 좋음: 0, 보통: 1, 나쁨: 2, 매우나쁨: 3 };
                        const worstGrade = [airQuality.pm10Grade, airQuality.pm25Grade]
                          .filter(Boolean)
                          .sort((a, b) => GRADE_RANK[b] - GRADE_RANK[a])[0];
                        const good = worstGrade === "좋음" || worstGrade === "보통";
                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${good ? "bg-emerald-100" : "bg-amber-100"}`}>
                              <Smile className={`w-4 h-4 ${good ? "text-emerald-600" : "text-amber-600"}`} />
                            </div>
                            <span className={`text-[14px] font-bold whitespace-nowrap ${good ? "text-emerald-600" : "text-amber-600"}`}>
                              {worstGrade}
                            </span>
                          </div>
                        );
                      })()}
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                        {[
                          airQuality.pm10 != null ? `PM10(미세먼지) ${airQuality.pm10}` : null,
                          airQuality.pm25 != null ? `PM2.5(초미세먼지) ${airQuality.pm25}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-300">정보없음</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {regions.length > 0 && selectedRegion && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="font-bold text-[#0F2540] text-sm">최근 안전·재난 소식</h4>
              <button
                type="button"
                onClick={() => onOpenSafetyNews?.(selectedRegion.memberRegionId)}
                className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition cursor-pointer"
              >
                더보기
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {disasterMessagesLoading ? (
              <p className="text-xs text-slate-400">불러오는 중...</p>
            ) : disasterMessages.length === 0 ? (
              <p className="text-xs text-slate-400">최근 발송된 재난문자가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {disasterMessages.slice(0, 5).map((msg, i) => {
                  const Icon = DISASTER_ICON[msg.disasterType] || AlertTriangle;
                  return (
                    <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50">
                      <Icon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-red-600 shrink-0">{msg.disasterType}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{msg.createdAt}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-snug">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 재난 특보 상세 - 근처 진행중인 Incident 목록 → 클릭하면 그 사건 상세로 */}
      {incidentListOpen && (() => {
        const selectedIncident = nearbyIncidents.find((i) => i.incidentId === selectedIncidentId) || null;
        const closeAll = () => {
          setIncidentListOpen(false);
          setSelectedIncidentId(null);
        };
        const timeline = selectedIncident ? incidentTimelines[selectedIncident.incidentId] || [] : [];
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={closeAll}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {!selectedIncident ? (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                      <h2 className="font-extrabold text-[#0F2540]">진행중인 재난 {nearbyIncidents.length}건</h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">관심지역 반경 5km 이내 · 눌러서 상세 상황을 확인하세요</p>
                    </div>
                    <button onClick={closeAll} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 space-y-2">
                    {nearbyIncidents.map((incident) => {
                      const Icon = DISASTER_ICON[incident.disasterType] || AlertTriangle;
                      return (
                        <button
                          key={incident.incidentId}
                          onClick={() => setSelectedIncidentId(incident.incidentId)}
                          className="w-full text-left rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${DISASTER_TYPE_STYLE[incident.disasterType] || "bg-slate-100 text-slate-600"}`}>
                                <Icon className="w-3 h-3 shrink-0" />{incident.disasterType}
                              </span>
                              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${SEVERITY_STYLE[incident.severity] || "bg-slate-100 text-slate-600"}`}>
                                {SEVERITY_LABEL_KO[incident.severity] || incident.severity}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-600 text-white">
                                {STATUS_LABEL_KO[incident.status] || incident.status}
                              </span>
                            </div>
                            <h3 className="font-bold text-[#0F2540] text-sm mb-1 truncate">{incident.title}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{incident.region}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 shrink-0">
                    <button onClick={() => setSelectedIncidentId(null)} className="text-slate-400 hover:text-slate-600 p-1 -ml-1 cursor-pointer shrink-0">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="font-extrabold text-[#0F2540] flex-1 truncate">사건 상세</h2>
                    <button onClick={closeAll} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 space-y-4">
                    <div>
                      {(() => {
                        const Icon = DISASTER_ICON[selectedIncident.disasterType] || AlertTriangle;
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${DISASTER_TYPE_STYLE[selectedIncident.disasterType] || "bg-slate-100 text-slate-600"}`}>
                              <Icon className="w-3 h-3 shrink-0" />{selectedIncident.disasterType}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${SEVERITY_STYLE[selectedIncident.severity] || "bg-slate-100 text-slate-600"}`}>
                              {SEVERITY_LABEL_KO[selectedIncident.severity] || selectedIncident.severity}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-600 text-white">
                              {STATUS_LABEL_KO[selectedIncident.status] || selectedIncident.status}
                            </span>
                          </div>
                        );
                      })()}
                      <h3 className="font-bold text-[#0F2540] text-base mb-1.5">{selectedIncident.title}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {selectedIncident.region}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        최초 접수 {formatDateTimeFull(selectedIncident.createdAt)}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#0F2540] mb-2">대응 이력</h4>
                      {incidentTimelineLoading && timeline.length === 0 ? (
                        <p className="text-xs text-slate-400">불러오는 중...</p>
                      ) : timeline.length === 0 ? (
                        <p className="text-xs text-slate-400">아직 등록된 조치 내용이 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {timeline.map((log, i) => (
                            <div key={log.logId} className="flex gap-2">
                              <div className="flex flex-col items-center shrink-0">
                                <span className={`w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm ${REPORT_STATUS_DOT[log.newStatus] || "bg-slate-400"}`} />
                                {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                              </div>
                              <div className="min-w-0 flex-1 rounded-lg border border-slate-100 px-2.5 py-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-[#0F2540]">{STATUS_LABEL_KO[log.newStatus] || log.newStatus}</span>
                                  <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.changedAt)}</span>
                                </div>
                                {log.memo && <div className="text-xs text-slate-600 mt-0.5">{log.memo}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
