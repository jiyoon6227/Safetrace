import { ChevronLeft, ChevronRight } from "lucide-react";

// 화면마다 다른 모양은 variant로 고른다. hideSingle은 한 쪽뿐일 때 숨길지 여부
const VARIANTS = {
  table: {
    wrap: "flex items-center justify-center gap-1.5 pt-4",
    hideSingle: true,
    prev: "‹",
    next: "›",
    nav: (off) => `w-8 h-8 rounded-lg border text-sm font-bold transition ${off ? "border-slate-200 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"}`,
    num: (on) => `min-w-8 h-8 px-2 rounded-lg text-sm font-bold transition cursor-pointer ${on ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`,
  },
  square: {
    wrap: "mt-7 flex items-center justify-center gap-1",
    prev: <ChevronLeft className="h-3.5 w-3.5" />,
    next: <ChevronRight className="h-3.5 w-3.5" />,
    nav: () => "flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 disabled:opacity-30",
    num: (on) => `h-8 min-w-8 border px-2 text-[11px] font-bold ${on ? "border-[#0B5FB3] bg-[#0B5FB3] text-white" : "border-slate-200 bg-white text-slate-500 hover:border-[#0B5FB3] hover:text-[#0B5FB3]"}`,
  },
  modal: {
    wrap: "flex items-center justify-center gap-2",
    prev: "‹",
    next: "›",
    nav: () => "w-8 h-8 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
    num: (on) => `w-8 h-8 rounded-lg border text-[12px] font-bold transition cursor-pointer ${on ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`,
  },
  soft: {
    wrap: "flex items-center gap-1",
    prev: "‹",
    next: "›",
    nav: () => "w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default",
    num: (on) => `w-8 h-8 rounded-lg text-xs font-bold cursor-pointer ${on ? "bg-blue-500 text-white" : "text-slate-500 hover:bg-slate-100"}`,
  },
};

// 쪽 번호 버튼 줄. windowSize를 주면 현재 쪽 둘레의 그 개수만 보인다 (없으면 전부)
export default function TablePagination({ currentPage, totalPages, setPage, variant = "table", windowSize }) {
  const v = VARIANTS[variant];
  if (v.hideSingle && totalPages <= 1) return null;
  let first = 1;
  let last = totalPages;
  if (windowSize && totalPages > windowSize) {
    last = Math.min(totalPages, Math.max(1, currentPage - Math.floor((windowSize - 1) / 2)) + windowSize - 1);
    first = Math.max(1, last - windowSize + 1);
  }
  const atStart = currentPage === 1;
  const atEnd = currentPage === totalPages;
  return (
    <div className={v.wrap}>
      <button type="button" onClick={() => setPage(currentPage - 1)} disabled={atStart} className={v.nav(atStart)}>{v.prev}</button>
      {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((page) => (
        <button key={page} type="button" onClick={() => setPage(page)} className={v.num(currentPage === page)}>{page}</button>
      ))}
      <button type="button" onClick={() => setPage(currentPage + 1)} disabled={atEnd} className={v.nav(atEnd)}>{v.next}</button>
    </div>
  );
}
