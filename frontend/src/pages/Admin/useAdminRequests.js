import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

export const ADMIN_PAGE_SIZE = 20;

// ADMIN 자원 요청 처리 화면의 데이터: 상태별 목록(페이지), 승인·반려·출고·승인 취소
export function useAdminRequests({ setToast }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 지금 처리 중인 요청 ID. 처리 중에는 다른 버튼을 눌러도 무시한다(중복 전송 방지).
  const [actingId, setActingId] = useState(null);

  // 필터를 빠르게 바꿨을 때 늦게 도착한 이전 응답이 화면을 덮어쓰지 않도록 순번을 둔다
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: String(ADMIN_PAGE_SIZE) });
      if (status) params.set("status", status);
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
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = (next) => {
    setStatus(next);
    setPage(1);
  };

  // 처리 하나를 보낸다. 성공하면 true. 실패하면 서버 메시지를 그대로 알리고 false.
  // 다른 관리자가 먼저 처리했을 수 있으므로 성공·실패와 상관없이 목록을 다시 불러온다.
  const act = async (requestId, path, options, doneMessage) => {
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
      await load();
    }
  };

  const approve = (requestId) => act(requestId, "approve", {}, "요청을 승인했습니다.");
  const reject = (requestId, reason) =>
    act(requestId, "reject", { body: JSON.stringify({ reason: reason.trim() }) }, "요청을 반려했습니다.");
  const dispatch = (requestId) => act(requestId, "dispatch", {}, "출고 처리했습니다.");
  const cancel = (requestId) => act(requestId, "cancel", {}, "승인을 취소했습니다.");

  return {
    status, changeStatus, page, setPage, items, total, loading, error, load,
    actingId, approve, reject, dispatch, cancel,
  };
}
