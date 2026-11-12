import { AlertTriangle, X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_STYLE, formatQty } from "../../constants/resource";

// 사건 종료 확인 모달 - 종료하면 취소될 출고 전 자원 요청과, 종료 뒤에도 남는 미반납 건수를 보여준다.
// "확인하고 종료"를 누르면 여기 보인 출고 전 요청 번호를 서버에 함께 보내 종료한다.
export default function IncidentCloseConfirmModal({
  incidentLabel, incident, preview, submitting, error, onConfirm, onCancel,
}) {
  useEscapeKey(!submitting, onCancel);

  const openRequests = preview.openRequests || [];
  const dispatchedCount = preview.dispatchedCount || 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> 사건 종료 확인
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {incidentLabel} {incident.title} 사건을 종료하기 전에 자원 요청 현황을 확인해 주세요.
        </p>

        {openRequests.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-extrabold text-[#0F2540] mb-1.5">
              종료하면 취소되는 자원 요청 ({openRequests.length}건)
            </div>
            <ul className="space-y-1.5 mb-1.5">
              {openRequests.map((request) => (
                <li
                  key={request.requestId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate">
                      {request.itemName} {formatQty(request.quantity, request.unit)}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{request.departmentName}</div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      REQUEST_STATUS_STYLE[request.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {REQUEST_STATUS_LABEL[request.status] || request.status}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500">
              승인된 요청은 예약해 둔 수량이 재고로 되돌아갑니다.
            </p>
          </div>
        )}

        {dispatchedCount > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <p className="text-xs font-bold text-amber-800">
              출고된 뒤 아직 반납이 끝나지 않은 자원이 {dispatchedCount}건 있습니다.
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              사건을 종료해도 이 건은 취소되지 않고 그대로 남습니다. 반납·손실 처리는 종료 뒤에도 계속할 수 있습니다.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 text-sm font-bold text-white bg-[#0F2540] hover:bg-[#193A5B] rounded-lg py-2.5 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "종료 처리 중..." : "확인하고 종료"}
          </button>
        </div>
      </div>
    </div>
  );
}
