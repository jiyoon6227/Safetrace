import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Boxes, ChevronRight, ClipboardList, Package } from "lucide-react";
import ControlBoardHeader from "../ControlBoard/ControlBoardHeader";
import ControlBoardSidebar from "../ControlBoard/ControlBoardSidebar";
import ResourceFilterBar from "../ControlBoard/ResourceFilterBar";
import { CATEGORY_ICON } from "../ControlBoard/ResourceRequestCard";
import RequestStatusBadge from "../ControlBoard/RequestStatusBadge";
import ResourceSummaryCards, { REQUEST_SUMMARY_CARDS } from "../ControlBoard/ResourceSummaryCards";
import { formatDateTime } from "../ControlBoard/constants";
import { ADMIN_REQUEST_FILTERS, ADMIN_STATUS_LABEL, formatCode, formatQty } from "../../constants/resource";
import { useHeaderMenus } from "../ControlBoard/useHeaderMenus";
import { useAdminRequests } from "./useAdminRequests";
import AdminRejectModal from "./AdminRejectModal";
import AdminConfirmModal from "./AdminConfirmModal";
import AdminRequestDetail from "./AdminRequestDetail";
import AdminTable, { LOADING, SHOW_3XL, SHOW_4XL } from "./AdminTable";

// 반납·정산 관리와 재고 관리는 메뉴를 눌렀을 때만 불러온다
const AdminReturnsTab = lazy(() => import("./AdminReturnsTab"));
const AdminStockTab = lazy(() => import("./AdminStockTab"));

// 사이드바 메뉴: 자원 업무(요청·출고 / 반납·정산) 그룹과 독립된 재고 관리. 본문 탭 없이 메뉴로 화면을 바꾼다
const ADMIN_NAV_ITEMS = [
  {
    key: "resource-work", icon: ClipboardList, label: "자원 업무",
    children: [
      { key: "requests", label: "요청·출고 관리" },
      { key: "returns", label: "반납·정산 관리" },
    ],
  },
  { key: "stock", icon: Boxes, label: "재고 관리" },
];
const ADMIN_SCREENS = {
  requests: { title: "요청·출고 관리", desc: "담당자가 보낸 자원 요청을 승인·반려하고, 승인한 요청을 출고합니다. 출고 뒤 반납과 손실은 반납·정산 관리에서 처리합니다." },
  returns: { title: "반납·정산 관리", desc: "출고된 자원의 반납 여부를 확인하고, 남은 수량은 반납 확인 또는 손실 확정으로 정산합니다." },
  stock: { title: "재고 관리", desc: "품목과 부서별 재고를 등록하고 입고·수량 조정·사용 중지를 관리합니다." },
};

// 현황 카드는 STAFF와 같은 것을 쓰되, 출고된 요청은 ADMIN이 할 일에 맞춰 "출고 후 관리"로 부른다
const ADMIN_CARDS = REQUEST_SUMMARY_CARDS.map((card) =>
  card.statuses?.[0] === "DISPATCHED" ? { ...card, label: ADMIN_STATUS_LABEL.DISPATCHED, hint: "출고 완료, 반납·정산 관리 중" } : card);
// 요청·출고 관리 표의 칸. 요청자는 48rem부터, 요청일시 칸은 56rem부터 보이고 그보다 좁으면 요청번호 아래에 붙는다
const REQUEST_COLUMNS = [
  {
    head: "요청번호",
    cell: (r) => (
      <>
        <div className="font-extrabold text-[#244D7C]">{formatCode("REQ", r.requestId)}</div>
        <div className="@4xl:hidden text-xs text-slate-500">{formatDateTime(r.createdAt)}</div>
      </>
    ),
  },
  {
    head: "사건번호 / 사건명",
    cell: (r) => (
      <>
        <div className="font-bold text-[#244D7C]">{formatCode("INC", r.incidentId)}</div>
        <div className="text-slate-600 truncate max-w-[8.5rem] @3xl:max-w-[11rem] @4xl:max-w-[15rem]">{r.incidentTitle}</div>
      </>
    ),
  },
  {
    head: "요청 자원",
    cell: (r) => {
      const Icon = CATEGORY_ICON[r.category] || Package;
      return (
        <>
          <span className="inline-flex items-center gap-2 font-bold text-slate-900">
            <Icon className="w-[18px] h-[18px] text-[#244D7C]" /> {r.itemName}
          </span>
          <div className="@3xl:hidden text-xs text-slate-500">{formatQty(r.quantity, r.unit)}</div>
        </>
      );
    },
  },
  { head: "수량", show: SHOW_3XL, cell: (r) => <b className="text-slate-900">{formatQty(r.quantity, r.unit)}</b> },
  { head: "처리 상태", cell: (r) => <RequestStatusBadge status={r.status} request={r} labels={ADMIN_STATUS_LABEL} className="px-3 py-1 text-xs" /> },
  {
    head: "요청자 (부서)",
    show: SHOW_3XL,
    cell: (r) => (
      <>
        <div className="font-medium text-slate-900">{r.requesterName}</div>
        {r.requesterDepartmentName && <div className="text-xs text-slate-500">({r.requesterDepartmentName})</div>}
      </>
    ),
  },
  { head: "요청일시", show: SHOW_4XL, cell: (r) => <span className="text-slate-700">{formatDateTime(r.createdAt)}</span> },
  {
    head: "상세",
    show: SHOW_3XL,
    cell: () => (
      <button type="button" className="inline-flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
        상세보기 <ChevronRight className="w-3.5 h-3.5" />
      </button>
    ),
  },
];

// 자원 관리자(ADMIN) 전용 화면 - 요청 승인·반려·출고(표 + 상세 패널), 반납 확인·반려
export default function AdminPage({ currentUser, onBackToHome, onLogout }) {
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("requests");
  // { action: "reject" | "dispatch" | "cancel", request }
  const [pending, setPending] = useState(null);
  // 상세 패널에 연 요청. 내용은 목록에서 찾아 쓰므로 처리 뒤 목록이 바뀌면 패널도 같이 바뀐다
  const [selectedId, setSelectedId] = useState(null);
  const data = useAdminRequests({ setToast });
  const menus = useHeaderMenus();
  const refreshRef = useRef(null); // 반납·정산·재고 화면이 자기 화면을 다시 읽는 함수를 걸어 두는 곳

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const selected = data.items.find((request) => request.requestId === selectedId);

  const openDetail = (requestId) => {
    setSelectedId(requestId);
    data.loadHistory(requestId);
  };

  const handleAction = (action, request) => {
    if (action === "approve") {
      data.approve(request.requestId);
      return;
    }
    setPending({ action, request });
  };

  // 메뉴를 누를 때마다 그 화면을 같은 조건으로 다시 읽는다. 다른 메뉴에서 온 반납·정산·재고는 새로 열리며 스스로 읽는다
  const changeTab = (next) => {
    setTab(next);
    if (next === "requests") {
      data.reload();
      if (selectedId) data.loadHistory(selectedId);
    } else if (next === tab) {
      refreshRef.current?.();
    }
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

  const header = (
    <div>
      <h1 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">{ADMIN_SCREENS[tab].title}</h1>
      <p className="text-[13px] text-slate-500 mt-2">{ADMIN_SCREENS[tab].desc}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] text-slate-800 font-sans">
      {/* STAFF 화면과 같은 사이드바·헤더. 화면 전환은 사이드바 메뉴로 한다 */}
      <ControlBoardSidebar
        sidebarOpen={menus.sidebarOpen}
        handleBackToHome={onBackToHome}
        activeNav={tab}
        handleNavClick={changeTab}
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

        <main className="flex-1 min-w-0 px-5 py-4 xl:flex xl:items-start xl:gap-4">
          {tab === "returns" || tab === "stock" ? (
            // 반납·정산 관리와 재고 관리는 자기 오른쪽 상세 패널까지 한 덩어리로 그린다 (제목은 여기서 넘긴다)
            <Suspense fallback={LOADING}>
              {tab === "returns" ? <AdminReturnsTab setToast={setToast} header={header} refreshRef={refreshRef} /> : <AdminStockTab setToast={setToast} header={header} refreshRef={refreshRef} />}
            </Suspense>
          ) : (
            <div className="@container flex-1 min-w-0 space-y-4">
              {header}

              <ResourceSummaryCards summary={data.summary} scopeHint="접수된 전체 자원 요청" cards={ADMIN_CARDS} large />

              <ResourceFilterBar
                data={data}
                filters={ADMIN_REQUEST_FILTERS}
                searchFirst
                withDates
                placeholder="요청번호(REQ-0003), 사건번호(INC-0003), 사건명, 자원명, 요청자 검색"
              />

              {data.error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{data.error}</div>}

              <AdminTable
                data={data}
                columns={REQUEST_COLUMNS}
                rowKey={(request) => request.requestId}
                selectedKey={selectedId}
                onSelect={(request) => openDetail(request.requestId)}
                emptyText={data.status || data.keyword || data.dates.from || data.dates.to ? "조건에 맞는 자원 요청이 없습니다" : "접수된 자원 요청이 없습니다"}
              />
            </div>
          )}

          {tab === "requests" && selected && (
            <AdminRequestDetail
              request={selected}
              history={data.histories[selected.requestId]}
              busy={data.actingId !== null}
              onAction={handleAction}
              onGoReturns={() => changeTab("returns")}
              onClose={() => setSelectedId(null)}
            />
          )}
        </main>
      </div>

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
