import { Loader2, Package, Plus, RefreshCw } from "lucide-react";
import { formatDateTime } from "./constants";
import {
  CANCELLABLE_REQUEST_STATUSES, REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, formatQty,
  getResourceRequestAvailability,
} from "../../constants/resource";

// 사건 상세의 "자원 요청" 영역 - 이 사건에 보낸 자원 요청 목록과 요청/취소 버튼
export default function IncidentResourcesSection({
  incident, currentUser, requests, requestsTotal, requestsLoading, requestsError, loadRequests,
  cancellingId, cancelRequest, openRequestModal,
}) {
  const availability = getResourceRequestAvailability(currentUser, incident);

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3 mt-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-[13px] font-extrabold text-[#0F2540] flex items-center gap-1.5">
          <Package className="w-4 h-4 text-[#244D7C]" /> 자원 요청 ({requestsTotal}건)
        </h4>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadRequests(incident.incidentId)}
            disabled={requestsLoading}
            aria-label="자원 요청 목록 새로고침"
            title="새로고침"
            className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-500 flex items-center justify-center hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${requestsLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={openRequestModal}
            disabled={!availability.allowed}
            title={availability.reason || "이 사건에 필요한 자원을 요청합니다."}
            className="flex items-center gap-1 bg-[#0F2540] text-white rounded-lg px-3.5 py-2 text-xs font-bold hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> 자원 요청
          </button>
        </div>
      </div>

      {!availability.allowed && availability.reason && (
        <p className="text-[11px] text-slate-400 mb-2">{availability.reason}</p>
      )}

      {requestsError && (
        <div className="mb-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{requestsError}</div>
      )}

      {requestsLoading && requests.length === 0 ? (
        <div className="text-xs text-slate-400 py-5 text-center flex items-center justify-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
        </div>
      ) : requests.length === 0 ? (
        !requestsError && (
          <div className="text-xs text-slate-400 py-5 text-center">이 사건에 보낸 자원 요청이 없습니다.</div>
        )
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => {
            const cancellable = CANCELLABLE_REQUEST_STATUSES.includes(request.status)
              && request.requesterId === currentUser?.memberId;
            return (
              <li key={request.requestId} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700">
                      {request.itemName} {formatQty(request.quantity, request.unit)}
                      <span className="ml-1.5 font-normal text-slate-400">· {request.departmentName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      요청 {formatDateTime(request.createdAt)}
                      {request.neededAt && ` · 필요 ${formatDateTime(request.neededAt)}`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      REQUEST_STATUS_STYLE[request.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {REQUEST_STATUS_LABEL[request.status] || request.status}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 mt-1.5 break-words">{request.reason}</p>

                {request.status === "REJECTED" && request.rejectReason && (
                  <p className="text-[11px] text-rose-600 mt-1 break-words">반려 사유: {request.rejectReason}</p>
                )}
                {request.returnable === "Y" && ["DISPATCHED", "SETTLED"].includes(request.status) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    반납 {formatQty(request.returnedQty || 0, request.unit)} · 손실 {formatQty(request.lostQty || 0, request.unit)}
                  </p>
                )}

                {cancellable && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => cancelRequest(request.requestId)}
                      disabled={cancellingId !== null}
                      className="text-[11px] font-semibold text-slate-500 border border-slate-300 bg-white rounded-md px-2.5 py-1 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                    >
                      {cancellingId === request.requestId ? "취소 중..." : "요청 취소"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {requestsTotal > requests.length && (
        <p className="text-[11px] text-slate-400 mt-2 text-center">
          {requests.length}건만 표시합니다. (전체 {requestsTotal}건)
        </p>
      )}
    </div>
  );
}
