import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

// 서버가 한 번에 주는 최대 건수. 한 사건의 요청이 이보다 많아질 일은 드물어 한 번에 불러온다.
const REQUEST_LIST_SIZE = 50;

// 사건 상세 패널의 "자원 요청" 영역 데이터: 이 사건의 요청 목록, 요청 모달(재고 목록·전송), 요청 취소
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

  return {
    requests, requestsTotal, requestsLoading, requestsError, loadRequests,
    requestModalOpen, openRequestModal, closeRequestModal,
    stocks, stocksLoading, stocksError, submitting, submitError, submitRequest,
    cancellingId, cancelRequest, REQUEST_LIST_SIZE,
  };
}
