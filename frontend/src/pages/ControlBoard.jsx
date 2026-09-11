import React, { useEffect, useRef, useState } from "react";
import {
  ShieldAlert, LayoutDashboard, FileText, ClipboardList, Truck,
  Building2, FileBarChart, Bell, LogOut, Search, RefreshCw,
  Clock, AlertTriangle, CheckCircle2, Activity, X, UserCheck, Link2, Image as ImageIcon
} from "lucide-react";
import { authFetch, getCurrentUser } from "../api/client";
import { connectIncidentSocket } from "../api/socket";

const SEVERITY_COLOR = {
  HIGH: "#DC2626",
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

// 서버가 주는 시각 문자열을 "9/6 16:20" 형태로 짧게 표시
const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

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
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportAddresses, setReportAddresses] = useState({}); // reportId -> 주소 문자열
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState(null); // null = 전체, 아니면 특정 재난유형만

  // 검색어/유형필터가 바뀌어서 지금 선택된 제보가 더 이상 목록에 안 보이면, 상세도 같이 닫는다.
  useEffect(() => {
    if (!selectedReportId) return;
    const q = reportSearchQuery.trim().toLowerCase();
    const stillVisible = reports.some((r) => {
      if (r.reportId !== selectedReportId) return false;
      if (reportTypeFilter && r.disasterType !== reportTypeFilter) return false;
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
  }, [reportSearchQuery, reportTypeFilter]);

  // 사건 관리 탭 상태 (신규 Incident 생성)
  const [newIncident, setNewIncident] = useState({
    title: "", disasterType: "침수", severity: "MEDIUM", region: "", latitude: "", longitude: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [linkAfterCreateReportId, setLinkAfterCreateReportId] = useState(null);
  const [showCreateIncidentModal, setShowCreateIncidentModal] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);

  // 사건 관리 탭 - 기존 사건 목록 검색어
  const [incidentSearchQuery, setIncidentSearchQuery] = useState("");

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

  const drawMarkers = (data) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    data.forEach((inc) => {
      if (inc.latitude == null || inc.longitude == null) return;
      const position = new window.kakao.maps.LatLng(inc.latitude, inc.longitude);
      const color = SEVERITY_COLOR[inc.severity] || "#64748B";
      const markerImage = new window.kakao.maps.MarkerImage(
        `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="2.5"/></svg>`
        )}`,
        new window.kakao.maps.Size(24, 24)
      );
      const marker = new window.kakao.maps.Marker({ position, image: markerImage, map });
      marker.addListener?.("click", () => {
        setActiveNav("incidents");
        openIncidentDetail(inc.incidentId);
      });
      markersRef.current.push(marker);
    });
  };

  // ---- 사건 상세 (담당자 배정 / 상태변경) ----------------------------------

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
  const resolveReportAddress = (report) => {
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
      const data = await authFetch("/api/reports");
      setReports(data);
      data.forEach(resolveReportAddress);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportsLoading(false);
    }
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
    } catch (err) {
      setReportError(err.message);
    }
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
    setShowCreateIncidentModal(true);
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
      setCreateError("위도/경도를 숫자로 입력해주세요.");
      return;
    }

    setCreateLoading(true);
    try {
      const created = await authFetch("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: newIncident.title,
          disasterType: newIncident.disasterType,
          severity: newIncident.severity,
          region: newIncident.region,
          latitude: lat,
          longitude: lng,
        }),
      });

      if (linkAfterCreateReportId) {
        await authFetch(`/api/reports/${linkAfterCreateReportId}/link`, {
          method: "PATCH",
          body: JSON.stringify({ incidentId: created.incidentId }),
        });
        setLinkAfterCreateReportId(null);
        await loadReports();
      }

      setNewIncident({ title: "", disasterType: "침수", severity: "MEDIUM", region: "", latitude: "", longitude: "" });
      await loadIncidents();
      setShowCreateIncidentModal(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const selectedReport = reports.find((r) => r.reportId === selectedReportId) || null;

  // 사건 관리 탭 - 검색어로 사건명/지역/재난유형 필터링
  const filteredIncidents = incidents.filter((inc) => {
    if (!incidentSearchQuery.trim()) return true;
    const q = incidentSearchQuery.trim().toLowerCase();
    return (
      inc.title?.toLowerCase().includes(q) ||
      inc.region?.toLowerCase().includes(q) ||
      inc.disasterType?.toLowerCase().includes(q)
    );
  });

  // 제보 관리 탭 - 미연결 제보 재난유형별 건수 요약
  const reportTypeCounts = reports.reduce((acc, r) => {
    acc[r.disasterType] = (acc[r.disasterType] || 0) + 1;
    return acc;
  }, {});

  // 제보 관리 탭 - 재난유형 필터 + 검색어로 필터링된 목록
  const filteredReports = reports.filter((r) => {
    if (reportTypeFilter && r.disasterType !== reportTypeFilter) return false;
    if (!reportSearchQuery.trim()) return true;
    const q = reportSearchQuery.trim().toLowerCase();
    return (
      r.disasterType?.toLowerCase().includes(q) ||
      r.content?.toLowerCase().includes(q) ||
      r.reporterName?.toLowerCase().includes(q) ||
      reportAddresses[r.reportId]?.toLowerCase().includes(q)
    );
  });

  // 통계는 지금 불러온 incidents 배열로 클라이언트에서 즉석 계산
  const stats = {
    received: incidents.filter((i) => i.status === "RECEIVED").length,
    inProgress: incidents.filter((i) => i.status === "CONFIRMING" || i.status === "RESPONDING").length,
    assigned: incidents.filter((i) => i.assignedStaffId != null && i.status !== "CLOSED").length,
    urgent: incidents.filter((i) => i.severity === "HIGH" && i.status !== "CLOSED").length,
    closed: incidents.filter((i) => i.status === "CLOSED").length,
  };

  const statCards = [
    { icon: Clock, label: "접수 대기", value: stats.received, color: "text-slate-600 bg-slate-100" },
    { icon: Activity, label: "진행 중 사건", value: stats.inProgress, color: "text-blue-600 bg-blue-100" },
    { icon: ClipboardList, label: "담당 사건", value: stats.assigned, color: "text-amber-600 bg-amber-100" },
    { icon: AlertTriangle, label: "긴급 상황", value: stats.urgent, color: "text-red-600 bg-red-100" },
    { icon: CheckCircle2, label: "해결 완료", value: stats.closed, color: "text-emerald-600 bg-emerald-100" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* 사이드바 */}
      <aside className="w-56 bg-[#0F2540] text-slate-300 flex flex-col shrink-0">
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
              onClick={() => key && setActiveNav(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                activeNav === key ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5"
              } cursor-pointer`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 */}
      <div className="flex-1 min-w-0">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 bg-slate-50 rounded-lg px-3 py-2 w-80">
            <Search className="w-4 h-4" />
            <span className="text-sm">사건번호, 지역, 담당자 검색</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={activeNav === "reports" ? loadReports : loadIncidents}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Bell className="w-4 h-4 text-slate-400" />
            <button onClick={onBackToHome} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
              시민 홈으로
            </button>
          </div>
        </header>

        {activeNav === "dashboard" && (
          <main className="p-6">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}

            {/* 통계 카드 */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              {statCards.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-2xl font-extrabold text-[#0F2540]">{value}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* 지도 + 목록 */}
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-[#0F2540] mb-3">실시간 사고 현황 지도</h3>
                <div ref={mapRef} className="w-full rounded-xl overflow-hidden" style={{ height: 340 }} />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-[#0F2540] mb-3">담당 사건 목록</h3>
                {loading ? (
                  <p className="text-sm text-slate-400">불러오는 중...</p>
                ) : incidents.length === 0 ? (
                  <p className="text-sm text-slate-400">등록된 Incident가 없습니다.</p>
                ) : (
                  <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {incidents.map((inc) => (
                      <li
                        key={inc.incidentId}
                        onClick={() => {
                          setActiveNav("incidents");
                          openIncidentDetail(inc.incidentId);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition ${
                          selectedIncidentId === inc.incidentId
                            ? "border-[#0F2540] bg-slate-50"
                            : "border-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-700 truncate">{inc.title}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-2 ${STATUS_STYLE[inc.status] || ""}`}>
                            {STATUS_LABEL[inc.status] || inc.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{inc.region}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </main>
        )}

        {activeNav === "reports" && (
          <main className="p-6">
            {reportError && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{reportError}</div>
            )}

            <div className="space-y-6">
              {/* 요약 통계 - 총 건수 + 재난유형별 건수. 클릭하면 아래 목록이 해당 유형만 필터링됨 */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setReportTypeFilter(null)}
                  className={`text-left bg-white rounded-xl border px-4 py-2.5 min-w-[120px] transition ${
                    reportTypeFilter === null ? "border-red-300 ring-1 ring-red-200" : "border-slate-200 hover:border-slate-300"
                  } cursor-pointer`}
                >
                  <div className="text-lg font-extrabold text-red-600">{reports.length}</div>
                  <div className="text-xs text-slate-400">미연결 제보 총 건수</div>
                </button>
                {Object.entries(reportTypeCounts).map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setReportTypeFilter(type)}
                    className={`text-left bg-white rounded-xl border px-4 py-2.5 min-w-[100px] transition ${
                      reportTypeFilter === type ? "border-[#0F2540] ring-1 ring-slate-300" : "border-slate-200 hover:border-slate-300"
                    } cursor-pointer`}
                  >
                    <div className="text-lg font-extrabold text-[#0F2540]">{count}</div>
                    <div className="text-xs text-slate-400">{type}</div>
                  </button>
                ))}
              </div>

              {/* 미연결 제보 목록 - 전체 너비 테이블 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-[#0F2540] mb-3">
                  사건에 연결되지 않은 제보 {reportTypeFilter && `- ${reportTypeFilter}`}
                </h3>
                <div className="flex items-center gap-2 text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-3 max-w-md">
                  <Search className="w-4 h-4" />
                  <input
                    type="text"
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    placeholder="재난유형, 내용, 신고자, 주소 검색"
                    className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none w-full"
                  />
                </div>
                {reportsLoading ? (
                  <p className="text-sm text-slate-400">불러오는 중...</p>
                ) : filteredReports.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {reportSearchQuery || reportTypeFilter ? "검색 결과가 없습니다." : "연결 대기 중인 제보가 없습니다."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                          <th className="py-2 pr-4 font-semibold">재난유형</th>
                          <th className="py-2 pr-4 font-semibold">내용</th>
                          <th className="py-2 pr-4 font-semibold">신고자</th>
                          <th className="py-2 pr-4 font-semibold">접수일시</th>
                          <th className="py-2 pr-4 font-semibold">주소</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.map((r) => (
                          <tr
                            key={r.reportId}
                            onClick={() => openReportCandidates(r.reportId)}
                            className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${
                              selectedReportId === r.reportId ? "bg-slate-50" : ""
                            }`}
                          >
                            <td className="py-2.5 pr-4 font-semibold text-slate-700">{r.disasterType}</td>
                            <td className="py-2.5 pr-4 text-slate-500 max-w-xs truncate">{r.content}</td>
                            <td className="py-2.5 pr-4 text-slate-500">{r.reporterName || `#${r.memberId}`}</td>
                            <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(r.createdAt)}</td>
                            <td className="py-2.5 pr-4 text-slate-500">
                              {reportAddresses[r.reportId] || "확인 중..."}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 아래: 제보 상세 + 병합 후보 (선택 시에만 채워짐) */}
              <div className="grid grid-cols-2 gap-6">
                {selectedReport && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h3 className="font-bold text-[#0F2540] mb-3">제보 상세</h3>

                    {selectedReport.photoUrl && (
                      <img
                        src={`http://localhost:8080${selectedReport.photoUrl}`}
                        alt="제보 첨부 사진"
                        className="w-full max-h-96 object-contain bg-slate-100 rounded-lg mb-4"
                      />
                    )}

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <span className="text-xs text-slate-400 block mb-0.5">재난유형</span>
                        {selectedReport.disasterType}
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block mb-0.5">접수 시각</span>
                        {formatDateTime(selectedReport.createdAt)}
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 block mb-0.5">현장 상황</span>
                        {selectedReport.content || "-"}
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 block mb-0.5">위치</span>
                        {reportAddresses[selectedReport.reportId] || "주소 확인 중..."}
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block mb-0.5">제보자</span>
                        {selectedReport.reporterName || `#${selectedReport.memberId}`}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <h3 className="font-bold text-[#0F2540] mb-1">병합 후보 사건</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    같은 재난유형 · 최근 30분 이내 · 반경 500m 조건으로 찾은 후보입니다. 담당자가 확인 후 직접 연결합니다.
                  </p>

                  {!selectedReport ? (
                    <p className="text-sm text-slate-400">왼쪽에서 제보를 먼저 선택하세요.</p>
                  ) : candidatesLoading ? (
                    <p className="text-sm text-slate-400">후보를 찾는 중...</p>
                  ) : candidates.length === 0 ? (
                    <div>
                      <p className="text-sm text-slate-400 mb-3">관련된 기존 사건이 없습니다. 새 사건으로 등록해야 합니다.</p>
                      <button
                        onClick={() => startNewIncidentFromReport(selectedReport)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-lg px-3 py-2 cursor-pointer"
                      >
                        이 제보로 새 사건 만들기
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {candidates.map((inc) => (
                        <li
                          key={inc.incidentId}
                          className="p-3 rounded-lg border border-slate-100 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-700">{inc.title}</div>
                            <p className="text-xs text-slate-400">
                              #{inc.incidentId} · {inc.region} ·{" "}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[inc.status] || ""}`}>
                                {STATUS_LABEL[inc.status] || inc.status}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => handleLinkReport(inc.incidentId)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-lg px-3 py-2 cursor-pointer"
                          >
                            <Link2 className="w-3.5 h-3.5" /> 이 사건에 연결
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </main>
        )}

        {activeNav === "incidents" && (
          <main className="p-6">
            <div className="space-y-6">
              {/* 기존 사건 목록 - 전체 너비 테이블 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-[#0F2540] mb-3">기존 사건 목록</h3>
                <div className="flex items-center gap-2 text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-3 max-w-md">
                  <Search className="w-4 h-4" />
                  <input
                    type="text"
                    value={incidentSearchQuery}
                    onChange={(e) => setIncidentSearchQuery(e.target.value)}
                    placeholder="사건명, 지역, 재난유형 검색"
                    className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none w-full"
                  />
                </div>

                {loading ? (
                  <p className="text-sm text-slate-400">불러오는 중...</p>
                ) : filteredIncidents.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {incidentSearchQuery ? "검색 결과가 없습니다." : "등록된 사건이 없습니다."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                          <th className="py-2 pr-4 font-semibold">사건명</th>
                          <th className="py-2 pr-4 font-semibold">재난유형</th>
                          <th className="py-2 pr-4 font-semibold">지역</th>
                          <th className="py-2 pr-4 font-semibold">위험도</th>
                          <th className="py-2 pr-4 font-semibold">접수일시</th>
                          <th className="py-2 pr-4 font-semibold">담당자</th>
                          <th className="py-2 pr-4 font-semibold">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIncidents.map((inc) => (
                          <tr
                            key={inc.incidentId}
                            onClick={() => openIncidentDetail(inc.incidentId)}
                            className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${
                              selectedIncidentId === inc.incidentId ? "bg-slate-50" : ""
                            }`}
                          >
                            <td className="py-2.5 pr-4 font-semibold text-slate-700">{inc.title}</td>
                            <td className="py-2.5 pr-4 text-slate-500">{inc.disasterType}</td>
                            <td className="py-2.5 pr-4 text-slate-500">{inc.region}</td>
                            <td className="py-2.5 pr-4 text-slate-500">{inc.severity}</td>
                            <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(inc.createdAt)}</td>
                            <td className="py-2.5 pr-4 text-slate-500">
                              {inc.assignedStaffId ? `#${inc.assignedStaffId}` : "미배정"}
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[inc.status] || ""}`}>
                                {STATUS_LABEL[inc.status] || inc.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 사건 선택 시 상세 패널 */}
              <div>
                  {selectedIncident ? (
                <div className="bg-white rounded-2xl border-2 border-[#0F2540] p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#0F2540]">{selectedIncident.title}</h3>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[selectedIncident.status] || ""}`}>
                          {STATUS_LABEL[selectedIncident.status] || selectedIncident.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        #{selectedIncident.incidentId} · {selectedIncident.region} · {selectedIncident.disasterType}
                      </p>
                    </div>
                    <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {detailError && (
                    <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">{detailError}</div>
                  )}

                  <div className="space-y-6">
                    {/* 처리 타임라인 */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 mb-2">처리 타임라인</h4>
                      {timelineLoading ? (
                        <p className="text-xs text-slate-400">불러오는 중...</p>
                      ) : timeline.length === 0 ? (
                        <p className="text-xs text-slate-400">아직 기록이 없습니다.</p>
                      ) : (
                        <ol className="relative border-l-2 border-slate-200 ml-2">
                          {timeline.map((log) => (
                            <li key={log.logId} className="mb-3 ml-4 last:mb-0">
                              <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-[#0F2540] border-2 border-white" />
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-700">
                                  {STATUS_LABEL[log.newStatus] || log.newStatus}
                                </span>
                                <span className="text-[11px] text-slate-400">{formatDateTime(log.changedAt)}</span>
                              </div>
                              {log.memo && <div className="text-xs text-slate-500">{log.memo}</div>}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    {/* 연결된 제보 - 상세 필드(신고자/날짜/재난유형/주소/내용) 카드로 표시 */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 mb-2">
                        연결된 제보 {linkedReports.length > 0 && `(${linkedReports.length}건)`}
                      </h4>
                      {linkedReportsLoading ? (
                        <p className="text-xs text-slate-400">불러오는 중...</p>
                      ) : linkedReports.length === 0 ? (
                        <p className="text-xs text-slate-400">연결된 제보가 없습니다.</p>
                      ) : (
                        <ul className="space-y-3">
                          {linkedReports.map((r) => (
                            <li key={r.reportId} className="p-3 rounded-lg border border-slate-100">
                              <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm mb-2">
                                <div>
                                  <span className="text-xs text-slate-400 block mb-0.5">신고자</span>
                                  {r.reporterName || `#${r.memberId}`}
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 block mb-0.5">접수일시</span>
                                  {formatDateTime(r.createdAt)}
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 block mb-0.5">재난유형</span>
                                  {r.disasterType} · 제보 #{r.reportId}
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 block mb-0.5">주소</span>
                                  {reportAddresses[r.reportId] || "확인 중..."}
                                </div>
                              </div>
                              <div>
                                <span className="text-xs text-slate-400 block mb-0.5">현장 상황</span>
                                <p className="text-sm text-slate-700">{r.content || "-"}</p>
                              </div>
                              {r.photoUrl && (
                                <div className="flex justify-end mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setViewingPhotoUrl(`http://localhost:8080${r.photoUrl}`)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-full px-3 py-1.5 cursor-pointer"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5" /> 첨부된 사진 보기
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* 담당자 */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 mb-2">담당자</h4>
                      {selectedIncident.assignedStaffId ? (
                        <p className="text-sm text-slate-700">#{selectedIncident.assignedStaffId} 배정됨</p>
                      ) : (
                        <button
                          onClick={handleAssignToMe}
                          disabled={actionLoading}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> 내가 담당하기
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 상태 전환 입력 - 패널 맨 아래, 전체 너비 */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    {nextStatus ? (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 mb-2">
                          다음 상태로 전환: {STATUS_LABEL[nextStatus]}
                        </h4>
                        <textarea
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                          placeholder={nextStatus === "CLOSED" ? "종료 사유를 입력하세요 (필수)" : "조치내용을 입력하세요"}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#0F2540]"
                          rows={2}
                        />
                        <button
                          onClick={handleChangeStatus}
                          disabled={actionLoading}
                          className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white text-sm font-bold rounded-lg py-2 disabled:opacity-50 cursor-pointer"
                        >
                          {STATUS_LABEL[nextStatus]}(으)로 전환
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">더 이상 전환할 상태가 없습니다.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 h-full flex items-center justify-center">
                  <p className="text-sm text-slate-400">위 목록에서 사건을 선택하면 상세 정보가 여기에 표시됩니다.</p>
                </div>
              )}
                </div>
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
              <h3 className="font-bold text-[#0F2540]">새 사건(Incident) 등록</h3>
              <button
                onClick={() => {
                  setShowCreateIncidentModal(false);
                  setLinkAfterCreateReportId(null);
                  setCreateError("");
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              재난유형·지역·위치가 이 제보 정보로 자동 채워져 있습니다. 필요하면 지역은 직접 수정해도 됩니다.
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
                <label className="block text-xs font-semibold text-slate-500 mb-1">지역</label>
                <input
                  type="text"
                  value={newIncident.region}
                  onChange={(e) => setNewIncident({ ...newIncident, region: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  placeholder="예: 대전 유성구 궁동"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">위도</label>
                  <input
                    type="text"
                    value={newIncident.latitude}
                    onChange={(e) => setNewIncident({ ...newIncident, latitude: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">경도</label>
                  <input
                    type="text"
                    value={newIncident.longitude}
                    onChange={(e) => setNewIncident({ ...newIncident, longitude: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                  />
                </div>
              </div>

              {createError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}

              <button
                type="submit"
                disabled={createLoading}
                className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
              >
                {createLoading ? "등록 중..." : "등록하고 제보 연결하기"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
