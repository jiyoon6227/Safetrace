import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

// 사건 상세에 보여줄 최근 요청 건수
const RECENT_REQUEST_SIZE = 3;

// 사건 상세 패널의 "자원 요청" 요약 영역 데이터: 최근 요청 3건 + 상태별 건수(서버가 센 값), 요청 모달(재고 목록·전송)
// 취소·도착 확인·반납 신청·처리 이력은 "자원 관리" 탭(useMyResources)에서 한다.
export function useIncidentResources({ selectedIncidentId, setToast }) {
  const [requests, setRequests] = useState([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestCounts, setRequestCounts] = useState({}); // { 상태: 건수 }
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 사건을 빠르게 바꿔 눌렀을 때 늦게 도착한 이전 사건의 응답이 화면을 덮어쓰지 않도록 순번을 둔다
  const loadSeq = useRef(0);

  const loadRequests = useCallback(async (incidentId) => {
    const seq = ++loadSeq.current;
    if (!incidentId) {
      setRequests([]);
      setRequestsTotal(0);
      setRequestCounts({});
      setRequestsError("");
      setRequestsLoading(false);
      return;
    }
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const [recent, summary] = await Promise.all([
        authFetch(`/api/resources/requests?incidentId=${incidentId}&page=1&size=${RECENT_REQUEST_SIZE}`),
        authFetch(`/api/resources/requests/summary?incidentId=${incidentId}`),
      ]);
      if (seq !== loadSeq.current) return;
      setRequests(Array.isArray(recent.items) ? recent.items : []);
      setRequestsTotal(Number(summary.total) || 0);
      setRequestCounts(summary.counts || {});
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setRequests([]);
      setRequestsTotal(0);
      setRequestCounts({});
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

  return {
    requests, requestsTotal, requestCounts, requestsLoading, requestsError, loadRequests,
    requestModalOpen, openRequestModal, closeRequestModal,
    stocks, stocksLoading, stocksError, submitting, submitError, submitRequest,
  };
}
