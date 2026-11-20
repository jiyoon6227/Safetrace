import { useCallback, useEffect, useState } from "react";
import { Home, Loader2, Search } from "lucide-react";
import { authFetch } from "../../api/client";
import { SIDO_REGIONS } from "./publicInfoConstants";
import { formatCapacity } from "./publicInfoUtils";
import { ModalShell, Pagination } from "./PublicInfoModal";

export default function ShelterModal({ onClose }) {
  const PAGE_SIZE = 10;
  const [region, setRegion] = useState("");
  const [inputKeyword, setInputKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
      });
      if (region) params.set("region", region);
      if (keyword) params.set("keyword", keyword);
      const data = await authFetch(`/api/environment/shelters/search?${params.toString()}`);
      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotalCount(Number(data?.totalCount) || 0);
    } catch (err) {
      setRows([]);
      setTotalCount(0);
      setError(err?.message || "대피시설을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [region, keyword, page]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <ModalShell title="대피시설 전체보기" subtitle={`전국 등록 민방위 대피시설 · ${totalCount.toLocaleString()}곳 조회`} onClose={onClose} maxWidth="max-w-[920px]">
      <div className="px-5 py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setKeyword(inputKeyword.trim());
          }}
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="">전체 지역</option>
            {SIDO_REGIONS.map((item) => (
              <option key={item.sido} value={item.sido}>{item.label}</option>
            ))}
          </select>

          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={inputKeyword}
              onChange={(event) => setInputKeyword(event.target.value)}
              placeholder="시설명 검색"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>
          <button type="submit" className="h-10 rounded-lg bg-blue-600 px-4 text-[12px] font-bold text-white hover:bg-blue-700">검색</button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[minmax(190px,1fr)_110px_minmax(270px,1.35fr)_110px] bg-slate-50 px-4 py-2.5 text-[12px] font-extrabold text-slate-500">
            <span>시설명</span>
            <span>지역</span>
            <span>주소</span>
            <span className="text-right">수용인원</span>
          </div>

          {loading ? (
            <div className="flex h-[360px] items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-[11px]">대피시설을 조회하는 중입니다.</span>
            </div>
          ) : error ? (
            <div className="flex h-[360px] items-center justify-center text-center text-[11px] text-rose-500">{error}</div>
          ) : rows.length === 0 ? (
            <div className="flex h-[360px] items-center justify-center text-[11px] text-slate-400">조건에 맞는 대피시설이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((item, index) => (
                <div key={`${item.name}-${item.address}-${index}`} className="grid min-h-[50px] grid-cols-[minmax(190px,1fr)_110px_minmax(270px,1.35fr)_110px] items-center px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Home className="h-3.5 w-3.5" strokeWidth={2.3} />
                    </span>
                    <span className="truncate text-[12px] font-bold text-[#0F2540]" title={item.name || ""}>{item.name || "-"}</span>
                  </div>
                  <span className="text-[12px] text-slate-500">{item.region || "-"}</span>
                  <span className="truncate pr-2 text-[12px] text-slate-500" title={item.address || ""}>{item.address || "-"}</span>
                  <span className="text-right text-[12px] font-semibold text-slate-600">{formatCapacity(item.capacity)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
      </div>
    </ModalShell>
  );
}
