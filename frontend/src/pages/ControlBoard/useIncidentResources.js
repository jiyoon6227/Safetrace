import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

// 서버가 한 번에 주는 최대 건수. 한 사건의 요청이 이보다 많아질 일은 드물어 한 번에 불러온다.
const REQUEST_LIST_SIZE = 50;

// 사건 상세 패널의 "자원 요청" 영역 데이터: 이 사건의 요청 목록, 요청 모달(재고 목록·전송), 요청 취소,
// 도착 확인, 반납 신청 모달(신청 내역·전송)
export function useIncidentResources({ selectedIncidentId, setToast }) {
  const [requests, setRequests] = useState([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [cancellingId, setCancellingId] = useState(null);
  const [arrivingId, setArrivingId] = useState(null);

  // 반납 신청 모달: 대상 요청, 그 요청의 신청 내역, 전송 상태
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnApplications, setReturnApplications] = useState([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnLoadError, setReturnLoadError] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSubmitError, setReturnSubmitError] = useState("");
  const returnSeq = useRef(0);

  // 사건을 빠르게 바꿔 눌렀을 때 늦게 도착한 이전 사건의 응답이 화면을 덮어쓰지 않도록 순번을 둔다
  const loadSeq = useRef(0);

  const loadRequests = useCallback(async (incidentId) => {
    const seq = ++loadSeq.current;
    if (!incidentId) {
      setRequests([]);
      setRequestsTotal(0);
      setRequestsError("");
      setRequestsLoading(false);
      return;
    }
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const data = await authFetch(
        `/api/resources/requests?incidentId=${incidentId}&page=1&size=${REQUEST_LIST_SIZE}`
      );
      if (seq !== loadSeq.current) return;
      setRequests(Array.isArray(data.items) ? data.items : []);
      setRequestsTotal(Number(data.total) || 0);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setRequests([]);
      setRequestsTotal(0);
      setRequestsError(err.message);
    } finally {
      if (seq === loadSeq.current) setRequestsLoading(false);
    }
  }, []);

  // 다른 사건을 열면 그 사건의 요청 목록을 새로 불러온다. 요청 창도 닫는다.
  useEffect(() => {
    setRequestModalOpen(false);
    setReturnTarget(null);
    loadRequests(selectedIncidentId);
  }, [selectedIncidentId, loadRequests]);

  const openRequestModal = async () => {
    setSubmitError("");
    setStocksError("");
    setRequestModalOpen(true);
    setStocksLoading(true);
    try {
      const data = await authFetch("/api/resources/stocks");
      setStocks(Array.isArray(data) ? data : []);
    } catch (err) {
      setStocks([]);
      setStocksError(err.message);
    } finally {
      setStocksLoading(false);
    }
  };

  const closeRequestModal = () => {
    if (submitting) return;
    setRequestModalOpen(false);
    setSubmitError("");
  };

  // 요청 전송. 성공하면 true. 실패하면 서버 메시지를 모달 안에 그대로 보여주고 false.
  const submitRequest = async ({ incidentId, stockId, quantity, reason, neededAt }) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await authFetch("/api/resources/requests", {
        method: "POST",
        body: JSON.stringify({
          incidentId,
          stockId,
          quantity: Number(quantity),
          reason: reason.trim(),
          neededAt: neededAt || null,
        }),
      });
      setRequestModalOpen(false);
      setToast("자원 요청을 보냈습니다.");
      await loadRequests(incidentId);
      return true;
    } catch (err) {
      setSubmitError(err.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // 출고 전(승인 대기·승인됨) 요청 취소
  const cancelRequest = async (requestId) => {
    if (cancellingId) return;
    setCancellingId(requestId);
    try {
      await authFetch(`/api/resources/requests/${requestId}/cancel`, { method: "PATCH" });
      setToast("자원 요청을 취소했습니다.");
    } catch (err) {
      setToast(err.message);
    } finally {
      setCancellingId(null);
      await loadRequests(selectedIncidentId);
    }
  };

  // 도착 확인 (내 요청이 출고된 뒤 물품을 받았다고 표시)
  const arriveRequest = async (requestId) => {
    if (arrivingId) return;
    setArrivingId(requestId);
    try {
      await authFetch(`/api/resources/requests/${requestId}/arrive`, { method: "PATCH" });
      setToast("도착 확인했습니다.");
    } catch (err) {
      setToast(err.message);
    } finally {
      setArrivingId(null);
      await loadRequests(selectedIncidentId);
    }
  };

  // 반납 신청 모달 열기: 이 요청의 신청 내역을 불러와 신청 가능 수량을 계산한다
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
      await loadRequests(selectedIncidentId);
      return true;
    } catch (err) {
      setReturnSubmitError(err.message);
      try {
        const data = await authFetch(`/api/resources/requests/${requestId}/return-applications`);
        setReturnApplications(Array.isArray(data) ? data : []);
      } catch {
        // 내역을 못 불러와도 위의 오류 메시지는 그대로 보여준다
      }
      await loadRequests(selectedIncidentId);
      return false;
    } finally {
      setReturnSubmitting(false);
    }
  };

  return {
    requests, requestsTotal, requestsLoading, requestsError, loadRequests,
    requestModalOpen, openRequestModal, closeRequestModal,
    stocks, stocksLoading, stocksError, submitting, submitError, submitRequest,
    cancellingId, cancelRequest, REQUEST_LIST_SIZE,
    arrivingId, arriveRequest,
    returnTarget, returnApplications, returnLoading, returnLoadError, returnSubmitting, returnSubmitError,
    openReturnModal, closeReturnModal, submitReturn,
  };
}
