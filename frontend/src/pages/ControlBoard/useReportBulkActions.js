import { useState } from "react";
import { authFetch } from "../../api/client";

export function useReportBulkActions({
  reports, selectedReportIds, setSelectedReportIds, selectedReportId, setSelectedReportId, setCandidates,
  setReportError, loadReports, setToast,
}) {
  // 반려 모달 - target이 숫자 reportId면 단건, "bulk"면 체크된 제보 전체
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  // 체크박스로 여러 제보를 골라 "합치기"할 때 쓰는 모달 상태
  const [bulkMergeOpen, setBulkMergeOpen] = useState(false);
  const [bulkMergeCandidates, setBulkMergeCandidates] = useState([]);
  const [bulkMergeLoading, setBulkMergeLoading] = useState(false);
  const [bulkMergeSubmitting, setBulkMergeSubmitting] = useState(false);

  // 반려 모달 열기 - target이 숫자 reportId면 단건, "bulk"면 체크된 제보 전체
  const openRejectModal = (target) => {
    setRejectTarget(target);
    setRejectReasonInput("");
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

  return {
    rejectTarget, setRejectTarget, rejectReasonInput, setRejectReasonInput, rejectSubmitting, bulkMergeOpen,
    setBulkMergeOpen, bulkMergeCandidates, bulkMergeLoading, bulkMergeSubmitting, openRejectModal,
    submitReject, toggleReportSelected, openBulkMerge, handleBulkLinkToIncident,
  };
}
