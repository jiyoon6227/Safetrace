import { useEffect, useState } from "react";
import { authFetch, authUpload } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function useCreateIncidentForm({
  reports, reportAddresses, selectedReportIds, setSelectedReportIds, setBulkMergeOpen, loadReports,
  loadIncidents, setToast,
}) {
  // "새 사건으로 만들기"를 여러 제보 선택 상태에서 눌렀을 때, 생성 후 이 배열 전체를 연결해야 함
  const [bulkLinkReportIds, setBulkLinkReportIds] = useState(null);

  // 사건 관리 탭 상태 (신규 Incident 생성)
  const [newIncident, setNewIncident] = useState({
    title: "", disasterType: "침수", severity: "MEDIUM", region: "", latitude: "", longitude: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [linkAfterCreateReportId, setLinkAfterCreateReportId] = useState(null);
  const [showCreateIncidentModal, setShowCreateIncidentModal] = useState(false);
  useEscapeKey(showCreateIncidentModal, () => {
    setShowCreateIncidentModal(false);
    setLinkAfterCreateReportId(null);
    setCreateError("");
  });

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
    // 변환된 주소가 있으면 지역란에 채우기 (미완료 시 아래 useEffect에서 채움)
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

  return {
    newIncident, setNewIncident, createLoading, createError, setCreateError, linkAfterCreateReportId,
    setLinkAfterCreateReportId, showCreateIncidentModal, setShowCreateIncidentModal, bulkLinkReportIds,
    setBulkLinkReportIds, startBulkNewIncident, startNewIncidentFromReport, startNewIncidentDirect, geocoding,
    setPhotoFile, photoPreviewUrl, setPhotoPreviewUrl, handleAddressSearch, handlePhotoChange,
    handleRemovePhoto, handleCreateIncident,
  };
}
