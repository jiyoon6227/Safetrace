import { useEffect, useState } from "react";
import { getDefaultDateRange } from "./constants";
import { createDateRangeHandlers } from "./dateRangeFilter";

export function useIncidentFilters({
  incidents, selectedIncidentId, closeDetail, setToast, todayStr,
}) {
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

  const {
    handleDateFromChange: handleIncidentDateFromChange,
    handleDateFromBlur: handleIncidentDateFromBlur,
    handleDateToChange: handleIncidentDateToChange,
    handleDateToBlur: handleIncidentDateToBlur,
    applyDateFilter: applyIncidentDateFilter,
  } = createDateRangeHandlers({
    dateFrom: incidentDateFrom,
    dateTo: incidentDateTo,
    setDateFrom: setIncidentDateFrom,
    setDateTo: setIncidentDateTo,
    setAppliedDateFrom: setAppliedIncidentDateFrom,
    setAppliedDateTo: setAppliedIncidentDateTo,
    setPage: setIncidentPage,
    todayStr,
    setToast,
  });

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
      // 접수일시(createdAt) 기준 정렬 (updatedAt 기준 시 수정할 때마다 행 위치 변동)
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

  return {
    incidentSearchQuery, setIncidentSearchQuery, incidentSortOrder, setIncidentSortOrder,
    incidentStatusFilter, setIncidentStatusFilter, incidentTypeFilter, setIncidentTypeFilter,
    incidentRegionFilter, setIncidentRegionFilter, incidentSeverityFilter, setIncidentSeverityFilter,
    incidentDateFrom, incidentDateTo, incidentPage, setIncidentPage, handleIncidentDateFromChange,
    handleIncidentDateFromBlur, handleIncidentDateToChange, handleIncidentDateToBlur, applyIncidentDateFilter,
    filteredIncidents, incidentCounts, incidentRank, incidentTotalPages, pagedIncidents,
  };
}
