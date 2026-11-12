import { useRef, useState } from "react";
import { authFetch, authUpload } from "../../api/client";
import { needsClosureConfirm } from "../../constants/resource";

export function useIncidentActions({
  currentUser, selectedIncident, nextStatus, memo, setMemo, setActionLoading, setDetailError, incidentPhotos,
  setIncidentPhotos, loadIncidents, openIncidentDetail, setToast, afterStatusChange,
}) {
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

  // 사건 종료 확인 창 - 종료할 때 출고 전 자원 요청이나 미반납 출고 건이 있으면 먼저 보여준다
  const [closurePreview, setClosurePreview] = useState(null);
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [closureError, setClosureError] = useState("");

  // 상태 변경 요청만 보낸다. cancelRequestIds는 종료 확인 창에서 담당자가 확인한 출고 전 요청 번호다.
  const sendStatus = async (cancelRequestIds) => {
    const body = { status: nextStatus, memo };
    if (cancelRequestIds && cancelRequestIds.length > 0) body.cancelRequestIds = cancelRequestIds;
    await authFetch(`/api/incidents/${selectedIncident.incidentId}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    // 종료하면 출고 전 요청이 취소되므로, 사건 상세의 자원 요청 목록도 다시 불러온다
    afterStatusChange?.(selectedIncident.incidentId);
  };

  const refreshAfterStatusChange = async () => {
    setMemo("");
    await loadIncidents();
    await openIncidentDetail(selectedIncident.incidentId);
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
      if (nextStatus === "CLOSED") {
        // 종료 전에 취소될 자원 요청이 있는지 먼저 확인한다
        const preview = await authFetch(`/api/incidents/${selectedIncident.incidentId}/closure-preview`);
        if (needsClosureConfirm(preview)) {
          // 확인 창에서 "확인하고 종료"를 눌러야 실제로 종료된다
          setClosureError("");
          setClosurePreview(preview);
          return;
        }
      }
      await sendStatus(null);
      await refreshAfterStatusChange();
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 종료 확인 창의 "확인하고 종료" - 화면에서 확인한 출고 전 요청 번호를 함께 보낸다
  const confirmClosure = async () => {
    if (!closurePreview || !selectedIncident) return;
    setClosureSubmitting(true);
    setClosureError("");
    try {
      await sendStatus((closurePreview.openRequests || []).map((request) => request.requestId));
    } catch (err) {
      // 서버 메시지를 확인 창 안에 그대로 보여준다 (그 사이 요청이 바뀐 경우 등)
      setClosureError(err.message);
      setClosureSubmitting(false);
      return;
    }
    setClosurePreview(null);
    setClosureSubmitting(false);
    try {
      await refreshAfterStatusChange();
    } catch (err) {
      setDetailError(err.message);
    }
  };

  const cancelClosure = () => {
    if (closureSubmitting) return;
    setClosurePreview(null);
    setClosureError("");
  };

  return {
    fieldPhotoUploading, fieldPhotoInputRef, MAX_INCIDENT_PHOTOS, handleFieldPhotoSelected, handleAssignToMe,
    handleChangeStatus, closurePreview, closureSubmitting, closureError, confirmClosure, cancelClosure,
  };
}
