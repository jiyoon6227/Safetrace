import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Clock, Info, Layers, Package, XCircle } from "lucide-react";
import { authFetch } from "../../api/client";
import RequestStatusBadge from "../ControlBoard/RequestStatusBadge";
import ResourceFilterBar from "../ControlBoard/ResourceFilterBar";
import ResourceSummaryCards from "../ControlBoard/ResourceSummaryCards";
import { CATEGORY_ICON } from "../ControlBoard/ResourceRequestCard";
import { formatDateTime } from "../ControlBoard/constants";
import { ADMIN_STATUS_LABEL, RETURN_STATUS_FILTERS, RETURN_STATUS_LABEL, RETURN_STATUS_STYLE, formatCode, formatQty } from "../../constants/resource";
import { useAdminRequests } from "./useAdminRequests";
import { useAdminReturns } from "./useAdminReturns";
import AdminTable, { SHOW_4XL, SHOW_5XL } from "./AdminTable";
import AdminRequestDetail from "./AdminRequestDetail";
import AdminRejectModal from "./AdminRejectModal";
import AdminConfirmModal from "./AdminConfirmModal";

const RETURN_CARDS = [
  { label: "전체 반납 신청", Icon: ClipboardList, tone: "bg-blue-50 text-blue-600" },
  { label: "확인 대기", hint: "관리자 확인이 필요한 신청", Icon: Clock, tone: "bg-amber-50 text-amber-600", statuses: ["PENDING"] },
  { label: "반납 확인됨", hint: "가용 수량에 반영 완료", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", statuses: ["CONFIRMED"] },
  { label: "반려", hint: "재고 변화 없음", Icon: XCircle, tone: "bg-rose-50 text-rose-600", statuses: ["REJECTED"] },
];
// 미정산 화면의 카드: 확인 대기는 반납 신청 건수, 나머지는 요청 상태별 건수 (둘 다 서버가 센 값을 합쳐 쓴다)
const UNSETTLED_CARDS = [
  { label: "반납 확인 대기", hint: "반납 신청 후 확인이 필요한 건", Icon: Clock, tone: "bg-amber-50 text-amber-600", statuses: ["PENDING"] },
  { label: "미정산 출고", hint: "반납 또는 손실 처리가 필요한 건", Icon: Layers, tone: "bg-orange-50 text-orange-600", statuses: ["DISPATCHED"] },
  { label: "정산 완료", hint: "반납 또는 손실 정산이 완료된 건", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", statuses: ["SETTLED"] },
];

// 요청번호 칸: 좁아서 사건 칸이 숨겨지면 사건번호·사건명이 그 아래 줄로 붙는다
const codeCell = (r) => (
  <>
    <div className="font-extrabold text-[#244D7C]">{formatCode("REQ", r.requestId)}</div>
    <div className="@5xl:hidden max-w-[10rem] truncate text-xs text-slate-500">{formatCode("INC", r.incidentId)} · {r.incidentTitle}</div>
  </>
);
const incidentColumn = {
  head: "사건번호 / 사건명",
  show: SHOW_5XL,
  cell: (r) => (
    <>
      <div className="font-bold text-[#244D7C]">{formatCode("INC", r.incidentId)}</div>
      <div className="max-w-[12rem] truncate text-slate-600">{r.incidentTitle}</div>
    </>
  ),
};
const itemCell = (r) => {
  const Icon = CATEGORY_ICON[r.category] || Package;
  return <span className="inline-flex items-center gap-2 font-bold text-slate-900"><Icon className="w-[18px] h-[18px] text-[#244D7C]" /> {r.itemName}</span>;
};
const count = (value, unit, tone = "") => <b className={tone || "text-slate-900"}>{formatQty(value || 0, unit)}</b>;

const RETURN_COLUMNS = [
  { head: "요청번호", cell: codeCell },
  incidentColumn,
  { head: "자원명", cell: itemCell },
  { head: "신청 수량", cell: (r) => count(r.appliedQty, r.unit) },
  { head: "상태", cell: (r) => <RequestStatusBadge status={r.status} labels={RETURN_STATUS_LABEL} styles={RETURN_STATUS_STYLE} className="px-3 py-1 text-xs" /> },
  { head: "신청자", show: SHOW_4XL, cell: (r) => <span className="font-medium text-slate-900">{r.applicantName}</span> },
  { head: "신청일시", show: SHOW_4XL, cell: (r) => <span className="text-slate-700">{formatDateTime(r.appliedAt)}</span> },
];

// 남은 미정산 = 아직 신청하지 않은 수량 + 확인 대기 중인 반납 (확인 전이라 반납으로 세지 않는다)
const left = (r) => (r.applicableReturnQty || 0) + (r.pendingReturnQty || 0);
const UNSETTLED_COLUMNS = [
  { head: "요청번호", cell: codeCell },
  incidentColumn,
  { head: "자원명", cell: itemCell },
  { head: "출고", show: SHOW_4XL, cell: (r) => count(r.quantity, r.unit) },
  { head: "반납 확정", show: SHOW_4XL, cell: (r) => count(r.returnedQty, r.unit, r.returnedQty > 0 && "text-emerald-700") },
  { head: "손실 확정", show: SHOW_4XL, cell: (r) => count(r.lostQty, r.unit, r.lostQty > 0 && "text-rose-600") },
  { head: "남은 미정산", cell: (r) => count(left(r), r.unit, "text-amber-600") },
  { head: "신청 대기", show: SHOW_4XL, cell: (r) => count(r.pendingReturnQty, r.unit) },
  { head: "상태", cell: (r) => <RequestStatusBadge status={r.status} request={r} labels={ADMIN_STATUS_LABEL} className="px-3 py-1 text-xs" /> },
  { head: "요청자", show: SHOW_5XL, cell: (r) => <span className="font-medium text-slate-900">{r.requesterName}</span> },
];


// ADMIN 반납·정산 관리 - 반납 신청 목록(확인·반려)과 미정산 출고 목록(손실 확정), 각자 오른쪽 상세 패널.
// 반납 신청이 없는 출고 건도 미정산에서 보인다: 미정산 = 상태가 출고됨(DISPATCHED)인 요청이고, 서버의 요청 목록이 그대로 준다.
export default function AdminReturnsTab({ setToast, header, refreshRef }) {
  const [tab, setTab] = useState("returns");
  const [selectedId, setSelectedId] = useState(null); // 반납 신청 번호(반납 신청) 또는 요청 번호(미정산 출고)
  const [pending, setPending] = useState(null); // { action: "returnConfirm" | "returnReject" | "loss", item }
  const [detail, setDetail] = useState(null); // 반납 신청 패널이 수량 현황에 쓰는 그 요청의 최신 내용
  const returns = useAdminReturns({ setToast });
  const unsettled = useAdminRequests({ setToast, initialStatus: "DISPATCHED" });

  const isReturns = tab === "returns";
  const list = isReturns ? returns : unsettled;
  const applied = isReturns ? returns.items.find((item) => item.returnId === selectedId) : null;
  const request = isReturns ? applied && requestOf(applied, detail) : unsettled.items.find((item) => item.requestId === selectedId);
  const busy = returns.actingId !== null || unsettled.actingId !== null;

  // 신청 목록이 새로 읽힐 때마다(처리 뒤 포함) 그 요청의 최신 수량을 다시 읽는다
  useEffect(() => {
    if (!applied) return undefined;
    let live = true;
    authFetch(`/api/resources/requests/${applied.requestId}`).then((data) => live && setDetail(data)).catch(() => {});
    return () => { live = false; };
  }, [applied]);

  // 탭 이름의 건수가 두 목록에서 오므로, 탭을 옮기면 두 목록과 건수를 다시 읽는다
  const reloadAll = () => {
    returns.reload();
    unsettled.reload();
  };
  const changeTab = (next) => {
    setTab(next);
    setSelectedId(null);
    reloadAll();
  };
  // 사이드바에서 이 메뉴를 다시 누르면 다시 읽고, 열려 있는 상세의 처리 이력도 새로 읽는다
  useEffect(() => {
    refreshRef.current = () => {
      reloadAll();
      if (request) list.loadHistory(request.requestId);
    };
  });

  const select = (id, requestId) => {
    setSelectedId(id);
    list.loadHistory(requestId);
  };

  const submit = async (reason, qty) => {
    const { action, item } = pending;
    if (action === "returnConfirm") await returns.confirm(item);
    else if (action === "returnReject") await returns.reject(item, reason);
    else await unsettled.loss(item, qty, reason);
    (action === "loss" ? returns : unsettled).reload(); // 처리한 쪽은 훅이 이미 새로 읽었으니, 반대쪽 목록·건수도 맞춘다
    // 실패해도 창을 닫는다. 서버 메시지는 화면 아래 알림으로 보인다.
    setPending(null);
  };

  // 반납 확인·반려 창은 요청 처리 창을 같이 쓰므로, 신청 수량을 quantity로 맞춰 넘긴다
  const modalItem = pending && (pending.action === "loss" ? pending.item : { ...pending.item, quantity: pending.item.appliedQty });
  const unsettledSummary = { total: unsettled.summary?.total, counts: { ...unsettled.summary?.counts, PENDING: returns.summary?.counts?.PENDING } };
  const tabs = [
    ["returns", `반납 신청 (대기 ${returns.summary?.counts?.PENDING || 0} / 전체 ${returns.summary?.total || 0})`],
    ["unsettled", `미정산 출고 (${unsettled.summary?.counts?.DISPATCHED || 0})`],
  ];

  return (
    <>
      <div className="@container flex-1 min-w-0 space-y-4">
        {header}
        <ResourceSummaryCards
          summary={isReturns ? returns.summary : unsettledSummary}
          cards={isReturns ? RETURN_CARDS : UNSETTLED_CARDS}
          scopeHint="접수된 전체 반납 신청"
          large
        />

        <div role="tablist" className="flex gap-1 border-b border-slate-200">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => changeTab(key)}
              className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-extrabold cursor-pointer ${tab === key ? "border-[#0F2540] text-[#0F2540]" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {!isReturns && (
          <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3.5 py-2.5 text-[13px] text-blue-800">
            <Info className="w-4 h-4 shrink-0" /> 미정산 출고는 아직 반납이 끝나지 않았거나, 반납 신청이 없어도 남은 수량이 있는 출고 건을 모두 포함합니다.
          </p>
        )}

        <ResourceFilterBar
          data={list}
          filters={isReturns ? RETURN_STATUS_FILTERS : []}
          searchFirst
          withDates
          dateLabel={isReturns ? "신청일" : "요청일"}
          placeholder={isReturns ? "요청번호(REQ-0003), 사건번호(INC-0003), 자원명, 신청자 검색" : "요청번호(REQ-0003), 사건번호(INC-0003), 사건명, 자원명, 요청자 검색"}
        />

        {list.error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{list.error}</div>}

        <AdminTable
          data={list}
          columns={isReturns ? RETURN_COLUMNS : UNSETTLED_COLUMNS}
          rowKey={(row) => (isReturns ? row.returnId : row.requestId)}
          selectedKey={selectedId}
          onSelect={(row) => select(isReturns ? row.returnId : row.requestId, row.requestId)}
          emptyText={
            list.keyword || list.dates.from || list.dates.to || (isReturns && list.status)
              ? "조건에 맞는 항목이 없습니다"
              : isReturns ? "접수된 반납 신청이 없습니다" : "미정산 출고가 없습니다"
          }
        />
      </div>

      {request && (
        <AdminRequestDetail
          title={isReturns ? "반납 신청 상세" : "미정산 출고 상세"}
          request={request}
          applied={applied}
          history={list.histories[request.requestId]}
          busy={busy}
          onAction={(action, item) => setPending({ action, item })}
          onClose={() => setSelectedId(null)}
        />
      )}

      {pending?.action === "returnConfirm" && (
        <AdminConfirmModal action="returnConfirm" request={modalItem} submitting={busy} onConfirm={() => submit()} onClose={() => setPending(null)} />
      )}
      {(pending?.action === "returnReject" || pending?.action === "loss") && (
        <AdminRejectModal action={pending.action} request={modalItem} submitting={busy} onSubmit={submit} onClose={() => setPending(null)} />
      )}
    </>
  );
}

// 반납 신청 패널이 쓰는 요청: 최신 내용을 읽어 오기 전에는 신청 행에 담긴 값으로 대신한다 (확인 대기 수량은 이 신청 한 건으로 본다)
function requestOf(applied, detail) {
  if (detail?.requestId === applied.requestId) return detail;
  const pendingQty = applied.status === "PENDING" ? applied.appliedQty : 0;
  return {
    ...applied,
    quantity: applied.requestQuantity,
    status: applied.requestStatus,
    returnable: "Y",
    pendingReturnQty: pendingQty,
    applicableReturnQty: Math.max(0, applied.requestQuantity - applied.returnedQty - applied.lostQty - pendingQty),
  };
}
