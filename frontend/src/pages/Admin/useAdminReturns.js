import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

export const RETURNS_PAGE_SIZE = 20;
const BASE = "/api/resources/admin/return-applications";

// ADMIN 반납 관리 데이터: 상태별 반납 신청 목록(페이지)과 상태별 건수(서버 집계 한 번), 반납 확인·반려.
// 처음에는 전체(빈 값 "")를 보여준다. 확인 대기가 0건이어도 화면이 비어 보이지 않게 하고, 관리자가 상태 필터로 좁혀 본다.
export function useAdminReturns({ setToast }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null); // { total, counts: { 상태: 건수 } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null); // 처리 중인 반납 신청 ID (중복 전송 방지)

  // 필터를 빠르게 바꿨을 때 늦게 도착한 이전 응답이 화면을 덮어쓰지 않도록 순번을 둔다
  const loadSeq = useRef(0);

  const loadList = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: status || "ALL", page: String(page), size: String(RETURNS_PAGE_SIZE) });
      const data = await authFetch(`${BASE}?${params.toString()}`);
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

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await authFetch(`${BASE}/summary`));
    } catch {
      // 건수를 못 불러와도 목록은 그대로 쓸 수 있다 (목록 오류가 따로 안내된다)
    }
  }, []);

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

  // 성공하면 true. 다른 곳에서 먼저 바뀌었을 수 있어 성공·실패와 상관없이 목록과 건수를 다시 불러온다.
  const act = async (returnId, path, doneMessage, options = {}) => {
    if (actingId !== null) return false;
    setActingId(returnId);
    try {
      await authFetch(`${BASE}/${returnId}/${path}`, { method: "PATCH", ...options });
      setToast(doneMessage);
      return true;
    } catch (err) {
      setToast(err.message);
      return false;
    } finally {
      setActingId(null);
      await reload();
    }
  };

  return {
    status, changeStatus, page, setPage, items, total, summary, loading, error, reload, actingId,
    confirm: (returnId) => act(returnId, "confirm", "반납을 확인했습니다. 가용 수량에 반영됐습니다."),
    reject: (returnId, reason) =>
      act(returnId, "reject", "반납 신청을 반려했습니다.", { body: JSON.stringify({ reason: reason.trim() }) }),
  };
}
