import { useMemo, useState } from "react";
import { Loader2, Package, X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  ITEM_CATEGORY_LABEL, MAX_REASON_LENGTH, formatQty, validateResourceRequestForm,
} from "../../constants/resource";

// 지금 시각을 datetime-local 입력칸 형식(YYYY-MM-DDTHH:mm)으로 만든다. 과거 시각을 못 고르게 하는 용도.
function nowForDateTimeInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 자원 요청 모달 - 사건 상세에서 "자원 요청" 버튼을 누르면 열린다.
export default function ResourceRequestModal({
  incident, incidentLabel, stocks, stocksLoading, stocksError, submitting, submitError, onSubmit, onClose,
}) {
  const [stockId, setStockId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [neededAt, setNeededAt] = useState("");
  const [localError, setLocalError] = useState("");

  useEscapeKey(true, onClose);

  // 사용 중인 재고만, 부서별로 묶어서 보여준다
  const stockGroups = useMemo(() => {
    const groups = new Map();
    stocks
      .filter((stock) => stock.status === "ACTIVE")
      .forEach((stock) => {
        const key = stock.departmentName || "부서 미지정";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(stock);
      });
    return Array.from(groups.entries());
  }, [stocks]);

  const selectedStock = stocks.find((stock) => String(stock.stockId) === stockId) || null;

  const handleSubmit = async () => {
    const message = validateResourceRequestForm({ stock: selectedStock, quantity, reason });
    setLocalError(message);
    if (message) return;
    await onSubmit({
      incidentId: incident.incidentId,
      stockId: selectedStock.stockId,
      quantity,
      reason,
      neededAt,
    });
  };

  const inputClass =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540] disabled:bg-slate-50";

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540] flex items-center gap-1.5">
            <Package className="w-4 h-4 text-[#244D7C]" /> 자원 요청
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {incidentLabel} {incident.title} 사건에 필요한 자원을 요청합니다. 자원 관리자가 승인하면 출고됩니다.
        </p>

        {stocksError && (
          <div className="mb-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{stocksError}</div>
        )}

        <label className="block text-xs font-bold text-slate-600 mb-1">요청할 자원</label>
        {stocksLoading ? (
          <div className="text-xs text-slate-400 py-2.5 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> 재고를 불러오는 중...
          </div>
        ) : (
          <select
            value={stockId}
            onChange={(e) => { setStockId(e.target.value); setLocalError(""); }}
            disabled={submitting}
            className={`${inputClass} mb-1`}
          >
            <option value="">자원을 선택하세요</option>
            {stockGroups.map(([departmentName, list]) => (
              <optgroup key={departmentName} label={departmentName}>
                {list.map((stock) => (
                  <option key={stock.stockId} value={stock.stockId}>
                    {stock.itemName} ({ITEM_CATEGORY_LABEL[stock.category] || stock.category}) · 가용{" "}
                    {formatQty(stock.availableQty, stock.unit)} / 총 {formatQty(stock.totalQty, stock.unit)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        <p className="text-[11px] text-slate-400 mb-3">
          가용 수량이 모자라도 요청은 보낼 수 있습니다. 가용 수량은 승인할 때 다시 확인합니다.
          {selectedStock && selectedStock.returnable === "Y" && " 이 자원은 사용 뒤 반납해야 합니다."}
          {selectedStock && selectedStock.returnable === "N" && " 이 자원은 소모품이라 반납하지 않습니다."}
        </p>

        <label className="block text-xs font-bold text-slate-600 mb-1">
          요청 수량{selectedStock ? ` (최대 ${formatQty(selectedStock.totalQty, selectedStock.unit)})` : ""}
        </label>
        <input
          type="number"
          min={1}
          max={selectedStock ? selectedStock.totalQty : undefined}
          step={1}
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); setLocalError(""); }}
          disabled={submitting}
          placeholder="수량을 입력하세요"
          className={`${inputClass} mb-3`}
        />

        <label className="block text-xs font-bold text-slate-600 mb-1">
          필요 시각 <span className="font-normal text-slate-400">(선택)</span>
        </label>
        <input
          type="datetime-local"
          min={nowForDateTimeInput()}
          value={neededAt}
          onChange={(e) => setNeededAt(e.target.value)}
          disabled={submitting}
          className={`${inputClass} mb-3`}
        />

        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-600">요청 사유</label>
          <span className="text-[10px] font-bold text-slate-400">{reason.length}/{MAX_REASON_LENGTH}</span>
        </div>
        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value.slice(0, MAX_REASON_LENGTH)); setLocalError(""); }}
          disabled={submitting}
          placeholder="왜 필요한지 입력하세요 (필수)"
          rows={3}
          maxLength={MAX_REASON_LENGTH}
          className={`${inputClass} mb-3 resize-none`}
        />

        {(localError || submitError) && (
          <div className="mb-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
            {localError || submitError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || stocksLoading}
            className="flex-1 text-sm font-bold text-white bg-[#0F2540] hover:bg-[#193A5B] rounded-lg py-2.5 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "요청 보내는 중..." : "요청 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
