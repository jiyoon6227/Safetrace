import { useEffect, useState } from "react";
import { authFetch } from "../../api/client";
import { REPORT_DISASTER_TYPES, getDefaultDateRange } from "./constants";
import { createDateRangeHandlers } from "./dateRangeFilter";

export function useReportManagement({
  incidents, setToast, todayStr,
}) {
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

  // 위경도 -> 실제 주소 문자열로 변환 (카카오 리버스 지오코딩)
  // DB에 ADDRESS가 없는 제보만 좌표로 역지오코딩 (하위 호환)
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

  // 활성 탭 재클릭 시 목록 재조회 + 필터(상태/유형/지역/정렬/날짜/검색어) 초기화
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

  const {
    handleDateFromChange: handleReportDateFromChange,
    handleDateFromBlur: handleReportDateFromBlur,
    handleDateToChange: handleReportDateToChange,
    handleDateToBlur: handleReportDateToBlur,
    applyDateFilter: applyReportDateFilter,
  } = createDateRangeHandlers({
    dateFrom: reportDateFrom,
    dateTo: reportDateTo,
    setDateFrom: setReportDateFrom,
    setDateTo: setReportDateTo,
    setAppliedDateFrom: setAppliedReportDateFrom,
    setAppliedDateTo: setAppliedReportDateTo,
    setPage: setReportPage,
    todayStr,
    setToast,
  });

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

  return {
    reports, reportsLoading, selectedReportId, setSelectedReportId, reportPhotos, candidates, setCandidates,
    candidatesLoading, reportError, setReportError, reportAddresses, reportSearchQuery, setReportSearchQuery,
    reportTypeFilter, setReportTypeFilter, reportRegionFilter, setReportRegionFilter, reportSortOrder,
    setReportSortOrder, reportStatusFilter, setReportStatusFilter, reportDateFrom, reportDateTo, reportPage,
    setReportPage, selectedReportIds, setSelectedReportIds, resolveReportAddress, loadReports,
    resetReportFilters, openReportCandidates, handleLinkReport, handleMarkReviewing,
    handleReportDateFromChange, handleReportDateFromBlur, handleReportDateToChange, handleReportDateToBlur,
    applyReportDateFilter, totalReports, receivedReports, linkedReportsCount, reviewingReports,
    rejectedReports, filteredReports, reportTotalPages, pagedReports, selectablePagedReports, allPageSelected,
    selectedReport, selectedLinkedIncident,
  };
}
