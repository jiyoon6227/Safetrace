import { useRef, useState } from "react";
import { authFetch, authUpload } from "../../api/client";

export function useIncidentActions({
  currentUser, selectedIncident, nextStatus, memo, setMemo, setActionLoading, setDetailError, incidentPhotos,
  setIncidentPhotos, loadIncidents, openIncidentDetail, setToast,
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

  return {
    fieldPhotoUploading, fieldPhotoInputRef, MAX_INCIDENT_PHOTOS, handleFieldPhotoSelected, handleAssignToMe,
    handleChangeStatus,
  };
}
