import { Suspense, lazy, useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import TablePagination from "../ControlBoard/TablePagination";
import ControlBoardHeader from "../ControlBoard/ControlBoardHeader";
import ControlBoardSidebar from "../ControlBoard/ControlBoardSidebar";
import ResourceFilterBar from "../ControlBoard/ResourceFilterBar";
import ResourceRequestCard from "../ControlBoard/ResourceRequestCard";
import ResourceSummaryCards from "../ControlBoard/ResourceSummaryCards";
import { useHeaderMenus } from "../ControlBoard/useHeaderMenus";
import { MY_RESOURCES_PAGE_SIZE } from "../ControlBoard/useMyResources";
import { useAdminRequests } from "./useAdminRequests";
import AdminRejectModal from "./AdminRejectModal";
import AdminConfirmModal from "./AdminConfirmModal";

// 반납 관리는 탭을 눌렀을 때만 불러온다
const AdminReturnsTab = lazy(() => import("./AdminReturnsTab"));

const ADMIN_NAV_ITEMS = [{ key: "resources", icon: Package, label: "자원 관리" }];
// 재고 관리 탭은 그 기능을 만들 때 더한다
const ADMIN_TABS = [
  { key: "requests", label: "요청 관리", desc: "담당자가 보낸 자원 요청을 승인·반려하고, 승인한 요청을 출고합니다. 출고 뒤 분실된 수량은 손실로 확정합니다." },
  { key: "returns", label: "반납 관리", desc: "담당자가 신청한 반납을 확인하면 가용 수량에 반영하고, 맞지 않으면 사유와 함께 반려합니다." },
];

// 자원 관리자(ADMIN) 전용 화면 - 요청 승인·반려·출고·손실 확정, 반납 확인·반려
export default function AdminPage({ currentUser, onBackToHome, onLogout }) {
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("requests");
  // { action: "reject" | "dispatch" | "cancel" | "loss", request }
  const [pending, setPending] = useState(null);
  const data = useAdminRequests({ setToast });
  const menus = useHeaderMenus();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const totalPages = Math.max(1, Math.ceil(data.total / MY_RESOURCES_PAGE_SIZE));

  const handleAction = (action, request) => {
    if (action === "approve") {
      data.approve(request.requestId);
      return;
    }
    setPending({ action, request });
  };

  // 반납 관리에서 재고·요청이 바뀌었을 수 있어, 요청 관리로 돌아올 때 다시 불러온다
  const changeTab = (next) => {
    setTab(next);
    if (next === "requests") data.reload();
  };

  const submitPending = async (reason, quantity) => {
    if (!pending) return;
    const { action, request } = pending;
    if (action === "reject") await data.reject(request.requestId, reason);
    else if (action === "loss") await data.loss(request, quantity, reason);
    else if (action === "dispatch") await data.dispatch(request.requestId);
    else await data.cancel(request.requestId);
    // 실패하면 창을 그대로 두지 않고 닫는다. 서버 메시지는 화면 아래 알림으로 보인다.
    setPending(null);
  };

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] text-slate-800 font-sans">
      {/* STAFF 화면과 같은 사이드바·헤더. 메뉴는 자원 관리 하나만 둔다. */}
      <ControlBoardSidebar
        sidebarOpen={menus.sidebarOpen}
        handleBackToHome={onBackToHome}
        activeNav="resources"
        handleNavClick={() => {}}
        member={menus.member}
        currentUser={currentUser}
        onLogout={onLogout}
        navItems={ADMIN_NAV_ITEMS}
        roleLabel="자원 관리자"
      />

      <div className="flex-1 min-w-0">
        <ControlBoardHeader
          setSidebarOpen={menus.setSidebarOpen}
          profileRef={menus.profileRef}
          profileOpen={menus.profileOpen}
          setProfileOpen={menus.setProfileOpen}
          member={menus.member}
          currentUser={currentUser}
          handleBackToHome={onBackToHome}
          onLogout={onLogout}
          roleLabel="자원 관리자"
        />

        <main className="flex-1 min-w-0 px-5 py-4">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">자원 관리</h1>
              <p className="text-[13px] text-slate-500 mt-2">{ADMIN_TABS.find((t) => t.key === tab).desc}</p>
            </div>

            <div role="tablist" className="flex gap-1 border-b border-slate-200">
              {ADMIN_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => changeTab(key)}
                  className={`px-5 py-2.5 text-sm font-bold -mb-px border-b-2 transition cursor-pointer ${
                    tab === key ? "border-[#0F2540] text-[#0F2540]" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "returns" ? (
              <Suspense
                fallback={
                  <div className="text-xs text-slate-400 py-12 text-center flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
                  </div>
                }
              >
                <AdminReturnsTab setToast={setToast} />
              </Suspense>
            ) : (
              <>
                <ResourceSummaryCards summary={data.summary} scopeHint="접수된 전체 자원 요청" />

                <ResourceFilterBar data={data} />

                {data.error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{data.error}</div>}

                <h2 className="flex items-center gap-1.5 text-base font-extrabold text-[#0F2540] pt-1">
                  <Package className="w-4 h-4 text-[#244D7C]" /> 자원 요청 목록 ({data.total}건)
                </h2>

                {data.loading && data.items.length === 0 ? (
                  <div className="text-xs text-slate-400 py-12 text-center flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
                  </div>
                ) : data.items.length === 0 ? (
                  !data.error && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
                      <Package className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-600 mt-2">
                        {data.status || data.keyword ? "조건에 맞는 자원 요청이 없습니다" : "접수된 자원 요청이 없습니다"}
                      </p>
                    </div>
                  )
                ) : (
                  <>
                    <ul className="space-y-3">
                      {data.items.map((request) => (
                        <ResourceRequestCard
                          key={request.requestId}
                          request={request}
                          busy={data.actingId !== null}
                          history={data.histories[request.requestId]}
                          onToggleHistory={data.toggleHistory}
                          onAdminAction={handleAction}
                        />
                      ))}
                    </ul>
                    <TablePagination currentPage={data.page} totalPages={totalPages} setPage={data.setPage} />
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {(pending?.action === "reject" || pending?.action === "loss") && (
        <AdminRejectModal
          action={pending.action}
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
