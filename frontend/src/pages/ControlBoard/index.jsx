import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldAlert, LogOut, Loader2, ChevronDown, User, Menu, X,
  Clock, AlertTriangle, CheckCircle2, Activity, ClipboardList, Search,
  TrendingUp, TrendingDown, Minus, UserPlus, FilePlus, UserRound, FileSearch, Clock3,
  RefreshCw,
} from "lucide-react";
import { authFetch, authUpload, getCurrentUser } from "../../api/client";
import { connectIncidentSocket } from "../../api/socket";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  STATUS_LABEL, STATUS_ORDER, REPORT_DISASTER_TYPES,
  MIN_REPORT_DATE, toDateInputValue, getDefaultDateRange, sameDay, DISASTER_TYPE_COLOR,
  buildMarkerImage, NAV_ITEMS,
} from "./constants";
import DashboardTab from "./DashboardTab";
import ReportsTab from "./ReportsTab";
import IncidentsTab from "./IncidentsTab";
import PublicInfoTab from "./PublicInfoTab";
import StatisticsReportTab from "./StatisticsReportTab";
import CreateIncidentModal from "./CreateIncidentModal";
import EditIncidentModal from "./EditIncidentModal";
import RejectModal from "./RejectModal";
import LinkedReportsModal from "./LinkedReportsModal";
import PhotoViewerModal from "./PhotoViewerModal";

const CONTROL_BOARD_TABS = new Set(["dashboard", "reports", "incidents", "publicInfo", "statistics"]);

function getInitialControlBoardTab() {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return CONTROL_BOARD_TABS.has(tab) ? tab : "dashboard";
  } catch {
    return "dashboard";
  }
}

export default function ControlBoard({ onBackToHome, onLogout, onOpenNotices }) {
  // 지도 DOM이 다시 마운트되는 경우(HMR/탭 재진입 등)도 감지할 수 있도록 callback ref 사용
  const mapContainerRef = useRef(null);
  const mapElementRef = useRef(null);
  const [mapMountVersion, setMapMountVersion] = useState(0);
  const mapRef = useCallback((node) => {
    mapContainerRef.current = node;
    setMapMountVersion((v) => v + 1);
  }, []);

  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null); // 사건 마커 클러스터링용 - 가까운 마커는 숫자 배지로 뭉쳐서 표시

  const currentUser = getCurrentUser();

  // 현재 탭을 URL의 ?tab=... 과 동기화해서 브라우저 새로고침 후에도 같은 탭을 유지한다.
  // 단, 홈으로 나갈 때는 handleBackToHome에서 tab을 지우므로 다시 STAFF로 들어오면 대시보드부터 시작한다.
  const [activeNav, setActiveNav] = useState(getInitialControlBoardTab);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);

      if (activeNav === "dashboard") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", activeNav);
      }

      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch {
      // URL 동기화 실패 시에도 탭 전환 자체는 정상 동작하게 둔다.
    }
  }, [activeNav]);

  // 관제화면에서 홈으로 나갈 때 현재 탭 상태와 ?tab=... 쿼리를 함께 초기화한다.
  // 다시 STAFF 관리화면으로 들어오면 항상 대시보드부터 시작하도록 보장한다.
  const handleBackToHome = useCallback(() => {
    setActiveNav("dashboard");

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch {
      // URL 정리에 실패해도 홈 이동 자체는 진행한다.
    }

    onBackToHome?.();
  }, [onBackToHome]);

  // 헤더 - 프로필/미확인 제보 드롭다운, 내 정보(부서 표시용)
  const [member, setMember] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // 햄버거로 열고 닫는 사이드바(기본 열림)
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  useEffect(() => {
    authFetch("/api/mypage").then(setMember).catch(() => {});
  }, []);
  useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // 대시보드 - 지도 재난유형 필터, 최근 활동용 제보 목록
  const [mapTypeFilter, setMapTypeFilter] = useState(null); // null = 전체 (Incident.status 값 중 하나)
  const [mapUrgentOnly, setMapUrgentOnly] = useState(false); // 긴급(심각도) - 상태 필터와 별개로 겹쳐 켤 수 있는 오버레이 토글
  const [dashboardReports, setDashboardReports] = useState([]);
  useEffect(() => {
    if (activeNav !== "dashboard") return;
    authFetch("/api/reports").then(setDashboardReports).catch(() => {});
  }, [activeNav]);

  // 지도에 표시할 레이어 on/off - 대응자원/대피소/CCTV는 아직 실데이터 연동 전이라 체크박스만 두고 비활성 처리
  const [mapLayers, setMapLayers] = useState({ reports: true, incidents: true });
  const [mapType, setMapType] = useState("normal"); // "normal" | "skyview"
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao) return;
    map.setMapTypeId(mapType === "skyview" ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP);
  }, [mapType]);

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 사건 상세 패널 상태
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const selectedIncidentIdRef = useRef(null); // 소켓 콜백 안에서 "지금 열려있는 상세"의 최신값을 읽기 위함
  useEffect(() => {
    selectedIncidentIdRef.current = selectedIncidentId;
  }, [selectedIncidentId]);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [linkedReports, setLinkedReports] = useState([]);
  const [linkedReportsLoading, setLinkedReportsLoading] = useState(false);
  const [memo, setMemo] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // 제보 관리 탭 상태
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  // 제보에 등록된 사진 전체 목록 (0번째 = 대표) - 제보를 선택할 때마다 같이 불러옴
  const [reportPhotos, setReportPhotos] = useState([]);
  useEffect(() => {
    if (!selectedReportId) {
      setReportPhotos([]);
      return;
    }
    authFetch(`/api/reports/${selectedReportId}/photos`)
      .then(setReportPhotos)
      .catch(() => setReportPhotos([]));
  }, [selectedReportId]);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  // 사건 연결/등록 성공했을 때 잠깐 떴다 사라지는 토스트 - "저장은 됐는데 화면이 조용해서 헷갈림" 문제 해결용
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  const [reportAddresses, setReportAddresses] = useState({}); // reportId -> 주소 문자열
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState(null); // null = 전체, 아니면 특정 재난유형만
  const [reportRegionFilter, setReportRegionFilter] = useState(null); // null = 전체, 아니면 "대전광역시" 같은 시/도
  const [reportSortOrder, setReportSortOrder] = useState("newest"); // "newest" | "oldest"
  const [reportStatusFilter, setReportStatusFilter] = useState("all"); // "all" | "RECEIVED" | "LINKED"
  const [reportDateFrom, setReportDateFrom] = useState(() => getDefaultDateRange(12).from); // 접수일시 필터 - 시작일 입력값(아직 조회 버튼 누르기 전)
  const [reportDateTo, setReportDateTo] = useState(() => getDefaultDateRange(12).to); // 접수일시 필터 - 종료일 입력값(아직 조회 버튼 누르기 전)
  const [appliedReportDateFrom, setAppliedReportDateFrom] = useState(() => getDefaultDateRange(12).from); // "조회" 버튼을 눌러야 여기로 반영되어 실제 필터링에 쓰임
  const [appliedReportDateTo, setAppliedReportDateTo] = useState(() => getDefaultDateRange(12).to); // "조회" 버튼을 눌러야 여기로 반영되어 실제 필터링에 쓰임
  const [reportPage, setReportPage] = useState(1);
  const REPORT_PAGE_SIZE = 8;

  // 제보 여러 건을 체크박스로 골라서 한 번에 반려/병합하기 위한 선택 상태
  const [selectedReportIds, setSelectedReportIds] = useState(new Set());
  // 반려 모달 - target이 숫자 reportId면 단건, "bulk"면 체크된 제보 전체
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  // 체크박스로 여러 제보를 골라 "합치기"할 때 쓰는 모달 상태
  const [bulkMergeOpen, setBulkMergeOpen] = useState(false);
  const [bulkMergeCandidates, setBulkMergeCandidates] = useState([]);
  const [bulkMergeLoading, setBulkMergeLoading] = useState(false);
  const [bulkMergeSubmitting, setBulkMergeSubmitting] = useState(false);
  // "새 사건으로 만들기"를 여러 제보 선택 상태에서 눌렀을 때, 생성 후 이 배열 전체를 연결해야 함
  const [bulkLinkReportIds, setBulkLinkReportIds] = useState(null);

  // 검색어/유형필터/상태필터가 바뀌어서 지금 선택된 제보가 더 이상 목록에 안 보이면, 상세도 같이 닫는다.
  useEffect(() => {
    if (!selectedReportId) return;
    const q = reportSearchQuery.trim().toLowerCase();
    const stillVisible = reports.some((r) => {
      if (r.reportId !== selectedReportId) return false;
      if (reportTypeFilter && r.disasterType !== reportTypeFilter) return false;
      if (reportRegionFilter && !reportAddresses[r.reportId]?.startsWith(reportRegionFilter)) return false;
      if (reportStatusFilter !== "all" && r.status !== reportStatusFilter) return false;
      if (!q) return true;
      const normalizedReportQuery = q.replace(/^#?r-?/, "");
      const reportNoMatched =
        q === `r-${r.reportId}` ||
        q === `#r-${r.reportId}` ||
        (normalizedReportQuery && String(r.reportId).includes(normalizedReportQuery));
      return (
        reportNoMatched ||
        r.disasterType?.toLowerCase().includes(q) ||
        r.content?.toLowerCase().includes(q) ||
        r.reporterName?.toLowerCase().includes(q) ||
        reportAddresses[r.reportId]?.toLowerCase().includes(q)
      );
    });
    if (!stillVisible) {
      setSelectedReportId(null);
      setCandidates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportSearchQuery, reportTypeFilter, reportRegionFilter, reportStatusFilter]);

  // 검색어/필터가 바뀌면 페이지를 1로 되돌리고, 화면에서 사라진 체크선택도 정리
  useEffect(() => {
    setReportPage(1);
    setSelectedReportIds(new Set());
  }, [reportSearchQuery, reportTypeFilter, reportRegionFilter, reportStatusFilter]);

  // 사건 관리 탭 상태 (신규 Incident 생성)
  const [newIncident, setNewIncident] = useState({
    title: "", disasterType: "침수", severity: "MEDIUM", region: "", latitude: "", longitude: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [linkAfterCreateReportId, setLinkAfterCreateReportId] = useState(null);
  const [showCreateIncidentModal, setShowCreateIncidentModal] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);
  useEscapeKey(!!viewingPhotoUrl, () => setViewingPhotoUrl(null));
  useEscapeKey(showCreateIncidentModal, () => {
    setShowCreateIncidentModal(false);
    setLinkAfterCreateReportId(null);
    setCreateError("");
  });

  // 사건 관리 탭 - 기존 사건 수정 (제목/유형/위험도/위치). 사진은 상세패널의 "현장 사진 추가"에서 별도로 관리
  const [editIncident, setEditIncident] = useState(null);
  const [showEditIncidentModal, setShowEditIncidentModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editGeocoding, setEditGeocoding] = useState(false);
  useEscapeKey(showEditIncidentModal, () => {
    setShowEditIncidentModal(false);
    setEditError("");
  });

  const openEditIncidentModal = (inc) => {
    setEditIncident({
      incidentId: inc.incidentId,
      title: inc.title,
      disasterType: inc.disasterType,
      severity: inc.severity,
      region: inc.region,
      latitude: inc.latitude != null ? String(inc.latitude) : "",
      longitude: inc.longitude != null ? String(inc.longitude) : "",
    });
    setEditError("");
    setShowEditIncidentModal(true);
  };

  // "새 사건 등록" 모달의 주소검색/geocode와 동일한 방식 - editIncident 상태를 대상으로만 분리
  const geocodeEditAddress = (address) => {
    if (!window.kakao || !window.kakao.maps) {
      setEditError("지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setEditGeocoding(true);
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        setEditGeocoding(false);
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          setEditIncident((prev) => ({
            ...prev,
            region: address,
            latitude: String(result[0].y),
            longitude: String(result[0].x),
          }));
        } else {
          setEditError("좌표 변환에 실패했습니다. 다른 주소로 다시 검색해주세요.");
        }
      });
    });
  };

  const handleEditAddressSearch = () => {
    setEditError("");
    if (!window.daum || !window.daum.Postcode) {
      setEditError("주소 검색 서비스를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        geocodeEditAddress(fullAddress);
      },
    }).open();
  };

  // 상세패널 "현장 사진 추가" - 여러 장 한번에 선택 가능, 최대 5장
  const [fieldPhotoUploading, setFieldPhotoUploading] = useState(false);
  const fieldPhotoInputRef = useRef(null);
  const MAX_INCIDENT_PHOTOS = 5;

  const handleFieldPhotoSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // 같은 파일을 다시 골라도 onChange가 또 발생하도록 초기화
    if (files.length === 0 || !selectedIncident) return;

    const currentTotal = incidentPhotos.length;
    const room = MAX_INCIDENT_PHOTOS - currentTotal;
    if (room <= 0) {
      setToast(`현장 사진은 최대 ${MAX_INCIDENT_PHOTOS}장까지 첨부할 수 있습니다.`);
      return;
    }
    const toUpload = files.slice(0, room);
    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) {
        setToast("이미지 파일만 첨부할 수 있습니다.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setToast("사진 용량은 5MB 이하만 가능합니다.");
        return;
      }
    }

    setFieldPhotoUploading(true);
    try {
      // 순서가 곧 SORT_ORDER로 저장되므로, 한 장씩 순서대로 처리함
      for (const file of toUpload) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadResult = await authUpload("/api/uploads", formData);
        await authFetch(`/api/incidents/${selectedIncident.incidentId}/photos`, {
          method: "POST",
          body: JSON.stringify({ photoUrl: uploadResult.url }),
        });
      }

      setToast(toUpload.length > 1 ? "현장 사진이 등록되었습니다." : "현장 사진이 등록되었습니다.");
      await loadIncidents();
      const photos = await authFetch(`/api/incidents/${selectedIncident.incidentId}/photos`);
      setIncidentPhotos(photos);
    } catch (err) {
      setToast(err.message);
    } finally {
      setFieldPhotoUploading(false);
    }
  };

  const handleUpdateIncident = async (e) => {
    e.preventDefault();
    if (!editIncident) return;
    setEditError("");

    if (!editIncident.title.trim() || !editIncident.region.trim()) {
      setEditError("제목과 지역은 필수입니다.");
      return;
    }
    const lat = parseFloat(editIncident.latitude);
    const lng = parseFloat(editIncident.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setEditError("주소 검색으로 위치를 먼저 확인해주세요.");
      return;
    }

    setEditLoading(true);
    try {
      const targetId = editIncident.incidentId;
      await authFetch(`/api/incidents/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editIncident.title,
          disasterType: editIncident.disasterType,
          severity: editIncident.severity,
          region: editIncident.region,
          latitude: lat,
          longitude: lng,
        }),
      });

      setShowEditIncidentModal(false);
      setEditIncident(null);
      setToast("사건 정보가 수정되었습니다.");
      await loadIncidents();
      if (selectedIncidentIdRef.current === targetId) {
        await openIncidentDetail(targetId);
      }
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // 사건 관리 탭 - 기존 사건 목록 검색/필터/정렬
  const [incidentSearchQuery, setIncidentSearchQuery] = useState("");
  const [incidentSortOrder, setIncidentSortOrder] = useState("newest"); // "newest" | "oldest"
  const [incidentStatusFilter, setIncidentStatusFilter] = useState("ALL");
  const [incidentTypeFilter, setIncidentTypeFilter] = useState("ALL");
  const [incidentRegionFilter, setIncidentRegionFilter] = useState("ALL");
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState("ALL");
  const [incidentDateFrom, setIncidentDateFrom] = useState(() => getDefaultDateRange(12).from); // 사건 목록 날짜 필터 - 입력값(조회 버튼 누르기 전)
  const [incidentDateTo, setIncidentDateTo] = useState(() => getDefaultDateRange(12).to); // 사건 목록 날짜 필터 - 입력값(조회 버튼 누르기 전)
  const [appliedIncidentDateFrom, setAppliedIncidentDateFrom] = useState(() => getDefaultDateRange(12).from); // "조회" 눌러야 실제 필터링에 반영됨
  const [appliedIncidentDateTo, setAppliedIncidentDateTo] = useState(() => getDefaultDateRange(12).to); // "조회" 눌러야 실제 필터링에 반영됨
  const [incidentPage, setIncidentPage] = useState(1);
  const INCIDENT_PAGE_SIZE = 5;

  // 검색어가 바뀌어서 지금 선택된 사건이 더 이상 목록에 안 보이면, 상세패널도 같이 닫는다.
  useEffect(() => {
    if (!selectedIncidentId) return;
    const q = incidentSearchQuery.trim().toLowerCase();
    const stillVisible = incidents.some((inc) => {
      if (inc.incidentId !== selectedIncidentId) return false;
      if (!q) return true;
      return (
        inc.title?.toLowerCase().includes(q) ||
        inc.region?.toLowerCase().includes(q) ||
        inc.disasterType?.toLowerCase().includes(q)
      );
    });
    if (!stillVisible) closeDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentSearchQuery]);

  // 검색어/필터/정렬이 바뀌면 페이지를 1로 되돌림
  useEffect(() => {
    setIncidentPage(1);
  }, [
    incidentSearchQuery,
    incidentSortOrder,
    incidentStatusFilter,
    incidentTypeFilter,
    incidentRegionFilter,
    incidentSeverityFilter,
    appliedIncidentDateFrom,
    appliedIncidentDateTo,
  ]);

  useEffect(() => {
    if (activeNav !== "dashboard") return; // 대시보드 탭이 아닐 땐 지도 그릴 필요 없음

    const container = mapContainerRef.current;
    if (!container) return;

    if (!window.kakao || !window.kakao.maps) {
      setError("카카오맵 SDK를 불러오지 못했습니다.");
      return;
    }

    let cancelled = false;

    window.kakao.maps.load(() => {
      if (cancelled || !mapContainerRef.current) return;

      const currentContainer = mapContainerRef.current;

      // 같은 지도 DOM이면 새 지도를 만들지 않고 크기만 다시 계산한다.
      if (mapInstanceRef.current && mapElementRef.current === currentContainer) {
        requestAnimationFrame(() => {
          if (cancelled || !mapInstanceRef.current) return;
          window.kakao.maps.event.trigger(mapInstanceRef.current, "resize");
          drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
        });
        return;
      }

      // DashboardTab이 HMR 등으로 다시 마운트되어 지도 div가 바뀐 경우에만 새 DOM에 지도 재연결
      clustererRef.current?.clear();
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      const center = new window.kakao.maps.LatLng(36.3504, 127.3845);
      const map = new window.kakao.maps.Map(currentContainer, { center, level: 8 });

      mapInstanceRef.current = map;
      mapElementRef.current = currentContainer;

      // 가까운 마커 여러 개가 겹칠 때 숫자 배지 하나로 묶어 보여주고, 확대하면 자동으로 풀림
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6, // 이 레벨보다 확대하면 클러스터 안 묶고 마커 그대로 표시
        disableClickZoom: false, // 클러스터 클릭 시 카카오 기본 동작(자동 확대)
      });

      // 현재 지도 유형 유지
      map.setMapTypeId(
        mapType === "skyview"
          ? window.kakao.maps.MapTypeId.HYBRID
          : window.kakao.maps.MapTypeId.ROADMAP
      );

      requestAnimationFrame(() => {
        if (cancelled) return;
        window.kakao.maps.event.trigger(map, "resize");
        // 지도 초기화는 지도만 담당한다. 사건 데이터 조회는 아래 별도 effect에서 즉시 실행한다.
        // (메인페이지 -> 담당자 대시보드 재진입 때 map ref 재마운트와 effect cleanup이 겹치면
        // 여기의 rAF가 취소되어 loadIncidents()가 영원히 실행되지 않던 race condition 방지)
        drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
      });
    });

    return () => {
      cancelled = true;
    };
    // 지도 DOM이 실제로 다시 마운트될 때만 재초기화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, mapMountVersion]);

  const loadIncidents = async () => {
    setLoading(true);
    setError("");
    try {
      // 사건 데이터는 지도 로딩과 분리해서 독립적으로 조회한다.
      // /api/reports는 위 dashboardReports effect가 따로 담당하므로 여기서 중복 호출하지 않는다.
      const data = await authFetch("/api/incidents");
      const nextIncidents = Array.isArray(data) ? data : [];
      setIncidents(nextIncidents);
      drawMarkers(nextIncidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ControlBoard가 새로 마운트될 때(로그인 직후뿐 아니라 메인페이지에 갔다가 다시 들어올 때도)
  // 카카오맵 초기화 여부와 상관없이 사건 목록을 즉시 가져온다.
  useEffect(() => {
    loadIncidents();
    // 최초 마운트 시 1회만 실행. 이후 수동 새로고침/소켓 갱신은 기존 loadIncidents를 그대로 사용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawMarkers = (
    incidentsData = incidents,
    reportsData = dashboardReports,
    statusFilter = mapTypeFilter,
    layers = mapLayers,
    urgentOnly = mapUrgentOnly
  ) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    // 사건 마커는 클러스터러가 들고 있으므로 지도에서 직접 떼지 않고 클러스터러를 비움
    clustererRef.current?.clear();
    // 제보 마커(클러스터 대상 아님)만 markersRef로 직접 관리
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 사건 상태 5개(RECEIVED/CONFIRMING/RESPONDING/RECOVERING/CLOSED)를 필터 칩 키에 그대로 매핑
    // (CLOSED만 칩 라벨이 "해결/RESOLVED"라 키를 맞춰줌). 긴급은 상태가 아니라 urgentOnly로 별도 처리
    const incidentCategoryOf = (inc) => (inc.status === "CLOSED" ? "RESOLVED" : inc.status);
    const isUrgent = (inc) => inc.status !== "CLOSED" && inc.severity === "HIGH";

    const showIncidents = layers.incidents;
    // 제보는 사건 상태 칩 대상이 아니라서, 특정 사건 상태를 골라 보는 중(statusFilter 있음)이면
    // 상태 필터와 무관한 제보 마커가 같이 남아있어 "그 상황만 안 보인다"는 혼란이 생김 -> 전체(statusFilter=null)일 때만 표시
    const showReports = layers.reports && !statusFilter;

    const visibleIncidents = showIncidents
      ? incidentsData.filter(
          (inc) =>
            inc.latitude != null &&
            inc.longitude != null &&
            (!statusFilter || incidentCategoryOf(inc) === statusFilter) &&
            (!urgentOnly || isUrgent(inc))
        )
      : [];
    const visibleReports = showReports
      ? reportsData.filter((r) => !r.incidentId && r.latitude != null && r.longitude != null)
      : [];

    const incidentMarkers = visibleIncidents.map((inc) => {
      const position = new window.kakao.maps.LatLng(inc.latitude, inc.longitude);
      const markerImage = buildMarkerImage(inc);
      const marker = new window.kakao.maps.Marker({ position, image: markerImage });
      marker.addListener?.("click", () => {
        setActiveNav("incidents");
        openIncidentDetail(inc.incidentId);
      });
      return marker;
    });
    // 겹치는 마커는 클러스터러가 숫자 배지로 묶어서 보여주고, 확대하거나 배지를 클릭하면 자동으로 풀림
    clustererRef.current?.addMarkers(incidentMarkers);

    // 제보 마커는 아직 사건 마커와 구분되는 전용 이미지가 없어 카카오 기본 마커로 표시함(클러스터 대상 아님)
    visibleReports.forEach((r) => {
      const position = new window.kakao.maps.LatLng(r.latitude, r.longitude);
      const marker = new window.kakao.maps.Marker({ position, map });
      marker.addListener?.("click", () => {
        setActiveNav("reports");
        setSelectedReportId(r.reportId);
      });
      markersRef.current.push(marker);
    });

    // 필터링해서 보고 있는 마커들이 항상 화면 안에 들어오도록 지도 범위를 자동으로 맞춤
    const visible = [...visibleIncidents, ...visibleReports];
    if (visible.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      visible.forEach((item) => bounds.extend(new window.kakao.maps.LatLng(item.latitude, item.longitude)));
      map.setBounds(bounds);
      if (visible.length === 1 && map.getLevel() < 5) map.setLevel(5);
    }
  };

  // 상태 필터 칩 / 긴급 토글 / 표시 항목 체크박스 / 제보 목록을 바꾸면 새로 불러오지 않고 마커만 다시 그림
  useEffect(() => {
    if (activeNav !== "dashboard") return;
    drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTypeFilter, mapUrgentOnly, mapLayers, dashboardReports]);

  const handleZoom = (delta) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setLevel(map.getLevel() + delta);
  };

  // 지도를 다시 현재 필터 기준 사건들이 전부 보이는 범위로 되돌림
  const handleLocateReset = () => {
    drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
  };

  // ---- 사건 상세 (담당자 배정 / 상태변경) ----------------------------------

  const closeIncidentDetail = () => {
    setSelectedIncidentId(null);
    setTimeline([]);
    setLinkedReports([]);
    setDetailError("");
    setMemo("");
    setIncidentPhotos([]);
  };

  const toggleIncidentDetail = (incidentId) => {
    if (selectedIncidentIdRef.current === incidentId) {
      closeIncidentDetail();
      return;
    }
    openIncidentDetail(incidentId);
  };

  // 사건에 등록된 현장 사진 전체 목록 (0번째 = 대표) - 사건 상세를 열 때마다 같이 불러옴
  const [incidentPhotos, setIncidentPhotos] = useState([]);
  // "연결된 제보" 전체보기 팝업
  const [showLinkedReportsModal, setShowLinkedReportsModal] = useState(false);
  const [linkedReportsModalPage, setLinkedReportsModalPage] = useState(1);
  const LINKED_REPORTS_MODAL_PAGE_SIZE = 10;
  const linkedReportsModalTotalPages = Math.max(1, Math.ceil(linkedReports.length / LINKED_REPORTS_MODAL_PAGE_SIZE));
  const pagedLinkedReports = linkedReports.slice(
    (linkedReportsModalPage - 1) * LINKED_REPORTS_MODAL_PAGE_SIZE,
    linkedReportsModalPage * LINKED_REPORTS_MODAL_PAGE_SIZE
  );
  useEffect(() => {
    if (showLinkedReportsModal) setLinkedReportsModalPage(1);
  }, [showLinkedReportsModal, selectedIncidentId]);
  useEffect(() => {
    if (linkedReportsModalPage > linkedReportsModalTotalPages) {
      setLinkedReportsModalPage(linkedReportsModalTotalPages);
    }
  }, [linkedReportsModalPage, linkedReportsModalTotalPages]);
  useEscapeKey(showLinkedReportsModal, () => setShowLinkedReportsModal(false));

  const openIncidentDetail = async (incidentId) => {
    setSelectedIncidentId(incidentId);
    setDetailError("");
    setMemo("");
    setTimelineLoading(true);
    setLinkedReportsLoading(true);
    try {
      const data = await authFetch(`/api/incidents/${incidentId}/timeline`);
      setTimeline(data);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setTimelineLoading(false);
    }
    try {
      const reportsData = await authFetch(`/api/incidents/${incidentId}/reports`);
      setLinkedReports(reportsData);
      reportsData.forEach(resolveReportAddress);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setLinkedReportsLoading(false);
    }
    try {
      const photos = await authFetch(`/api/incidents/${incidentId}/photos`);
      setIncidentPhotos(photos);
    } catch {
      setIncidentPhotos([]);
    }
  };

  // WebSocket 연결 - 나 또는 다른 STAFF가 어디서든 사건을 만들거나 상태를 바꾸면
  // 새로고침 없이 지도/목록/통계가 자동 갱신되고, 지금 열어본 상세 패널도 같이 갱신됨.
  // 컴포넌트가 떠 있는 동안(=STAFF 화면에 있는 동안)만 연결하고, 화면 나가면 연결 정리.
  useEffect(() => {
    const socket = connectIncidentSocket((data) => {
      loadIncidents(); // 지도 마커 + 목록 + 상단 통계 카드 전부 이걸로 갱신됨

      const changedId = data.incident?.incidentId;
      if (changedId && selectedIncidentIdRef.current === changedId) {
        openIncidentDetail(changedId); // 지금 열려있는 상세가 바로 그 사건이면 타임라인/연결된 제보도 갱신
      }
    });

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDetail = () => {
    setSelectedIncidentId(null);
    setTimeline([]);
    setLinkedReports([]);
    setMemo("");
    setDetailError("");
  };

  const selectedIncident = incidents.find((i) => i.incidentId === selectedIncidentId) || null;

  const nextStatus = (() => {
    if (!selectedIncident) return null;
    const idx = STATUS_ORDER.indexOf(selectedIncident.status);
    if (idx === -1 || idx === STATUS_ORDER.length - 1) return null;
    return STATUS_ORDER[idx + 1];
  })();

  const handleAssignToMe = async () => {
    if (!selectedIncident || !currentUser) return;
    setActionLoading(true);
    setDetailError("");
    try {
      await authFetch(`/api/incidents/${selectedIncident.incidentId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ staffId: currentUser.memberId }),
      });
      await loadIncidents();
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedIncident || !nextStatus) return;
    if (nextStatus === "CLOSED" && memo.trim() === "") {
      setDetailError("종료 처리에는 조치내역을 반드시 입력해야 합니다.");
      return;
    }
    setActionLoading(true);
    setDetailError("");
    try {
      await authFetch(`/api/incidents/${selectedIncident.incidentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, memo }),
      });
      setMemo("");
      await loadIncidents();
      await openIncidentDetail(selectedIncident.incidentId);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ---- 제보 관리 (중복탐지 후보 -> 실제 병합) -------------------------------

  // 위경도 -> 실제 주소 문자열로 변환 (카카오 리버스 지오코딩)
  // 이제 DB에 ADDRESS가 저장되어 오니까, 저장된 게 없는 옛날 제보에 한해서만 좌표로 역지오코딩(하위호환)
  const resolveReportAddress = (report) => {
    if (report.address) { setReportAddresses((prev) => ({ ...prev, [report.reportId]: report.address })); return; }
    if (!window.kakao?.maps?.services || report.latitude == null || report.longitude == null) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(report.longitude, report.latitude, (result, status) => {
      const addr =
        status === window.kakao.maps.services.Status.OK && result[0]
          ? result[0].road_address?.address_name || result[0].address?.address_name || "주소 확인 불가"
          : "주소 확인 불가";
      setReportAddresses((prev) => ({ ...prev, [report.reportId]: addr }));
    });
  };

  const loadReports = async () => {
    setReportsLoading(true);
    setReportError("");
    try {
      // 사건전환된 제보도 이력으로 계속 보여줘야 해서 전체 목록을 받아옴 (연결 여부는 status/incidentId로 구분)
      const data = await authFetch("/api/reports/all");
      setReports(data);
      data.forEach(resolveReportAddress);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportsLoading(false);
    }
  };

  // 사이드바에서 "제보 관리" 탭을 이미 켜진 상태에서 또 누르면 목록만 다시 받아오는 게 아니라
  // 걸어둔 필터(상태/유형/지역/정렬/날짜/검색어)까지 전부 초기 상태로 되돌림 - 새로고침한 느낌을 주기 위함
  const resetReportFilters = () => {
    setReportSearchQuery("");
    setReportTypeFilter(null);
    setReportRegionFilter(null);
    setReportSortOrder("newest");
    setReportStatusFilter("all");
    setReportDateFrom(getDefaultDateRange(12).from);
    setReportDateTo(getDefaultDateRange(12).to);
    setAppliedReportDateFrom(getDefaultDateRange(12).from);
    setAppliedReportDateTo(getDefaultDateRange(12).to);
    setReportPage(1);
    setSelectedReportIds(new Set());
  };

  useEffect(() => {
    if (activeNav === "reports") {
      loadReports();
      setSelectedReportId(null);
      setCandidates([]);
    }
  }, [activeNav]);

  // "사건 관리" 탭에 들어왔을 때도 기존 사건 목록을 불러온다 (지도 없이 목록만 필요하므로 loadIncidents 재사용)
  useEffect(() => {
    if (activeNav === "incidents") {
      loadIncidents();
    }
  }, [activeNav]);

  const openReportCandidates = async (reportId) => {
    setSelectedReportId(reportId);
    setCandidatesLoading(true);
    setReportError("");
    try {
      const data = await authFetch(`/api/reports/${reportId}/candidates`);
      setCandidates(data);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleLinkReport = async (incidentId) => {
    if (!selectedReportId) return;
    setReportError("");
    try {
      await authFetch(`/api/reports/${selectedReportId}/link`, {
        method: "PATCH",
        body: JSON.stringify({ incidentId }),
      });
      await loadReports();
      setSelectedReportId(null);
      setCandidates([]);
      setToast("기존 사건에 연결되었습니다.");
    } catch (err) {
      setReportError(err.message);
    }
  };

  // 담당자가 "검토 시작"을 누르면 - 사건화/반려를 아직 정하지 않았어도 다른 담당자에게 "확인 중"임을 표시
  const handleMarkReviewing = async (reportId) => {
    setReportError("");
    try {
      await authFetch(`/api/reports/${reportId}/review`, { method: "PATCH" });
      await loadReports();
    } catch (err) {
      setReportError(err.message);
    }
  };

  // 반려 모달 열기 - target이 숫자 reportId면 단건, "bulk"면 체크된 제보 전체
  const openRejectModal = (target) => {
    setRejectTarget(target);
    setRejectReasonInput("");
  };

  // 접수일시 필터 - 시작일. 타이핑 중엔 그대로 받아주고(연도 입력 중 매 자리마다 막히는 것 방지), 포커스 벗어날 때만 보정. 실제 필터링은 "조회" 버튼을 눌러야 반영됨
  const handleReportDateFromChange = (value) => {
    setReportDateFrom(value);
  };
  const handleReportDateFromBlur = () => {
    if (!reportDateFrom) return;
    let v = reportDateFrom;
    if (v < MIN_REPORT_DATE) { v = MIN_REPORT_DATE; setToast(`${MIN_REPORT_DATE} 이전 날짜는 선택할 수 없습니다.`); }
    else if (v > todayStr) { v = todayStr; setToast("미래 날짜는 선택할 수 없습니다."); }
    if (v !== reportDateFrom) setReportDateFrom(v);
    if (reportDateTo && v > reportDateTo) {
      setReportDateTo(v); // 시작일이 종료일보다 늦어지면 종료일도 같이 밀어줌
      setToast("시작일이 종료일보다 늦어 종료일을 시작일에 맞춰 조정했습니다.");
    }
  };

  // 접수일시 필터 - 종료일. 타이핑 중엔 그대로 받아주고, 포커스 벗어날 때만 보정. 실제 필터링은 "조회" 버튼을 눌러야 반영됨
  const handleReportDateToChange = (value) => {
    setReportDateTo(value);
  };
  const handleReportDateToBlur = () => {
    if (!reportDateTo) return;
    let v = reportDateTo;
    if (v < MIN_REPORT_DATE) { v = MIN_REPORT_DATE; setToast(`${MIN_REPORT_DATE} 이전 날짜는 선택할 수 없습니다.`); }
    else if (v > todayStr) { v = todayStr; setToast("미래 날짜는 선택할 수 없습니다."); }
    if (v !== reportDateTo) setReportDateTo(v);
    if (reportDateFrom && v < reportDateFrom) {
      setReportDateFrom(v); // 종료일이 시작일보다 빨라지면 시작일도 같이 당겨줌
      setToast("종료일이 시작일보다 빨라 시작일을 종료일에 맞춰 조정했습니다.");
    }
  };

  // "조회" 버튼 - 여기서 눌러야 입력해둔 날짜 범위가 실제 목록 필터링에 반영됨
  const applyReportDateFilter = () => {
    setAppliedReportDateFrom(reportDateFrom);
    setAppliedReportDateTo(reportDateTo);
    setReportPage(1);
  };

  // 사건 관리 탭 날짜 필터 - 제보 관리 탭과 동일한 패턴(타이핑 중엔 그대로 받고 blur에서만 보정)
  const handleIncidentDateFromChange = (value) => setIncidentDateFrom(value);
  const handleIncidentDateFromBlur = () => {
    if (!incidentDateFrom) return;
    let v = incidentDateFrom;
    if (v < MIN_REPORT_DATE) { v = MIN_REPORT_DATE; setToast(`${MIN_REPORT_DATE} 이전 날짜는 선택할 수 없습니다.`); }
    else if (v > todayStr) { v = todayStr; setToast("미래 날짜는 선택할 수 없습니다."); }
    if (v !== incidentDateFrom) setIncidentDateFrom(v);
    if (incidentDateTo && v > incidentDateTo) {
      setIncidentDateTo(v);
      setToast("시작일이 종료일보다 늦어 종료일을 시작일에 맞춰 조정했습니다.");
    }
  };
  const handleIncidentDateToChange = (value) => setIncidentDateTo(value);
  const handleIncidentDateToBlur = () => {
    if (!incidentDateTo) return;
    let v = incidentDateTo;
    if (v < MIN_REPORT_DATE) { v = MIN_REPORT_DATE; setToast(`${MIN_REPORT_DATE} 이전 날짜는 선택할 수 없습니다.`); }
    else if (v > todayStr) { v = todayStr; setToast("미래 날짜는 선택할 수 없습니다."); }
    if (v !== incidentDateTo) setIncidentDateTo(v);
    if (incidentDateFrom && v < incidentDateFrom) {
      setIncidentDateFrom(v);
      setToast("종료일이 시작일보다 빨라 시작일을 종료일에 맞춰 조정했습니다.");
    }
  };
  const applyIncidentDateFilter = () => {
    setAppliedIncidentDateFrom(incidentDateFrom);
    setAppliedIncidentDateTo(incidentDateTo);
    setIncidentPage(1);
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReasonInput.trim()) return;
    setRejectSubmitting(true);
    setReportError("");
    try {
      const targetIds = rejectTarget === "bulk" ? [...selectedReportIds] : [rejectTarget];
      await Promise.all(
        targetIds.map((id) =>
          authFetch(`/api/reports/${id}/reject`, {
            method: "PATCH",
            body: JSON.stringify({ reason: rejectReasonInput.trim() }),
          })
        )
      );
      await loadReports();
      setSelectedReportIds(new Set());
      if (targetIds.includes(selectedReportId)) {
        setSelectedReportId(null);
        setCandidates([]);
      }
      setRejectTarget(null);
      setRejectReasonInput("");
      setToast(targetIds.length > 1 ? `${targetIds.length}건을 반려했습니다.` : "반려 처리되었습니다.");
    } catch (err) {
      setReportError(err.message);
    } finally {
      setRejectSubmitting(false);
    }
  };

  // 체크박스 - 반려 전 상태(접수/검토중)인 제보만 대상으로 함. 이미 전환/반려된 건 선택 자체를 막음
  const toggleReportSelected = (reportId) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  // "선택 합치기" - 재난유형/위치 기준 후보 + 선택한 제보 중 이미 사건에 연결된 것들을 합쳐서 후보로 보여줌
  // (이미 연결된 사건은 유형이 달라도 무조건 후보에 포함 - "여러 사건에 흩어진 제보를 한 사건으로 다시 모으기" 용도)
  const openBulkMerge = async () => {
    if (selectedReportIds.size === 0) return;
    setBulkMergeOpen(true);
    setBulkMergeLoading(true);
    setReportError("");
    try {
      const firstId = [...selectedReportIds][0];
      const typeLocationCandidates = await authFetch(`/api/reports/${firstId}/candidates`);

      const alreadyLinkedIncidentIds = [...new Set(
        reports.filter((r) => selectedReportIds.has(r.reportId) && r.incidentId).map((r) => r.incidentId)
      )];
      const alreadyLinkedIncidents = await Promise.all(
        alreadyLinkedIncidentIds.map((id) => authFetch(`/api/incidents/${id}`))
      );

      const merged = [...alreadyLinkedIncidents, ...typeLocationCandidates].filter(
        (inc, index, arr) => arr.findIndex((i) => i.incidentId === inc.incidentId) === index
      );
      setBulkMergeCandidates(merged);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setBulkMergeLoading(false);
    }
  };

  // 체크된 제보 전체를 하나의 기존 사건에 한번에 연결
  const handleBulkLinkToIncident = async (incidentId) => {
    setBulkMergeSubmitting(true);
    setReportError("");
    try {
      await Promise.all(
        [...selectedReportIds].map((id) =>
          authFetch(`/api/reports/${id}/link`, {
            method: "PATCH",
            body: JSON.stringify({ incidentId }),
          })
        )
      );
      await loadReports();
      setToast(`${selectedReportIds.size}건을 사건에 연결했습니다.`);
      setSelectedReportIds(new Set());
      setBulkMergeOpen(false);
      setBulkMergeCandidates([]);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setBulkMergeSubmitting(false);
    }
  };

  // 체크된 제보들을 묶어서 새 사건 하나를 만들기 - 대표(첫 번째) 제보 정보로 폼을 채우고,
  // 생성이 끝나면 handleCreateIncident 쪽에서 bulkLinkReportIds 전체를 그 사건에 연결함
  const startBulkNewIncident = () => {
    const targetIds = [...selectedReportIds];
    const first = reports.find((r) => r.reportId === targetIds[0]);
    if (!first) return;
    setNewIncident({
      title: `${first.disasterType} · 제보 ${targetIds.length}건 묶음`,
      disasterType: first.disasterType,
      severity: "MEDIUM",
      region: reportAddresses[first.reportId] || "",
      latitude: String(first.latitude ?? ""),
      longitude: String(first.longitude ?? ""),
    });
    setBulkLinkReportIds(targetIds);
    setLinkAfterCreateReportId(null);
    setCreateError("");
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setBulkMergeOpen(false);
    setShowCreateIncidentModal(true);
  };

  const startNewIncidentFromReport = (report) => {
    // 이미 "제보 상세"에서 변환해둔 주소가 있으면 그걸 그대로 지역란에 채움.
    // 아직 변환이 안 끝났으면(드물게 클릭이 빨랐을 경우) 일단 비워두고,
    // resolveReportAddress가 끝나는 대로 아래 useEffect가 뒤늦게 채워줌.
    setNewIncident({
      title: `${report.disasterType} · 제보 #${report.reportId}`,
      disasterType: report.disasterType,
      severity: "MEDIUM",
      region: reportAddresses[report.reportId] || "",
      latitude: String(report.latitude ?? ""),
      longitude: String(report.longitude ?? ""),
    });
    setLinkAfterCreateReportId(report.reportId);
    setCreateError("");
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setShowCreateIncidentModal(true);
  };

  // 제보 없이 STAFF가 처음부터 직접 사건을 등록하는 경우 - "사건 관리" 탭에서 진입.
  // 제보 기반과 달리 자동으로 채워줄 값이 없어서 전부 빈 폼으로 시작함.
  const startNewIncidentDirect = () => {
    setNewIncident({ title: "", disasterType: "침수", severity: "MEDIUM", region: "", latitude: "", longitude: "" });
    setLinkAfterCreateReportId(null);
    setCreateError("");
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setShowCreateIncidentModal(true);
  };

  // ---- 새 사건 등록 모달 - 주소 검색(위도/경도 자동 변환) + 현장사진 첨부 ------------------
  const [geocoding, setGeocoding] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  // 주소 문자열 -> 위경도 좌표 변환 (카카오 Geocoder). ReportForm.jsx의 시민 제보 흐름과 동일한 방식.
  const geocodeAddress = (address) => {
    if (!window.kakao || !window.kakao.maps) {
      setCreateError("지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setGeocoding(true);
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        setGeocoding(false);
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          setNewIncident((prev) => ({
            ...prev,
            region: address,
            latitude: String(result[0].y),
            longitude: String(result[0].x),
          }));
        } else {
          setCreateError("좌표 변환에 실패했습니다. 다른 주소로 다시 검색해주세요.");
        }
      });
    });
  };

  // "주소 검색" 버튼 -> 다음(Daum) 우편번호 검색 팝업 오픈 (스크립트는 index.html에 전역으로 이미 로드돼있음)
  const handleAddressSearch = () => {
    setCreateError("");
    if (!window.daum || !window.daum.Postcode) {
      setCreateError("주소 검색 서비스를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        geocodeAddress(fullAddress);
      },
    }).open();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCreateError("이미지 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCreateError("사진 용량은 5MB 이하만 가능합니다.");
      return;
    }
    setCreateError("");
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  // "이 제보로 새 사건 만들기"를 눌렀을 때 주소 변환이 아직 안 끝나 있었다면,
  // 나중에 변환이 끝나는 시점에 지역란을 뒤늦게라도 채워준다.
  useEffect(() => {
    if (!linkAfterCreateReportId) return;
    const addr = reportAddresses[linkAfterCreateReportId];
    if (addr && !newIncident.region) {
      setNewIncident((prev) => ({ ...prev, region: addr }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportAddresses, linkAfterCreateReportId]);

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (!newIncident.title.trim() || !newIncident.region.trim()) {
      setCreateError("제목과 지역은 필수입니다.");
      return;
    }
    const lat = parseFloat(newIncident.latitude);
    const lng = parseFloat(newIncident.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setCreateError("주소 검색으로 위치를 먼저 확인해주세요.");
      return;
    }

    setCreateLoading(true);
    try {
      // 사진을 첨부했으면 먼저 업로드해서 URL부터 받아옴 (시민 제보 폼과 동일한 방식)
      let photoUrl = null;
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        const uploadResult = await authUpload("/api/uploads", formData);
        photoUrl = uploadResult.url;
      }

      const created = await authFetch("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: newIncident.title,
          disasterType: newIncident.disasterType,
          severity: newIncident.severity,
          region: newIncident.region,
          latitude: lat,
          longitude: lng,
          photoUrl,
          // 이 사건을 처음 만든 제보를 기록해둠 - 나중에 "연결된 제보" 목록에서 "최초 신고" 뱃지로 표시하는 데 씀.
          // 일괄 등록이면 대표(첫 번째) 제보, 단건 등록이면 그 제보, 제보 없이 직접 등록이면 null
          sourceReportId: bulkLinkReportIds && bulkLinkReportIds.length > 0
            ? bulkLinkReportIds[0]
            : (linkAfterCreateReportId || null),
        }),
      });

      // linkAfterCreateReportId/bulkLinkReportIds를 비우기 전에 미리 판단해둠 (연결까지 했는지 여부로 문구 구분)
      const linkedFromReport = !!linkAfterCreateReportId || (bulkLinkReportIds && bulkLinkReportIds.length > 0);

      if (bulkLinkReportIds && bulkLinkReportIds.length > 0) {
        await Promise.all(
          bulkLinkReportIds.map((id) =>
            authFetch(`/api/reports/${id}/link`, {
              method: "PATCH",
              body: JSON.stringify({ incidentId: created.incidentId }),
            })
          )
        );
        setBulkLinkReportIds(null);
        setSelectedReportIds(new Set());
        await loadReports();
      } else if (linkAfterCreateReportId) {
        await authFetch(`/api/reports/${linkAfterCreateReportId}/link`, {
          method: "PATCH",
          body: JSON.stringify({ incidentId: created.incidentId }),
        });
        setLinkAfterCreateReportId(null);
        await loadReports();
      }

      setNewIncident({ title: "", disasterType: "침수", severity: "MEDIUM", region: "", latitude: "", longitude: "" });
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      await loadIncidents();
      setShowCreateIncidentModal(false);
      setToast(linkedFromReport ? "새 사건으로 등록하고 제보를 연결했습니다." : "새 사건이 등록되었습니다.");
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // 사건 관리 탭 - 검색/상태/재난유형/지역/위험도 필터링 + 최신 업데이트 기준 정렬
  const filteredIncidents = incidents
    .filter((inc) => {
      const q = incidentSearchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        inc.title?.toLowerCase().includes(q) ||
        inc.region?.toLowerCase().includes(q) ||
        inc.disasterType?.toLowerCase().includes(q);
      const matchStatus = incidentStatusFilter === "ALL" || inc.status === incidentStatusFilter;
      const matchType = incidentTypeFilter === "ALL" || inc.disasterType === incidentTypeFilter;
      const matchRegion = incidentRegionFilter === "ALL" || inc.region?.startsWith(incidentRegionFilter);
      const matchSeverity = incidentSeverityFilter === "ALL" || inc.severity === incidentSeverityFilter;
      const incDate = (inc.createdAt || "").slice(0, 10);
      const matchDate = (!appliedIncidentDateFrom || incDate >= appliedIncidentDateFrom) && (!appliedIncidentDateTo || incDate <= appliedIncidentDateTo);
      return matchSearch && matchStatus && matchType && matchRegion && matchSeverity && matchDate;
    })
    .sort((a, b) => {
      // 접수일시(createdAt) 기준 고정 정렬 - updatedAt으로 정렬하면 상태/내용을 수정할 때마다
      // updatedAt이 갱신되어 목록에서 행이 위로 튀어오르는 문제가 있어 접수일시로 고정함
      const aDate = new Date(a.createdAt);
      const bDate = new Date(b.createdAt);
      return incidentSortOrder === "newest" ? bDate - aDate : aDate - bDate;
    });

  // 상태 요약 카드/탭 숫자는 현재 선택한 지역·유형·위험도·기간·검색어를 기준으로 계산한다.
  // 단, 상태 필터 자체는 제외해야 각 상태별 건수를 동시에 보여줄 수 있다.
  const incidentsForCounts = incidents.filter((inc) => {
    const q = incidentSearchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      inc.title?.toLowerCase().includes(q) ||
      inc.region?.toLowerCase().includes(q) ||
      inc.disasterType?.toLowerCase().includes(q);
    const matchType = incidentTypeFilter === "ALL" || inc.disasterType === incidentTypeFilter;
    const matchRegion = incidentRegionFilter === "ALL" || inc.region?.startsWith(incidentRegionFilter);
    const matchSeverity = incidentSeverityFilter === "ALL" || inc.severity === incidentSeverityFilter;
    const incDate = (inc.createdAt || "").slice(0, 10);
    const matchDate =
      (!appliedIncidentDateFrom || incDate >= appliedIncidentDateFrom) &&
      (!appliedIncidentDateTo || incDate <= appliedIncidentDateTo);

    return matchSearch && matchType && matchRegion && matchSeverity && matchDate;
  });

  const incidentCounts = {
    ALL: incidentsForCounts.length,
    RECEIVED: incidentsForCounts.filter((i) => i.status === "RECEIVED").length,
    CONFIRMING: incidentsForCounts.filter((i) => i.status === "CONFIRMING").length,
    RESPONDING: incidentsForCounts.filter((i) => i.status === "RESPONDING").length,
    RECOVERING: incidentsForCounts.filter((i) => i.status === "RECOVERING").length,
    CLOSED: incidentsForCounts.filter((i) => i.status === "CLOSED").length,
  };

  // 목록 정렬(최신순)과 무관하게, 제일 오래 접수된 사건이 1번이 되도록 접수일시 기준으로 번호를 매김
  const incidentRank = new Map(
    [...incidents]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((inc, i) => [inc.incidentId, i + 1])
  );

  const incidentTotalPages = Math.max(1, Math.ceil(filteredIncidents.length / INCIDENT_PAGE_SIZE));
  const pagedIncidents = filteredIncidents.slice(
    (incidentPage - 1) * INCIDENT_PAGE_SIZE,
    incidentPage * INCIDENT_PAGE_SIZE
  );

  // 사건 상세의 "현장 조치 현황"은 별도 가짜 데이터를 만들지 않고
  // 현재 상태와 가장 최근 진행 멘트를 요약해서 보여준다.
  const latestIncidentLog = [...timeline]
    .filter((log) => log?.changedAt)
    .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0];
  const currentActionText = latestIncidentLog?.memo || (selectedIncident
    ? `${STATUS_LABEL[selectedIncident.status] || selectedIncident.status} 단계가 진행 중입니다.`
    : "-");

  // ----------------------------------------------------------------------
  // 제보 관리
  // 사건으로 전환된 제보도 삭제하지 않고 원본 이력으로 계속 보관한다.
  // ----------------------------------------------------------------------
  const unlinkedReports = reports.filter((r) => !r.incidentId);

  // 전체 제보 기준 재난유형별 건수
  const reportTypeCounts = REPORT_DISASTER_TYPES.reduce((acc, type) => {
    acc[type] = reports.filter((r) => r.disasterType === type).length;
    return acc;
  }, {});

  const totalReports = reports.length;
  const receivedReports = reports.filter((r) => !r.incidentId && r.status === "RECEIVED").length;
  const linkedReportsCount = reports.filter((r) => !!r.incidentId || r.status === "LINKED").length;
  const reviewingReports = reports.filter((r) => r.status === "REVIEWING").length;
  const rejectedReports = reports.filter((r) => r.status === "REJECTED").length;

  // 재난유형 / 지역 / 상태 / 검색어 필터
  const filteredReports = reports
    .filter((r) => {
      if (reportTypeFilter && r.disasterType !== reportTypeFilter) return false;
      if (reportRegionFilter && !reportAddresses[r.reportId]?.startsWith(reportRegionFilter)) return false;

      if (reportStatusFilter === "RECEIVED") {
        if (r.incidentId || r.status !== "RECEIVED") return false;
      }

      if (reportStatusFilter === "LINKED") {
        if (!r.incidentId && r.status !== "LINKED") return false;
      }

      if (reportStatusFilter === "REVIEWING" && r.status !== "REVIEWING") return false;
      if (reportStatusFilter === "REJECTED" && r.status !== "REJECTED") return false;

      // 접수일시가 조회 버튼으로 적용한 날짜 범위 안에 있는지 (날짜만 비교, 시간은 무시)
      const reportDate = r.createdAt?.slice(0, 10);
      if (appliedReportDateFrom && reportDate < appliedReportDateFrom) return false;
      if (appliedReportDateTo && reportDate > appliedReportDateTo) return false;

      if (!reportSearchQuery.trim()) return true;
      const q = reportSearchQuery.trim().toLowerCase();
      // 화면에 표시되는 #R-5 / R-5 형식도 제보번호 검색으로 인식
      const normalizedReportQuery = q.replace(/^#?r-?/, "");
      const reportNoMatched =
        q === `r-${r.reportId}` ||
        q === `#r-${r.reportId}` ||
        (normalizedReportQuery && String(r.reportId).includes(normalizedReportQuery));
      return (
        reportNoMatched ||
        r.disasterType?.toLowerCase().includes(q) ||
        r.content?.toLowerCase().includes(q) ||
        r.reporterName?.toLowerCase().includes(q) ||
        reportAddresses[r.reportId]?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) =>
      reportSortOrder === "oldest"
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt)
    );

  // 오래 접수된 제보부터 번호 부여
  const reportRank = new Map(
    [...reports]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((r, i) => [r.reportId, i + 1])
  );

  const reportTotalPages = Math.max(1, Math.ceil(filteredReports.length / REPORT_PAGE_SIZE));
  const pagedReports = filteredReports.slice(
    (reportPage - 1) * REPORT_PAGE_SIZE,
    reportPage * REPORT_PAGE_SIZE
  );
  // 체크박스는 반려 전 상태(접수/검토중)인 제보만 대상 - 이미 전환/반려된 건 일괄작업 의미가 없음
  const selectablePagedReports = pagedReports.filter((r) => r.status !== "REJECTED");
  const allPageSelected = selectablePagedReports.length > 0 && selectablePagedReports.every((r) => selectedReportIds.has(r.reportId));

  const selectedReport = reports.find((r) => r.reportId === selectedReportId) || null;
  const selectedLinkedIncident = selectedReport?.incidentId
    ? incidents.find((inc) => inc.incidentId === selectedReport.incidentId) || null
    : null;

  // 사건 목록/제보 목록 표에서 공용으로 쓰는 페이지네이션 컨트롤
  const renderTablePagination = (currentPage, totalPages, setPage) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-1.5 pt-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
            currentPage === 1 ? "border-slate-200 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => setPage(page)}
            className={`min-w-8 h-8 px-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              currentPage === page ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
            currentPage === totalPages ? "border-slate-200 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          ›
        </button>
      </div>
    );
  };

  // 통계는 지금 불러온 incidents 배열로 클라이언트에서 즉석 계산
  const today = new Date();
  const todayStr = toDateInputValue(today); // 접수일시 필터 - 오늘 날짜(미래 선택 방지용)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // "해결 완료" 카드는 incidents 배열의 updatedAt으로 세면 안 됨 - 종료된 사건을
  // 나중에 수정(제목 등)해도 updatedAt이 갱신되어 그날 해결한 것처럼 잘못 잡히기 때문.
  // 대신 상태변경 이력 기준으로 정확히 세는 백엔드 API를 따로 불러옴
  const [closedCountStats, setClosedCountStats] = useState({ today: 0, yesterday: 0 });
  useEffect(() => {
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    Promise.all([
      authFetch(`/api/incidents/stats/closed-count?date=${toDateInputValue(today)}`),
      authFetch(`/api/incidents/stats/closed-count?date=${toDateInputValue(yesterdayDate)}`),
    ])
      .then(([todayCount, yesterdayCount]) => setClosedCountStats({ today: todayCount, yesterday: yesterdayCount }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  const createdToday = incidents.filter((i) => sameDay(i.createdAt, today)).length;
  const createdYesterday = incidents.filter((i) => sameDay(i.createdAt, yesterday)).length;
  const receivedToday = incidents.filter((i) => i.status === "RECEIVED" && sameDay(i.updatedAt, today)).length;
  const receivedYesterday = incidents.filter((i) => i.status === "RECEIVED" && sameDay(i.updatedAt, yesterday)).length;
  const respondingToday = incidents.filter((i) => i.status === "RESPONDING" && sameDay(i.updatedAt, today)).length;
  const respondingYesterday = incidents.filter((i) => i.status === "RESPONDING" && sameDay(i.updatedAt, yesterday)).length;
  const recoveringToday = incidents.filter((i) => i.status === "RECOVERING" && sameDay(i.updatedAt, today)).length;
  const recoveringYesterday = incidents.filter((i) => i.status === "RECOVERING" && sameDay(i.updatedAt, yesterday)).length;

  // 상단 카드/지도 필터 칩 전부 "사건"(Incident.status) 기준으로 통일함. dashboardReports는 이제
  // "확인 필요 제보"(내 업무 카드)처럼 사건화 전 원본 제보량이 필요한 곳에만 씀 - 상단 KPI에는 안 씀
  const dashboardReceivedCount = dashboardReports.filter((r) => r.status === "RECEIVED").length;
  const confirmingToday = incidents.filter((i) => i.status === "CONFIRMING" && sameDay(i.updatedAt, today)).length;
  const confirmingYesterday = incidents.filter((i) => i.status === "CONFIRMING" && sameDay(i.updatedAt, yesterday)).length;

  // 상단 카드 - 접수대기/확인중/대응중/복구중/해결 전부 "사건" 상태(Incident.status) 기준으로 통일.
  // 처리 흐름(접수→확인중→대응중→복구중→종료) 그대로 카드를 배치 - 긴급(심각도)은 상태가 아니라서 상단에서 제외
  // (담당 사건 개수는 여기 없고 "내 업무" 쪽으로 옮김 - 상단 카드는 전체 현황용, 내 업무는 개인화된 할 일용)
  const stats = {
    received: incidents.filter((i) => i.status === "RECEIVED").length,
    confirming: incidents.filter((i) => i.status === "CONFIRMING").length,
    responding: incidents.filter((i) => i.status === "RESPONDING").length,
    recovering: incidents.filter((i) => i.status === "RECOVERING").length,
    // 상단 카드에서는 빠졌지만 지도 필터 칩("긴급")이 여전히 이 값을 참조함
    urgent: incidents.filter((i) => i.severity === "HIGH" && i.status !== "CLOSED").length,
    closedToday: closedCountStats.today,
  };

  // 카드별 "전일 대비" - 실데이터 있는 카드만 계산, 나머지는 시점 스냅샷이 없어 변동표시를 생략
  const trendOf = (diff) =>
    diff > 0
      ? { icon: TrendingUp, text: `전일 대비 +${diff}건`, tone: "text-emerald-600" }
      : diff < 0
      ? { icon: TrendingDown, text: `전일 대비 ${diff}건`, tone: "text-red-500" }
      : { icon: Minus, text: "변동 없음", tone: "text-slate-400" };

  // 상단 KPI 카드 클릭 시 사건관리 탭으로 이동 + 해당 상태로 필터링
  const goToIncidentsWithStatus = (status) => {
    setSelectedIncidentId(null);
    setIncidentSearchQuery("");
    setIncidentStatusFilter(status);
    setIncidentTypeFilter("ALL");
    setIncidentRegionFilter("ALL");
    setIncidentSeverityFilter("ALL");
    setIncidentSortOrder("newest");
    setIncidentPage(1);
    setActiveNav("incidents");
  };

  const statCards = [
    { icon: ClipboardList, label: "접수 대기", value: stats.received, color: "text-slate-600 bg-slate-100", trend: trendOf(receivedToday - receivedYesterday), onClick: () => goToIncidentsWithStatus("RECEIVED") },
    { icon: Search, label: "확인 중", value: stats.confirming, color: "text-blue-600 bg-blue-100", trend: trendOf(confirmingToday - confirmingYesterday), onClick: () => goToIncidentsWithStatus("CONFIRMING") },
    { icon: Activity, label: "대응 중", value: stats.responding, color: "text-orange-600 bg-orange-100", trend: trendOf(respondingToday - respondingYesterday), onClick: () => goToIncidentsWithStatus("RESPONDING") },
    { icon: RefreshCw, label: "복구 중", value: stats.recovering, color: "text-yellow-600 bg-yellow-100", trend: trendOf(recoveringToday - recoveringYesterday), onClick: () => goToIncidentsWithStatus("RECOVERING") },
    { icon: CheckCircle2, label: "오늘 해결 완료", value: stats.closedToday, color: "text-emerald-600 bg-emerald-100", trend: trendOf(closedCountStats.today - closedCountStats.yesterday), onClick: () => goToIncidentsWithStatus("CLOSED") },
  ];

  // "내 업무" 3카드 - 로그인한 STAFF 개인 기준
  const myAssignedCount = incidents.filter((i) => i.assignedStaffId === currentUser?.memberId && i.status !== "CLOSED").length;
  const needsReviewCount = dashboardReceivedCount;
  const LONG_PENDING_DAYS = 3; // 3일 이상 상태 변경 없는 진행중 사건 = 장기 미처리
  const longPendingCount = incidents.filter((i) => {
    if (i.status === "CLOSED") return false;
    const last = new Date(i.updatedAt || i.createdAt);
    return (today - last) / (1000 * 60 * 60 * 24) >= LONG_PENDING_DAYS;
  }).length;
  const myTaskCards = [
    { icon: UserRound, label: "내 담당 사건", value: myAssignedCount, sub: "나에게 배정된 진행 사건", tone: "text-blue-600 bg-blue-50", onClick: () => setActiveNav("incidents") },
    { icon: FileSearch, label: "확인 필요 제보", value: needsReviewCount, sub: "아직 검토하지 않은 제보", tone: "text-indigo-600 bg-indigo-50", onClick: () => setActiveNav("reports") },
    { icon: Clock3, label: "장기 미처리", value: longPendingCount, sub: `${LONG_PENDING_DAYS}일 이상 상태 변경 없음`, tone: "text-red-600 bg-red-50", onClick: () => setActiveNav("incidents") },
  ];

  // 지도 상태 필터 칩 - 전부 Incident.status 하나로만 분류(서로 안 겹침)해서 개수 합이 "전체"와 정확히 일치함.
  // 긴급은 상태가 아니라 심각도라 이 목록에서 빼고 mapUrgentOnly 토글로 따로 뺐음(DashboardTab에서 별도 렌더링)
  const mapStatusChips = [
    { key: null, label: "전체", count: incidents.length },
    { key: "RECEIVED", label: "접수대기", count: stats.received },
    { key: "CONFIRMING", label: "확인중", count: stats.confirming },
    { key: "RESPONDING", label: "대응중", count: stats.responding },
    { key: "RECOVERING", label: "복구중", count: stats.recovering },
    { key: "RESOLVED", label: "해결", count: incidents.filter((i) => i.status === "CLOSED").length },
  ];

  // 일별 사건 현황 - 최근 7일간 접수(생성) 건수 vs 처리완료(종료) 건수
  const dailyStats = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
      received: incidents.filter((inc) => sameDay(inc.createdAt, d)).length,
      resolved: incidents.filter((inc) => inc.status === "CLOSED" && sameDay(inc.updatedAt, d)).length,
    };
  });
  const dailyMax = Math.max(1, ...dailyStats.flatMap((d) => [d.received, d.resolved]));

  // 사건 유형별 통계 - 이번 달 등록된 사건 기준 도넛차트
  const monthIncidents = incidents.filter((inc) => {
    const d = new Date(inc.createdAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  });
  const typeCounts = monthIncidents.reduce((acc, i) => {
    acc[i.disasterType] = (acc[i.disasterType] || 0) + 1;
    return acc;
  }, {});
  const typeTotal = monthIncidents.length;
  const typeStats = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      pct: typeTotal ? Math.round((count / typeTotal) * 100) : 0,
      color: DISASTER_TYPE_COLOR[type] || "#94A3B8",
    }));

  // 최근 활동 - 사건 상태변화(생성/배정/상태전환) + 제보 접수를 합쳐 최신순 정렬
  const recentActivity = [
    ...incidents.map((inc) => {
      if (inc.status === "CLOSED") {
        return { key: `inc-closed-${inc.incidentId}`, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600", text: "사건이 해결 완료되었습니다.", sub: `${inc.disasterType} · ${inc.title}`, at: inc.updatedAt };
      }
      if (inc.status === "RESPONDING") {
        return { key: `inc-resp-${inc.incidentId}`, icon: AlertTriangle, tone: "bg-red-100 text-red-500", text: "화재 사건이 대응중으로 변경되었습니다.".replace("화재", inc.disasterType), sub: inc.region, at: inc.updatedAt };
      }
      if (inc.assignedStaffId != null) {
        return { key: `inc-assign-${inc.incidentId}`, icon: UserPlus, tone: "bg-blue-100 text-blue-600", text: "담당자 배정이 완료되었습니다.", sub: `${inc.disasterType} · ${inc.title}`, at: inc.updatedAt };
      }
      return { key: `inc-new-${inc.incidentId}`, icon: FilePlus, tone: "bg-blue-100 text-blue-600", text: `${inc.disasterType} 사건이 접수되었습니다.`, sub: inc.region, at: inc.createdAt };
    }),
    ...dashboardReports
      .filter((r) => !r.incidentId)
      .map((r) => ({ key: `report-${r.reportId}`, icon: FilePlus, tone: "bg-blue-100 text-blue-600", text: "시민 제보가 등록되었습니다.", sub: `${r.disasterType} · 제보 #${r.reportId}`, at: r.createdAt })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* 사이드바 - 햄버거로 폭을 접었다 펼쳤다 하는 방식(모바일/데스크톱 공통) */}
      <aside
        className={`bg-[#0F2540] text-slate-300 flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ${
          sidebarOpen ? "w-56" : "w-0"
        }`}
      >
        <div className="w-56 flex flex-col h-full">
          <button
            type="button"
            onClick={handleBackToHome}
            className="flex items-center gap-2 px-5 py-5 hover:opacity-80 transition text-left cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white">세이프트레이스</span>
          </button>
          <nav className="flex-1 px-3 space-y-1">
            {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => {
                  if (!key) return;
                  if (key === activeNav) {
                    // 이미 활성화된 탭을 다시 누른 경우 - activeNav 값이 그대로라 setActiveNav만으론
                    // 리렌더가 안 일어나므로, 그 탭의 새로고침 함수를 직접 호출해줌
                    if (key === "reports") { resetReportFilters(); loadReports(); }
                    else if (key === "incidents") {
                      setSelectedIncidentId(null);
                      setIncidentSearchQuery("");
                      setIncidentStatusFilter("ALL");
                      setIncidentTypeFilter("ALL");
                      setIncidentRegionFilter("ALL");
                      setIncidentSeverityFilter("ALL");
                      setIncidentSortOrder("newest");
                      setIncidentPage(1);
                      loadIncidents();
                    }
                    else if (key === "dashboard") loadIncidents();
                  } else {
                    if (key === "incidents") {
                      setSelectedIncidentId(null);
                      setIncidentSearchQuery("");
                      setIncidentStatusFilter("ALL");
                      setIncidentTypeFilter("ALL");
                      setIncidentRegionFilter("ALL");
                      setIncidentSeverityFilter("ALL");
                      setIncidentSortOrder("newest");
                      setIncidentPage(1);
                    }
                    setActiveNav(key);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  activeNav === key ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5"
                } cursor-pointer`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {member?.profileImageUrl ? (
                <img src={member.profileImageUrl} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-slate-300" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{(currentUser?.name || member?.name || "담당자")}님</div>
              <div className="text-[11px] text-slate-400 truncate">담당자</div>
            </div>
          </div>
          <div className="px-3 pb-5 space-y-3">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 */}
      <div className="flex-1 min-w-0">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 -ml-1.5 transition-colors cursor-pointer shrink-0"
              aria-label="메뉴 열고 닫기"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="미확인 제보"
              >
                {/* 마이페이지(시민용)의 진짜 알림 피드와 헷갈리지 않도록 종 대신 클립보드 아이콘 사용.
                    이건 실시간 계산된 "지금 접수대기 중인 제보 수"일 뿐, 읽음/안읽음이 쌓이는 알림이 아님 */}
                <ClipboardList className="w-4.5 h-4.5" />
                {dashboardReceivedCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white">
                    {dashboardReceivedCount > 9 ? "9+" : dashboardReceivedCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-8 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-extrabold text-[#0F2540]">미확인 제보</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">현재 확인이 필요한 제보 {dashboardReceivedCount}건</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      setActiveNav("reports");
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-semibold text-[#0F2540] hover:bg-slate-50 cursor-pointer"
                  >
                    제보 관리에서 확인하기 →
                  </button>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {member?.profileImageUrl ? (
                    <img src={member.profileImageUrl} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-left leading-tight hidden sm:block max-w-[120px]">
                  <div className="text-xs font-bold text-[#0F2540] truncate">{(currentUser?.name || member?.name || "담당자")}님</div>
                  <div className="text-[10px] text-slate-400 truncate">{member?.address || "담당자"}</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-10 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-[#0F2540]">{currentUser?.name || member?.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{member?.email || "-"}</p>
                  </div>
                  <button onClick={handleBackToHome} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                    홈으로
                  </button>
                  <button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {activeNav === "dashboard" && (
          <DashboardTab
            error={error}
            currentUser={currentUser}
            member={member}
            today={today}
            loadIncidents={loadIncidents}
            statCards={statCards}
            myTaskCards={myTaskCards}
            mapStatusChips={mapStatusChips}
            mapTypeFilter={mapTypeFilter}
            setMapTypeFilter={setMapTypeFilter}
            mapUrgentOnly={mapUrgentOnly}
            setMapUrgentOnly={setMapUrgentOnly}
            urgentCount={stats.urgent}
            mapLayers={mapLayers}
            setMapLayers={setMapLayers}
            mapType={mapType}
            setMapType={setMapType}
            mapRef={mapRef}
            handleZoom={handleZoom}
            handleLocateReset={handleLocateReset}
            loading={loading}
            incidents={incidents}
            setActiveNav={setActiveNav}
            openIncidentDetail={openIncidentDetail}
            recentActivity={recentActivity}
            dailyStats={dailyStats}
            dailyMax={dailyMax}
            typeTotal={typeTotal}
            typeStats={typeStats}
            onOpenNotices={onOpenNotices}
          />
        )}

        {activeNav === "reports" && (
          <ReportsTab
            reportError={reportError}
            totalReports={totalReports}
            receivedReports={receivedReports}
            reviewingReports={reviewingReports}
            linkedReportsCount={linkedReportsCount}
            rejectedReports={rejectedReports}
            reportStatusFilter={reportStatusFilter}
            setReportStatusFilter={setReportStatusFilter}
            reportTypeFilter={reportTypeFilter}
            setReportTypeFilter={setReportTypeFilter}
            reportRegionFilter={reportRegionFilter}
            setReportRegionFilter={setReportRegionFilter}
            reportSortOrder={reportSortOrder}
            setReportSortOrder={setReportSortOrder}
            reportDateFrom={reportDateFrom}
            reportDateTo={reportDateTo}
            todayStr={todayStr}
            handleReportDateFromChange={handleReportDateFromChange}
            handleReportDateFromBlur={handleReportDateFromBlur}
            handleReportDateToChange={handleReportDateToChange}
            handleReportDateToBlur={handleReportDateToBlur}
            applyReportDateFilter={applyReportDateFilter}
            reportSearchQuery={reportSearchQuery}
            setReportSearchQuery={setReportSearchQuery}
            selectedReportIds={selectedReportIds}
            setSelectedReportIds={setSelectedReportIds}
            openBulkMerge={openBulkMerge}
            openRejectModal={openRejectModal}
            reports={reports}
            reportAddresses={reportAddresses}
            reportsLoading={reportsLoading}
            filteredReports={filteredReports}
            allPageSelected={allPageSelected}
            selectablePagedReports={selectablePagedReports}
            pagedReports={pagedReports}
            selectedReportId={selectedReportId}
            setSelectedReportId={setSelectedReportId}
            setCandidates={setCandidates}
            setReportError={setReportError}
            openReportCandidates={openReportCandidates}
            toggleReportSelected={toggleReportSelected}
            incidentRank={incidentRank}
            setActiveNav={setActiveNav}
            openIncidentDetail={openIncidentDetail}
            reportPage={reportPage}
            reportTotalPages={reportTotalPages}
            setReportPage={setReportPage}
            renderTablePagination={renderTablePagination}
            selectedReport={selectedReport}
            reportPhotos={reportPhotos}
            setViewingPhotoUrl={setViewingPhotoUrl}
            selectedLinkedIncident={selectedLinkedIncident}
            handleMarkReviewing={handleMarkReviewing}
            candidatesLoading={candidatesLoading}
            candidates={candidates}
            handleLinkReport={handleLinkReport}
            startNewIncidentFromReport={startNewIncidentFromReport}
          />
        )}

        {activeNav === "incidents" && (
          <IncidentsTab
            incidentCounts={incidentCounts}
            incidentStatusFilter={incidentStatusFilter}
            setIncidentStatusFilter={setIncidentStatusFilter}
            incidentTypeFilter={incidentTypeFilter}
            setIncidentTypeFilter={setIncidentTypeFilter}
            incidentRegionFilter={incidentRegionFilter}
            setIncidentRegionFilter={setIncidentRegionFilter}
            incidentSeverityFilter={incidentSeverityFilter}
            setIncidentSeverityFilter={setIncidentSeverityFilter}
            incidentSortOrder={incidentSortOrder}
            setIncidentSortOrder={setIncidentSortOrder}
            incidentDateFrom={incidentDateFrom}
            incidentDateTo={incidentDateTo}
            todayStr={todayStr}
            handleIncidentDateFromChange={handleIncidentDateFromChange}
            handleIncidentDateFromBlur={handleIncidentDateFromBlur}
            handleIncidentDateToChange={handleIncidentDateToChange}
            handleIncidentDateToBlur={handleIncidentDateToBlur}
            applyIncidentDateFilter={applyIncidentDateFilter}
            incidentSearchQuery={incidentSearchQuery}
            setIncidentSearchQuery={setIncidentSearchQuery}
            setIncidentPage={setIncidentPage}
            startNewIncidentDirect={startNewIncidentDirect}
            loading={loading}
            filteredIncidents={filteredIncidents}
            pagedIncidents={pagedIncidents}
            selectedIncidentId={selectedIncidentId}
            toggleIncidentDetail={toggleIncidentDetail}
            incidentRank={incidentRank}
            openEditIncidentModal={openEditIncidentModal}
            renderTablePagination={renderTablePagination}
            incidentPage={incidentPage}
            incidentTotalPages={incidentTotalPages}
            selectedIncident={selectedIncident}
            detailError={detailError}
            closeIncidentDetail={closeIncidentDetail}
            member={member}
            timeline={timeline}
            nextStatus={nextStatus}
            handleAssignToMe={handleAssignToMe}
            actionLoading={actionLoading}
            memo={memo}
            setMemo={setMemo}
            handleChangeStatus={handleChangeStatus}
            linkedReports={linkedReports}
            setShowLinkedReportsModal={setShowLinkedReportsModal}
            linkedReportsLoading={linkedReportsLoading}
            setActiveNav={setActiveNav}
            setSelectedReportId={setSelectedReportId}
            setViewingPhotoUrl={setViewingPhotoUrl}
            fieldPhotoUploading={fieldPhotoUploading}
            incidentPhotos={incidentPhotos}
            fieldPhotoInputRef={fieldPhotoInputRef}
            handleFieldPhotoSelected={handleFieldPhotoSelected}
            MAX_INCIDENT_PHOTOS={MAX_INCIDENT_PHOTOS}
          />
        )}

        {activeNav === "publicInfo" && <PublicInfoTab />}
        {activeNav === "statistics" && <StatisticsReportTab />}

      </div>

      {/* 연결된 제보 전체보기 팝업 */}
      {showLinkedReportsModal && (
        <LinkedReportsModal
          setShowLinkedReportsModal={setShowLinkedReportsModal}
          linkedReports={linkedReports}
          pagedLinkedReports={pagedLinkedReports}
          linkedReportsModalPage={linkedReportsModalPage}
          setLinkedReportsModalPage={setLinkedReportsModalPage}
          linkedReportsModalTotalPages={linkedReportsModalTotalPages}
          setActiveNav={setActiveNav}
          setSelectedReportId={setSelectedReportId}
          setViewingPhotoUrl={setViewingPhotoUrl}
        />
      )}

      {/* 첨부 사진 확대보기 팝업 */}
      {viewingPhotoUrl && (
        <PhotoViewerModal viewingPhotoUrl={viewingPhotoUrl} setViewingPhotoUrl={setViewingPhotoUrl} />
      )}

      {/* "이 제보로 새 사건 만들기" 모달 - 탭 이동 없이 팝업으로 처리 */}
      {showCreateIncidentModal && (
        <CreateIncidentModal
          bulkLinkReportIds={bulkLinkReportIds}
          linkAfterCreateReportId={linkAfterCreateReportId}
          setShowCreateIncidentModal={setShowCreateIncidentModal}
          setLinkAfterCreateReportId={setLinkAfterCreateReportId}
          setBulkLinkReportIds={setBulkLinkReportIds}
          setCreateError={setCreateError}
          setPhotoFile={setPhotoFile}
          setPhotoPreviewUrl={setPhotoPreviewUrl}
          handleCreateIncident={handleCreateIncident}
          newIncident={newIncident}
          setNewIncident={setNewIncident}
          handleAddressSearch={handleAddressSearch}
          geocoding={geocoding}
          photoPreviewUrl={photoPreviewUrl}
          handlePhotoChange={handlePhotoChange}
          handleRemovePhoto={handleRemovePhoto}
          createError={createError}
          createLoading={createLoading}
        />
      )}

      {/* 사건 수정 모달 - "새 사건 등록" 모달과 필드 구성은 같고, editIncident를 채운 채로 열림 */}
      {showEditIncidentModal && editIncident && (
        <EditIncidentModal
          editIncident={editIncident}
          setEditIncident={setEditIncident}
          setShowEditIncidentModal={setShowEditIncidentModal}
          setEditError={setEditError}
          handleUpdateIncident={handleUpdateIncident}
          handleEditAddressSearch={handleEditAddressSearch}
          editGeocoding={editGeocoding}
          editError={editError}
          editLoading={editLoading}
        />
      )}

      {/* 반려 모달 - 사유 입력 필수, 단건/일괄(rejectTarget === "bulk") 공용 */}
      {rejectTarget && (
        <RejectModal
          rejectTarget={rejectTarget}
          setRejectTarget={setRejectTarget}
          rejectSubmitting={rejectSubmitting}
          selectedReportIds={selectedReportIds}
          rejectReasonInput={rejectReasonInput}
          setRejectReasonInput={setRejectReasonInput}
          submitReject={submitReject}
        />
      )}

      {/* 체크박스로 여러 건을 골라 한번에 합치는 모달 - 첫 번째 선택 건 기준으로 후보를 찾음 */}
      {bulkMergeOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
          onClick={() => !bulkMergeSubmitting && setBulkMergeOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[#0F2540]">선택한 제보 {selectedReportIds.size}건 합치기</h3>
              <button
                onClick={() => setBulkMergeOpen(false)}
                disabled={bulkMergeSubmitting}
                className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              체크한 제보 전부가 아래에서 고른 사건 하나에 연결됩니다. 이미 다른 사건에 연결된 제보가 있으면 그 사건도 후보에 포함되고, 나머지는 첫 번째로 선택한 제보의 재난유형·위치 기준으로 찾았습니다.
            </p>

            {bulkMergeLoading ? (
              <div className="h-[140px] flex items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />후보 사건을 찾는 중...
              </div>
            ) : bulkMergeCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-600">병합 가능한 기존 사건이 없습니다.</p>
                <p className="text-xs text-slate-400 mt-1">선택한 제보들을 묶어서 새 사건으로 등록해주세요.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 mb-2">
                {bulkMergeCandidates.map((inc) => (
                  <div key={inc.incidentId} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F2540] truncate">{inc.title}</p>
                      <p className="text-[11px] text-slate-400 mt-1">사건 #{incidentRank.get(inc.incidentId) ?? inc.incidentId} · {inc.region}</p>
                    </div>
                    <button
                      type="button"
                      disabled={bulkMergeSubmitting}
                      onClick={() => handleBulkLinkToIncident(inc.incidentId)}
                      className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      이 사건에 연결
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={startBulkNewIncident}
              disabled={bulkMergeSubmitting}
              className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              {selectedReportIds.size}건을 묶어서 새 사건으로 만들기
            </button>
          </div>
        </div>
      )}

      {/* 사건 연결/등록 성공 토스트 - MainPage.jsx 제보 접수 토스트와 동일한 스타일 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F2540] text-white text-sm font-semibold rounded-lg px-4 py-3 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
