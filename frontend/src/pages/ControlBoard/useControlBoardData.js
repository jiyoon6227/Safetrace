import { useEffect } from "react";
import { authFetch } from "../../api/client";
import { connectIncidentSocket } from "../../api/socket";

export function useControlBoardData({
  activeNav, incidents, drawMarkers, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly, setIncidents,
  setLoading, setError, loadReports, setSelectedReportId, setCandidates, selectedIncidentIdRef,
  openIncidentDetail,
}) {
  const loadIncidents = async () => {
    setLoading(true);
    setError("");
    try {
      // 사건 데이터는 지도 로딩과 분리해서 독립적으로 조회한다.
      // /api/reports는 dashboardReports effect가 따로 담당하므로 여기서 중복 호출하지 않는다.
      const data = await authFetch("/api/incidents");
      const nextIncidents = Array.isArray(data) ? data : [];
      setIncidents(nextIncidents);
      drawMarkers(nextIncidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ControlBoard가 새로 마운트될 때(로그인 직후뿐 아니라 메인페이지에 갔다가 다시 들어올 때도)
  // 카카오맵 초기화 여부와 상관없이 사건 목록을 즉시 가져온다.
  useEffect(() => {
    loadIncidents();
    // 최초 마운트 시 1회 실행 (수동 새로고침·소켓 갱신은 loadIncidents 사용)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상태 필터 칩 / 긴급 토글 / 표시 항목 체크박스 / 제보 목록을 바꾸면 새로 불러오지 않고 마커만 다시 그림
  useEffect(() => {
    if (activeNav !== "dashboard") return;
    drawMarkers(incidents, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTypeFilter, mapUrgentOnly, mapLayers, dashboardReports]);

  // WebSocket 연결 - 나 또는 다른 STAFF가 어디서든 사건을 만들거나 상태를 바꾸면
  // 새로고침 없이 지도/목록/통계가 자동 갱신되고, 지금 열어본 상세 패널도 같이 갱신됨.
  // 컴포넌트가 떠 있는 동안(=STAFF 화면에 있는 동안)만 연결하고, 화면 나가면 연결 정리.
  useEffect(() => {
    const socket = connectIncidentSocket((data) => {
      loadIncidents(); // 지도 마커 + 목록 + 상단 통계 카드 전부 이걸로 갱신됨

      const changedId = data.incident?.incidentId;
      if (changedId && selectedIncidentIdRef.current === changedId) {
        openIncidentDetail(changedId); // 지금 열려있는 상세가 바로 그 사건이면 타임라인/연결된 제보도 갱신
      }
    });

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeNav === "reports") {
      loadReports();
      setSelectedReportId(null);
      setCandidates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav]);

  // "사건 관리" 탭에 들어왔을 때도 기존 사건 목록을 불러온다 (지도 없이 목록만 필요하므로 loadIncidents 재사용)
  useEffect(() => {
    if (activeNav === "incidents") {
      loadIncidents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav]);

  return {
    loadIncidents,
  };
}
