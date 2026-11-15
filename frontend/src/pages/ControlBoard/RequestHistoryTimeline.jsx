import { Check, Loader2 } from "lucide-react";
import { formatDateTime } from "./constants";

// 요청 처리 이력(서버가 만든 단계 목록) - 지난 처리는 체크, 지금 해야 할 단계는 강조, 남은 단계는 회색으로 보여준다
// compact는 ADMIN 상세 패널용: 항상 세로로, 완료(실선·체크)/진행 중(강조)/예정(점선·흐림)을 구분하고 시각·담당자·내용을 한 단계에 모아 보여준다
export default function RequestHistoryTimeline({ history, compact, emptyText = "처리 이력이 없습니다." }) {
  if (history?.loading) {
    return (
      <div className="text-xs text-slate-400 flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
      </div>
    );
  }
  if (history?.error) {
    return <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{history.error}</div>;
  }
  const steps = history?.steps || [];
  if (steps.length === 0) return <div className="text-xs text-slate-400">{emptyText}</div>;

  if (compact) {
    return (
      <ol>
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {index < steps.length - 1 && (
              <span aria-hidden="true" className={`absolute left-[11px] top-6 -bottom-0.5 border-l-2 ${step.done ? "border-[#244D7C]" : "border-dashed border-slate-300"}`} />
            )}
            <span
              className={`relative shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step.done ? "bg-[#244D7C] text-white"
                  : step.current ? "bg-white text-[#244D7C] border-2 border-[#244D7C] ring-4 ring-[#244D7C]/15"
                    : "bg-white text-slate-400 border-2 border-dashed border-slate-300"
              }`}
            >
              {step.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[15px] font-extrabold ${step.done || step.current ? "text-[#0F2540]" : "text-slate-400"}`}>{step.label}</span>
                <span className={`shrink-0 text-[13px] ${step.current ? "font-bold text-[#244D7C]" : step.done ? "text-slate-500" : "text-slate-400"}`}>
                  {step.done ? formatDateTime(step.time) : step.current ? "진행 중" : "예정"}
                </span>
              </div>
              {step.done && (step.by || step.note) && (
                <div className="mt-0.5 text-sm text-slate-600 break-keep [overflow-wrap:anywhere]">{[step.by, step.note].filter(Boolean).join(" · ")}</div>
              )}
              {step.current && step.note && <div className="mt-1.5 rounded-lg bg-[#F3F7FD] px-3 py-2 text-sm text-slate-700 break-keep [overflow-wrap:anywhere]">{step.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  const current = steps.find((step) => step.current);

  // 놓인 자리의 너비에 맞춘다: 넓은 카드에서는 가로, 좁은 상세 패널에서는 세로
  return (
    <div className="@container">
      <ol className="grid gap-4 @2xl:grid-flow-col @2xl:auto-cols-fr">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex @2xl:flex-col items-start @2xl:items-center gap-3 @2xl:gap-2 @2xl:text-center">
            {index < steps.length - 1 && (
              <>
                <span
                  aria-hidden="true"
                  className={`hidden @2xl:block absolute top-[14.5px] left-1/2 w-full h-[3px] ${step.done ? "bg-[#244D7C]" : "bg-slate-300"}`}
                />
                <span
                  aria-hidden="true"
                  className={`@2xl:hidden absolute left-[14.5px] top-8 -bottom-4 w-[3px] ${step.done ? "bg-[#244D7C]" : "bg-slate-300"}`}
                />
              </>
            )}
            <span
              className={`relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step.done ? "bg-[#244D7C] text-white"
                  : step.current ? "bg-[#0F2540] text-white ring-4 ring-[#244D7C]/25"
                    : "bg-white text-slate-500 border-2 border-slate-300"
              }`}
            >
              {step.done ? <Check className="w-4 h-4" strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 flex-1 @2xl:flex-none @2xl:w-full @2xl:px-1">
              <div className={`text-[15px] font-extrabold ${step.done || step.current ? "text-[#0F2540]" : "text-slate-600"}`}>{step.label}</div>
              <div className={`mt-0.5 text-[13px] break-words ${step.current ? "font-bold text-[#244D7C]" : "text-slate-700"}`}>
                {step.done ? `${formatDateTime(step.time)}${step.by ? ` · ${step.by}` : ""}` : step.current ? "진행 중" : "예정"}
              </div>
              {step.done && step.note && <div className="mt-1 text-[13px] text-slate-800 break-keep [overflow-wrap:anywhere]">{step.note}</div>}
            </div>
          </li>
        ))}
      </ol>
      {current?.note && (
        <p className="mt-4 rounded-lg border border-slate-200 border-l-4 border-l-[#244D7C] bg-white px-4 py-2.5 text-sm text-[#0F2540]">
          <b className="font-extrabold">{current.label}</b> 단계 · {current.note}
        </p>
      )}
    </div>
  );
}
