import { useState } from "react";
import { Loader2, Undo2, X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  MAX_REASON_LENGTH, RETURN_STATUS_LABEL, RETURN_STATUS_STYLE, formatQty, getApplicableReturnQty,
  validateReturnForm,
} from "../../constants/resource";
import { formatDateTime } from "./constants";

// 반납 신청 모달 - 출고된 반납 대상 물품을 돌려보낼 수량을 신청한다.
// 신청만으로는 재고가 변하지 않고, 자원 관리자가 확인해야 반영된다.
export default function ReturnApplyModal({
  request, applications, applicationsLoading, applicationsError, submitting, submitError, onSubmit, onClose,
}) {
  const applicableQty = getApplicableReturnQty(request, applications);
  const [quantity, setQuantity] = useState("");
  const [memo, setMemo] = useState("");
  const [localError, setLocalError] = useState("");

  useEscapeKey(!submitting, onClose);

  const handleSubmit = async () => {
    const message = validateReturnForm({ quantity, applicableQty, memo, unit: request.unit });
    setLocalError(message);
    if (message) return;
    await onSubmit({ requestId: request.requestId, quantity, memo });
  };

  const inputClass =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540] disabled:bg-slate-50";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
            <Undo2 className="w-4 h-4 text-[#244D7C]" /> 반납 신청
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          신청해도 재고는 바로 바뀌지 않고, 자원 관리자가 확인하면 반영됩니다.
        </p>

        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 mb-3 space-y-0.5">
          <div className="font-bold text-slate-700">
            {request.itemName} {formatQty(request.quantity, request.unit)}
            <span className="ml-1.5 font-normal text-slate-400">· {request.departmentName}</span>
          </div>
          <div>
            반납 확인 {formatQty(request.returnedQty || 0, request.unit)} · 손실 {formatQty(request.lostQty || 0, request.unit)}
          </div>
          <div className="font-semibold text-[#0F2540]">
            지금 신청할 수 있는 수량 {applicationsLoading ? "확인 중..." : formatQty(applicableQty, request.unit)}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-[11px] font-bold text-slate-500 mb-1">이 요청의 반납 신청 내역</div>
          {applicationsLoading ? (
            <div className="text-xs text-slate-400 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
            </div>
          ) : applicationsError ? (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{applicationsError}</div>
          ) : applications.length === 0 ? (
            <div className="text-xs text-slate-400">아직 신청한 내역이 없습니다.</div>
          ) : (
            <ul className="space-y-1.5">
              {applications.map((app) => (
                <li key={app.returnId} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{formatQty(app.appliedQty, request.unit)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RETURN_STATUS_STYLE[app.status] || "bg-slate-100 text-slate-600"}`}>
                      {RETURN_STATUS_LABEL[app.status] || app.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">신청 {formatDateTime(app.appliedAt)}</div>
                  {app.applyMemo && <div className="text-[11px] text-slate-500 mt-0.5 break-words">{app.applyMemo}</div>}
                  {app.status === "REJECTED" && app.rejectReason && (
                    <div className="text-[11px] text-rose-600 mt-0.5 break-words">반려 사유: {app.rejectReason}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">반납 수량 *</span>
            <input
              type="number"
              min={1}
              max={applicableQty || undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={submitting || applicableQty < 1}
              placeholder={applicableQty > 0 ? `1 ~ ${applicableQty}` : "신청할 수 있는 수량이 없습니다"}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">메모 (선택)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              maxLength={MAX_REASON_LENGTH + 50}
              disabled={submitting}
              placeholder="상태나 전달 방법 등을 적어주세요"
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>

        {(localError || submitError) && (
          <div className="mt-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{localError || submitError}</div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={submitting} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            닫기
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || applicationsLoading || applicableQty < 1}
            className="flex-1 text-sm font-bold text-white bg-[#0F2540] hover:bg-[#193A5B] rounded-lg py-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "신청 중..." : "반납 신청"}
          </button>
        </div>
      </div>
    </div>
  );
}
