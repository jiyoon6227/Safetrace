import { useState, useEffect, useRef } from "react";
import LoginPage from "./pages/LoginPage";
import ControlBoard from "./pages/ControlBoard";
import ReportForm from "./pages/ReportForm";
import ReportPage from "./pages/ReportPage";
import MyPage from "./pages/MyPage";
import WithdrawModal from "./pages/MyPage/WithdrawModal";
import SafetyCheckResponsePage from "./pages/SafetyCheckResponsePage";
import ShelterPage from "./pages/ShelterPage";
import SafetyGuidePage from "./pages/SafetyGuidePage";
import DisasterNewsPage from "./pages/DisasterNewsPage";
import PublicDisasterPage from "./pages/PublicDisasterPage";
import SafetyMapPage from "./pages/SafetyMapPage";
import NoticePage from "./pages/NoticePage";
import SearchPage from "./pages/SearchPage";
import NearbySafetyMap from "./components/NearbySafetyMap";
import SiteFooter from "./components/SiteFooter";
import { getCurrentUser, authFetch, getNotifications } from "./api/client";
import { connectIncidentSocket, connectSafetyCheckSocket, connectReportSocket } from "./api/socket";
import { buildNotificationItems } from "./pages/MyPage/constants";
import { useEscapeKey } from "./hooks/useEscapeKey";
import { REPORT_STATE_LABEL, REPORT_STATE_STYLE, WEATHER_LOCATION_CACHE_KEY } from "./pages/Main/constants";
import { readWeatherCachedLocation, distanceKm, pickPriorityIncident } from "./pages/Main/utils";
import MainHeader from "./pages/Main/MainHeader";
import MainHero from "./pages/Main/MainHero";
import QuickMenu from "./pages/Main/QuickMenu";
import ShelterPanel from "./pages/Main/ShelterPanel";
import SafetyGuidePanel from "./pages/Main/SafetyGuidePanel";
import DisasterInfoSection from "./pages/Main/DisasterInfoSection";
import WeatherCard from "./pages/Main/WeatherCard";
import AiBriefingCard from "./pages/Main/AiBriefingCard";
import ReportTrackingCard from "./pages/Main/ReportTrackingCard";
import AiChatModal from "./pages/Main/AiChatModal";
import TrackingModal from "./pages/Main/TrackingModal";

export default function MainPage() {
  const currentUser = getCurrentUser();
  const isStaff = currentUser?.role === "STAFF";

  // 이메일 안전확인 링크(?safetyCheckToken=xxx)로 들어온 거면 그 응답 화면부터 바로 보여줌
  const safetyCheckTokenFromUrl = new URLSearchParams(window.location.search).get("safetyCheckToken");
  // 새로고침 후에도 보던 페이지 유지 (history.state 복원)
  const [page, setPage] = useState(
    safetyCheckTokenFromUrl ? "safety-check-response" : window.history.state?.page || "home"
  ); // "home" | "login" | "mypage" | "shelters" | "safety-guides" | "disaster-info" | "safety-map" | "safety-news" | "safety-check-response" | "notices"
  const [selectedShelterRegionId, setSelectedShelterRegionId] = useState(
    window.history.state?.shelterRegionId ?? null
  );
  const [selectedSafetyNewsRegionId, setSelectedSafetyNewsRegionId] = useState(
    window.history.state?.safetyNewsRegionId ?? null
  );
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // 로그인 필요 기능 클릭 시 네이티브 alert 후 로그인 페이지로 이동
  const requireLogin = (action) => {
    if (!token) {
      window.alert("로그인이 필요한 서비스입니다.");
      goTo("login");
      return;
    }
    action();
  };

  // 헤더 검색 - "실시간 재난·안전 정보" 목록을 지역/키워드로 필터링
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const headerSearchInputRef = useRef(null);
  const disasterListRef = useRef(null);
  const safetyMapRef = useRef(null);
  const shelterPanelRef = useRef(null);
  const safetyGuidePanelRef = useRef(null);

  // 메인 "실시간 재난 · 안전 정보" - 행안부 긴급재난문자 최근 48시간 데이터를 사용
  const [mainDisasterMessages, setMainDisasterMessages] = useState([]);
  const [mainNearbyIncident, setMainNearbyIncident] = useState(null);
  const [mainNearbyIncidentLoading, setMainNearbyIncidentLoading] = useState(false);
  const [mainDisasterLoading, setMainDisasterLoading] = useState(true);
  const [mainDisasterError, setMainDisasterError] = useState("");
  const [mainDisasterFilter, setMainDisasterFilter] = useState("전체");

  // 메인 현재 날씨 - 안전지도와 같은 sessionStorage 위치를 사용한다.
  // 위치 권한을 자동으로 다시 요청하지 않고, 캐시된 위치가 있으면 그 좌표로만 조회한다.
  const [weatherLocation, setWeatherLocation] = useState(() => readWeatherCachedLocation());
  const [weatherLocationLabel, setWeatherLocationLabel] = useState("내 위치");
  const [currentWeather, setCurrentWeather] = useState(null);
  const [currentAirQuality, setCurrentAirQuality] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const [weatherLocating, setWeatherLocating] = useState(false);

  // 메인 퀵메뉴 "대피시설 찾기" 중간 패널
  const [shelterPanelOpen, setShelterPanelOpen] = useState(false);
  const [quickShelters, setQuickShelters] = useState([]);
  const [quickShelterLoading, setQuickShelterLoading] = useState(false);
  const [quickShelterError, setQuickShelterError] = useState("");
  const [quickShelterQuery, setQuickShelterQuery] = useState("");
  const [quickShelterRefreshKey, setQuickShelterRefreshKey] = useState(0);

  // 메인 퀵메뉴 "행동요령" 중간 패널
  const [safetyGuidePanelOpen, setSafetyGuidePanelOpen] = useState(false);
  const [activeSafetyGuideKey, setActiveSafetyGuideKey] = useState("FLOOD");

  // AI 상황 브리핑
  const [aiBriefing, setAiBriefing] = useState("");
  const [aiBriefingLoading, setAiBriefingLoading] = useState(false);
  const [aiBriefingError, setAiBriefingError] = useState("");
  const [aiBriefingRefreshKey, setAiBriefingRefreshKey] = useState(0);

  // AI 안전 도우미 채팅
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatError, setAiChatError] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      role: "assistant",
      content: "안녕하세요. SafeTrace 안전 도우미입니다. 내 주변 정보뿐 아니라 서울·화성시처럼 다른 지역의 재난문자·사건·대피시설도 질문해보세요.",
    },
  ]);
  const aiChatEndRef = useRef(null);

  const closeAiChat = () => {
    if (aiChatLoading) return;
    setAiChatOpen(false);
    setAiChatError("");
  };

  const openAiChat = () => {
    setAiChatError("");
    setAiChatOpen(true);
  };

  const sendAiChatMessage = async (presetQuestion) => {
    const message = String(presetQuestion ?? aiChatInput).trim();
    if (!message || aiChatLoading) return;

    const region = weatherLocation
      ? String(weatherLocationLabel || "")
          .replace(/\s*기준\s*$/, "")
          .trim() || "현재 위치 주변"
      : "현재 위치 정보 없음";

    const history = aiChatMessages
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    setAiChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setAiChatInput("");
    setAiChatError("");
    setAiChatLoading(true);

    try {
      const data = await authFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          lat: weatherLocation?.lat ?? null,
          lng: weatherLocation?.lng ?? null,
          region,
          history,
        }),
      });

      setAiChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(data?.answer || "답변을 생성하지 못했습니다."),
        },
      ]);
    } catch (e) {
      setAiChatError(e?.message || "AI 안전 도우미 답변을 불러오지 못했습니다.");
    } finally {
      setAiChatLoading(false);
    }
  };

  useEffect(() => {
    if (!aiChatOpen) return;
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiChatOpen, aiChatMessages, aiChatLoading]);

  useEscapeKey(aiChatOpen, closeAiChat);

  const requestWeatherLocation = () => {
    if (!navigator.geolocation) {
      setWeatherError("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setWeatherLocating(true);
    setWeatherError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        try {
          window.sessionStorage.setItem(WEATHER_LOCATION_CACHE_KEY, JSON.stringify(next));
        } catch {
          // 저장소 사용 불가 환경에서는 현재 화면에서만 사용
        }
        setWeatherLocation(next);
        setWeatherLocating(false);
        setWeatherRefreshKey((value) => value + 1);
      },
      (error) => {
        setWeatherLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setWeatherError("위치 권한을 허용하면 현재 위치의 날씨를 볼 수 있어요.");
        } else if (error.code === error.TIMEOUT) {
          setWeatherError("위치 확인 시간이 초과됐습니다. 다시 시도해주세요.");
        } else {
          setWeatherError("현재 위치를 확인하지 못했습니다.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // 안전지도에서 위치를 확인한 뒤 sessionStorage가 갱신되면 날씨 카드도 같은 위치로 따라간다.
  // GPS를 재요청하는 타이머가 아니라, 저장된 좌표가 바뀌었는지만 확인한다.
  useEffect(() => {
    if (page !== "home") return undefined;

    const syncCachedLocation = () => {
      const cached = readWeatherCachedLocation();
      if (!cached) return;
      setWeatherLocation((prev) => {
        if (prev && prev.lat === cached.lat && prev.lng === cached.lng) return prev;
        return cached;
      });
    };

    syncCachedLocation();
    const timer = window.setInterval(syncCachedLocation, 1500);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (page !== "home" || !weatherLocation) return undefined;

    let active = true;
    setWeatherLoading(true);
    setWeatherError("");

    const { lat, lng } = weatherLocation;

    const resolveRegion = () => new Promise((resolve) => {
      let attempts = 0;
      const tryResolve = () => {
        if (!active) {
          resolve(null);
          return;
        }

        if (window.kakao?.maps?.services?.Geocoder) {
          const geocoder = new window.kakao.maps.services.Geocoder();
          geocoder.coord2RegionCode(lng, lat, (result, status) => {
            if (!active || status !== window.kakao.maps.services.Status.OK || !result?.length) {
              resolve(null);
              return;
            }
            const region = result.find((item) => item.region_type === "H") || result[0];
            resolve({
              sido: region?.region_1depth_name || "",
              label: [region?.region_1depth_name, region?.region_2depth_name]
                .filter(Boolean)
                .join(" "),
            });
          });
          return;
        }

        attempts += 1;
        if (attempts >= 30) {
          resolve(null);
          return;
        }
        window.setTimeout(tryResolve, 100);
      };

      tryResolve();
    });

    Promise.allSettled([
      authFetch(`/api/environment/weather?lat=${lat}&lng=${lng}&_=${Date.now()}`),
      resolveRegion(),
    ]).then(async ([weatherResult, regionResult]) => {
      if (!active) return;

      const weatherData = weatherResult.status === "fulfilled" ? weatherResult.value : null;
      const region = regionResult.status === "fulfilled" ? regionResult.value : null;

      setCurrentWeather(weatherData?.available ? weatherData : null);
      if (region?.label) setWeatherLocationLabel(`${region.label} 기준`);
      else setWeatherLocationLabel("내 위치 기준");

      if (region?.sido) {
        try {
          const air = await authFetch(`/api/environment/air-quality?sido=${encodeURIComponent(region.sido)}&_=${Date.now()}`);
          if (active) setCurrentAirQuality(air?.available ? air : null);
        } catch {
          if (active) setCurrentAirQuality(null);
        }
      } else {
        setCurrentAirQuality(null);
      }

      if (!weatherData?.available) {
        setWeatherError(weatherData?.message || "현재 날씨를 불러오지 못했습니다.");
      }

      if (active) setWeatherLoading(false);
    });

    return () => { active = false; };
  }, [page, weatherLocation, weatherRefreshKey]);


  // 대피시설 패널이 열렸을 때만 실제 공공 API를 조회한다.
  // 메인 진입 때마다 불필요하게 대피시설 API를 호출하지 않도록 분리함.
  useEffect(() => {
    if (page !== "home" || !shelterPanelOpen || !weatherLocation) return undefined;

    const region = String(weatherLocationLabel || "")
      .replace(/\s*기준\s*$/, "")
      .trim();

    // 카카오 좌표 -> 행정구역 변환이 끝나기 전에는 잠시 기다림
    if (!region || region === "내 위치") return undefined;

    let active = true;
    const { lat, lng } = weatherLocation;

    setQuickShelterLoading(true);
    setQuickShelterError("");

    const loadShelters = async () => {
      try {
        let data = await authFetch(
          `/api/environment/shelters?guName=${encodeURIComponent(region)}&lat=${lat}&lng=${lng}&limit=50`
        );

        // 일부 공공데이터는 "대전광역시 동구"보다 "동구" LIKE 검색에서 더 잘 잡히는 경우가 있어 1회만 fallback
        if (!Array.isArray(data) || data.length === 0) {
          const parts = region.split(/\s+/).filter(Boolean);
          const gu = parts.length >= 2 ? parts[1] : "";
          if (gu) {
            data = await authFetch(
              `/api/environment/shelters?guName=${encodeURIComponent(gu)}&lat=${lat}&lng=${lng}&limit=50`
            );
          }
        }

        if (!active) return;
        setQuickShelters(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setQuickShelters([]);
        setQuickShelterError(e?.message || "대피시설 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setQuickShelterLoading(false);
      }
    };

    loadShelters();

    return () => {
      active = false;
    };
  }, [page, shelterPanelOpen, weatherLocation, weatherLocationLabel, quickShelterRefreshKey]);

  const filteredQuickShelters = quickShelters
    .filter((shelter) => {
      const query = quickShelterQuery.trim().toLowerCase();
      if (!query) return true;

      return `${shelter.name || ""} ${shelter.address || ""}`
        .toLowerCase()
        .includes(query);
    })
    .sort(
      (a, b) =>
        (Number(a.distanceM) || Number.MAX_SAFE_INTEGER) -
        (Number(b.distanceM) || Number.MAX_SAFE_INTEGER)
    );

  const formatShelterDistance = (distanceM) => {
    const value = Number(distanceM);
    if (!Number.isFinite(value)) return "거리 정보 없음";
    if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
    return `${Math.round(value)}m`;
  };

  const openShelterPanel = () => {
    const willOpen = !shelterPanelOpen;
    setSafetyGuidePanelOpen(false);
    setShelterPanelOpen(willOpen);
    setQuickShelterError("");

    if (willOpen) {
      window.setTimeout(() => {
        shelterPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
    }
  };

  const openSafetyGuidePanel = () => {
    const willOpen = !safetyGuidePanelOpen;
    setShelterPanelOpen(false);
    setSafetyGuidePanelOpen(willOpen);

    if (willOpen) {
      window.setTimeout(() => {
        safetyGuidePanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
    }
  };

  // 현재 위치/지역 기준 AI 상황 브리핑 조회 (Groq)
  useEffect(() => {
    if (page !== "home" || !weatherLocation) return undefined;

    const region = String(weatherLocationLabel || "")
      .replace(/\s*기준\s*$/, "")
      .trim();

    // 카카오 좌표→지역 변환이 끝나기 전에는 호출하지 않는다.
    if (!region || region === "내 위치") return undefined;

    let active = true;
    setAiBriefingLoading(true);
    setAiBriefingError("");

    const { lat, lng } = weatherLocation;
    const query = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      region,
      _: String(Date.now()),
    });

    authFetch(`/api/ai/briefing?${query.toString()}`)
      .then((data) => {
        if (!active) return;
        setAiBriefing(String(data?.summary || "").trim());
      })
      .catch((e) => {
        if (!active) return;
        setAiBriefing("");
        setAiBriefingError(e?.message || "AI 상황 브리핑을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setAiBriefingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, weatherLocation, weatherLocationLabel, aiBriefingRefreshKey]);

  useEffect(() => {
    if (page !== "home") return undefined;

    let active = true;
    setMainDisasterLoading(true);
    setMainDisasterError("");

    authFetch("/api/environment/disaster-messages/nationwide?limit=30")
      .then((data) => {
        if (!active) return;
        setMainDisasterMessages(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!active) return;
        setMainDisasterMessages([]);
        setMainDisasterError(e?.message || "재난문자를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setMainDisasterLoading(false);
      });

    return () => { active = false; };
  }, [page]);

  // 히어로 카드용 - 반경 3km 내 진행 중 사건 중 가장 심각한 1건
  useEffect(() => {
    if (page !== "home" || !weatherLocation) {
      setMainNearbyIncident(null);
      return undefined;
    }

    let active = true;
    const { lat, lng } = weatherLocation;
    setMainNearbyIncidentLoading(true);

    authFetch(`/api/incidents/nearby?lat=${lat}&lng=${lng}&radiusKm=3`)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const picked = pickPriorityIncident(list);
        setMainNearbyIncident(
          picked ? { ...picked, distanceKm: distanceKm(lat, lng, picked.latitude, picked.longitude) } : null
        );
      })
      .catch(() => {
        if (active) setMainNearbyIncident(null);
      })
      .finally(() => {
        if (active) setMainNearbyIncidentLoading(false);
      });

    return () => { active = false; };
  }, [page, weatherLocation]);

  // 앱 내 페이지 전환을 브라우저 히스토리에 기록 (뒤로가기/앞으로가기 지원)
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, page }, "");
    const handlePopState = (e) => {
      setPage(e.state?.page || "home");
      setSelectedShelterRegionId(e.state?.shelterRegionId ?? null);
      setSelectedSafetyNewsRegionId(e.state?.safetyNewsRegionId ?? null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 페이지 전환: 추가 state도 같이 저장해두면 새로고침/뒤로가기에서도 선택 정보를 유지할 수 있음
  const goTo = (nextPage, extraState = {}) => {
    // 일반 페이지 이동 시 열려 있던 현장제보 팝업 상태를 반드시 닫는다.
    // openReport=true일 때만 팝업으로 열기
    if (extraState.openReport) {
      setShowReportForm(true);
    } else {
      setShowReportForm(false);
    }

    setPage(nextPage);

    if (Object.prototype.hasOwnProperty.call(extraState, "shelterRegionId")) {
      setSelectedShelterRegionId(extraState.shelterRegionId);
    }
    if (Object.prototype.hasOwnProperty.call(extraState, "safetyNewsRegionId")) {
      setSelectedSafetyNewsRegionId(extraState.safetyNewsRegionId);
    }

        window.history.pushState({ page: nextPage, ...extraState }, "");
  };

  // 메인 히어로 검색 → 통합검색 페이지로 이동
  const submitHeroSearch = () => {
    const q = headerSearchQuery.trim();
    if (!q) {
      headerSearchInputRef.current?.focus();
      return;
    }
    goTo("search", { searchQuery: q });
  };

  // 프로필 드롭다운 바깥을 클릭하면 자동으로 닫힘
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false); // 마이페이지 푸터 "회원탈퇴" 모달 (공통 SiteFooter에 전달)
  const [reportSuccess, setReportSuccess] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [myReportsLoading, setMyReportsLoading] = useState(false);

  // authFetch/authUpload의 401 처리 후 화면 상태 정리 (토큰 삭제는 client.js에서 완료)
  useEffect(() => {
    const handleAuthInvalid = () => {
      setToken(null);
      setMyProfile(null);
      if (page === "mypage" || page === "safety-news") {
        goTo("home");
      }
    };
    window.addEventListener("auth:invalid", handleAuthInvalid);
    return () => window.removeEventListener("auth:invalid", handleAuthInvalid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 연결된 사건들의 현재 상태 (incidentId -> Incident 객체)
  const incidentInfoRef = useRef({});
  const [incidentInfo, setIncidentInfo] = useState({});
  incidentInfoRef.current = incidentInfo;
  // 연결된 사건들의 처리 타임라인 (incidentId -> IncidentLog[]) - 사이드바 카드에 바로 보여주기 위함
  const [incidentTimelines, setIncidentTimelines] = useState({});

  // 대응상황 추적 모달 상태
  // trackingOpen=true & detailIncidentId=null  -> "내 연결된 사건 목록" 모드 (전체보기용)
  // trackingOpen=true & detailIncidentId=있음  -> 그 사건의 상태+타임라인 상세 모드
  const [trackingOpen, setTrackingOpen] = useState(false);
  // 제보 목록 모달의 필터/정렬 (상태 전체·진행중·완료·반려 / 재난유형 / 정렬)
  const [trackingStatusFilter, setTrackingStatusFilter] = useState("all"); // "all" | "progress" | "closed" | "rejected"
  const [trackingTypeFilter, setTrackingTypeFilter] = useState(null); // null(전체) | "침수" | "화재" 등
  const [trackingSort, setTrackingSort] = useState("newest"); // "newest" | "oldest"
  const [detailIncidentId, setDetailIncidentId] = useState(null);
  const detailIncidentIdRef = useRef(null); // 소켓 콜백 안에서 "지금 열려있는 모달"의 최신값을 읽기 위함
  useEffect(() => {
    detailIncidentIdRef.current = detailIncidentId;
  }, [detailIncidentId]);
  const [detailTimeline, setDetailTimeline] = useState([]);
  const [detailTimelineLoading, setDetailTimelineLoading] = useState(false);
  // 상세 모달 "처리 타임라인" 정렬 - 기본값은 최신순
  const [detailTimelineSort, setDetailTimelineSort] = useState("newest"); // "oldest" | "newest"

  // 안전확인 요청 목록 (헤더 알림 배지 계산용)
  const [receivedSafetyChecks, setReceivedSafetyChecks] = useState([]); // 나에게 온 요청 전체 (PENDING/SAFE/HELP)
  const [sentSafetyChecks, setSentSafetyChecks] = useState([]); // 내가 보낸 요청 전체

  // 헤더 표시용 프로필 (토큰의 이름/사진은 로그인 시점 값이라 홈 복귀 시마다 재조회)
  const [myProfile, setMyProfile] = useState(null);
  useEffect(() => {
    if (!token) {
      setMyProfile(null);
      return;
    }
    if (page !== "home") return;
    authFetch("/api/mypage").then(setMyProfile).catch(() => {});
  }, [token, page]);

  // 로그인된 상태면 화면 진입 시 내가 등록한 제보 목록을 실제 DB에서 가져옴
  useEffect(() => {
    if (!token) {
      setMyReports([]);
      return;
    }
    setMyReportsLoading(true);
    authFetch("/api/reports/my")
      .then(setMyReports)
      .catch(() => setMyReports([]))
      .finally(() => setMyReportsLoading(false));
  }, [token, reportSuccess]);

  // 헤더 알림 배지용 - 마이페이지 "알림" 탭과 같은 기준의 재난/제보/기타 알림 조회 (안전확인은 위 상태 재사용)
  const [regions, setRegions] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]);
  useEffect(() => {
    if (!token) {
      setRegions([]);
      setDbNotifications([]);
      return;
    }
    authFetch("/api/mypage/regions").then(setRegions).catch(() => {});
    getNotifications().then(setDbNotifications).catch(() => {});
  }, [token]);

  // myReports가 갱신될 때마다, 연결된(고유한) Incident들의 현재 상태 + 타임라인을 같이 가져옴
  useEffect(() => {
    const uniqueIds = [...new Set(myReports.filter((r) => r.incidentId).map((r) => r.incidentId))];
    uniqueIds.forEach((id) => {
      if (!incidentInfo[id]) {
        authFetch(`/api/incidents/${id}`)
          .then((data) => setIncidentInfo((prev) => ({ ...prev, [id]: data })))
          .catch(() => {});
      }
      if (!incidentTimelines[id]) {
        authFetch(`/api/incidents/${id}/timeline`)
          .then((data) => setIncidentTimelines((prev) => ({ ...prev, [id]: data })))
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReports]);

  // "내 현장제보 목록"의 검토 대기중(사건 미연결) 항목들 - 위경도만 있고 주소 텍스트는 DB에 없어서
  // 카카오 리버스 지오코딩으로 좌표 -> 주소 문자열을 변환해둠 (담당자 대시보드의 제보 관리 탭과 동일한 방식)
  const [pendingReportAddresses, setPendingReportAddresses] = useState({});
  useEffect(() => {
    const targets = myReports.filter((r) => !r.incidentId && !pendingReportAddresses[r.reportId]);
    if (targets.length === 0 || !window.kakao?.maps) return;

    // Kakao SDK가 autoload=false라 services를 바로 쓰면 아직 준비되지 않은 경우가 있음.
    // maps.load 안에서 Geocoder를 생성해야 신규 제보 주소도 정상 표시된다.
    window.kakao.maps.load(() => {
      if (!window.kakao?.maps?.services) return;

      const geocoder = new window.kakao.maps.services.Geocoder();
      targets.forEach((report) => {
        if (report.latitude == null || report.longitude == null) {
          setPendingReportAddresses((prev) => ({
            ...prev,
            [report.reportId]: "위치정보 없음",
          }));
          return;
        }

        geocoder.coord2Address(report.longitude, report.latitude, (result, status) => {
          const addr =
            status === window.kakao.maps.services.Status.OK && result[0]
              ? result[0].road_address?.address_name || result[0].address?.address_name || "주소 확인 불가"
              : "주소 확인 불가";

          setPendingReportAddresses((prev) => ({ ...prev, [report.reportId]: addr }));
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReports]);

  // 로그인 상태일 때 WebSocket 연결 - STAFF가 내가 추적 중인 사건 상태를 바꾸면
  // 새로고침 없이 뱃지/타임라인이 자동으로 갱신됨
  useEffect(() => {
    if (!token) return;

    const socket = connectIncidentSocket((data) => {
      // 백엔드 재시작 등으로 소켓이 끊겼다가 다시 붙은 경우, 끊겨 있던 동안의 상태 변경까지
      // 현재 DB 값으로 다시 맞춘다.
      if (data?.eventType === "SOCKET_CONNECTED") {
        Object.keys(incidentInfoRef.current).forEach((id) => {
          authFetch(`/api/incidents/${id}`)
            .then((freshIncident) => {
              setIncidentInfo((prev) => ({ ...prev, [id]: freshIncident }));
            })
            .catch(() => {});

          authFetch(`/api/incidents/${id}/timeline`)
            .then((timeline) => {
              setIncidentTimelines((prev) => ({ ...prev, [id]: timeline }));
              if (String(detailIncidentIdRef.current) === String(id)) {
                setDetailTimeline(timeline);
              }
            })
            .catch(() => {});
        });

        getNotifications().then(setDbNotifications).catch(() => {});
        return;
      }

      const changedId = data?.incident?.incidentId;
      if (!changedId) return;


      getNotifications().then(setDbNotifications).catch(() => {});

      // WebSocket payload 즉시 반영 후 DB 값으로 재동기화 (재연결 직후 오래된 상태 방지)
      setIncidentInfo((prev) => {
        if (!prev[changedId]) return prev;
        return { ...prev, [changedId]: { ...prev[changedId], ...data.incident } };
      });

      if (incidentInfoRef.current?.[changedId]) {
        authFetch(`/api/incidents/${changedId}`)
          .then((freshIncident) => {
            setIncidentInfo((prev) => ({ ...prev, [changedId]: freshIncident }));
          })
          .catch(() => {});

        authFetch(`/api/incidents/${changedId}/timeline`)
          .then((timeline) => {
            setIncidentTimelines((prev) => ({ ...prev, [changedId]: timeline }));

            if (detailIncidentIdRef.current === changedId) {
              setDetailTimeline(timeline);
            }
          })
          .catch(() => {});
      }
    });

    return () => socket.close();
  }, [token]);

  // 제보 WebSocket - 담당자가 제보를 검토중/사건연결/반려로 바꾸면
  // /api/reports/my를 다시 조회해서 메인 "내 현장제보" 목록/배지가 즉시 바뀐다.
  useEffect(() => {
    if (!token) return;

    const socket = connectReportSocket((data) => {
      const changedReport = data?.report;

      // 현재 목록에 있는 내 제보라면 이벤트 데이터로 먼저 즉시 반영
      if (changedReport?.reportId) {
        setMyReports((prev) =>
          prev.map((report) =>
            report.reportId === changedReport.reportId
              ? { ...report, ...changedReport }
              : report
          )
        );
      }

      // DB 확정값으로 한 번 더 동기화. 사건연결 시 incidentId도 여기서 최신화된다.
      authFetch("/api/reports/my")
        .then(setMyReports)
        .catch(() => {});

      getNotifications()
        .then(setDbNotifications)
        .catch(() => {});
    });

    return () => socket.close();
  }, [token]);

  // 로그인 상태의 받은·보낸 안전확인 요청 조회
  const loadSafetyCheckData = () => {
    if (!token) {
      setReceivedSafetyChecks([]);
      setSentSafetyChecks([]);
      return;
    }
    authFetch("/api/safety-checks/received").then(setReceivedSafetyChecks).catch(() => {});
    authFetch("/api/safety-checks/sent").then(setSentSafetyChecks).catch(() => {});
  };

  useEffect(loadSafetyCheckData, [token]);

  // 안전확인 WebSocket - 누가 나한테 요청을 보내거나, 내가 보낸 요청에 응답이 오면 실시간 갱신
  useEffect(() => {
    if (!token) return;
    const socket = connectSafetyCheckSocket(() => {
      loadSafetyCheckData();
    });
    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    goTo("home");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    goTo("home");
  };

  // 메인 가운데/퀵메뉴의 "현장 제보하기"는 팝업으로 열기
  const handleReportClick = () => requireLogin(() => setShowReportForm(true));

  // 헤더의 "현장 제보"만 별도 페이지로 이동한다.
  // 열려 있는 팝업은 닫은 뒤 report 페이지로 전환
  const handleReportPageClick = () =>
    requireLogin(() => {
      setShowReportForm(false);
      goTo("report");
      window.scrollTo({ top: 0, behavior: "auto" });
    });

  const handleReportSuccess = () => {
    setShowReportForm(false);
    setReportSuccess(true);
    setTimeout(() => setReportSuccess(false), 4000);
  };

  // 특정 사건의 상세(상태+타임라인)를 모달로 열기
  const openIncidentDetail = async (incidentId) => {
    setTrackingOpen(true);
    setDetailIncidentId(incidentId);
    setDetailTimelineLoading(true);
    try {
      const data = await authFetch(`/api/incidents/${incidentId}/timeline`);
      setDetailTimeline(data);
    } catch {
      setDetailTimeline([]);
    } finally {
      setDetailTimelineLoading(false);
    }
  };

  // "전체보기"는 제보가 1건뿐이어도 항상 목록부터 연다.
  // 목록에서 항목을 클릭했을 때만 해당 제보/사건의 대응상황 상세로 들어간다.
  const openTrackingOverview = () => requireLogin(() => {
    setTrackingOpen(true);
    setDetailIncidentId(null);
    setDetailPendingReportId(null);
  });

  const closeTracking = () => {
    setTrackingOpen(false);
    setDetailIncidentId(null);
    setDetailTimeline([]);
    setDetailPendingReportId(null);
  };
  useEscapeKey(trackingOpen, closeTracking);

  // "검토 대기중"(사건 미연결) 제보 상세보기 - 아직 Incident가 없어서 타임라인/진행상태는 없고
  // 제보 원본 내용만 보여주는 단순 모드
  const [detailPendingReportId, setDetailPendingReportId] = useState(null);

  const uniqueLinkedIds = [...new Set(myReports.filter((r) => r.incidentId).map((r) => r.incidentId))];
  const detailIncident = detailIncidentId ? incidentInfo[detailIncidentId] : null;
  const detailPendingReport = detailPendingReportId
    ? myReports.find((r) => r.reportId === detailPendingReportId)
    : null;

  // 헤더 알림 배지 - 마이페이지 "알림" 탭과 같은 기준 (읽음 목록 localStorage safeTraceReadNotifications 공유)
  const notificationItems = buildNotificationItems({
    sentChecks: sentSafetyChecks,
    receivedChecks: receivedSafetyChecks,
    myReports,
    regions,
    dbNotifications,
  });
  let readNotificationIds = [];
  try {
    readNotificationIds = JSON.parse(localStorage.getItem("safeTraceReadNotifications") || "[]");
  } catch {
    readNotificationIds = [];
  }
  // 마이페이지에서 삭제한 알림은 홈 화면 배지에서도 똑같이 빠져야 함 (같은 localStorage 키 공유)
  let dismissedNotificationIds = [];
  try {
    dismissedNotificationIds = JSON.parse(localStorage.getItem("safeTraceDismissedNotifications") || "[]");
  } catch {
    dismissedNotificationIds = [];
  }
  const unreadNotificationCount = notificationItems.filter(
    (n) => !readNotificationIds.includes(n.id) && !dismissedNotificationIds.includes(n.id)
  ).length;

  // "내 현장제보 추적"을 제보 단위가 아니라 "연결된 사건" 단위로 묶음 —
  // 같은 사건에 제보 여러 개가 묶여도 카드 하나로 압축되고, 최근 업데이트순으로 정렬
  const groupedIncidents = uniqueLinkedIds
    .map((id) => ({
      incidentId: id,
      incident: incidentInfo[id],
      reports: myReports.filter((r) => r.incidentId === id),
    }))
    .sort((a, b) => {
      const ta = a.incident?.updatedAt ? new Date(a.incident.updatedAt).getTime() : 0;
      const tb = b.incident?.updatedAt ? new Date(b.incident.updatedAt).getTime() : 0;
      return tb - ta;
    });

  // "대응상황 상세" 모달용 - 이 사건에 연결된 내 제보(사진/제보내용)와, 타임라인상 가장 최근 로그
  const detailReports = groupedIncidents.find((g) => g.incidentId === detailIncidentId)?.reports || [];
  const detailPhotoUrl = detailReports.find((r) => r.photoUrl)?.photoUrl;
  // detailTimeline은 항상 오래된순(API 원본 순서)이라, 정렬 토글과 무관하게 마지막 원소가 곧 최신 로그
  const latestDetailLog = detailTimeline[detailTimeline.length - 1];
  const detailDescription = latestDetailLog?.memo || detailReports[0]?.content || null;
  const detailTimelineSorted = detailTimelineSort === "newest" ? [...detailTimeline].reverse() : detailTimeline;

  // 제보 목록 모달용 - 연결 전/반려 제보까지 포함해서 실제 등장하는 재난유형을 보여준다.
  const trackingDisasterTypes = [...new Set(myReports.map((r) => r.disasterType).filter(Boolean))];

  // 사건에 아직 연결되지 않은 제보의 현재 제보 상태를 그대로 표시한다.
  // RECEIVED=등록, REVIEWING=검토중, REJECTED=반려
  const reportStateOf = (report) => {
    const code = report.status || (report.incidentId ? "LINKED" : "RECEIVED");
    return {
      code,
      label: REPORT_STATE_LABEL[code] || code,
      style: REPORT_STATE_STYLE[code] || REPORT_STATE_STYLE.RECEIVED,
    };
  };

  // 사건에 연결되지 않은 제보를 진행중 제보와 반려 제보로 분리한다.
  // 반려(REJECTED)는 더 이상 진행중이 아니므로 진행중 개수/탭에서 제외한다.
  const pendingReports = myReports.filter((r) => !r.incidentId);
  const rejectedReports = pendingReports.filter((r) => reportStateOf(r).code === "REJECTED");
  const activePendingReports = pendingReports.filter((r) => reportStateOf(r).code !== "REJECTED");

  // 메인 "내 현장제보 추적" 미리보기는 연결 사건뿐 아니라
  // 아직 사건에 연결되지 않은 등록/검토중/반려 제보까지 모두 합쳐 최근 3건을 보여준다.
  // 연결된 제보 여러 개가 같은 Incident에 묶인 경우에는 사건 카드 1개로 유지한다.
  const trackingPreviewItems = [
    ...pendingReports.map((report) => ({
      kind: "report",
      key: `report-${report.reportId}`,
      sortTime: new Date(report.createdAt || 0).getTime(),
      report,
    })),
    ...groupedIncidents.map((group) => ({
      kind: "incident",
      key: `incident-${group.incidentId}`,
      sortTime: new Date(group.incident?.updatedAt || group.reports[0]?.createdAt || 0).getTime(),
      ...group,
    })),
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 3);

  // 메인 카드 구성: 대표 제보 1건 + 다른 제보 2건
  // 연결된 사건이 있으면 가장 최근 사건을 대표로 보여주고,
  // 연결 사건이 없을 때만 가장 최근 미연결 제보를 대표로 사용한다.
  const primaryTrackingItem =
    groupedIncidents.length > 0
      ? {
          kind: "incident",
          key: `incident-${groupedIncidents[0].incidentId}`,
          ...groupedIncidents[0],
        }
      : trackingPreviewItems[0] || null;

  const otherTrackingItems = trackingPreviewItems
    .filter((item) => item.key !== primaryTrackingItem?.key)
    .slice(0, 2);

  const trackingProgressCount =
    groupedIncidents.filter((g) => g.incident?.status !== "CLOSED").length + activePendingReports.length;
  const trackingClosedCount = groupedIncidents.filter((g) => g.incident?.status === "CLOSED").length;
  const trackingRejectedCount = rejectedReports.length;

  const filteredPendingReports = pendingReports.filter((r) => {
    const reportCode = reportStateOf(r).code;

    if (trackingStatusFilter === "closed") return false;
    if (trackingStatusFilter === "rejected" && reportCode !== "REJECTED") return false;
    if (trackingStatusFilter === "progress" && reportCode === "REJECTED") return false;

    if (trackingTypeFilter && r.disasterType !== trackingTypeFilter) return false;
    return true;
  });

  const filteredTrackingIncidents = groupedIncidents.filter((g) => {
    if (trackingStatusFilter === "rejected") return false;
    if (trackingStatusFilter === "progress" && g.incident?.status === "CLOSED") return false;
    if (trackingStatusFilter === "closed" && g.incident?.status !== "CLOSED") return false;
    if (trackingTypeFilter && g.reports[0]?.disasterType !== trackingTypeFilter) return false;
    return true;
  });

  // 미연결·반려 제보와 연결 사건을 합쳐 시간순 정렬
  const filteredTrackingItems = [
    ...filteredPendingReports.map((report) => ({
      kind: "report",
      key: `pending-${report.reportId}`,
      sortTime: new Date(report.createdAt || 0).getTime(),
      report,
    })),
    ...filteredTrackingIncidents.map((group) => ({
      kind: "incident",
      key: `incident-${group.incidentId}`,
      sortTime: new Date(group.incident?.updatedAt || group.reports[0]?.createdAt || 0).getTime(),
      ...group,
    })),
  ].sort((a, b) =>
    trackingSort === "newest"
      ? b.sortTime - a.sortTime
      : a.sortTime - b.sortTime
  );

  const renderWithFooter = (content, footerProps = {}) => (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">{content}</div>
      <SiteFooter onNavigate={goTo} {...footerProps} />
    </div>
  );

  if (page === "safety-check-response") {
    return renderWithFooter(
      <SafetyCheckResponsePage
        token={safetyCheckTokenFromUrl}
        onDone={() => {
          window.history.replaceState({}, "", "/");
          goTo("home");
        }}
      />
    );
  }

  if (page === "login") {
    return renderWithFooter(
      <LoginPage onLoginSuccess={handleLoginSuccess} onBackToHome={() => goTo("home")} onSearch={() => goTo("search")} />
    );
  }

  if (page === "mypage") {
    return (
      <>
        {renderWithFooter(
          <MyPage
            onBackToHome={() => goTo("home")}
            onLogout={handleLogout}
            onOpenShelters={(regionId) => goTo("shelters", { shelterRegionId: regionId })}
            onOpenSafetyNews={(regionId) => goTo("safety-news", { safetyNewsRegionId: regionId })}
          />,
          { showWithdraw: true, onWithdraw: () => setShowWithdrawModal(true) }
        )}
        {showWithdrawModal && <WithdrawModal onClose={() => setShowWithdrawModal(false)} />}
      </>
    );
  }

  if (page === "shelters") {
    return renderWithFooter(
      <ShelterPage
        initialRegionId={selectedShelterRegionId}
        initialFocusShelter={window.history.state?.shelterFocus ?? null}
        onBackToHome={() => goTo("home")}
        onLogin={() => goTo("login")}
        onNavigate={goTo}
      />
    );
  }

  if (page === "safety-guides") {
    return renderWithFooter(
      <SafetyGuidePage
        initialGuideKey={window.history.state?.safetyGuideKey || "FLOOD"}
        onBackToHome={() => goTo("home")}
        onOpenShelters={() => goTo("shelters")}
        onNavigate={goTo}
      />
    );
  }

  if (page === "safety-map") {
    return renderWithFooter(
      <SafetyMapPage
        onBackToHome={() => goTo("home")}
        onNavigate={goTo}
        focusIncidentId={window.history.state?.focusIncidentId ?? null}
      />
    );
  }

  if (page === "disaster-info") {
    return renderWithFooter(
      <PublicDisasterPage
        initialMessageSn={window.history.state?.disasterSn ?? null}
        onBackToHome={() => goTo("home")}
        onOpenShelters={() => goTo("shelters", { shelterRegionId: null })}
        onOpenReport={() => requireLogin(() => goTo("home", { openReport: true }))}
        onNavigate={goTo}
      />
    );
  }

  if (page === "report") {
    return renderWithFooter(
      <ReportPage
        onNavigate={goTo}
        onSuccess={() => {
          setReportSuccess(true);
          goTo("home");
          setTimeout(() => setReportSuccess(false), 4000);
        }}
      />
    );
  }

  if (page === "safety-news") {
    return renderWithFooter(
      <DisasterNewsPage
        initialRegionId={selectedSafetyNewsRegionId}
        onBackToHome={() => goTo("home")}
        onLogout={handleLogout}
        onGoToMyPageTab={(tab) => goTo("mypage", { mypageTab: tab })}
      />
    );
  }

  if (page === "staff" && isStaff) {
    return (
      <ControlBoard
        onBackToHome={() => goTo("home")}
        onLogout={handleLogout}
        onOpenNotices={(noticeId) => goTo("notices", noticeId ? { noticeId } : {})}
      />
    );
  }

  if (page === "search") {
    return renderWithFooter(
      <SearchPage
        initialQuery={window.history.state?.searchQuery || ""}
        onNavigate={goTo}
      />
    );
  }

  if (page === "notices") {
    return renderWithFooter(
      <NoticePage
        initialNoticeId={window.history.state?.noticeId ?? null}
        onBackToHome={() => goTo("home")}
        onNavigate={goTo}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hi+Melody&display=swap');`}</style>
      {/* 헤더 */}
      <MainHeader
        currentUser={currentUser}
        isStaff={isStaff}
        token={token}
        profileMenuOpen={profileMenuOpen}
        setProfileMenuOpen={setProfileMenuOpen}
        profileMenuRef={profileMenuRef}
        requireLogin={requireLogin}
        activeSafetyGuideKey={activeSafetyGuideKey}
        goTo={goTo}
        myProfile={myProfile}
        handleLogout={handleLogout}
        handleReportPageClick={handleReportPageClick}
        unreadNotificationCount={unreadNotificationCount}
      />

      {/* 메인 히어로 */}
      <MainHero
        headerSearchQuery={headerSearchQuery}
        setHeaderSearchQuery={setHeaderSearchQuery}
        headerSearchInputRef={headerSearchInputRef}
        mainNearbyIncident={mainNearbyIncident}
        mainNearbyIncidentLoading={mainNearbyIncidentLoading}
        weatherLocation={weatherLocation}
        goTo={goTo}
        submitHeroSearch={submitHeroSearch}
        handleReportPageClick={handleReportPageClick}
      />

      {/* 퀵 메뉴 - 자주 쓰는 기능만 4개로 축소 */}
      <QuickMenu
        requireLogin={requireLogin}
        openShelterPanel={openShelterPanel}
        openSafetyGuidePanel={openSafetyGuidePanel}
        goTo={goTo}
        handleReportClick={handleReportClick}
      />


      {/* 대피시설 찾기 - 퀵메뉴 클릭 시 메인 중간에 펼쳐지는 패널 */}
      {shelterPanelOpen && (
        <ShelterPanel
          shelterPanelRef={shelterPanelRef}
          weatherLocation={weatherLocation}
          weatherLocationLabel={weatherLocationLabel}
          weatherLocating={weatherLocating}
          quickShelterLoading={quickShelterLoading}
          quickShelterError={quickShelterError}
          quickShelterQuery={quickShelterQuery}
          setQuickShelterQuery={setQuickShelterQuery}
          setQuickShelterRefreshKey={setQuickShelterRefreshKey}
          requestWeatherLocation={requestWeatherLocation}
          filteredQuickShelters={filteredQuickShelters}
          formatShelterDistance={formatShelterDistance}
          goTo={goTo}
        />
      )}

      {/* 재난 행동요령 - 퀵메뉴 클릭 시 대피시설 패널과 같은 자리를 교체해서 사용 */}
      {safetyGuidePanelOpen && (
        <SafetyGuidePanel
          safetyGuidePanelRef={safetyGuidePanelRef}
          activeSafetyGuideKey={activeSafetyGuideKey}
          setActiveSafetyGuideKey={setActiveSafetyGuideKey}
          openShelterPanel={openShelterPanel}
          goTo={goTo}
        />
      )}

      {/* 하단 대시보드 - 정보/지도/개인화 3열 구조 */}
      <main className="max-w-[1450px] mx-auto px-6 py-5 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.08fr_0.97fr] gap-4 items-start">

          {/* 실시간 재난 · 안전 정보 */}
          <DisasterInfoSection
            disasterListRef={disasterListRef}
            mainDisasterMessages={mainDisasterMessages}
            mainDisasterLoading={mainDisasterLoading}
            mainDisasterError={mainDisasterError}
            mainDisasterFilter={mainDisasterFilter}
            setMainDisasterFilter={setMainDisasterFilter}
            goTo={goTo}
          />

          {/* 내 주변 안전지도 - 실제 Kakao Map + 현재 위치 + 진행중 사건 + 대피시설 */}
          <section ref={safetyMapRef}>
            <NearbySafetyMap
              mode="compact"
              onOpenFullMap={() => goTo("safety-map")}
            />
          </section>

          {/* 오른쪽: 날씨 / AI 브리핑 / 내 제보 */}
          <div className="space-y-3">

            {/* 현재 날씨 - 기상청 초단기실황 + 에어코리아 */}
            <WeatherCard
              weatherLocation={weatherLocation}
              weatherLocationLabel={weatherLocationLabel}
              currentWeather={currentWeather}
              currentAirQuality={currentAirQuality}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              setWeatherError={setWeatherError}
              setWeatherRefreshKey={setWeatherRefreshKey}
              weatherLocating={weatherLocating}
              requestWeatherLocation={requestWeatherLocation}
            />

            {/* AI 상황 브리핑 (Groq) */}
            <AiBriefingCard
              weatherLocation={weatherLocation}
              aiBriefing={aiBriefing}
              aiBriefingLoading={aiBriefingLoading}
              aiBriefingError={aiBriefingError}
              setAiBriefingRefreshKey={setAiBriefingRefreshKey}
              openAiChat={openAiChat}
            />

            {/* 내 현장제보 추적 - 대표 1건 + 다른 제보 2건 */}
            <ReportTrackingCard
              token={token}
              goTo={goTo}
              myReportsLoading={myReportsLoading}
              setTrackingOpen={setTrackingOpen}
              setDetailIncidentId={setDetailIncidentId}
              pendingReportAddresses={pendingReportAddresses}
              handleReportClick={handleReportClick}
              openIncidentDetail={openIncidentDetail}
              openTrackingOverview={openTrackingOverview}
              setDetailPendingReportId={setDetailPendingReportId}
              reportStateOf={reportStateOf}
              primaryTrackingItem={primaryTrackingItem}
              otherTrackingItems={otherTrackingItems}
              trackingProgressCount={trackingProgressCount}
              trackingClosedCount={trackingClosedCount}
              trackingRejectedCount={trackingRejectedCount}
            />
          </div>
        </div>
      </main>

      {showReportForm && (
        <ReportForm onClose={() => setShowReportForm(false)} onSuccess={handleReportSuccess} />
      )}

      {reportSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F2540] text-white text-sm font-semibold rounded-lg px-4 py-3 shadow-lg z-50">
          제보가 등록되었습니다. 담당자가 확인 후 처리할 예정입니다.
        </div>
      )}

      {/* AI 안전 도우미 채팅 모달 */}
      {aiChatOpen && (
        <AiChatModal
          weatherLocation={weatherLocation}
          weatherLocationLabel={weatherLocationLabel}
          aiChatInput={aiChatInput}
          setAiChatInput={setAiChatInput}
          aiChatLoading={aiChatLoading}
          aiChatError={aiChatError}
          aiChatMessages={aiChatMessages}
          aiChatEndRef={aiChatEndRef}
          closeAiChat={closeAiChat}
          sendAiChatMessage={sendAiChatMessage}
          requestWeatherLocation={requestWeatherLocation}
        />
      )}

      {/* 대응상황 추적 모달 - 목록 모드 / 상세(타임라인) 모드 겸용 */}
      {trackingOpen && (
        <TrackingModal
          trackingStatusFilter={trackingStatusFilter}
          setTrackingStatusFilter={setTrackingStatusFilter}
          trackingTypeFilter={trackingTypeFilter}
          setTrackingTypeFilter={setTrackingTypeFilter}
          trackingSort={trackingSort}
          setTrackingSort={setTrackingSort}
          detailIncidentId={detailIncidentId}
          setDetailIncidentId={setDetailIncidentId}
          detailTimeline={detailTimeline}
          detailTimelineLoading={detailTimelineLoading}
          detailTimelineSort={detailTimelineSort}
          setDetailTimelineSort={setDetailTimelineSort}
          pendingReportAddresses={pendingReportAddresses}
          openIncidentDetail={openIncidentDetail}
          closeTracking={closeTracking}
          detailPendingReportId={detailPendingReportId}
          setDetailPendingReportId={setDetailPendingReportId}
          detailIncident={detailIncident}
          detailPendingReport={detailPendingReport}
          groupedIncidents={groupedIncidents}
          detailReports={detailReports}
          detailPhotoUrl={detailPhotoUrl}
          latestDetailLog={latestDetailLog}
          detailDescription={detailDescription}
          detailTimelineSorted={detailTimelineSorted}
          trackingDisasterTypes={trackingDisasterTypes}
          reportStateOf={reportStateOf}
          pendingReports={pendingReports}
          trackingProgressCount={trackingProgressCount}
          trackingClosedCount={trackingClosedCount}
          trackingRejectedCount={trackingRejectedCount}
          filteredTrackingItems={filteredTrackingItems}
        />
      )}

      <SiteFooter onNavigate={goTo} />
    </div>
  );
}
