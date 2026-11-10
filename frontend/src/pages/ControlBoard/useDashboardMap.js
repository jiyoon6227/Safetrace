import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";
import { buildMarkerImage } from "./constants";

export function useDashboardMap({
  activeNav, setActiveNav, incidents, setError, openIncidentDetail, setSelectedReportId,
}) {
  // 지도 DOM이 다시 마운트되는 경우(HMR/탭 재진입 등)도 감지할 수 있도록 callback ref 사용
  const mapContainerRef = useRef(null);
  const mapElementRef = useRef(null);
  const [mapMountVersion, setMapMountVersion] = useState(0);
  const mapRef = useCallback((node) => {
    mapContainerRef.current = node;
    setMapMountVersion((v) => v + 1);
  }, []);

  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null); // 사건 마커 클러스터링용 - 가까운 마커는 숫자 배지로 뭉쳐서 표시

  // 대시보드 - 지도 재난유형 필터, 최근 활동용 제보 목록
  const [mapTypeFilter, setMapTypeFilter] = useState(null); // null = 전체 (Incident.status 값 중 하나)
  const [mapUrgentOnly, setMapUrgentOnly] = useState(false); // 긴급(심각도) - 상태 필터와 별개로 겹쳐 켤 수 있는 오버레이 토글
  const [dashboardReports, setDashboardReports] = useState([]);
  useEffect(() => {
    if (activeNav !== "dashboard") return;
    authFetch("/api/reports").then(setDashboardReports).catch(() => {});
  }, [activeNav]);

  // 지도에 표시할 레이어 on/off - 대응자원/대피소/CCTV는 아직 실데이터 연동 전이라 체크박스만 두고 비활성 처리
  const [mapLayers, setMapLayers] = useState({ reports: true, incidents: true });
  const [mapType, setMapType] = useState("normal"); // "normal" | "skyview"
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao) return;
    map.setMapTypeId(mapType === "skyview" ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP);
  }, [mapType]);

  useEffect(() => {
    if (activeNav !== "dashboard") return; // 대시보드 탭이 아닐 땐 지도 그릴 필요 없음

    const container = mapContainerRef.current;
    if (!container) return;

    if (!window.kakao || !window.kakao.maps) {
      setError("카카오맵 SDK를 불러오지 못했습니다.");
      return;
    }

    let cancelled = false;

    window.kakao.maps.load(() => {
      if (cancelled || !mapContainerRef.current) return;

      const currentContainer = mapContainerRef.current;

      // 같은 지도 DOM이면 새 지도를 만들지 않고 크기만 다시 계산한다.
      if (mapInstanceRef.current && mapElementRef.current === currentContainer) {
        requestAnimationFrame(() => {
          if (cancelled || !mapInstanceRef.current) return;
          window.kakao.maps.event.trigger(mapInstanceRef.current, "resize");
          drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
        });
        return;
      }

      // DashboardTab이 HMR 등으로 다시 마운트되어 지도 div가 바뀐 경우에만 새 DOM에 지도 재연결
      clustererRef.current?.clear();
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      const center = new window.kakao.maps.LatLng(36.3504, 127.3845);
      const map = new window.kakao.maps.Map(currentContainer, { center, level: 8 });

      mapInstanceRef.current = map;
      mapElementRef.current = currentContainer;

      // 가까운 마커 여러 개가 겹칠 때 숫자 배지 하나로 묶어 보여주고, 확대하면 자동으로 풀림
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6, // 이 레벨보다 확대하면 클러스터 안 묶고 마커 그대로 표시
        disableClickZoom: false, // 클러스터 클릭 시 카카오 기본 동작(자동 확대)
      });

      // 현재 지도 유형 유지
      map.setMapTypeId(
        mapType === "skyview"
          ? window.kakao.maps.MapTypeId.HYBRID
          : window.kakao.maps.MapTypeId.ROADMAP
      );

      requestAnimationFrame(() => {
        if (cancelled) return;
        window.kakao.maps.event.trigger(map, "resize");
        // 지도 초기화만 담당, 사건 데이터는 별도 effect에서 조회 (rAF 취소 시 loadIncidents 미실행 방지)
        drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
      });
    });

    return () => {
      cancelled = true;
    };
    // 지도 DOM이 실제로 다시 마운트될 때만 재초기화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, mapMountVersion]);

  const drawMarkers = (
    incidentsData = incidents,
    reportsData = dashboardReports,
    statusFilter = mapTypeFilter,
    layers = mapLayers,
    urgentOnly = mapUrgentOnly
  ) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    // 사건 마커는 클러스터러가 들고 있으므로 지도에서 직접 떼지 않고 클러스터러를 비움
    clustererRef.current?.clear();
    // 제보 마커(클러스터 대상 아님)만 markersRef로 직접 관리
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 사건 상태 5개(RECEIVED/CONFIRMING/RESPONDING/RECOVERING/CLOSED)를 필터 칩 키에 그대로 매핑
    // (CLOSED만 칩 라벨이 "해결/RESOLVED"라 키를 맞춰줌). 긴급은 상태가 아니라 urgentOnly로 별도 처리
    const incidentCategoryOf = (inc) => (inc.status === "CLOSED" ? "RESOLVED" : inc.status);
    const isUrgent = (inc) => inc.status !== "CLOSED" && inc.severity === "HIGH";

    const showIncidents = layers.incidents;
    // 제보 마커는 상태 필터 미선택(전체)일 때만 표시 (제보는 사건 상태 칩 대상 아님)
    const showReports = layers.reports && !statusFilter;

    const visibleIncidents = showIncidents
      ? incidentsData.filter(
          (inc) =>
            inc.latitude != null &&
            inc.longitude != null &&
            (!statusFilter || incidentCategoryOf(inc) === statusFilter) &&
            (!urgentOnly || isUrgent(inc))
        )
      : [];
    const visibleReports = showReports
      ? reportsData.filter((r) => !r.incidentId && r.latitude != null && r.longitude != null)
      : [];

    const incidentMarkers = visibleIncidents.map((inc) => {
      const position = new window.kakao.maps.LatLng(inc.latitude, inc.longitude);
      const markerImage = buildMarkerImage(inc);
      const marker = new window.kakao.maps.Marker({ position, image: markerImage });
      marker.addListener?.("click", () => {
        setActiveNav("incidents");
        openIncidentDetail(inc.incidentId);
      });
      return marker;
    });
    // 겹치는 마커는 클러스터러가 숫자 배지로 묶어서 보여주고, 확대하거나 배지를 클릭하면 자동으로 풀림
    clustererRef.current?.addMarkers(incidentMarkers);

    // 제보 마커는 아직 사건 마커와 구분되는 전용 이미지가 없어 카카오 기본 마커로 표시함(클러스터 대상 아님)
    visibleReports.forEach((r) => {
      const position = new window.kakao.maps.LatLng(r.latitude, r.longitude);
      const marker = new window.kakao.maps.Marker({ position, map });
      marker.addListener?.("click", () => {
        setActiveNav("reports");
        setSelectedReportId(r.reportId);
      });
      markersRef.current.push(marker);
    });

    // 필터링해서 보고 있는 마커들이 항상 화면 안에 들어오도록 지도 범위를 자동으로 맞춤
    const visible = [...visibleIncidents, ...visibleReports];
    if (visible.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      visible.forEach((item) => bounds.extend(new window.kakao.maps.LatLng(item.latitude, item.longitude)));
      map.setBounds(bounds);
      if (visible.length === 1 && map.getLevel() < 5) map.setLevel(5);
    }
  };

  const handleZoom = (delta) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setLevel(map.getLevel() + delta);
  };

  // 지도를 다시 현재 필터 기준 사건들이 전부 보이는 범위로 되돌림
  const handleLocateReset = () => {
    drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
  };

  return {
    mapRef, mapTypeFilter, setMapTypeFilter, mapUrgentOnly, setMapUrgentOnly, dashboardReports, mapLayers,
    setMapLayers, mapType, setMapType, drawMarkers, handleZoom, handleLocateReset,
  };
}
