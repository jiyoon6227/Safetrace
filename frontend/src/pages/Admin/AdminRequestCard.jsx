import { formatDateTime } from "../ControlBoard/constants";
import {
  ADMIN_ACTION_LABEL, ITEM_CATEGORY_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, formatQty,
  getAdminRequestActions,
} from "../../constants/resource";

const ACTION_STYLE = {
  approve: "bg-[#0F2540] text-white hover:bg-[#193A5B]",
  dispatch: "bg-[#0F2540] text-white hover:bg-[#193A5B]",
  reject: "border border-rose-300 text-rose-600 bg-white hover:bg-rose-50",
  cancel: "border border-slate-300 text-slate-600 bg-white hover:bg-slate-100",
};

// 요청 한 건 카드 - 내용과 상태별 처리 버튼
export default function AdminRequestCard({ request, busy, onAction }) {
  const actions = getAdminRequestActions(request);
  return (
    <li className="rounded-xl border border-slate-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-[#0F2540]">
            {request.itemName} {formatQty(request.quantity, request.unit)}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {ITEM_CATEGORY_LABEL[request.category] || request.category} · {request.departmentName}
              {request.returnable === "N" && " · 소모품"}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            사건: {request.incidentTitle} · 요청자: {request.requesterName}
            {request.requesterDepartmentName && `(${request.requesterDepartmentName})`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            요청 {formatDateTime(request.createdAt)}
            {request.neededAt && ` · 필요 ${formatDateTime(request.neededAt)}`}
          </div>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${REQUEST_STATUS_STYLE[request.status] || "bg-slate-100 text-slate-600"}`}>
          {REQUEST_STATUS_LABEL[request.status] || request.status}
        </span>
      </div>

      <p className="text-xs text-slate-600 mt-2 break-words">{request.reason}</p>
      {request.status === "REJECTED" && request.rejectReason && (
        <p className="text-xs text-rose-600 mt-1 break-words">반려 사유: {request.rejectReason}</p>
      )}
      {request.returnable === "Y" && ["DISPATCHED", "SETTLED"].includes(request.status) && (
        <p className="text-xs text-slate-500 mt-1">
          반납 {formatQty(request.returnedQty || 0, request.unit)} · 손실 {formatQty(request.lostQty || 0, request.unit)}
        </p>
      )}

      {request.arrivedAt && (
        <p className="text-xs text-slate-500 mt-1">담당자 도착 확인 {formatDateTime(request.arrivedAt)}</p>
      )}

      {actions.length > 0 && (
        <div className="flex justify-end gap-2 mt-3">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => onAction(action, request)}
              className={`text-xs font-bold rounded-lg px-3.5 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${ACTION_STYLE[action]}`}
            >
              {ADMIN_ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
