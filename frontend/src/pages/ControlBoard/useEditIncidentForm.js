import { useState } from "react";
import { authFetch } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function useEditIncidentForm({
  selectedIncidentIdRef, loadIncidents, openIncidentDetail, setToast,
}) {
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

  return {
    editIncident, setEditIncident, showEditIncidentModal, setShowEditIncidentModal, editLoading, editError,
    setEditError, editGeocoding, openEditIncidentModal, handleEditAddressSearch, handleUpdateIncident,
  };
}
