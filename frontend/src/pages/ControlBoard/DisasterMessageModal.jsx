import { useEffect, useMemo, useState } from "react";
import { SIDO_REGIONS } from "./publicInfoConstants";
import { getMessageCategory, messageBadgeTone, formatExternalDate } from "./publicInfoUtils";
import { ModalShell, Pagination } from "./PublicInfoModal";

export default function DisasterMessageModal({ rows, onClose }) {
  const PAGE_SIZE = 10;
  const [typeFilter, setTypeFilter] = useState("전체");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    return (rows || []).filter((message) => {
      const category = getMessageCategory(message.disasterType);
      if (typeFilter !== "전체" && category !== typeFilter) return false;
      if (regionFilter !== "ALL") {
        const region = SIDO_REGIONS.find((item) => item.sido === regionFilter);
        const text = String(message.region || "");
        if (region && !text.includes(region.sido) && !text.includes(region.label)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, regionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, regionFilter]);

  return (
    <ModalShell title="최근 재난문자 전체보기" subtitle={`전국 · 최근 48시간 · ${filteredRows.length}건`} onClose={onClose} maxWidth="max-w-[860px]">
      <div className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {["전체", "풍랑", "호우", "산불", "기타"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  typeFilter === type
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <select
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="ALL">전체 지역</option>
            {SIDO_REGIONS.map((region) => (
              <option key={region.sido} value={region.sido}>{region.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[84px_150px_102px_minmax(0,1fr)] bg-slate-50 px-3 py-2 text-[10px] font-extrabold text-slate-500">
            <span>재난유형</span>
            <span>지역</span>
            <span>발송시각</span>
            <span>내용</span>
          </div>
          <div className="divide-y divide-slate-100">
            {pageRows.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-[12px] text-slate-400">조건에 맞는 재난문자가 없습니다.</div>
            ) : pageRows.map((message, index) => (
              <div key={message.sn || `${message.createdAt}-${index}`} className="grid min-h-[48px] grid-cols-[84px_150px_102px_minmax(0,1fr)] items-center px-3 py-2">
                <span className={`w-fit rounded-md px-2 py-1 text-[9px] font-bold ${messageBadgeTone(message.disasterType)}`}>
                  {message.disasterType || "기타"}
                </span>
                <span className="truncate pr-2 text-[10px] font-bold text-slate-700" title={message.region || "전국"}>{message.region || "전국"}</span>
                <span className="text-[9px] text-slate-400">{formatExternalDate(message.createdAt)}</span>
                <span className="line-clamp-2 pr-1 text-[10px] leading-4 text-slate-600" title={message.message || ""}>{message.message || "내용 없음"}</span>
              </div>
            ))}
          </div>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>
    </ModalShell>
  );
}
