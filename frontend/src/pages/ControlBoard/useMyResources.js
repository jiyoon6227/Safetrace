import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

export const MY_RESOURCES_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300; // 입력이 멈춘 뒤에만 서버 검색 (글자마다 요청 방지)

// STAFF "자원 관리" 탭의 데이터: 내가 보낸 전체 요청(상태·사건·검색어 조건, 페이지)과 상태별 건수,
// 요청 취소, 도착 확인, 반납 신청 모달, 요청별 처리 이력(카드 펼치기)
// 검색·페이징·상태별 건수는 서버가 처리하고, 여기서는 조건을 보내고 결과를 받아 둘 뿐이다.
export function useMyResources({ initialIncidentId, setToast }) {
  const [status, setStatus] = useState("");
  const [incidentId, setIncidentId] = useState(initialIncidentId ?? null);
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null); // { total, counts: { 상태: 건수 } } - 상태 조건만 뺀 건수
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 처리 중인 요청 ID. 처리 중에는 다른 버튼을 눌러도 무시한다(중복 전송 방지).
  const [actingId, setActingId] = useState(null);

  // 요청별 처리 이력: { [requestId]: { open, loading, error, steps } }
  const [histories, setHistories] = useState({});
  const historiesRef = useRef({});
  useEffect(() => {
    historiesRef.current = histories;
  }, [histories]);

  // 반납 신청 모달: 대상 요청, 그 요청의 신청 내역, 전송 상태
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnApplications, setReturnApplications] = useState([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnLoadError, setReturnLoadError] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSubmitError, setReturnSubmitError] = useState("");
  const returnSeq = useRef(0);

  // 검색어는 입력이 멈춘 뒤에 반영하고 1페이지로 돌아간다
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  // 필터를 빠르게 바꿨을 때 늦게 도착한 이전 응답이 화면을 덮어쓰지 않도록 순번을 둔다
  const loadSeq = useRef(0);
  const summarySeq = useRef(0);

  const loadList = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: String(MY_RESOURCES_PAGE_SIZE) });
      if (status) params.set("status", status);
      if (incidentId) params.set("incidentId", String(incidentId));
      if (keyword) params.set("keyword", keyword);
      const data = await authFetch(`/api/resources/requests?${params.toString()}`);
      if (seq !== loadSeq.current) return;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setItems([]);
      setTotal(0);
      setError(err.message);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [status, incidentId, keyword, page]);

  // 상태별 건수는 상태 조건만 빼고 같은 조건(사건·검색어)으로 센다
  const loadSummary = useCallback(async () => {
    const seq = ++summarySeq.current;
    try {
      const params = new URLSearchParams();
      if (incidentId) params.set("incidentId", String(incidentId));
      if (keyword) params.set("keyword", keyword);
      const data = await authFetch(`/api/resources/requests/summary?${params.toString()}`);
      if (seq === summarySeq.current) setSummary(data);
    } catch {
      // 건수를 못 불러와도 목록은 그대로 쓸 수 있다 (목록 오류가 따로 안내된다)
    }
  }, [incidentId, keyword]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const reload = useCallback(() => Promise.all([loadList(), loadSummary()]), [loadList, loadSummary]);

  const changeStatus = (next) => {
    setStatus(next);
    setPage(1);
  };

  const changeIncident = (next) => {
    setIncidentId(next);
    setPage(1);
  };

  // ---- 처리 이력 ----
  const loadHistory = useCallback(async (requestId) => {
    setHistories((prev) => ({
      ...prev,
      [requestId]: { ...(prev[requestId] || { steps: [] }), open: true, loading: true, error: "" },
    }));
    try {
      const data = await authFetch(`/api/resources/requests/${requestId}/timeline`);
      setHistories((prev) => ({
        ...prev,
        [requestId]: { open: true, loading: false, error: "", steps: Array.isArray(data) ? data : [] },
      }));
    } catch (err) {
      setHistories((prev) => ({
        ...prev,
        [requestId]: { open: true, loading: false, error: err.message, steps: [] },
      }));
    }
  }, []);

  const toggleHistory = (requestId) => {
    const current = historiesRef.current[requestId];
    if (current?.open) {
      setHistories((prev) => ({ ...prev, [requestId]: { ...prev[requestId], open: false } }));
    } else {
      loadHistory(requestId);
    }
  };

  // 처리 뒤에는 펼쳐 둔 이력도 같이 새로 읽는다
  const refreshOpenHistory = async (requestId) => {
    if (historiesRef.current[requestId]?.open) await loadHistory(requestId);
  };

  // ---- 취소 · 도착 확인 (ADMIN 화면은 승인·반려·출고도 이 함수로 보낸다) ----
  // 성공하면 true. 다른 곳에서 먼저 바뀌었을 수 있어 성공·실패와 상관없이 목록을 다시 불러온다.
  const act = async (requestId, path, doneMessage, options = {}) => {
    if (actingId !== null) return false;
    setActingId(requestId);
    try {
      await authFetch(`/api/resources/requests/${requestId}/${path}`, { method: "PATCH", ...options });
      setToast(doneMessage);
      return true;
    } catch (err) {
      setToast(err.message);
      return false;
    } finally {
      setActingId(null);
      await Promise.all([reload(), refreshOpenHistory(requestId)]);
    }
  };

  const cancelRequest = (requestId) => act(requestId, "cancel", "자원 요청을 취소했습니다.");
  const arriveRequest = (requestId) => act(requestId, "arrive", "도착 확인했습니다.");

  // ---- 반납 신청 ----
  // 모달을 열 때 이 요청의 신청 내역을 불러와 신청 가능 수량을 계산한다
  const openReturnModal = async (request) => {
    const seq = ++returnSeq.current;
    setReturnTarget(request);
    setReturnApplications([]);
    setReturnLoadError("");
    setReturnSubmitError("");
    setReturnLoading(true);
    try {
      const data = await authFetch(`/api/resources/requests/${request.requestId}/return-applications`);
      if (seq !== returnSeq.current) return;
      setReturnApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      if (seq !== returnSeq.current) return;
      setReturnLoadError(err.message);
    } finally {
      if (seq === returnSeq.current) setReturnLoading(false);
    }
  };

  const closeReturnModal = () => {
    if (returnSubmitting) return;
    returnSeq.current += 1;
    setReturnTarget(null);
    setReturnSubmitError("");
  };

  // 반납 신청 전송. 실패하면 서버 메시지를 모달 안에 그대로 보여준다.
  // 다른 곳에서 먼저 바뀌었을 수 있어 실패해도 신청 내역과 요청 목록을 다시 불러온다.
  const submitReturn = async ({ requestId, quantity, memo }) => {
    setReturnSubmitting(true);
    setReturnSubmitError("");
    try {
      await authFetch(`/api/resources/requests/${requestId}/return-applications`, {
        method: "POST",
        body: JSON.stringify({ appliedQty: Number(quantity), memo: memo.trim() || null }),
      });
      setReturnTarget(null);
      setToast("반납을 신청했습니다. 자원 관리자가 확인하면 반영됩니다.");
      await Promise.all([reload(), refreshOpenHistory(requestId)]);
      return true;
    } catch (err) {
      setReturnSubmitError(err.message);
      try {
        const data = await authFetch(`/api/resources/requests/${requestId}/return-applications`);
        setReturnApplications(Array.isArray(data) ? data : []);
      } catch {
        // 내역을 못 불러와도 위의 오류 메시지는 그대로 보여준다
      }
      await Promise.all([reload(), refreshOpenHistory(requestId)]);
      return false;
    } finally {
      setReturnSubmitting(false);
    }
  };

  return {
    status, changeStatus, incidentId, changeIncident, keyword, keywordInput, setKeywordInput, page, setPage,
    items, total, summary, loading, error, reload,
    actingId, act, cancelRequest, arriveRequest,
    histories, toggleHistory,
    returnTarget, returnApplications, returnLoading, returnLoadError, returnSubmitting, returnSubmitError,
    openReturnModal, closeReturnModal, submitReturn,
  };
}
