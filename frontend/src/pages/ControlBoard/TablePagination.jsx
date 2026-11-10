// 사건 목록/제보 목록 표에서 공용으로 쓰는 페이지네이션 컨트롤
export default function TablePagination({ currentPage, totalPages, setPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button
        type="button"
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
          currentPage === 1 ? "border-slate-200 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
        }`}
      >
        ‹
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => setPage(page)}
          className={`min-w-8 h-8 px-2 rounded-lg text-sm font-bold transition cursor-pointer ${
            currentPage === page ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
          currentPage === totalPages ? "border-slate-200 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
        }`}
      >
        ›
      </button>
    </div>
  );
}
