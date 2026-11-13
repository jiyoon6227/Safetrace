import { X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { ADMIN_ACTION_LABEL, ADMIN_CONFIRM_TEXT, formatQty, getAdminConfirmMessage } from "../../constants/resource";

// 출고·승인 취소·반납 확인처럼 되돌리기 어려운 처리를 한 번 더 확인하는 창.
// 반납 확인은 반납 신청 한 건을 request로 넘기되 quantity에 신청 수량을 담는다.
export default function AdminConfirmModal({ action, request, submitting, onConfirm, onClose }) {
  useEscapeKey(!submitting, onClose);
  const label = ADMIN_ACTION_LABEL[action];
  const text = ADMIN_CONFIRM_TEXT[action] || { title: `${label} 확인`, submit: `${label} 확정` };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[#0F2540]">{text.title}</h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {request.itemName} {formatQty(request.quantity, request.unit)}
        </p>
        <p className="text-xs text-slate-400 mb-3">
          {request.departmentName} · {request.incidentTitle}
        </p>
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 mb-4 leading-relaxed whitespace-pre-line">
          {getAdminConfirmMessage(action, request)}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            닫기
          </button>
          <button onClick={onConfirm} disabled={submitting} className="flex-1 text-sm font-bold text-white bg-[#0F2540] hover:bg-[#193A5B] rounded-lg py-2.5 disabled:opacity-50 cursor-pointer">
            {submitting ? "처리 중..." : text.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
