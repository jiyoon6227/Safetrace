import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../../api/client";
import { MY_RESOURCES_PAGE_SIZE, useMyResources } from "../ControlBoard/useMyResources";
import { STOCK_FORMS, itemLogToStep, stockLogToStep } from "../../constants/resource";

const ADMIN = "/api/resources/admin";

// 이력(재고 변동·품목 수정)을 읽어 타임라인 단계 { loading, error, steps }로 둔다. 빠르게 다른 대상을 고르면 늦게 온 이전 응답은 버린다.
function useLogs() {
  const [history, setHistory] = useState();
  const seq = useRef(0);
  const load = useCallback(async (path, toStep) => {
    const id = ++seq.current;
    setHistory((prev) => ({ steps: prev?.steps || [], loading: true }));
    try {
      const data = await authFetch(path);
      if (id === seq.current) setHistory({ steps: data.map(toStep) });
    } catch (err) {
      if (id === seq.current) setHistory({ error: err.message });
    }
  }, []);
  return [history, load];
}

// ADMIN 재고 관리 데이터.
//  재고 현황: 목록·검색·상태별 건수·페이징은 서버가 하고(요청 목록과 같은 훅), 부서·분류 조건과 선택한 재고의 상세·변동 이력을 더한다.
//  품목 관리: 품목은 수십 개라 전체를 한 번 읽어 이 안에서 검색·분류·쪽 나누기를 한다. 검색어는 재고 현황처럼 조회 버튼·Enter로 적용한 값(keyword)만 쓴다. 상태 칩 자리에는 분류를 넣어 같은 필터 막대를 쓴다.
//  submit: 재고·품목 처리를 서버에 보내고(STOCK_FORMS의 주소·본문), 끝나면 목록과 열려 있는 상세·이력을 다시 읽는다. 실패하면 서버 메시지를 돌려준다.
export function useAdminStock({ setToast }) {
  const [filters, setFilters] = useState({ departmentId: "", category: "" });
  const stocks = useMyResources({ setToast, basePath: `${ADMIN}/stocks`, statusAll: "ALL", extraParams: filters });
  const [stock, setStock] = useState(null);
  const [stockLogs, loadStockLogs] = useLogs();
  const [departments, setDepartments] = useState([]);

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [itemQuery, setItemQuery] = useState({ input: "", keyword: "", category: "", page: 1 });
  const [itemId, setItemId] = useState(null);
  const [itemLogs, loadItemLogs] = useLogs();

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError("");
    try {
      const data = await authFetch("/api/resources/items");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setItemsError(err.message);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    authFetch("/api/departments").then((data) => setDepartments(Array.isArray(data) ? data : [])).catch(() => {});
  }, [loadItems]);

  // ---- 재고 현황 ----
  const changeFilter = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    stocks.setPage(1);
  };
  const openStock = (row) => {
    setStock(row);
    loadStockLogs(`/api/resources/stocks/${row.stockId}/logs`, (log) => stockLogToStep(log, row.unit));
  };
  // 처리 뒤 상세는 서버가 센 최신 수량으로 바꾼다 (목록에서 빠지거나 다른 쪽에 있어도 패널은 유지된다)
  const refreshStock = async (row) => {
    try {
      const fresh = await authFetch(`${ADMIN}/stocks/${row.stockId}`);
      setStock(fresh);
      loadStockLogs(`/api/resources/stocks/${row.stockId}/logs`, (log) => stockLogToStep(log, fresh.unit));
    } catch {
      // 상세를 못 읽어도 목록은 그대로 쓴다 (오류는 목록 쪽에서 안내된다)
    }
  };

  // ---- 품목 관리 ----
  const keyword = itemQuery.keyword.toLowerCase();
  const matched = useMemo(() => items.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(keyword)), [items, keyword]);
  const shown = itemQuery.category ? matched.filter((item) => item.category === itemQuery.category) : matched;
  const counts = {};
  matched.forEach((item) => { counts[item.category] = (counts[item.category] || 0) + 1; });
  const item = items.find((row) => row.itemId === itemId) || null;
  // 목록·건수와 열린 상세(수량·이력)를 다시 읽는다. 처리 뒤·탭 전환·새로고침·메뉴 재클릭이 모두 쓴다
  const refreshStocks = () => Promise.all([stocks.reload(), stock && refreshStock(stock)]);
  const refreshItems = () => Promise.all([loadItems(), item && loadItemLogs(`${ADMIN}/items/${item.itemId}/logs`, itemLogToStep)]);
  const itemData = {
    items: shown.slice((itemQuery.page - 1) * MY_RESOURCES_PAGE_SIZE, itemQuery.page * MY_RESOURCES_PAGE_SIZE),
    total: shown.length, page: itemQuery.page, setPage: (page) => setItemQuery((prev) => ({ ...prev, page })),
    loading: itemsLoading, error: itemsError, reload: refreshItems,
    summary: { total: matched.length, counts }, status: itemQuery.category, defaultStatus: "",
    changeStatus: (category) => setItemQuery((prev) => ({ ...prev, category, page: 1 })),
    keyword: itemQuery.keyword, keywordInput: itemQuery.input,
    setKeywordInput: (input) => setItemQuery((prev) => ({ ...prev, input })),
    search: (text = itemQuery.input) => { const next = text.trim(); setItemQuery((prev) => ({ ...prev, input: next, keyword: next, page: 1 })); },
    all: items, item,
    open: (row) => {
      setItemId(row.itemId);
      loadItemLogs(`${ADMIN}/items/${row.itemId}/logs`, itemLogToStep);
    },
    close: () => setItemId(null),
    history: itemLogs,
  };

  // 재고·품목 처리. 성공하면 "", 실패하면 서버 메시지 (입력창 안에 그대로 보인다).
  // 성공·실패와 상관없이 다른 처리와 겹쳤을 수 있어 목록과 열려 있는 상세·이력을 다시 읽는다.
  const submit = async (kind, target, values) => {
    const form = STOCK_FORMS[kind];
    const { path, method, body } = form.request(target, values);
    try {
      await authFetch(`${ADMIN}${path}`, { method, body: JSON.stringify(body) });
      setToast(form.done);
      return "";
    } catch (err) {
      return err.message;
    } finally {
      await Promise.all([refreshStocks(), refreshItems()]);
    }
  };

  return {
    stocks: { ...stocks, reload: refreshStocks, filters, changeFilter, selected: stock, open: openStock, close: () => setStock(null), history: stockLogs },
    items: itemData, departments, submit,
  };
}
