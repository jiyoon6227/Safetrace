import { ArrowRight, Loader2, Package, Plus, RefreshCw } from "lucide-react";
import { formatDateTime } from "./constants";
import RequestStatusBadge from "./RequestStatusBadge";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, formatQty, getResourceRequestAvailability } from "../../constants/resource";

// 사건 상세의 "자원 요청" 요약 - 상태별 건수(서버 집계), 최근 요청 3건, 요청 버튼.
// 취소·도착 확인·반납 신청 같은 처리는 "자원 관리" 탭에서 한다.
export default function IncidentResourcesSection({
  incident, currentUser, requests, requestsTotal, requestCounts, requestsLoading, requestsError, loadRequests,
  openRequestModal, onOpenResourceTab,
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
        <>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {Object.entries(requestCounts).filter(([, count]) => count > 0).map(([status, count]) => (
              <span
                key={status}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${REQUEST_STATUS_STYLE[status] || "bg-slate-100 text-slate-600"}`}
              >
                {REQUEST_STATUS_LABEL[status] || status} {count}
              </span>
            ))}
          </div>

          <ul className="space-y-1.5">
            {requests.map((request) => (
              <li
                key={request.requestId}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-700 truncate">
                    {request.itemName} {formatQty(request.quantity, request.unit)}
                    <span className="ml-1.5 font-normal text-slate-400">· {request.departmentName}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">요청 {formatDateTime(request.createdAt)}</div>
                </div>
                <RequestStatusBadge status={request.status} className="px-2 py-0.5 text-[10px]" />
              </li>
            ))}
          </ul>
        </>
      )}

      {requestsTotal > 0 && (
        <div className="flex justify-end mt-2.5">
          <button
            type="button"
            onClick={() => onOpenResourceTab(incident.incidentId)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#244D7C] hover:underline cursor-pointer"
          >
            자원 관리에서 전체 보기 <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
