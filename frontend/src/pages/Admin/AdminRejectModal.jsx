import { useState } from "react";
import { AlertTriangle, X, XCircle } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  ADMIN_REASON_FORM, MAX_REASON_LENGTH, formatQty, getLossPreview, validateLossForm, validateReason,
} from "../../constants/resource";

// 사유를 입력받는 처리 창: 요청 반려·반납 반려(action 기본값 reject, returnReject)와 손실 확정(loss).
// 손실 확정은 수량도 입력받고, 처리 뒤 결과를 미리 보여준다. onSubmit(reason, quantity)을 부른다.
// 반납 반려는 반납 신청 한 건을 request로 넘기되 quantity에 신청 수량을 담는다.
export default function AdminRejectModal({ action = "reject", request, submitting, onSubmit, onClose }) {
  const form = ADMIN_REASON_FORM[action];
  const isLoss = action === "loss";
  const maxQty = request.applicableReturnQty || 0;
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState("");
  const [touched, setTouched] = useState(false);
  const message = isLoss
    ? validateLossForm({ quantity: qty, maxQty, reason, unit: request.unit })
    : validateReason(reason, form.reasonLabel);
  const preview = isLoss ? getLossPreview(request, qty) : "";
  const TitleIcon = isLoss ? AlertTriangle : XCircle;

  useEscapeKey(!submitting, onClose);

  const submit = () => {
    setTouched(true);
    if (message) return;
    onSubmit(reason, isLoss ? Number(qty) : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
            <TitleIcon className="w-4 h-4 text-rose-500" /> {form.title}
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-1">
          {request.itemName} {formatQty(request.quantity, request.unit)} · {request.departmentName}
        </p>
        <p className="text-xs text-slate-400 mb-4">{form.hint}</p>
        {isLoss && (
          <div className="mb-3">
            <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-2 leading-relaxed">
              반납 {formatQty(request.returnedQty || 0, request.unit)} · 손실 {formatQty(request.lostQty || 0, request.unit)}
              {request.pendingReturnQty > 0 && ` · 확인 대기 ${formatQty(request.pendingReturnQty, request.unit)}`}
              <br />
              <b className="text-[#0F2540]">확정 가능 {formatQty(maxQty, request.unit)}</b>
            </div>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="손실 수량 (필수)"
              aria-label="손실 수량"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
            />
          </div>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`${form.reasonLabel}를 입력하세요 (필수)`}
          maxLength={MAX_REASON_LENGTH + 50}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-[#0F2540]"
          rows={3}
        />
        <div className="flex items-center justify-between mb-3 text-[11px]">
          <span className="text-rose-500">{touched ? message : ""}</span>
          <span className="text-slate-400">{reason.trim().length}/{MAX_REASON_LENGTH}</span>
        </div>
        {preview && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2.5 mb-3 leading-relaxed whitespace-pre-line">{preview}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            취소
          </button>
          <button onClick={submit} disabled={submitting} className="flex-1 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg py-2.5 disabled:opacity-50 cursor-pointer">
            {submitting ? "처리 중..." : form.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
