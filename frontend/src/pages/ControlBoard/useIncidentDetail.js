import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { STATUS_ORDER } from "./constants";

export function useIncidentDetail({
  incidents, resolveReportAddress,
}) {
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

  const closeIncidentDetail = () => {
    setSelectedIncidentId(null);
    setTimeline([]);
    setLinkedReports([]);
    setDetailError("");
    setMemo("");
    setIncidentPhotos([]);
    setLinkedReportPhotos([]);
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
  // 연결된 제보들의 첨부 사진 전체 ({ reportId, url } 목록)
  const [linkedReportPhotos, setLinkedReportPhotos] = useState([]);
  // 제보자 첨부 사진 펼침 여부 (다른 사건 선택 시 접힘)
  const [showAllLinkedReportPhotos, setShowAllLinkedReportPhotos] = useState(false);
  useEffect(() => {
    setShowAllLinkedReportPhotos(false);
  }, [selectedIncidentId]);
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
      const photoGroups = await Promise.all(
        reportsData.map((report) =>
          authFetch(`/api/reports/${report.reportId}/photos`)
            .then((urls) => urls.map((url) => ({ reportId: report.reportId, url })))
            .catch(() => (report.photoUrl ? [{ reportId: report.reportId, url: report.photoUrl }] : []))
        )
      );
      setLinkedReportPhotos(photoGroups.flat());
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

  return {
    selectedIncidentId, setSelectedIncidentId, selectedIncidentIdRef, timeline, linkedReports,
    linkedReportsLoading, memo, setMemo, actionLoading, setActionLoading, detailError, setDetailError,
    closeIncidentDetail, toggleIncidentDetail, incidentPhotos, setIncidentPhotos, linkedReportPhotos,
    showAllLinkedReportPhotos, setShowAllLinkedReportPhotos, showLinkedReportsModal,
    setShowLinkedReportsModal, linkedReportsModalPage, setLinkedReportsModalPage,
    linkedReportsModalTotalPages, pagedLinkedReports, openIncidentDetail, closeDetail, selectedIncident,
    nextStatus,
  };
}
