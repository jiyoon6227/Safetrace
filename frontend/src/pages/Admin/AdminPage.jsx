import { useEffect, useState } from "react";
import { LogOut, Loader2, Package, RefreshCw, ShieldAlert } from "lucide-react";
import TablePagination from "../ControlBoard/TablePagination";
import { ADMIN_STATUS_FILTERS } from "../../constants/resource";
import { ADMIN_PAGE_SIZE, useAdminRequests } from "./useAdminRequests";
import AdminRequestCard from "./AdminRequestCard";
import AdminRejectModal from "./AdminRejectModal";
import AdminConfirmModal from "./AdminConfirmModal";

// 자원 관리자(ADMIN) 전용 화면 - 자원 요청 승인·반려·출고
export default function AdminPage({ currentUser, onBackToHome, onLogout }) {
  const [toast, setToast] = useState("");
  // { action: "reject" | "dispatch" | "cancel", request }
  const [pending, setPending] = useState(null);
  const data = useAdminRequests({ setToast });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const totalPages = Math.max(1, Math.ceil(data.total / ADMIN_PAGE_SIZE));

  const handleAction = (action, request) => {
    if (action === "approve") {
      data.approve(request.requestId);
      return;
    }
    setPending({ action, request });
  };

  const submitPending = async (reason) => {
    if (!pending) return;
    const { action, request } = pending;
    if (action === "reject") await data.reject(request.requestId, reason);
    else if (action === "dispatch") await data.dispatch(request.requestId);
    else await data.cancel(request.requestId);
    // 실패하면 창을 그대로 두지 않고 닫는다. 서버 메시지는 화면 아래 알림으로 보인다.
    setPending(null);
  };

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] text-slate-800 font-sans">
      <aside className="w-56 bg-[#0F2540] text-slate-300 flex flex-col shrink-0">
        <button type="button" onClick={onBackToHome} className="flex items-center gap-2 px-5 py-5 hover:opacity-80 transition text-left cursor-pointer">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-white">세이프트레이스</span>
        </button>
        <nav className="flex-1 px-3 space-y-1">
          <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-white/10 text-white font-semibold">
            <Package className="w-4 h-4" /> 자원 요청 처리
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-sm font-semibold text-white truncate">{currentUser?.name || "관리자"}님</div>
          <div className="text-[11px] text-slate-400">자원 관리자</div>
        </div>
        <div className="px-3 pb-5">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 cursor-pointer">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-lg font-extrabold text-[#0F2540]">자원 요청 처리</h1>
              <p className="text-xs text-slate-400 mt-0.5">담당자가 보낸 요청을 승인·반려하고, 승인한 요청을 출고합니다.</p>
            </div>
            <button
              type="button"
              onClick={data.load}
              disabled={data.loading}
              aria-label="목록 새로고침"
              title="새로고침"
              className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-500 flex items-center justify-center hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${data.loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {ADMIN_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value || "all"}
                type="button"
                onClick={() => data.changeStatus(filter.value)}
                className={`text-xs font-bold rounded-full px-3.5 py-1.5 transition cursor-pointer ${
                  data.status === filter.value ? "bg-[#0F2540] text-white" : "bg-white border border-slate-300 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {data.error && <div className="mb-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{data.error}</div>}

          {data.loading && data.items.length === 0 ? (
            <div className="text-xs text-slate-400 py-12 text-center flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
            </div>
          ) : data.items.length === 0 ? (
            !data.error && <div className="text-xs text-slate-400 py-12 text-center">해당하는 자원 요청이 없습니다.</div>
          ) : (
            <>
              <p className="text-[11px] text-slate-400 mb-2">전체 {data.total}건</p>
              <ul className="space-y-3">
                {data.items.map((request) => (
                  <AdminRequestCard
                    key={request.requestId}
                    request={request}
                    busy={data.actingId !== null}
                    onAction={handleAction}
                  />
                ))}
              </ul>
              <TablePagination currentPage={data.page} totalPages={totalPages} setPage={data.setPage} />
            </>
          )}
        </div>
      </main>

      {pending?.action === "reject" && (
        <AdminRejectModal
          request={pending.request}
          submitting={data.actingId !== null}
          onSubmit={submitPending}
          onClose={() => setPending(null)}
        />
      )}
      {(pending?.action === "dispatch" || pending?.action === "cancel") && (
        <AdminConfirmModal
          action={pending.action}
          request={pending.request}
          submitting={data.actingId !== null}
          onConfirm={() => submitPending()}
          onClose={() => setPending(null)}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-[#0F2540] text-white text-sm rounded-xl px-5 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
