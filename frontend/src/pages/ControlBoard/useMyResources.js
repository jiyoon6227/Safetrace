import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

export const MY_RESOURCES_PAGE_SIZE = 20;

// STAFF "자원 관리" 탭의 데이터: 내가 보낸 전체 요청(상태·사건·검색어 조건, 페이지)과 상태별 건수,
// 요청 취소, 도착 확인, 반납 신청 모달, 요청별 처리 이력(카드 펼치기)
// 검색·페이징·상태별 건수는 서버가 처리하고, 여기서는 조건을 보내고 결과를 받아 둘 뿐이다.
// ADMIN 반납·정산 화면도 같은 훅을 쓴다: basePath로 다른 목록(반납 신청)을 읽고, initialStatus로 처음 상태(미정산 = DISPATCHED)를 정하고,
// statusAll은 "전체"를 서버에 ALL로 보내야 하는 목록(반납 신청은 상태가 없으면 확인 대기만 준다)용이다.
// extraParams는 목록·건수가 같이 쓰는 화면별 조건(재고의 부서·분류). 값이 비면 보내지 않고, 바꾸는 쪽이 setPage(1)로 첫 쪽으로 돌린다 (useMemo로 감싸서 넘긴다).
export function useMyResources({ initialIncidentId, initialStatus = "", basePath = "/api/resources/requests", statusAll, extraParams, setToast }) {
  const [status, setStatus] = useState(initialStatus);
  const [incidentId, setIncidentId] = useState(initialIncidentId ?? null);
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState(""); // 입력창에 쓰는 중인 검색어 (조회 전에는 목록에 영향이 없다)
  const [keyword, setKeyword] = useState(""); // 조회를 눌러 적용된 검색어: 목록·건수·처리 뒤 새로고침이 모두 이 값을 쓴다
  const [dates, setDates] = useState({ from: "", to: "" }); // 요청 기간(접수일). ADMIN 화면만 쓴다
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

  // 필터를 빠르게 바꿨을 때 늦게 도착한 이전 응답이 화면을 덮어쓰지 않도록 순번을 둔다
  const loadSeq = useRef(0);
  const summarySeq = useRef(0);

  // 목록과 상태별 건수가 함께 쓰는 조건 (사건·검색어·요청 기간·화면별 조건). 검색·집계는 서버가 한다
  const baseParams = useCallback(() => {
    const params = new URLSearchParams();
    if (incidentId) params.set("incidentId", String(incidentId));
    if (keyword) params.set("keyword", keyword);
    if (dates.from) params.set("fromDate", dates.from);
    if (dates.to) params.set("toDate", dates.to);
    Object.entries(extraParams || {}).forEach(([key, value]) => value && params.set(key, String(value)));
    return params;
  }, [incidentId, keyword, dates, extraParams]);

  const loadList = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const params = baseParams();
      params.set("page", String(page));
      params.set("size", String(MY_RESOURCES_PAGE_SIZE));
      if (status || statusAll) params.set("status", status || statusAll);
      const data = await authFetch(`${basePath}?${params.toString()}`);
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
  }, [baseParams, basePath, statusAll, status, page]);

  // 상태별 건수는 상태 조건만 빼고 같은 조건(사건·검색어·기간·화면별 조건)으로 센다
  const loadSummary = useCallback(async () => {
    const seq = ++summarySeq.current;
    try {
      const data = await authFetch(`${basePath}/summary?${baseParams().toString()}`);
      if (seq === summarySeq.current) setSummary(data);
    } catch {
      // 건수를 못 불러와도 목록은 그대로 쓸 수 있다 (목록 오류가 따로 안내된다)
    }
  }, [baseParams, basePath]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const reload = useCallback(() => Promise.all([loadList(), loadSummary()]), [loadList, loadSummary]);

  // 조회 버튼·Enter: 입력한 검색어(text를 주면 그 값, 비우면 전체)를 적용하고 1페이지로 돌아간다
  const search = (text = keywordInput) => {
    const next = text.trim();
    setKeywordInput(next);
    setKeyword(next);
    setPage(1);
  };

  const changeStatus = (next) => {
    setStatus(next);
    setPage(1);
  };

  const changeDates = (next) => {
    setDates(next);
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
      // "/"로 시작하면 전체 주소(ADMIN 손실 확정 등), 아니면 이 요청의 하위 주소
      await authFetch(path.startsWith("/") ? path : `/api/resources/requests/${requestId}/${path}`, { method: "PATCH", ...options });
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
    status, defaultStatus: initialStatus, changeStatus, incidentId, changeIncident, dates, changeDates, keyword, keywordInput, setKeywordInput, search, page, setPage,
    items, total, summary, loading, error, reload,
    actingId, act, cancelRequest, arriveRequest,
    histories, toggleHistory, loadHistory,
    returnTarget, returnApplications, returnLoading, returnLoadError, returnSubmitting, returnSubmitError,
    openReturnModal, closeReturnModal, submitReturn,
  };
}
