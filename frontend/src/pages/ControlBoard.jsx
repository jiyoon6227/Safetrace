import React, { useEffect, useRef, useState } from "react";
import {
  ShieldAlert, LayoutDashboard, FileText, ClipboardList, Truck,
  Building2, FileBarChart, Bell, LogOut, Search, RefreshCw,
  Clock, AlertTriangle, CheckCircle2, Activity, X, UserCheck, Link2, Image as ImageIcon,
  Camera, Loader2, ChevronDown, User, Plus, Minus, LocateFixed,
  TrendingUp, TrendingDown, UserPlus, FilePlus, MapPin, Eye, XCircle, Menu,
} from "lucide-react";
import { authFetch, authUpload, getCurrentUser } from "../api/client";
import { connectIncidentSocket } from "../api/socket";
import { useEscapeKey } from "../hooks/useEscapeKey";

const SEVERITY_COLOR = {
  HIGH: "#1f1b1b",
  MEDIUM: "#F59E0B",
  LOW: "#3B82F6",
};

const STATUS_LABEL = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};

const STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  CONFIRMING: "bg-sky-200 text-sky-800",
  RESPONDING: "bg-rose-200 text-rose-800",
  RECOVERING: "bg-yellow-200 text-yellow-800",
  CLOSED: "bg-emerald-200 text-emerald-800",
};

// 백엔드 IncidentStatus enum과 동일한 순서. "바로 다음 단계로만 이동 가능" 규칙을
// 화면에서도 그대로 반영하기 위해 씀 (다음 상태 버튼 하나만 보여주는 용도)
const STATUS_ORDER = ["RECEIVED", "CONFIRMING", "RESPONDING", "RECOVERING", "CLOSED"];

// 시민 ReportForm.jsx와 동일한 재난유형 목록 - 제보 관리 탭 요약 칩에서 0건인 유형도 같이 보여주기 위함
const REPORT_DISASTER_TYPES = ["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"];

// 시/도 17개 고정 목록 - 실제 제보 데이터랑 상관없이 항상 다 보여주고, 고른 지역에 제보가 있으면 그것만 필터링
const REGION_OPTIONS = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
  "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도",
];

// 제보 처리 상태 - 사건전환된 제보도 원본 데이터를 지우지 않고 상태만 바꿔서 이력으로 보존함
const REPORT_STATUS_LABEL = { RECEIVED: "접수", LINKED: "사건전환 완료" };
const REPORT_STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  LINKED: "bg-emerald-100 text-emerald-700",
};

// 접수일시 필터 - 너무 오래된/의미없는 연도(0000년 등) 입력 방지용 하한선
const MIN_REPORT_DATE = "2020-01-01";

// Date -> "YYYY-MM-DD" (input[type=date] 값 포맷). 날짜 필터 기본값이 하드코딩된 특정 날짜로
// 박혀있으면 다음날이 돼도 안 바뀌는 문제가 생기므로, 항상 이 함수로 "오늘" 기준으로 계산해서 씀.
const toDateInputValue = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// 날짜 필터 기본 범위: 오늘로부터 daysBack일 전 ~ 오늘
const getDefaultDateRange = (daysBack) => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - daysBack);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
};

// 한글 받침 유무에 따라 "으로"/"로" 조사를 붙여줌 (받침 없거나 받침이 ㄹ이면 "로", 그 외엔 "으로")
const withRo = (word) => {
  if (!word) return word;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${word}로`;
  const jong = (last - 0xac00) % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
};

// 서버가 주는 시각 문자열을 "2026-09-13 11:24" 형태(24시간제)로 통일해서 표시
const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "N분 전" / "N시간 전" 형태 - 담당 사건 목록, 최근 활동 카드에서 사용
const formatTimeAgo = (iso) => {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
};

// "01012344321" / "010-1234-4321" 등 어떤 형태로 들어와도 "010-****-4321"처럼 가운데를 가려서 표시
const maskPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone; // 형식이 이상하면 마스킹하지 않고 원본 그대로
  const first = digits.slice(0, 3);
  const last = digits.slice(-4);
  return `${first}-****-${last}`;
};

const sameDay = (isoA, dateB) => {
  if (!isoA) return false;
  const a = new Date(isoA);
  return a.getFullYear() === dateB.getFullYear() && a.getMonth() === dateB.getMonth() && a.getDate() === dateB.getDate();
};

// 지도 마커/범례 색상 - 위험도가 아니라 "지금 어떤 조치가 필요한지" 기준(상태)으로 구분
// 긴급(위험도 HIGH·미종료) > 대응중 > 확인중(접수/확인중) > 해결(종료)
const markerColorOf = (inc) => {
  if (inc.status !== "CLOSED" && inc.severity === "HIGH") return "#DC2626"; // 긴급
  if (inc.status === "RESPONDING") return "#F59E0B"; // 대응중
  if (inc.status === "CLOSED") return "#10B981"; // 해결
  return "#3B82F6"; // 확인중 (접수/확인중/복구중)
};

const DISASTER_TYPE_COLOR = {
  침수: "#3B82F6", 화재: "#EF4444", 산사태: "#8B5CF6", 태풍: "#06B6D4",
  폭염: "#F59E0B", 강풍: "#64748B", 한파: "#0EA5E9", 기타: "#94A3B8",
};

// 지도 마커에 넣을 재난유형별 이모지 - 색상 핀만으로는 무슨 재난인지 구분이 안 돼서 추가
const DISASTER_TYPE_EMOJI = {
  침수: "💧", 화재: "🔥", 산사태: "⛰️", 태풍: "🌀", 폭염: "☀️", 강풍: "💨", 한파: "❄️", 기타: "⚠️",
};

// 원형 점 대신 "핀" 모양 마커 - 위쪽 흰 원 안에 재난유형 이모지를 넣어 지도만 보고도 무슨 사건인지 알 수 있게 함
const buildMarkerImage = (inc) => {
  const color = markerColorOf(inc);
  const emoji = DISASTER_TYPE_EMOJI[inc.disasterType] || "⚠️";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 25 17 25s17-13 17-25C34 7.6 26.4 0 17 0z" fill="${color}"/>
    <circle cx="17" cy="16" r="11.5" fill="white"/>
    <text x="17" y="21" font-size="14" text-anchor="middle">${emoji}</text>
  </svg>`;
  return new window.kakao.maps.MarkerImage(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    new window.kakao.maps.Size(34, 42),
    { offset: new window.kakao.maps.Point(17, 42) }
  );
};

// 공지사항 - 별도 백엔드 API가 없어 화면 구성용으로 고정해둔 안내 문구
const STATIC_NOTICES = [
  { icon: AlertTriangle, tone: "text-red-500", title: "[긴급] 호우주의보 발효에 따른 비상근무 체계 가동", date: "오늘" },
  { icon: Bell, tone: "text-blue-500", title: "[안내] 추석 연휴 재난상황실 운영 안내", date: "어제" },
  { icon: Bell, tone: "text-blue-500", title: "[안내] 시스템 정기 점검 일정 안내", date: "이번 주" },
  { icon: Bell, tone: "text-blue-500", title: "[안내] 여름철 폭염 대응 지침 업데이트", date: "이번 달" },
];

const NAV_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard, label: "대시보드" },
  { key: "reports", icon: ClipboardList, label: "제보 관리" },
  { key: "incidents", icon: FileText, label: "사건 관리" },
  { icon: Truck, label: "대응 관리" },
  { icon: Building2, label: "자원 관리" },
  { icon: Activity, label: "공공 정보" },
  { icon: FileBarChart, label: "통계 보고서" },
];

export default function ControlBoard({ onBackToHome, onLogout }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const currentUser = getCurrentUser();

  const [activeNav, setActiveNav] = useState("dashboard");

  // 헤더 - 프로필/알림 드롭다운, 내 정보(부서 표시용)
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
  const [mapTypeFilter, setMapTypeFilter] = useState(null); // null = 전체
  const [dashboardReports, setDashboardReports] = useState([]);
  useEffect(() => {
    if (activeNav !== "dashboard") return;
    authFetch("/api/reports").then(setDashboardReports).catch(() => {});
  }, [activeNav]);

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
      return (
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
    if (!window.kakao || !window.kakao.maps) {
      setError("카카오맵 SDK를 불러오지 못했습니다.");
      return;
    }
    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(36.3504, 127.3845);
      const map = new window.kakao.maps.Map(mapRef.current, { center, level: 8 });
      mapInstanceRef.current = map;
      loadIncidents();
    });
  }, [activeNav]); // activeNav가 "dashboard"로 바뀔 때마다(=탭 재진입할 때마다) 다시 실행

  const loadIncidents = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authFetch("/api/incidents");
      setIncidents(data);
      drawMarkers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const drawMarkers = (data, typeFilter = mapTypeFilter) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const visible = (typeFilter ? data.filter((inc) => inc.disasterType === typeFilter) : data)
      .filter((inc) => inc.latitude != null && inc.longitude != null);

    visible.forEach((inc) => {
      const position = new window.kakao.maps.LatLng(inc.latitude, inc.longitude);
      const markerImage = buildMarkerImage(inc);
      const marker = new window.kakao.maps.Marker({ position, image: markerImage, map });
      marker.addListener?.("click", () => {
        setActiveNav("incidents");
        openIncidentDetail(inc.incidentId);
      });
      markersRef.current.push(marker);
    });

    // 필터링해서 보고 있는 마커들이 항상 화면 안에 들어오도록 지도 범위를 자동으로 맞춤
    // (예: "폭염" 필터를 눌렀는데 그 사건이 부산이라 대전 근처 화면 밖에 있던 문제)
    if (visible.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      visible.forEach((inc) => bounds.extend(new window.kakao.maps.LatLng(inc.latitude, inc.longitude)));
      map.setBounds(bounds);
      if (visible.length === 1 && map.getLevel() < 5) map.setLevel(5);
    }
  };

  // 재난유형 필터 칩을 바꾸면 새로 불러오지 않고 이미 있는 incidents로 마커만 다시 그림
  useEffect(() => {
    if (activeNav !== "dashboard") return;
    drawMarkers(incidents, mapTypeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTypeFilter]);

  const handleZoom = (delta) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setLevel(map.getLevel() + delta);
  };

  // 지도를 다시 현재 필터 기준 사건들이 전부 보이는 범위로 되돌림
  const handleLocateReset = () => {
    drawMarkers(incidents, mapTypeFilter);
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

  // "선택 합치기" - 체크된 제보들 중 대표(첫 번째)의 재난유형/위치로 병합 후보 사건을 찾아 모달에 띄움
  const openBulkMerge = async () => {
    if (selectedReportIds.size === 0) return;
    setBulkMergeOpen(true);
    setBulkMergeLoading(true);
    setReportError("");
    try {
      const firstId = [...selectedReportIds][0];
      const data = await authFetch(`/api/reports/${firstId}/candidates`);
      setBulkMergeCandidates(data);
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
      const aDate = new Date(a.updatedAt || a.createdAt);
      const bDate = new Date(b.updatedAt || b.createdAt);
      return incidentSortOrder === "newest" ? bDate - aDate : aDate - bDate;
    });

  const incidentCounts = {
    ALL: incidents.length,
    RECEIVED: incidents.filter((i) => i.status === "RECEIVED").length,
    CONFIRMING: incidents.filter((i) => i.status === "CONFIRMING").length,
    RESPONDING: incidents.filter((i) => i.status === "RESPONDING").length,
    RECOVERING: incidents.filter((i) => i.status === "RECOVERING").length,
    CLOSED: incidents.filter((i) => i.status === "CLOSED").length,
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
      return (
        r.disasterType?.toLowerCase().includes(q) ||
        r.content?.toLowerCase().includes(q) ||
        r.reporterName?.toLowerCase().includes(q) ||
        reportAddresses[r.reportId]?.toLowerCase().includes(q) ||
        String(r.reportId).includes(q)
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

  const closedToday = incidents.filter((i) => i.status === "CLOSED" && sameDay(i.updatedAt, today)).length;
  const closedYesterday = incidents.filter((i) => i.status === "CLOSED" && sameDay(i.updatedAt, yesterday)).length;
  const createdToday = incidents.filter((i) => sameDay(i.createdAt, today)).length;
  const createdYesterday = incidents.filter((i) => sameDay(i.createdAt, yesterday)).length;
  const inProgressChangedToday = incidents.filter(
    (i) => (i.status === "CONFIRMING" || i.status === "RESPONDING") && sameDay(i.updatedAt, today)
  ).length;
  const inProgressChangedYesterday = incidents.filter(
    (i) => (i.status === "CONFIRMING" || i.status === "RESPONDING") && sameDay(i.updatedAt, yesterday)
  ).length;

  const stats = {
    received: incidents.filter((i) => i.status === "RECEIVED").length,
    inProgress: incidents.filter((i) => i.status === "CONFIRMING" || i.status === "RESPONDING").length,
    assigned: incidents.filter((i) => i.assignedStaffId != null && i.status !== "CLOSED").length,
    urgent: incidents.filter((i) => i.severity === "HIGH" && i.status !== "CLOSED").length,
    closedToday,
  };

  // 카드별 "전일 대비" - 접수/진행/해결완료는 실데이터로 계산, 담당·긴급은 시점 스냅샷이 없어 변동표시를 생략
  const trendOf = (diff) =>
    diff > 0
      ? { icon: TrendingUp, text: `전일 대비 +${diff}건`, tone: "text-emerald-600" }
      : diff < 0
      ? { icon: TrendingDown, text: `전일 대비 ${diff}건`, tone: "text-red-500" }
      : { icon: Minus, text: "변동 없음", tone: "text-slate-400" };

  const statCards = [
    { icon: Clock, label: "접수 대기", value: stats.received, color: "text-slate-600 bg-slate-100", trend: trendOf(createdToday - createdYesterday) },
    { icon: Activity, label: "진행 중 사건", value: stats.inProgress, color: "text-blue-600 bg-blue-100", trend: trendOf(inProgressChangedToday - inProgressChangedYesterday) },
    { icon: ClipboardList, label: "담당 사건", value: stats.assigned, color: "text-amber-600 bg-amber-100", trend: trendOf(0) },
    { icon: AlertTriangle, label: "긴급 상황", value: stats.urgent, color: "text-red-600 bg-red-100", trend: trendOf(0) },
    { icon: CheckCircle2, label: "해결 완료 (오늘)", value: stats.closedToday, color: "text-emerald-600 bg-emerald-100", trend: trendOf(closedToday - closedYesterday) },
  ];

  // 지도 위 재난유형 필터 칩 - 실제 등록된 유형만 노출, 건수는 현재 목록 기준
  const mapTypeCounts = incidents.reduce((acc, i) => {
    acc[i.disasterType] = (acc[i.disasterType] || 0) + 1;
    return acc;
  }, {});
  const mapTypeChips = [
    { key: null, label: "전체", count: incidents.length },
    ...Object.entries(mapTypeCounts).map(([type, count]) => ({ key: type, label: type, count })),
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
            onClick={onBackToHome}
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
          <div className="px-3 pb-5 space-y-3">
            <div className="relative overflow-hidden bg-white/5 rounded-xl px-4 py-3.5">
              <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/5" />
              <p className="relative text-xs text-slate-300 leading-relaxed">
                오늘도<br />안전한 도시를 위해<br />수고하십니다 👍
              </p>
            </div>
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
                aria-label="알림"
              >
                <Bell className="w-4.5 h-4.5" />
                {stats.received > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white">
                    {stats.received > 9 ? "9+" : stats.received}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-8 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-extrabold text-[#0F2540]">알림</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">접수 대기 중인 사건 {stats.received}건</p>
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
                    <img src={`http://localhost:8080${member.profileImageUrl}`} alt="프로필" className="w-full h-full object-cover" />
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
                  <button onClick={onBackToHome} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
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
          <main className="p-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}

            {/* 인사말 + 새로고침 */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <h2 className="text-xl font-extrabold text-[#0F2540]">{(currentUser?.name || member?.name || "담당자")}님, 안녕하세요!</h2>
                <p className="text-sm text-slate-500 mt-0.5">시민의 안전을 지키는 든든한 파트너, 세이프트레이스입니다.</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400">
                  {today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })} {today.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={loadIncidents}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 새로고침
                </button>
              </div>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {statCards.map(({ icon: Icon, label, value, color, trend }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-2xl font-extrabold text-[#0F2540]">{value}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold shrink-0 ${trend.tone}`}>
                      <trend.icon className="w-3 h-3" />
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${trend.tone}`}>{trend.text}</p>
                </div>
              ))}
            </div>

            {/* 지도 + 목록 + 최근활동 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-[#0F2540]">실시간 사고 현황 지도</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">지도를 클릭하면 상세 정보를 확인할 수 있습니다.</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {mapTypeChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setMapTypeFilter(chip.key)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer ${
                          mapTypeFilter === chip.key ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {chip.label} ({chip.count})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative mt-3">
                  <div ref={mapRef} className="w-full rounded-xl overflow-hidden" style={{ height: 480 }} />
                  <div className="absolute right-2.5 top-2.5 flex flex-col gap-1">
                    <button type="button" onClick={() => handleZoom(-1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleZoom(1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer">
                      <Minus className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={handleLocateReset} className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer">
                      <LocateFixed className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                  {[
                    ["#DC2626", "긴급"],
                    ["#F59E0B", "대응중"],
                    ["#3B82F6", "확인중"],
                    ["#10B981", "해결"],
                  ].map(([color, label]) => (
                    <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-[#0F2540]">담당 사건 목록</h3>
                    <button onClick={() => setActiveNav("incidents")} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">전체보기 →</button>
                  </div>
                  {loading ? (
                    <p className="text-sm text-slate-400">불러오는 중...</p>
                  ) : incidents.length === 0 ? (
                    <p className="text-sm text-slate-400">등록된 Incident가 없습니다.</p>
                  ) : (
                    <ul className="space-y-2 max-h-56 overflow-y-auto">
                      {incidents.slice(0, 4).map((inc) => (
                        <li
                          key={inc.incidentId}
                          onClick={() => {
                            setActiveNav("incidents");
                            openIncidentDetail(inc.incidentId);
                          }}
                          className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${markerColorOf(inc)}1A`, color: markerColorOf(inc) }}>
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#0F2540] truncate">{inc.disasterType} · 제보 #{inc.incidentId}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[inc.status] || ""}`}>
                                {STATUS_LABEL[inc.status] || inc.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{inc.region}</p>
                            <p className="text-[10px] text-slate-300 mt-0.5">{formatTimeAgo(inc.updatedAt || inc.createdAt)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-[#0F2540]">최근 활동</h3>
                    <button onClick={() => setActiveNav("incidents")} className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">전체보기 →</button>
                  </div>
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-slate-400">최근 활동이 없습니다.</p>
                  ) : (
                    <ul className="space-y-3">
                      {recentActivity.map((a) => (
                        <li key={a.key} className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.tone}`}>
                            <a.icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700 leading-snug">{a.text}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{a.sub}</p>
                          </div>
                          <span className="text-[10px] text-slate-300 shrink-0">{formatTimeAgo(a.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* 일별 사건 현황 + 유형별 통계 + 공지사항 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-[#0F2540] text-sm">일별 사건 현황</h3>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" />접수</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />처리 완료</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-4">최근 7일간 사건 접수 및 처리 현황입니다.</p>
                <div className="flex items-end justify-between gap-2 h-32">
                  {dailyStats.map((d) => (
                    <div key={d.label} className="flex-1 flex items-end justify-center gap-1 h-full">
                      <div className="w-2.5 bg-sky-300 rounded-t" style={{ height: `${(d.received / dailyMax) * 100}%` }} title={`접수 ${d.received}건`} />
                      <div className="w-2.5 bg-emerald-400 rounded-t" style={{ height: `${(d.resolved / dailyMax) * 100}%` }} title={`처리완료 ${d.resolved}건`} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {dailyStats.map((d) => (
                    <span key={d.label} className="flex-1 text-center text-[9px] text-slate-400">{d.label}</span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-[#0F2540] text-sm mb-1">사건 유형별 통계</h3>
                <p className="text-[10px] text-slate-400 mb-4">이번 달 등록된 사건의 유형별 비율입니다.</p>
                {typeTotal === 0 ? (
                  <p className="text-sm text-slate-400">이번 달 등록된 사건이 없습니다.</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="relative w-28 h-28 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {(() => {
                          let offset = 0;
                          return typeStats.map((t) => {
                            const dash = (t.count / typeTotal) * 100;
                            const circle = (
                              <circle
                                key={t.type}
                                cx="18" cy="18" r="15.9"
                                fill="none"
                                stroke={t.color}
                                strokeWidth="4"
                                strokeDasharray={`${dash} ${100 - dash}`}
                                strokeDashoffset={-offset}
                              />
                            );
                            offset += dash;
                            return circle;
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-400">총</span>
                        <span className="text-base font-extrabold text-[#0F2540]">{typeTotal}건</span>
                        <span className="text-[9px] text-slate-400">이번 달</span>
                      </div>
                    </div>
                    <ul className="space-y-1.5 min-w-0 flex-1">
                      {typeStats.map((t) => (
                        <li key={t.type} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-600 truncate">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                            {t.type}
                          </span>
                          <span className="font-bold text-slate-500 shrink-0">{t.pct}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[#0F2540] text-sm">주요 공지사항</h3>
                  <button className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer">전체보기 →</button>
                </div>
                <ul className="space-y-3">
                  {STATIC_NOTICES.map((n) => (
                    <li key={n.title} className="flex items-start gap-2.5">
                      <n.icon className={`w-4 h-4 mt-0.5 shrink-0 ${n.tone}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-600 leading-snug truncate">{n.title}</p>
                      </div>
                      <span className="text-[10px] text-slate-300 shrink-0">{n.date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </main>
        )}

        {activeNav === "reports" && (
          <main className="px-5 py-4 bg-[#F7F9FC] min-h-[calc(100vh-64px)]">
            {reportError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                {reportError}
              </div>
            )}

            {/* 헤더 */}
            <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
              <div>
                <h2 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">제보 관리</h2>
                <p className="text-[13px] text-slate-500 mt-2">
                  시민이 접수한 제보를 확인하고 검토하여 사건으로 전환할 수 있습니다.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pt-1">
                <span>홈</span><span>›</span><span className="text-slate-500">제보 관리</span>
              </div>
            </div>

            {/* 상단 요약 카드 - 넓은 화면에서만 5개 한 줄, 좁아지면 2~3열로 쌓임 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
              {[
                { key: "all", label: "전체 제보", value: totalReports, sub: "전체 제보 건수", icon: ClipboardList, box: "bg-blue-100 text-blue-700" },
                { key: "RECEIVED", label: "접수", value: receivedReports, sub: totalReports ? `전체의 ${Math.round((receivedReports / totalReports) * 1000) / 10}%` : "전체의 0%", icon: FileText, box: "bg-blue-100 text-blue-700" },
                { key: "REVIEWING", label: "검토중", value: reviewingReports, sub: totalReports ? `전체의 ${Math.round((reviewingReports / totalReports) * 1000) / 10}%` : "전체의 0%", icon: Clock, box: "bg-amber-100 text-amber-700" },
                { key: "LINKED", label: "사건전환", value: linkedReportsCount, sub: totalReports ? `전체의 ${Math.round((linkedReportsCount / totalReports) * 1000) / 10}%` : "전체의 0%", icon: Link2, box: "bg-emerald-100 text-emerald-700" },
                { key: "REJECTED", label: "반려", value: rejectedReports, sub: totalReports ? `전체의 ${Math.round((rejectedReports / totalReports) * 1000) / 10}%` : "전체의 0%", icon: X, box: "bg-rose-100 text-rose-700" },
              ].map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => { setReportStatusFilter(card.key); setReportTypeFilter(null); }}
                  className={`h-[92px] bg-white rounded-xl border px-4 py-3 text-left transition cursor-pointer ${
                    reportStatusFilter === card.key ? "border-[#0F2540] shadow-sm" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 h-full">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.box}`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-600">{card.label}</p>
                      <p className="text-[25px] leading-7 font-extrabold text-[#0F2540] mt-0.5">
                        {card.value}<span className="text-xs font-semibold ml-1">건</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* 목록 카드 */}
            <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-3">
              {/* 필터 툴바 - 좁아지면 여러 줄로 자연스럽게 감싸짐 */}
              <div className="px-3 py-2.5 flex items-center flex-wrap gap-2 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: "all", label: `전체 (${totalReports})` },
                    { key: "RECEIVED", label: `접수 (${receivedReports})` },
                    { key: "REVIEWING", label: `검토중 (${reviewingReports})` },
                    { key: "LINKED", label: `사건전환 (${linkedReportsCount})` },
                    { key: "REJECTED", label: `반려 (${rejectedReports})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setReportStatusFilter(tab.key)}
                      className={`h-8 px-3 rounded-lg text-xs font-bold border-2 transition-colors cursor-pointer whitespace-nowrap ${
                        reportStatusFilter === tab.key
                          ? "bg-[#0F2540] border-[#0F2540] text-white hover:bg-[#16345c]"
                          : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                  <select
                    value={reportTypeFilter || ""}
                    onChange={(e) => setReportTypeFilter(e.target.value || null)}
                    className="h-8 min-w-[104px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none cursor-pointer"
                  >
                    <option value="">전체 유형</option>
                    {REPORT_DISASTER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>

                  <select
                    value={reportRegionFilter || ""}
                    onChange={(e) => setReportRegionFilter(e.target.value || null)}
                    className="h-8 min-w-[104px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none cursor-pointer"
                  >
                    <option value="">전체 지역</option>
                    {REGION_OPTIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>

                  <select
                    value={reportSortOrder}
                    onChange={(e) => setReportSortOrder(e.target.value)}
                    className="h-8 min-w-[92px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none cursor-pointer"
                  >
                    <option value="newest">최신순</option>
                    <option value="oldest">오래된순</option>
                  </select>

                  <div className="h-8 rounded-lg border border-slate-200 bg-white px-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus-within:border-blue-400 focus-within:bg-blue-50/40 focus-within:shadow-sm">
                    <input
                      type="date"
                      value={reportDateFrom}
                      min={MIN_REPORT_DATE}
                      max={reportDateTo || todayStr}
                      onChange={(e) => handleReportDateFromChange(e.target.value)}
                      onBlur={handleReportDateFromBlur}
                      className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                    />
                    <span className="text-slate-300">~</span>
                    <input
                      type="date"
                      value={reportDateTo}
                      min={reportDateFrom || MIN_REPORT_DATE}
                      max={todayStr}
                      onChange={(e) => handleReportDateToChange(e.target.value)}
                      onBlur={handleReportDateToBlur}
                      className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={applyReportDateFilter}
                    className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold hover:bg-[#16345c] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    조회
                  </button>

                  <div className="h-8 w-full sm:w-[275px] rounded-lg border border-slate-200 bg-white px-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      placeholder="제보 내용, 주소, 신고자 검색..."
                      className="w-full bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {selectedReportIds.size > 0 && (
                <div className="px-3 py-2.5 flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 bg-amber-50">
                  <span className="text-xs font-bold text-amber-700">{selectedReportIds.size}건 선택됨</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={openBulkMerge}
                      className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-[#0F2540] hover:bg-[#1B3A5C] text-white text-xs font-bold cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" /> 선택 합치기
                    </button>
                    <button
                      type="button"
                      onClick={() => openRejectModal("bulk")}
                      disabled={reports.some((r) => selectedReportIds.has(r.reportId) && r.status === "LINKED")}
                      title="이미 사건으로 전환된 제보가 포함돼 있으면 반려할 수 없습니다."
                      className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 선택 반려
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReportIds(new Set())}
                      className="h-8 px-3 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      선택 해제
                    </button>
                  </div>
                </div>
              )}

              {reportsLoading ? (
                <div className="py-16 text-center text-sm text-slate-400">제보를 불러오는 중입니다...</div>
              ) : filteredReports.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">조건에 맞는 제보가 없습니다.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] table-fixed text-[13px]">
                      <colgroup>
                        <col className="w-[38px]" />
                        <col className="w-[86px]" />
                        <col className="w-[90px]" />
                        <col className="w-[220px]" />
                        <col className="w-[110px]" />
                        <col className="w-[150px]" />
                        <col className="w-[250px]" />
                        <col className="w-[125px]" />
                        <col className="w-[150px]" />
                        <col className="w-[95px]" />
                      </colgroup>
                      <thead>
                        <tr className="h-10 bg-[#E9ECEF] text-left text-[12px] font-bold text-[#556070] border-y border-[#CBD5E1]">
                          <th className="px-3">
                            <input
                              type="checkbox"
                              checked={allPageSelected}
                              disabled={selectablePagedReports.length === 0}
                              onChange={() =>
                                setSelectedReportIds((prev) => {
                                  const next = new Set(prev);
                                  if (allPageSelected) selectablePagedReports.forEach((r) => next.delete(r.reportId));
                                  else selectablePagedReports.forEach((r) => next.add(r.reportId));
                                  return next;
                                })
                              }
                              className="w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-30"
                            />
                          </th>
                          <th className="px-2 font-semibold text-center">제보번호</th>
                          <th className="px-2 font-semibold text-center">재난유형</th>
                          <th className="px-2 font-semibold">내용</th>
                          <th className="px-2 font-semibold">신고자</th>
                          <th className="px-2 font-semibold text-center">접수일시</th>
                          <th className="px-2 font-semibold">주소</th>
                          <th className="px-2 font-semibold text-center">상태</th>
                          <th className="px-2 font-semibold text-center">연결 사건</th>
                          <th className="px-2 font-semibold text-center">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedReports.map((r) => {
                          const linked = !!r.incidentId;
                          const selected = selectedReportId === r.reportId;
                          return (
                            <tr
                              key={r.reportId}
                              onClick={() => {
                                setSelectedReportId(r.reportId);
                                if (linked) { setCandidates([]); setReportError(""); }
                                else openReportCandidates(r.reportId);
                              }}
                              className={`h-[41px] border-b border-[#E1E5EB] cursor-pointer transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-slate-50/90"}`}
                            >
                              <td className="px-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedReportIds.has(r.reportId)}
                                  disabled={r.status === "REJECTED"}
                                  onChange={() => toggleReportSelected(r.reportId)}
                                  className="w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-30"
                                />
                              </td>
                              <td className="px-2 text-center font-bold text-[#0F2540] whitespace-nowrap">#R-{r.reportId}</td>
                              <td className="px-2 text-center">
                                <span className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600">
                                  {r.disasterType}
                                </span>
                              </td>
                              <td className="px-2 text-slate-700 truncate" title={r.content}>{r.content || "-"}</td>
                              <td className="px-2 text-slate-600 truncate">{r.reporterName || `#${r.memberId}`}</td>
                              <td className="px-2 text-center text-slate-600 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                              <td className="px-2 text-slate-600 truncate" title={reportAddresses[r.reportId]}>{reportAddresses[r.reportId] || "주소 확인 중..."}</td>
                              <td className="px-2 text-center">
                                {linked ? (
                                  <span className="inline-flex rounded-md bg-emerald-50 text-emerald-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">사건전환 완료</span>
                                ) : r.status === "REVIEWING" ? (
                                  <span className="inline-flex rounded-md bg-amber-50 text-amber-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">검토중</span>
                                ) : r.status === "REJECTED" ? (
                                  <span className="inline-flex rounded-md bg-rose-50 text-rose-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">반려</span>
                                ) : (
                                  <span className="inline-flex rounded-md bg-blue-50 text-blue-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">접수</span>
                                )}
                              </td>
                              <td className="px-2 text-center">
                                {linked ? (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setActiveNav("incidents"); openIncidentDetail(r.incidentId); }}
                                    className="text-[11px] font-bold text-blue-600 hover:underline whitespace-nowrap cursor-pointer"
                                  >사건 #{incidentRank.get(r.incidentId) ?? r.incidentId} 보기 ↗</button>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-2 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation(); setSelectedReportId(r.reportId);
                                    if (linked) setCandidates([]); else openReportCandidates(r.reportId);
                                  }}
                                  className="h-7 px-3 rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >상세보기</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">총 {filteredReports.length}건의 제보가 있습니다.</p>
                    <div className="scale-[0.92] origin-right overflow-x-auto max-w-full">{renderTablePagination(reportPage, reportTotalPages, setReportPage)}</div>
                  </div>
                </>
              )}
            </div>

            {/* 하단 상세 - 넓은 화면에선 왼쪽 55%/오른쪽 45%, 좁아지면 위아래로 쌓임 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-3 items-stretch">
              <section className="bg-white rounded-xl border border-slate-200 p-4 min-h-[255px]">
                <h3 className="text-[15px] font-extrabold text-[#0F2540] mb-3">제보 상세</h3>

                {!selectedReport ? (
                  <div className="h-[205px] rounded-lg bg-slate-50 flex items-center justify-center text-sm text-slate-400">
                    제보를 선택하면 상세 정보가 표시됩니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-[320px_1fr] gap-5">
                    <div>
                      <div className="h-[205px] rounded-lg overflow-hidden bg-slate-100">
                        {selectedReport.photoUrl ? (
                          <img src={`http://localhost:8080${selectedReport.photoUrl}`} alt="제보 첨부" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-10 h-10" /></div>
                        )}
                      </div>
                      {reportPhotos.length > 1 && (
                        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                          {reportPhotos.slice(1).map((url, index) => (
                            <button
                              key={url + index}
                              type="button"
                              onClick={() => setViewingPhotoUrl(`http://localhost:8080${url}`)}
                              className="h-12 rounded-md overflow-hidden border border-slate-200 hover:shadow-md transition cursor-pointer"
                            >
                              <img src={`http://localhost:8080${url}`} alt={`추가 사진 ${index + 2}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <dl className="text-[12px] divide-y divide-slate-100">
                      <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">제보번호</dt><dd className="font-bold text-[#0F2540]">#R-{selectedReport.reportId}</dd></div>
                      <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">재난유형</dt><dd className="font-semibold text-slate-700">{selectedReport.disasterType}</dd></div>
                      <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">제보 내용</dt><dd className="text-slate-600 leading-5 line-clamp-2">{selectedReport.content || "-"}</dd></div>
                      <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">신고자</dt><dd className="text-slate-700">{selectedReport.reporterName || `#${selectedReport.memberId}`}{maskPhone(selectedReport.reporterPhone) && ` (${maskPhone(selectedReport.reporterPhone)})`}</dd></div>
                      <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">접수일시</dt><dd className="text-slate-700">{formatDateTime(selectedReport.createdAt)}</dd></div>
                      <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">주소</dt><dd className="text-slate-700 truncate">{reportAddresses[selectedReport.reportId] || "주소 확인 중..."}</dd></div>
                    </dl>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl border border-slate-200 p-4 min-h-[255px]">
                {selectedReport?.incidentId ? (
                  <>
                    <h3 className="text-[15px] font-extrabold text-[#0F2540] mb-3">연결된 사건 정보</h3>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-3 flex items-start gap-3">
                      <Link2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-bold text-emerald-700">이 제보는 사건으로 전환되었습니다.</p>
                        <p className="text-[11px] text-emerald-600 leading-5 mt-0.5">원본 제보는 삭제되지 않고 사건과 연결되어 계속 보관됩니다.<br />제보와 사건의 처리 과정을 함께 추적할 수 있습니다.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-4 items-center">
                      <dl className="text-[12px] space-y-1.5">
                        <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">사건번호</dt><dd className="font-bold text-blue-600">#{incidentRank.get(selectedReport.incidentId) ?? selectedReport.incidentId}</dd></div>
                        <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">사건 제목</dt><dd className="font-semibold text-slate-700 truncate">{selectedLinkedIncident?.title || `${selectedReport.disasterType} 관련 사건`}</dd></div>
                        <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">현재 상태</dt><dd>{selectedLinkedIncident ? <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_STYLE[selectedLinkedIncident.status] || "bg-slate-100 text-slate-600"}`}>{STATUS_LABEL[selectedLinkedIncident.status] || selectedLinkedIncident.status}</span> : <span className="text-slate-500">-</span>}</dd></div>
                        <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">담당자</dt><dd className="text-slate-700">{selectedLinkedIncident?.assignedStaffName || "-"}</dd></div>
                        <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">최초 신고 제보</dt><dd className="text-slate-700">
                          {selectedLinkedIncident?.sourceReportId ? (
                            <button
                              type="button"
                              onClick={() => setSelectedReportId(selectedLinkedIncident.sourceReportId)}
                              className={`font-bold hover:underline cursor-pointer ${selectedLinkedIncident.sourceReportId === selectedReport.reportId ? "text-amber-700" : "text-blue-600"}`}
                            >
                              #R-{selectedLinkedIncident.sourceReportId}{selectedLinkedIncident.sourceReportId === selectedReport.reportId && " (이 제보)"}
                            </button>
                          ) : "-"}
                        </dd></div>
                        <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">사건 생성일</dt><dd className="text-slate-700">{selectedLinkedIncident?.createdAt ? formatDateTime(selectedLinkedIncident.createdAt) : "-"}</dd></div>
                      </dl>
                      <button
                        type="button"
                        onClick={() => { setActiveNav("incidents"); openIncidentDetail(selectedReport.incidentId); }}
                        className="h-10 rounded-lg bg-[#0F2540] text-white text-sm font-bold hover:bg-[#183A60] cursor-pointer"
                      >사건 상세 보기 ↗</button>
                    </div>
                    <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-600 flex items-center gap-2">
                      <Bell className="w-4 h-4 shrink-0" /> 제보에서 사건으로 전환되어도, 원본 제보 데이터는 그대로 보존되며 목록에서 확인할 수 있습니다.
                    </div>
                  </>
                ) : selectedReport?.status === "REJECTED" ? (
                  <>
                    <h3 className="text-[15px] font-extrabold text-[#0F2540] mb-3">반려 정보</h3>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-bold text-rose-600">이 제보는 반려되었습니다.</p>
                        <p className="text-[12px] text-rose-500 leading-5 mt-2 whitespace-pre-line">
                          {selectedReport.rejectReason || "사유가 기록되지 않았습니다."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 flex items-center gap-2">
                      <Bell className="w-4 h-4 shrink-0" /> 반려된 제보도 삭제되지 않고 이력으로 그대로 보존됩니다.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-[15px] font-extrabold text-[#0F2540]">병합 후보 사건</h3>
                      {selectedReport && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {selectedReport.status === "RECEIVED" && (
                            <button
                              type="button"
                              onClick={() => handleMarkReviewing(selectedReport.reportId)}
                              className="h-7 flex items-center gap-1 px-2.5 rounded-md border border-amber-300 bg-amber-100 text-amber-800 text-[11px] font-bold hover:bg-amber-200 hover:border-amber-400 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> 검토 시작
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openRejectModal(selectedReport.reportId)}
                            className="h-7 flex items-center gap-1 px-2.5 rounded-md border border-rose-300 bg-rose-100 text-rose-700 text-[11px] font-bold hover:bg-rose-200 hover:border-rose-400 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> 반려
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 mb-3">같은 재난유형 · 최근 30분 이내 · 반경 500m의 기존 사건을 자동으로 찾아 보여줍니다.</p>
                    {!selectedReport ? (
                      <div className="h-[185px] rounded-lg bg-slate-50 flex items-center justify-center text-sm text-slate-400">제보를 먼저 선택해주세요.</div>
                    ) : candidatesLoading ? (
                      <div className="h-[185px] flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />후보 사건을 찾는 중...</div>
                    ) : candidates.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-600">병합 가능한 기존 사건이 없습니다.</p>
                        <p className="text-xs text-slate-400 mt-1">해당 제보가 독립적인 사건이라면 새로운 사건으로 등록해주세요.</p>
                        <button type="button" onClick={() => startNewIncidentFromReport(selectedReport)} className="w-full h-9 mt-4 rounded-lg bg-[#0F2540] text-white text-xs font-bold cursor-pointer">이 제보로 새 사건 만들기</button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {candidates.map((inc) => (
                          <div key={inc.incidentId} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0"><p className="text-sm font-bold text-[#0F2540] truncate">{inc.title}</p><p className="text-[11px] text-slate-400 mt-1">사건 #{incidentRank.get(inc.incidentId) ?? inc.incidentId} · {inc.region}</p></div>
                            <button type="button" onClick={() => handleLinkReport(inc.incidentId)} className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold cursor-pointer shrink-0">이 사건에 연결</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => startNewIncidentFromReport(selectedReport)} className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">별개의 새 사건으로 등록</button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </main>
        )}

        {activeNav === "incidents" && (
          <main className="px-5 py-4 bg-[#F7F9FC] min-h-[calc(100vh-64px)]">
            <div className="space-y-3">
              {/* 사건 관리 제목 */}
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h1 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">사건 관리</h1>
                  <p className="text-[13px] text-slate-500 mt-2">
                    접수된 제보를 바탕으로 생성된 사건을 확인하고 처리 과정을 관리합니다.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pt-1"><span>홈</span><span>›</span><span className="text-slate-500">사건 관리</span></div>
              </div>

              {/* 사건 상태 요약 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                  { key: "ALL", label: "전체 사건", sub: "등록된 전체 사건 수", icon: FileText, tone: "bg-blue-100 text-blue-700" },
                  { key: "RECEIVED", label: "접수", sub: "신규 접수된 사건", icon: ClipboardList, tone: "bg-blue-100 text-blue-700" },
                  { key: "CONFIRMING", label: "확인중", sub: "현장 확인 진행 중", icon: Search, tone: "bg-sky-100 text-sky-700" },
                  { key: "RESPONDING", label: "대응중", sub: "현장 조치 진행 중", icon: Activity, tone: "bg-indigo-100 text-indigo-700" },
                  { key: "RECOVERING", label: "복구중", sub: "복구 작업 진행 중", icon: RefreshCw, tone: "bg-orange-100 text-orange-700" },
                  { key: "CLOSED", label: "종료", sub: "조치 완료된 사건", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
                ].map((card) => {
                  const Icon = card.icon;
                  const active = incidentStatusFilter === card.key;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => setIncidentStatusFilter(card.key)}
                      className={`h-[92px] bg-white rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                        active
                          ? "border-[#0F2540] shadow-sm ring-1 ring-[#0F2540]/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 h-full">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.tone}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-slate-600">{card.label}</div>
                          <div className="text-[25px] leading-7 font-extrabold text-[#0F2540] mt-0.5">
                            {incidentCounts[card.key]}<span className="text-xs font-semibold ml-1">건</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">{card.sub}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 상태 탭 + 검색 / 필터 : 제보관리와 동일한 구성 */}
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* 사건 상태 탭 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[
                      { key: "ALL", label: "전체" },
                      { key: "RECEIVED", label: "접수" },
                      { key: "CONFIRMING", label: "확인중" },
                      { key: "RESPONDING", label: "대응중" },
                      { key: "RECOVERING", label: "복구중" },
                      { key: "CLOSED", label: "종료" },
                    ].map((tab) => {
                      const active = incidentStatusFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setIncidentStatusFilter(tab.key);
                            setIncidentPage(1);
                          }}
                          className={`h-8 px-3 rounded-lg border text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            active
                              ? "bg-[#0F2540] border-[#0F2540] text-white shadow-sm"
                              : "bg-white border-slate-300 text-slate-600 hover:border-[#0F2540]/50 hover:bg-slate-50"
                          }`}
                        >
                          {tab.label} ({incidentCounts[tab.key]})
                        </button>
                      );
                    })}
                  </div>

                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2 min-w-0">
                    <select
                      value={incidentTypeFilter}
                      onChange={(e) => { setIncidentTypeFilter(e.target.value); setIncidentPage(1); }}
                      className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
                    >
                      <option value="ALL">전체 유형</option>
                      {REPORT_DISASTER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>

                    <select
                      value={incidentRegionFilter}
                      onChange={(e) => { setIncidentRegionFilter(e.target.value); setIncidentPage(1); }}
                      className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
                    >
                      <option value="ALL">전체 지역</option>
                      {REGION_OPTIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                    </select>

                    <select
                      value={incidentSeverityFilter}
                      onChange={(e) => { setIncidentSeverityFilter(e.target.value); setIncidentPage(1); }}
                      className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
                    >
                      <option value="ALL">전체 위험도</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>

                    <select
                      value={incidentSortOrder}
                      onChange={(e) => setIncidentSortOrder(e.target.value)}
                      className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
                    >
                      <option value="newest">최신순</option>
                      <option value="oldest">오래된순</option>
                    </select>

                    <div className="h-8 rounded-lg border border-slate-200 bg-white px-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus-within:border-blue-400 focus-within:bg-blue-50/40 focus-within:shadow-sm">
                      <input
                        type="date"
                        value={incidentDateFrom}
                        min={MIN_REPORT_DATE}
                        max={incidentDateTo || todayStr}
                        onChange={(e) => handleIncidentDateFromChange(e.target.value)}
                        onBlur={handleIncidentDateFromBlur}
                        className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                      />
                      <span className="text-slate-300">~</span>
                      <input
                        type="date"
                        value={incidentDateTo}
                        min={incidentDateFrom || MIN_REPORT_DATE}
                        max={todayStr}
                        onChange={(e) => handleIncidentDateToChange(e.target.value)}
                        onBlur={handleIncidentDateToBlur}
                        className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={applyIncidentDateFilter}
                      className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold hover:bg-[#16345c] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      조회
                    </button>

                    <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 h-8 w-[240px] transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        value={incidentSearchQuery}
                        onChange={(e) => { setIncidentSearchQuery(e.target.value); setIncidentPage(1); }}
                        placeholder="사건명, 지역, 재난유형 검색..."
                        className="w-full text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 기존 사건 목록 */}
              <section className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
                  <h3 className="text-base font-extrabold text-[#0F2540]">기존 사건 목록</h3>
                  <button
                    type="button"
                    onClick={startNewIncidentDirect}
                    className="h-8 px-4 rounded-lg bg-[#0F2540] text-white text-xs font-bold flex items-center gap-1.5 transition hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" /> 사건 생성
                  </button>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
                ) : filteredIncidents.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">검색 결과가 없습니다.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] table-fixed text-[13px]">
                        <thead>
                          <tr className="h-10 bg-[#E9ECEF] text-[12px] font-bold text-[#556070] border-y border-[#CBD5E1]">
                            <th className="px-4 py-3 text-center">사건번호</th>
                            <th className="px-4 py-3 text-left">사건명</th>
                            <th className="px-4 py-3 text-center">재난유형</th>
                            <th className="px-4 py-3 text-left">지역</th>
                            <th className="px-4 py-3 text-center">위험도</th>
                            <th className="px-4 py-3 text-center">담당자</th>
                            <th className="px-4 py-3 text-center">상태</th>
                            <th className="px-4 py-3 text-center">접수일시</th>
                            <th className="px-4 py-3 text-center">작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedIncidents.map((inc) => (
                            <tr
                              key={inc.incidentId}
                              onClick={() => toggleIncidentDetail(inc.incidentId)}
                              className={`h-[42px] border-b border-slate-200 last:border-0 transition-colors duration-150 cursor-pointer ${
                                selectedIncidentId === inc.incidentId ? "bg-blue-50" : "bg-white hover:bg-slate-50/90"
                              }`}
                            >
                              <td className="px-3 py-2 text-center font-bold text-[#0F2540]">#I-{incidentRank.get(inc.incidentId)}</td>
                              <td className="px-3 py-2 font-semibold text-slate-700 max-w-[220px] truncate" title={inc.title}>{inc.title}</td>
                              <td className="px-3 py-2 text-center text-slate-500">{inc.disasterType}</td>
                              <td className="px-3 py-2 text-slate-600 max-w-[280px] truncate" title={inc.region}>{inc.region}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-extrabold ${
                                  inc.severity === "HIGH"
                                    ? "bg-red-100 text-red-600"
                                    : inc.severity === "MEDIUM"
                                      ? "bg-amber-100 text-amber-600"
                                      : "bg-blue-100 text-blue-600"
                                }`}>
                                  {inc.severity}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">
                                {inc.assignedStaffName || (inc.assignedStaffId ? `#${inc.assignedStaffId}` : "미배정")}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_STYLE[inc.status] || "bg-slate-100 text-slate-600"}`}>
                                  {STATUS_LABEL[inc.status] || inc.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(inc.createdAt)}</td>
                              <td className="px-3 py-2">
                                <div className="flex justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => toggleIncidentDetail(inc.incidentId)}
                                    className="border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-[#0F2540] hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                                  >
                                    상세보기
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditIncidentModal(inc)}
                                    className="border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                                  >
                                    수정
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-4 py-2.5 flex items-center justify-between border-t border-slate-200 bg-slate-50/60">
                      <p className="text-xs text-slate-400">총 {filteredIncidents.length}건의 사건이 있습니다.</p>
                      {renderTablePagination(incidentPage, incidentTotalPages, setIncidentPage)}
                    </div>
                  </>
                )}
              </section>

              {/* 사건 상세: 같은 사건 행/상세보기 재클릭 또는 X 버튼으로 닫힘 */}
              {selectedIncident ? (
                <section className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3.5">
                    {detailError && (
                      <div className="mb-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
                        {detailError}
                      </div>
                    )}

                    {/* 첫 번째 시안처럼: 왼쪽에 사건 상세/진행, 오른쪽에 연결 제보/사진을 처음부터 나란히 배치 */}
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_355px] gap-3.5 min-w-0 items-start">
                      <div className="min-w-0">
                        {/* 사건 상세 헤더 */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="text-base font-extrabold text-[#0F2540]">사건 상세 정보</div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditIncidentModal(selectedIncident)}
                              className="bg-[#0F2540] text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] transition cursor-pointer"
                            >
                              사건 수정
                            </button>
                            <button
                              type="button"
                              onClick={closeIncidentDetail}
                              aria-label="사건 상세 닫기"
                              title="닫기"
                              className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 hover:border-slate-400 transition cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* 사건 제목: 기본정보와 구분되도록 별도 영역 */}
                        <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 mb-3">
                          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">사건 제목</div>
                          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <span className="text-[19px] font-extrabold text-[#0F2540]">#I-{incidentRank.get(selectedIncident.incidentId)}</span>
                            <span className="text-[19px] font-extrabold text-[#0F2540] min-w-0 truncate">{selectedIncident.title}</span>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[selectedIncident.status] || "bg-slate-100 text-slate-600"}`}>
                              {STATUS_LABEL[selectedIncident.status] || selectedIncident.status}
                            </span>
                          </div>
                        </div>

                        {/* 핵심 정보 */}
                        <div className={`grid grid-cols-2 md:grid-cols-3 ${selectedIncident.sourceReportId ? "xl:grid-cols-7" : "xl:grid-cols-6"} gap-2 mb-4`}>
                          <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px] xl:col-span-2">
                            <MapPin className="w-4 h-4 text-[#244D7C] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] text-slate-500 leading-none font-semibold">발생 위치</div>
                              <div className="text-[12px] font-semibold text-slate-700 truncate mt-1" title={selectedIncident.region}>{selectedIncident.region}</div>
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                            <AlertTriangle className="w-4 h-4 text-[#244D7C] shrink-0" />
                            <div>
                              <div className="text-[11px] text-slate-500 leading-none font-semibold">위험도</div>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                selectedIncident.severity === "HIGH"
                                  ? "bg-red-100 text-red-600"
                                  : selectedIncident.severity === "MEDIUM"
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-blue-100 text-blue-600"
                              }`}>{selectedIncident.severity}</span>
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                            <User className="w-4 h-4 text-[#244D7C] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] text-slate-500 leading-none font-semibold">담당자</div>
                              <div className="text-[12px] font-semibold text-slate-700 mt-1 truncate">
                                {selectedIncident.assignedStaffName || (selectedIncident.assignedStaffId ? `#${selectedIncident.assignedStaffId}` : "미배정")}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                            <Building2 className="w-4 h-4 text-[#244D7C] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] text-slate-500 leading-none font-semibold">담당 부서</div>
                              <div className="text-[12px] font-semibold text-slate-700 mt-1 truncate">{member?.departmentName || "-"}</div>
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                            <Clock className="w-4 h-4 text-[#244D7C] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] text-slate-500 leading-none font-semibold">최종 업데이트</div>
                              <div className="text-[12px] font-semibold text-slate-700 whitespace-nowrap mt-1">{formatDateTime(selectedIncident.updatedAt || selectedIncident.createdAt)}</div>
                            </div>
                          </div>
                          {selectedIncident.sourceReportId && (
                            <button
                              type="button"
                              onClick={() => { setActiveNav("reports"); setSelectedReportId(selectedIncident.sourceReportId); }}
                              title="이 제보로 사건이 처음 만들어졌습니다. 클릭하면 제보 상세로 이동합니다."
                              className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px] hover:bg-slate-100 transition cursor-pointer text-left"
                            >
                              <Link2 className="w-4 h-4 text-[#244D7C] shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[11px] text-slate-500 leading-none font-semibold">최초 신고</div>
                                <div className="text-[12px] font-semibold text-slate-700 mt-1">#R-{selectedIncident.sourceReportId}</div>
                              </div>
                            </button>
                          )}
                        </div>

                        {/* 사건 진행 상황 */}
                        <div className="rounded-xl border border-slate-300 bg-white px-3 py-3.5 mb-3">
                          <h4 className="text-[13px] font-extrabold text-[#0F2540] mb-3">사건 진행 상황</h4>
                          <div className="grid grid-cols-5 gap-1.5">
                            {STATUS_ORDER.map((status, index) => {
                              const currentIndex = STATUS_ORDER.indexOf(selectedIncident.status);
                              const completed = index < currentIndex;
                              const current = index === currentIndex;
                              const statusLogs = timeline.filter((item) => item.newStatus === status);
                              const log = statusLogs[statusLogs.length - 1];
                              const fallbackDate = status === "RECEIVED" ? selectedIncident.createdAt : null;
                              const fallbackMemo = status === "RECEIVED" ? "사건이 접수되었습니다." : "아직 진행되지 않았습니다.";

                              return (
                                <div key={status} className="relative min-w-0">
                                  {index < STATUS_ORDER.length - 1 && (
                                    <div className={`absolute top-[15px] left-1/2 w-[calc(100%+0.5rem)] h-[2px] ${index < currentIndex ? "bg-blue-500" : "bg-slate-200"}`} />
                                  )}
                                  <div className="relative z-10 flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                      completed
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : current
                                          ? "bg-blue-600 border-blue-600 text-white shadow-md ring-4 ring-blue-100"
                                          : "bg-slate-100 border-slate-200 text-slate-500"
                                    }`}>
                                      {completed ? "✓" : index + 1}
                                    </div>
                                    <div className={`text-xs font-bold mt-2 ${current ? "text-blue-700" : "text-slate-700"}`}>{STATUS_LABEL[status]}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 text-center min-h-[15px]">
                                      {log?.changedAt || fallbackDate ? formatDateTime(log?.changedAt || fallbackDate) : "-"}
                                    </div>
                                    <div className={`w-full mt-2.5 min-h-[78px] rounded-lg border px-3 py-2 text-[11px] leading-[1.55] break-words transition-colors ${
                                      current
                                        ? "border-blue-200 bg-blue-50 text-blue-800"
                                        : completed
                                          ? "border-slate-200 bg-white text-slate-600"
                                          : "border-slate-200 bg-slate-50/80 text-slate-400"
                                    }`}>
                                      {log?.memo || fallbackMemo}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 다음 단계 진행 */}
                        <div className="rounded-xl border border-slate-300 bg-white p-3">
                          {!nextStatus ? (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-3 py-2.5 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0" /> 종료된 사건입니다. 각 단계의 진행 내용은 위에서 확인할 수 있습니다.
                            </div>
                          ) : !selectedIncident.assignedStaffId ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                              <div>
                                <p className="text-xs font-bold text-amber-800">담당자 배정이 필요합니다.</p>
                                <p className="text-[11px] text-amber-600 mt-0.5">담당자가 지정되어야 다음 단계로 진행할 수 있습니다.</p>
                              </div>
                              <button
                                type="button"
                                onClick={handleAssignToMe}
                                disabled={actionLoading}
                                className="shrink-0 text-xs font-bold text-[#0F2540] border border-amber-200 bg-white rounded-lg px-3 py-2 hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                              >
                                내가 담당하기
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="text-xs font-extrabold text-[#0F2540]">다음 단계 진행 내용</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">입력한 내용은 {STATUS_LABEL[nextStatus]} 단계의 진행 기록으로 남습니다.</div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{memo.length}/500</span>
                              </div>
                              <div className="flex gap-2">
                                <textarea
                                  value={memo}
                                  onChange={(e) => setMemo(e.target.value.slice(0, 500))}
                                  placeholder={nextStatus === "CLOSED" ? "종료 사유 및 최종 조치 내용을 입력하세요." : `${STATUS_LABEL[nextStatus]} 단계로 진행할 내용을 입력하세요.`}
                                  rows={2}
                                  maxLength={500}
                                  className="flex-1 resize-none border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                                <button
                                  type="button"
                                  onClick={handleChangeStatus}
                                  disabled={actionLoading}
                                  className="min-w-[145px] bg-[#0F2540] text-white rounded-lg px-4 text-xs font-bold hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                  {withRo(STATUS_LABEL[nextStatus])} 진행
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 오른쪽: 첫 번째 시안처럼 상세 상단부터 연결 제보/사진 배치 */}
                      <aside className="space-y-2.5 min-w-0">
                        <div className="border border-slate-300 rounded-xl p-3 shadow-sm bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-extrabold text-[#0F2540]">연결된 제보 ({linkedReports.length}건)</h4>
                            {linkedReports.length > 4 && (
                              <button
                                type="button"
                                onClick={() => { setActiveNav("reports"); }}
                                className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                              >
                                전체보기 ›
                              </button>
                            )}
                          </div>

                          {linkedReportsLoading ? (
                            <div className="text-xs text-slate-400 py-5 text-center">불러오는 중...</div>
                          ) : linkedReports.length === 0 ? (
                            <div className="text-xs text-slate-400 py-5 text-center">연결된 제보가 없습니다.</div>
                          ) : (
                            <table className="w-full text-[11px] table-fixed">
                              <colgroup>
                                <col className="w-[72px]" />
                                <col />
                                <col className="w-[90px]" />
                                <col className="w-[62px]" />
                              </colgroup>
                              <thead>
                                <tr className="text-[10px] font-semibold text-slate-400 border-b border-slate-100">
                                  <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">제보번호</th>
                                  <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">제보내용</th>
                                  <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">제보일시</th>
                                  <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">작업</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {linkedReports.slice(0, 4).map((report) => (
                                  <tr key={report.reportId} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-2 py-2.5 text-center font-bold text-[#0F2540] whitespace-nowrap">#R-{report.reportId}</td>
                                    <td className="px-2 py-2.5 text-left text-slate-500 truncate" title={report.content}>{report.content || report.disasterType}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-400 whitespace-nowrap">{formatDateTime(report.createdAt).slice(5)}</td>
                                    <td className="px-2 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => { setActiveNav("reports"); setSelectedReportId(report.reportId); }}
                                        className="inline-flex items-center justify-center min-w-[38px] whitespace-nowrap text-[11px] font-semibold text-[#0F2540] border border-slate-200 rounded-md px-2 py-1 hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer"
                                      >
                                        보기
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        <div className="border border-slate-300 rounded-xl p-3 shadow-sm bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-extrabold text-[#0F2540]">
                              제보자 첨부 사진 {linkedReports.filter((r) => r.photoUrl).length > 0 && `(${linkedReports.filter((r) => r.photoUrl).length})`}
                            </h4>
                            {linkedReports.filter((r) => r.photoUrl).length > 4 && (
                              <button
                                type="button"
                                onClick={() => { setActiveNav("reports"); }}
                                className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                              >
                                전체보기 ›
                              </button>
                            )}
                          </div>
                          {linkedReports.some((report) => report.photoUrl) ? (
                            <div className="grid grid-cols-2 gap-2">
                              {linkedReports.filter((report) => report.photoUrl).slice(0, 4).map((report) => (
                                <button
                                  key={report.reportId}
                                  type="button"
                                  onClick={() => setViewingPhotoUrl(`http://localhost:8080${report.photoUrl}`)}
                                  className="overflow-hidden rounded-lg border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
                                >
                                  <img src={`http://localhost:8080${report.photoUrl}`} alt="제보 첨부" className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="border border-dashed border-slate-200 rounded-lg py-6 text-center text-[11px] text-slate-400">첨부된 제보 사진이 없습니다.</div>
                          )}
                        </div>

                        <div className="border border-slate-300 rounded-xl p-3 shadow-sm bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="text-sm font-extrabold text-[#0F2540]">현장 확인 사진</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">제보 사진과 별도로 담당자가 현장을 확인한 사진입니다. (최대 {MAX_INCIDENT_PHOTOS}장)</p>
                            </div>
                            <button
                              type="button"
                              disabled={fieldPhotoUploading || incidentPhotos.length >= MAX_INCIDENT_PHOTOS}
                              onClick={() => fieldPhotoInputRef.current?.click()}
                              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#0F2540] border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition cursor-pointer disabled:opacity-50"
                            >
                              {fieldPhotoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                              {fieldPhotoUploading ? "업로드 중..." : "현장 사진 추가"}
                            </button>
                            <input
                              ref={fieldPhotoInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleFieldPhotoSelected}
                              className="hidden"
                            />
                          </div>
                          {incidentPhotos.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {incidentPhotos.map((url, index) => (
                                <button
                                  key={url + index}
                                  type="button"
                                  onClick={() => setViewingPhotoUrl(`http://localhost:8080${url}`)}
                                  className="overflow-hidden rounded-lg border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
                                >
                                  <img
                                    src={`http://localhost:8080${url}`}
                                    alt={`현장 확인 사진 ${index + 1}`}
                                    className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-slate-200 rounded-lg py-5 text-center bg-slate-50/50">
                              <Camera className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                              <div className="text-[11px] text-slate-400">현장 확인 사진이 등록되면 여기에 표시됩니다.</div>
                            </div>
                          )}
                        </div>
                      </aside>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl py-14 text-center text-sm text-slate-400">
                  위 목록에서 사건을 선택하면 상세 정보가 표시됩니다.
                </div>
              )}
            </div>
          </main>
        )}

      </div>

      {/* 첨부 사진 확대보기 팝업 */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setViewingPhotoUrl(null)}
        >
          <button
            onClick={() => setViewingPhotoUrl(null)}
            className="absolute top-6 right-6 text-white hover:text-slate-300 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={viewingPhotoUrl}
            alt="첨부 사진 확대"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* "이 제보로 새 사건 만들기" 모달 - 탭 이동 없이 팝업으로 처리 */}
      {showCreateIncidentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[#0F2540]">
                {bulkLinkReportIds ? `새 사건(Incident) 등록 · 제보 ${bulkLinkReportIds.length}건 묶음` : linkAfterCreateReportId ? "새 사건(Incident) 등록" : "새 사건 직접 등록"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateIncidentModal(false);
                  setLinkAfterCreateReportId(null);
                  setBulkLinkReportIds(null);
                  setCreateError("");
                  setPhotoFile(null);
                  setPhotoPreviewUrl(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {bulkLinkReportIds
                ? `체크한 제보 ${bulkLinkReportIds.length}건이 모두 이 사건 하나로 연결됩니다. 대표로 첫 번째 제보 정보를 채워뒀으니 필요하면 수정하세요.`
                : linkAfterCreateReportId
                ? "재난유형·지역·위치가 이 제보 정보로 자동 채워져 있습니다. 필요하면 주소를 다시 검색해 수정해도 됩니다."
                : "제보 없이 담당자가 직접 사건을 등록합니다. 아래 버튼으로 주소를 검색해 위치를 확인해주세요."}
            </p>

            <form onSubmit={handleCreateIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">사건명</label>
                <input
                  type="text"
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  placeholder="예: 유성구 궁동 침수"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">재난유형</label>
                  <select
                    value={newIncident.disasterType}
                    onChange={(e) => setNewIncident({ ...newIncident, disasterType: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  >
                    {["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">위험도</label>
                  <select
                    value={newIncident.severity}
                    onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">위치</label>
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  disabled={geocoding}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  주소 검색
                </button>
                {newIncident.region && newIncident.latitude && newIncident.longitude ? (
                  <p className="text-xs text-emerald-600 mt-1.5">✓ {newIncident.region}</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1.5">주소 검색으로 위치를 확인해주세요.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">현장 사진 (선택)</label>
                {!photoPreviewUrl ? (
                  <label className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-dashed border-slate-300 rounded-lg py-4 hover:bg-slate-50 cursor-pointer">
                    <Camera className="w-4 h-4" />
                    사진 첨부하기
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={photoPreviewUrl} alt="현장 사진 미리보기" className="w-full h-40 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {createError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}

              <button
                type="submit"
                disabled={createLoading}
                className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
              >
                {createLoading
                  ? "등록 중..."
                  : bulkLinkReportIds
                  ? `등록하고 제보 ${bulkLinkReportIds.length}건 연결하기`
                  : linkAfterCreateReportId
                  ? "등록하고 제보 연결하기"
                  : "사건 등록하기"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 사건 수정 모달 - "새 사건 등록" 모달과 필드 구성은 같고, editIncident를 채운 채로 열림 */}
      {showEditIncidentModal && editIncident && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[#0F2540]">사건 정보 수정</h3>
              <button
                onClick={() => {
                  setShowEditIncidentModal(false);
                  setEditIncident(null);
                  setEditError("");
                  setEditPhotoFile(null);
                  setEditPhotoPreviewUrl(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              상태(진행 단계)와 담당자는 여기서 바꿀 수 없습니다. 상세 패널의 워크플로우를 이용해주세요.
            </p>

            <form onSubmit={handleUpdateIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">사건명</label>
                <input
                  type="text"
                  value={editIncident.title}
                  onChange={(e) => setEditIncident({ ...editIncident, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  placeholder="예: 유성구 궁동 침수"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">재난유형</label>
                  <select
                    value={editIncident.disasterType}
                    onChange={(e) => setEditIncident({ ...editIncident, disasterType: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  >
                    {["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">위험도</label>
                  <select
                    value={editIncident.severity}
                    onChange={(e) => setEditIncident({ ...editIncident, severity: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">위치</label>
                <button
                  type="button"
                  onClick={handleEditAddressSearch}
                  disabled={editGeocoding}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  {editGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  주소 다시 검색
                </button>
                {editIncident.region && editIncident.latitude && editIncident.longitude ? (
                  <p className="text-xs text-emerald-600 mt-1.5">✓ {editIncident.region}</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1.5">주소 검색으로 위치를 확인해주세요.</p>
                )}
              </div>

              <p className="text-[11px] text-slate-400">현장 사진은 저장 후 상세패널의 "현장 사진 추가"에서 관리할 수 있습니다.</p>

              {editError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
              )}

              <button
                type="submit"
                disabled={editLoading}
                className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
              >
                {editLoading ? "저장 중..." : "수정 내용 저장"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 반려 모달 - 사유 입력 필수, 단건/일괄(rejectTarget === "bulk") 공용 */}
      {rejectTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
          onClick={() => !rejectSubmitting && setRejectTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-500" /> 제보 반려
              </h3>
              <button
                onClick={() => setRejectTarget(null)}
                disabled={rejectSubmitting}
                className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {rejectTarget === "bulk"
                ? `선택한 ${selectedReportIds.size}건의 제보를 반려합니다. 반려 사유는 필수입니다.`
                : "이 제보를 반려합니다. 원본 제보는 삭제되지 않고 반려 사유와 함께 이력으로 남습니다."}
            </p>
            <textarea
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
              placeholder="반려 사유를 입력하세요 (필수)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#0F2540]"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={rejectSubmitting}
                className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={submitReject}
                disabled={rejectSubmitting || !rejectReasonInput.trim()}
                className="flex-1 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg py-2.5 disabled:opacity-50 cursor-pointer"
              >
                {rejectSubmitting ? "처리 중..." : "반려 확정"}
              </button>
            </div>
          </div>
        </div>
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
              체크한 제보 전부가 아래에서 고른 사건 하나에 연결됩니다. 후보는 첫 번째로 선택한 제보의 재난유형·위치 기준으로 찾았습니다.
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
