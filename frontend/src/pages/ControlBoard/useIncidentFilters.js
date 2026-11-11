import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";
import { getDefaultDateRange } from "./constants";
import { createDateRangeHandlers } from "./dateRangeFilter";

const INCIDENT_PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 300; // 입력이 멈춘 뒤에만 서버 검색 (글자마다 요청 방지)

const EMPTY_INCIDENT_COUNTS = { ALL: 0, RECEIVED: 0, CONFIRMING: 0, RESPONDING: 0, RECOVERING: 0, CLOSED: 0 };

// 서버 상태별 건수 → 화면 탭/카드 키 형태
const toIncidentCounts = (statusCounts) => (statusCounts ? {
  ALL: statusCounts.total,
  RECEIVED: statusCounts.receivedCount,
  CONFIRMING: statusCounts.confirmingCount,
  RESPONDING: statusCounts.respondingCount,
  RECOVERING: statusCounts.recoveringCount,
  CLOSED: statusCounts.closedCount,
} : EMPTY_INCIDENT_COUNTS);

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

  // 서버 검색 결과 (현재 페이지 목록 + 조건에 맞는 전체 건수 + 상태별 건수)
  const [pagedIncidents, setPagedIncidents] = useState([]);
  const [incidentTotalCount, setIncidentTotalCount] = useState(0);
  const [incidentCounts, setIncidentCounts] = useState(EMPTY_INCIDENT_COUNTS);
  const [incidentListLoaded, setIncidentListLoaded] = useState(false);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(incidentSearchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [incidentSearchQuery]);

  // 검색어가 바뀌어서 지금 선택된 사건이 검색어에 안 맞게 되면 상세패널도 같이 닫는다.
  // 다음 검색 응답의 selectedIncluded(검색어 조건만 확인)로 판단
  const selectedIncidentIdRef = useRef(selectedIncidentId);
  useEffect(() => {
    selectedIncidentIdRef.current = selectedIncidentId;
  }, [selectedIncidentId]);
  const searchChangedRef = useRef(false);
  const isFirstSearchRef = useRef(true);
  useEffect(() => {
    if (isFirstSearchRef.current) {
      isFirstSearchRef.current = false;
      return;
    }
    searchChangedRef.current = true;
  }, [debouncedSearchQuery]);

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

  // 사건 관리 탭 - 검색/필터/정렬(접수일시 기준)/페이징은 서버에서 처리
  // incidents가 새로 들어오면(소켓 갱신·상태 변경·사건 생성) 같은 조건으로 다시 조회
  const requestSeqRef = useRef(0);
  useEffect(() => {
    const requestSeq = ++requestSeqRef.current;
    const searchChanged = searchChangedRef.current;
    const checkSelected = searchChanged && selectedIncidentIdRef.current != null;

    const params = new URLSearchParams({
      status: incidentStatusFilter,
      type: incidentTypeFilter,
      region: incidentRegionFilter,
      severity: incidentSeverityFilter,
      sort: incidentSortOrder,
      page: String(incidentPage),
      size: String(INCIDENT_PAGE_SIZE),
    });
    if (debouncedSearchQuery) params.set("q", debouncedSearchQuery);
    if (appliedIncidentDateFrom) params.set("from", appliedIncidentDateFrom);
    if (appliedIncidentDateTo) params.set("to", appliedIncidentDateTo);
    if (checkSelected) params.set("selectedId", String(selectedIncidentIdRef.current));

    authFetch(`/api/incidents/search?${params.toString()}`)
      .then((data) => {
        // 늦게 도착한 이전 요청 응답은 버림 (빠르게 입력할 때 옛 결과로 덮이는 것 방지)
        if (requestSeq !== requestSeqRef.current) return;
        if (searchChanged) searchChangedRef.current = false;

        const content = Array.isArray(data?.content) ? data.content : [];
        const totalCount = data?.totalCount ?? 0;
        setPagedIncidents(content);
        setIncidentTotalCount(totalCount);
        setIncidentCounts(toIncidentCounts(data?.statusCounts));

        if (checkSelected && data?.selectedIncluded === false) closeDetail();

        // 다른 곳에서 사건이 줄어 지금 페이지가 비면 마지막 페이지로 이동
        const lastPage = Math.max(1, Math.ceil(totalCount / INCIDENT_PAGE_SIZE));
        if (content.length === 0 && incidentPage > lastPage) setIncidentPage(lastPage);
      })
      .catch(() => {})
      .finally(() => {
        if (requestSeq === requestSeqRef.current) setIncidentListLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchQuery,
    incidentStatusFilter,
    incidentTypeFilter,
    incidentRegionFilter,
    incidentSeverityFilter,
    appliedIncidentDateFrom,
    appliedIncidentDateTo,
    incidentSortOrder,
    incidentPage,
    incidents,
  ]);

  // 접수 순번 - 서버가 전체 사건 기준으로 매긴 값(incidentRank)을 사건 ID로 찾을 수 있게 모아둠
  // (사건 상세 헤더, 제보 관리의 연결 사건 표시, 일괄 병합 모달에서 사용)
  const incidentRank = new Map(incidents.map((inc) => [inc.incidentId, inc.incidentRank]));

  const incidentTotalPages = Math.max(1, Math.ceil(incidentTotalCount / INCIDENT_PAGE_SIZE));

  return {
    incidentSearchQuery, setIncidentSearchQuery, incidentSortOrder, setIncidentSortOrder,
    incidentStatusFilter, setIncidentStatusFilter, incidentTypeFilter, setIncidentTypeFilter,
    incidentRegionFilter, setIncidentRegionFilter, incidentSeverityFilter, setIncidentSeverityFilter,
    incidentDateFrom, incidentDateTo, incidentPage, setIncidentPage, handleIncidentDateFromChange,
    handleIncidentDateFromBlur, handleIncidentDateToChange, handleIncidentDateToBlur, applyIncidentDateFilter,
    incidentTotalCount, incidentCounts, incidentRank, incidentTotalPages, pagedIncidents,
    incidentListLoading: !incidentListLoaded,
  };
}
