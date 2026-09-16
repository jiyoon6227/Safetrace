import { X, XCircle } from "lucide-react";

export default function RejectModal({
  rejectTarget,
  setRejectTarget,
  rejectSubmitting,
  selectedReportIds,
  rejectReasonInput,
  setRejectReasonInput,
  submitReject,
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
      onClick={() => !rejectSubmitting && setRejectTarget(null)}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-500" /> 제보 반려
          </h3>
          <button
            onClick={() => setRejectTarget(null)}
            disabled={rejectSubmitting}
            className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {rejectTarget === "bulk"
            ? `선택한 ${selectedReportIds.size}건의 제보를 반려합니다. 반려 사유는 필수입니다.`
            : "이 제보를 반려합니다. 원본 제보는 삭제되지 않고 반려 사유와 함께 이력으로 남습니다."}
        </p>
        <textarea
          value={rejectReasonInput}
          onChange={(e) => setRejectReasonInput(e.target.value)}
          placeholder="반려 사유를 입력하세요 (필수)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#0F2540]"
          rows={3}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setRejectTarget(null)}
            disabled={rejectSubmitting}
            className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={submitReject}
            disabled={rejectSubmitting || !rejectReasonInput.trim()}
            className="flex-1 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg py-2.5 disabled:opacity-50 cursor-pointer"
          >
            {rejectSubmitting ? "처리 중..." : "반려 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}
