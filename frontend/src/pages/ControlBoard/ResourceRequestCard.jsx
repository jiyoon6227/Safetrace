import { Building2, CalendarClock, Check, ChevronDown, ExternalLink, Droplets, FileText, Gift, HardHat, MessageSquareText, Package, Truck } from "lucide-react";
import { formatDateTime } from "./constants";
import RequestHistoryTimeline from "./RequestHistoryTimeline";
import RequestStatusBadge from "./RequestStatusBadge";
import {
  CANCELLABLE_REQUEST_STATUSES, ITEM_CATEGORY_LABEL, formatQty,
} from "../../constants/resource";

const CATEGORY_ICON = { DRAINAGE: Droplets, RESCUE: HardHat, RELIEF: Gift, VEHICLE: Truck };

const BUTTON = "min-w-[5.5rem] text-center text-[13px] font-bold rounded-lg border px-3.5 py-2 whitespace-nowrap disabled:opacity-50 cursor-pointer";

// 자원 관리 탭의 요청 한 건 - 한 줄 요약(품목·부서·사건·사유·시각·상태·버튼)과 펼쳐 보는 처리 이력
export default function ResourceRequestCard({
  request, incidentLabel, currentUser, busy, history, onToggleHistory, onCancel, onArrive, onOpenReturn, onOpenIncident,
}) {
  const isMine = request.requesterId === currentUser?.memberId;
  const cancellable = CANCELLABLE_REQUEST_STATUSES.includes(request.status) && isMine;
  const open = Boolean(history?.open);
  const Icon = CATEGORY_ICON[request.category] || Package;

  return (
    <li className={`rounded-xl border bg-white ${open ? "border-[#244D7C]" : "border-slate-200"}`}>
      <div className="grid gap-x-4 gap-y-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_auto] xl:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-12 h-12 rounded-xl bg-[#EAF1FB] text-[#244D7C] flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-[#0F2540] truncate">{request.itemName}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[13px] text-slate-700">
              <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5">수량 <b className="font-extrabold text-[#0F2540]">{formatQty(request.quantity, request.unit)}</b></span>
              <span className="truncate">
                {ITEM_CATEGORY_LABEL[request.category] || request.category}{request.returnable === "N" && " · 소모품"}
              </span>
            </div>
          </div>
        </div>

        <dl className="text-sm space-y-2 min-w-0 xl:border-l xl:border-slate-100 xl:pl-4">
          <div className="flex items-center gap-2">
            <dt className="shrink-0 w-24 flex items-center gap-1.5 text-slate-600"><Building2 className="w-4 h-4" /> 보유 부서</dt>
            <dd className="font-medium text-slate-900 truncate">{request.departmentName}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="shrink-0 w-24 flex items-center gap-1.5 text-slate-600"><FileText className="w-4 h-4" /> 사건명</dt>
            <dd className="min-w-0">
              <button
                type="button"
                onClick={() => onOpenIncident(request.incidentId)}
                title="사건 관리에서 이 사건 열기"
                className="max-w-full inline-flex items-center gap-1 font-semibold text-[#244D7C] hover:underline cursor-pointer"
              >
                <span className="truncate">{incidentLabel && `${incidentLabel} `}{request.incidentTitle}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </button>
            </dd>
          </div>
        </dl>

        <div className="text-sm min-w-0 space-y-2 xl:border-l xl:border-slate-100 xl:pl-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-600"><MessageSquareText className="w-4 h-4" /> 요청 사유</div>
            <p className="mt-0.5 font-medium text-slate-900 break-keep line-clamp-2">{request.reason}</p>
            {request.status === "REJECTED" && request.rejectReason && (
              <p className="mt-1 text-[13px] text-rose-700 bg-rose-50 rounded px-2 py-1 break-words">반려 사유: {request.rejectReason}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-slate-600" />
            <span className="text-slate-600">요청 시각</span>
            <span className="font-medium text-slate-900">{formatDateTime(request.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap xl:justify-end xl:border-l xl:border-slate-100 xl:pl-4">
          <RequestStatusBadge status={request.status} className="px-3.5 py-1.5 text-[13px]" />
          <div className="flex flex-wrap items-center gap-2">
            {request.canArrive && (
              <button type="button" onClick={() => onArrive(request.requestId)} disabled={busy} className={`${BUTTON} text-white border-[#0F2540] bg-[#0F2540] hover:bg-[#193A5B]`}>
                도착 확인
              </button>
            )}
            {isMine && request.arrivedAt && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                <Check className="w-3.5 h-3.5" /> 도착 확인 완료
              </span>
            )}
            {request.canApplyReturn && (
              <button type="button" onClick={() => onOpenReturn(request)} disabled={busy} className={`${BUTTON} text-[#0F2540] border-[#0F2540] bg-white hover:bg-slate-100`}>
                반납 신청
              </button>
            )}
            {cancellable && (
              <button type="button" onClick={() => onCancel(request.requestId)} disabled={busy} className={`${BUTTON} font-semibold text-slate-600 border-slate-300 bg-white hover:bg-slate-100`}>
                요청 취소
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={open ? "mx-3 mb-3 rounded-lg border border-[#D6E2F3] bg-[#F3F7FD]" : "border-t border-slate-100"}>
        <button
          type="button"
          onClick={() => onToggleHistory(request.requestId)}
          aria-expanded={open}
          className="flex items-center gap-1 px-4 py-2.5 text-[13px] font-bold text-[#0F2540] cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} /> 처리 이력
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-700">
              {request.neededAt && <span>필요 시각 {formatDateTime(request.neededAt)}</span>}
              {request.arrivedAt && <span>도착 확인 {formatDateTime(request.arrivedAt)}</span>}
              {request.returnable === "Y" && ["DISPATCHED", "SETTLED"].includes(request.status) && (
                <span>반납 {formatQty(request.returnedQty || 0, request.unit)} · 손실 {formatQty(request.lostQty || 0, request.unit)}</span>
              )}
            </div>
            <RequestHistoryTimeline history={history} />
          </div>
        )}
      </div>
    </li>
  );
}
