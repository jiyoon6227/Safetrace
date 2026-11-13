import { useState } from "react";
import { Building2, CalendarClock, CheckCircle2, ClipboardList, Clock, FileText, Loader2, MessageSquareText, RotateCcw, User, XCircle } from "lucide-react";
import TablePagination from "../ControlBoard/TablePagination";
import RequestStatusBadge from "../ControlBoard/RequestStatusBadge";
import ResourceFilterBar from "../ControlBoard/ResourceFilterBar";
import ResourceSummaryCards from "../ControlBoard/ResourceSummaryCards";
import { formatDateTime } from "../ControlBoard/constants";
import {
  ACTION_BUTTON, ADMIN_ACTION_LABEL, ADMIN_BUTTON_STYLE, RETURN_STATUS_FILTERS, RETURN_STATUS_LABEL, RETURN_STATUS_STYLE, formatQty,
} from "../../constants/resource";
import { RETURNS_PAGE_SIZE, useAdminReturns } from "./useAdminReturns";
import AdminRejectModal from "./AdminRejectModal";
import AdminConfirmModal from "./AdminConfirmModal";

const RETURN_CARDS = [
  { label: "전체 반납 신청", Icon: ClipboardList, tone: "bg-blue-50 text-blue-600" },
  { label: "확인 대기", hint: "관리자 확인이 필요한 신청", Icon: Clock, tone: "bg-amber-50 text-amber-600", statuses: ["PENDING"] },
  { label: "반납 확인됨", hint: "가용 수량에 반영 완료", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", statuses: ["CONFIRMED"] },
  { label: "반려", hint: "재고 변화 없음", Icon: XCircle, tone: "bg-rose-50 text-rose-600", statuses: ["REJECTED"] },
];

function Row({ Icon, label, children }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="shrink-0 w-24 flex items-center gap-1.5 text-slate-600"><Icon className="w-4 h-4" /> {label}</dt>
      <dd className="font-medium text-slate-900 truncate">{children}</dd>
    </div>
  );
}

// 반납 신청 한 건. 요청 카드와 같은 칸 구성(품목·부서/사건/신청자·내용·상태/버튼)
function ReturnCard({ item, busy, onAction }) {
  const { unit } = item;
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="grid gap-x-4 gap-y-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_auto] xl:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-12 h-12 rounded-xl bg-[#EAF1FB] text-[#244D7C] flex items-center justify-center">
            <RotateCcw className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-[#0F2540] truncate">{item.itemName}</div>
            <div className="mt-1 text-[13px] text-slate-700">
              <span className="whitespace-nowrap rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5">반납 신청 <b className="font-extrabold text-[#0F2540]">{formatQty(item.appliedQty, unit)}</b></span>
            </div>
          </div>
        </div>

        <dl className="text-sm space-y-2 min-w-0 xl:border-l xl:border-slate-100 xl:pl-4">
          <Row Icon={Building2} label="보유 부서">{item.departmentName}</Row>
          <Row Icon={FileText} label="사건명">{item.incidentTitle}</Row>
          <Row Icon={User} label="신청자">{item.applicantName}</Row>
        </dl>

        <div className="text-sm min-w-0 space-y-2 xl:border-l xl:border-slate-100 xl:pl-4">
          <div className="text-[13px] text-slate-700">
            요청 #{item.requestId} 전체 {formatQty(item.requestQuantity, unit)} · 반납 {formatQty(item.returnedQty || 0, unit)} · 손실 {formatQty(item.lostQty || 0, unit)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-600"><MessageSquareText className="w-4 h-4" /> 신청 메모</div>
            <p className="mt-0.5 font-medium text-slate-900 break-keep line-clamp-2">{item.applyMemo || "-"}</p>
            {item.status === "REJECTED" && item.rejectReason && (
              <p className="mt-1 text-[13px] text-rose-700 bg-rose-50 rounded px-2 py-1 break-words">반려 사유: {item.rejectReason}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-slate-600" /><span className="text-slate-600">신청</span><span className="font-medium text-slate-900">{formatDateTime(item.appliedAt)}</span></span>
            {item.processedAt && <span className="text-slate-600">처리 <span className="font-medium text-slate-900">{item.processedByName} · {formatDateTime(item.processedAt)}</span></span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap xl:justify-end xl:border-l xl:border-slate-100 xl:pl-6">
          <RequestStatusBadge status={item.status} labels={RETURN_STATUS_LABEL} styles={RETURN_STATUS_STYLE} className="px-3.5 py-1.5 text-[13px]" />
          {item.status === "PENDING" && (
            <div className="flex flex-wrap items-center gap-2.5">
              {["returnConfirm", "returnReject"].map((action) => (
                <button key={action} type="button" onClick={() => onAction(action, item)} disabled={busy} className={`${ACTION_BUTTON} ${ADMIN_BUTTON_STYLE[action]}`}>
                  {ADMIN_ACTION_LABEL[action]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ADMIN 반납 관리 - 현황 카드, 상태 필터, 반납 신청 목록, 반납 확인·반려
export default function AdminReturnsTab({ setToast }) {
  const data = useAdminReturns({ setToast });
  const [pending, setPending] = useState(null); // { action: "returnConfirm" | "returnReject", item }
  const totalPages = Math.max(1, Math.ceil(data.total / RETURNS_PAGE_SIZE));

  const submitPending = async (reason) => {
    const { action, item } = pending;
    if (action === "returnConfirm") await data.confirm(item.returnId);
    else await data.reject(item.returnId, reason);
    // 실패해도 창을 닫는다. 서버 메시지는 화면 아래 알림으로 보인다.
    setPending(null);
  };

  // 확인·반려 창은 요청 카드용 창을 같이 쓰므로, 신청 수량을 quantity로 맞춰 넘긴다
  const modalRequest = pending && { ...pending.item, quantity: pending.item.appliedQty };

  return (
    <div className="space-y-3">
      <ResourceSummaryCards summary={data.summary} cards={RETURN_CARDS} scopeHint="접수된 전체 반납 신청" />
      <ResourceFilterBar data={data} filters={RETURN_STATUS_FILTERS} />

      {data.error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{data.error}</div>}

      <h2 className="flex items-center gap-1.5 text-base font-extrabold text-[#0F2540] pt-1">
        <RotateCcw className="w-4 h-4 text-[#244D7C]" /> 반납 신청 목록 ({data.total}건)
      </h2>

      {data.loading && data.items.length === 0 ? (
        <div className="text-xs text-slate-400 py-12 text-center flex items-center justify-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
        </div>
      ) : data.items.length === 0 ? (
        !data.error && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
            <RotateCcw className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600 mt-2">
              {data.status ? "조건에 맞는 반납 신청이 없습니다" : "접수된 반납 신청이 없습니다"}
            </p>
          </div>
        )
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((item) => (
              <ReturnCard key={item.returnId} item={item} busy={data.actingId !== null} onAction={(action, target) => setPending({ action, item: target })} />
            ))}
          </ul>
          <TablePagination currentPage={data.page} totalPages={totalPages} setPage={data.setPage} />
        </>
      )}

      {pending?.action === "returnConfirm" && (
        <AdminConfirmModal action="returnConfirm" request={modalRequest} submitting={data.actingId !== null} onConfirm={() => submitPending()} onClose={() => setPending(null)} />
      )}
      {pending?.action === "returnReject" && (
        <AdminRejectModal action="returnReject" request={modalRequest} submitting={data.actingId !== null} onSubmit={submitPending} onClose={() => setPending(null)} />
      )}
    </div>
  );
}
