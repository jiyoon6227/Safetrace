import { useState } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { STOCK_FORMS, formatQty, returnableLabel, validateStockForm } from "../../constants/resource";

const INPUT = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]";

// 재고·품목 처리 입력창 - 입력칸은 STOCK_FORMS(constants/resource.js)의 정의대로 그린다.
// onSubmit(입력값)은 성공하면 빈 값, 실패하면 서버 메시지를 돌려주고, 실패하면 창을 열어 둔 채 메시지를 보여준다.
// options는 select 칸에 채울 [값, 이름] 목록 (부서·품목). 정의에 options가 있으면 그것을 쓴다.
export default function AdminFormModal({ kind, target, options = {}, onSubmit, onClose }) {
  const form = STOCK_FORMS[kind];
  const [values, setValues] = useState(() => ({ ...Object.fromEntries(form.fields.map(({ name }) => [name, ""])), ...form.init?.(target) }));
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEscapeKey(!submitting, onClose);

  const message = validateStockForm(kind, values);
  const submit = async () => {
    setTouched(true);
    if (message) return;
    setSubmitting(true);
    setError("");
    const failure = await onSubmit(values);
    if (failure) {
      setError(failure);
      setSubmitting(false);
    } else {
      onClose();
    }
  };

  // 대상 안내: 재고는 부서·품목과 현재 수량, 품목은 수정할 수 없는 단위·반납형 여부
  const subject = target?.stockId
    ? [`${target.departmentName} · ${target.itemName}`, `총 보유량 ${formatQty(target.totalQty, target.unit)} · 가용 ${formatQty(target.availableQty, target.unit)}`]
    : target?.itemId && [target.name, `단위 ${target.unit} · ${returnableLabel(target)} (수정할 수 없음)`];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[#0F2540]">{form.title}</h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
        {subject && (
          <>
            <p className="text-sm font-semibold text-slate-700">{subject[0]}</p>
            <p className="text-xs text-slate-400">{subject[1]}</p>
          </>
        )}
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 my-3 leading-relaxed">{form.hint}</p>

        <div className="space-y-3 mb-3">
          {form.fields.map(({ name, label, type, optional, options: fixed, placeholder, nonZero }) => {
            const delta = Number(values[name]); // 0이 안 되는 칸(조정 수량)은 증가·감소를 보여 준다
            const props = { id: `form-${name}`, value: values[name], onChange: (e) => setValues((prev) => ({ ...prev, [name]: e.target.value })), className: INPUT, disabled: submitting };
            return (
              <div key={name}>
                <label htmlFor={props.id} className="block text-[13px] font-semibold text-slate-600 mb-1">
                  {label}{optional && <span className="font-normal text-slate-400"> (선택)</span>}
                </label>
                {type === "select" ? (
                  <select {...props}>
                    <option value="">선택하세요</option>
                    {(fixed || options[name] || []).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                ) : type === "textarea" ? (
                  <textarea {...props} rows={3} />
                ) : (
                  <input {...props} type={type} step={type === "number" ? 1 : undefined} placeholder={placeholder} />
                )}
                {nonZero && Number.isInteger(delta) && delta !== 0 && (
                  <p className={`mt-1 text-xs font-bold ${delta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {delta > 0 ? "+" : "-"}{formatQty(Math.abs(delta), target?.unit)} {delta > 0 ? "증가" : "감소"}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {(touched && message) || error ? <p role="alert" className="text-xs text-rose-500 mb-3">{error || message}</p> : null}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            취소
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className={`flex-1 text-sm font-bold text-white rounded-lg py-2.5 disabled:opacity-50 cursor-pointer ${kind === "stockDeactivate" ? "bg-rose-500 hover:bg-rose-600" : "bg-[#0F2540] hover:bg-[#193A5B]"}`}
          >
            {submitting ? "처리 중..." : form.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
