import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function ModalShell({ title, subtitle, onClose, children, maxWidth = "max-w-[900px]" }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${maxWidth} max-h-[86vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[18px] font-extrabold text-[#0F2540]">{title}</h3>
            <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange, disabled = false }) {
  const pages = paginationNumbers(page, totalPages);
  return (
    <div className="mt-4 flex items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((item, index) => item === "…" ? (
        <span key={`ellipsis-${index}`} className="flex h-8 min-w-6 items-center justify-center text-[11px] text-slate-400">…</span>
      ) : (
        <button
          key={item}
          type="button"
          disabled={disabled}
          onClick={() => onChange(item)}
          className={`h-8 min-w-8 rounded-lg px-2 text-[11px] font-bold ${
            item === page ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {item}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function paginationNumbers(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
}
