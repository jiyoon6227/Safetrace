import { useState } from "react";
import { X, XCircle } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { MAX_REASON_LENGTH, formatQty, validateRejectReason } from "../../constants/resource";

// 요청 반려 창 - 사유를 입력받아 onSubmit(reason)을 부른다
export default function AdminRejectModal({ request, submitting, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const message = validateRejectReason(reason);

  useEscapeKey(!submitting, onClose);

  const submit = () => {
    setTouched(true);
    if (message) return;
    onSubmit(reason);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-500" /> 요청 반려
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-1">
          {request.itemName} {formatQty(request.quantity, request.unit)} · {request.departmentName}
        </p>
        <p className="text-xs text-slate-400 mb-4">반려 사유는 필수이며 요청한 담당자에게 그대로 보입니다.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="반려 사유를 입력하세요 (필수)"
          maxLength={MAX_REASON_LENGTH + 50}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-[#0F2540]"
          rows={3}
        />
        <div className="flex items-center justify-between mb-3 text-[11px]">
          <span className="text-rose-500">{touched ? message : ""}</span>
          <span className="text-slate-400">{reason.trim().length}/{MAX_REASON_LENGTH}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            취소
          </button>
          <button onClick={submit} disabled={submitting} className="flex-1 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg py-2.5 disabled:opacity-50 cursor-pointer">
            {submitting ? "처리 중..." : "반려 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}
