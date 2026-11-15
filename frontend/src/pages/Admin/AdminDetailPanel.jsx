import { X } from "lucide-react";
import { ACTION_BUTTON } from "../../constants/resource";

export const SECTION_TITLE = "flex items-center gap-1.5 text-[15px] font-extrabold text-[#0F2540] mb-2.5";

// ADMIN 오른쪽 상세 패널의 틀 - 제목·닫기, 스크롤되는 본문(children), 아래 안내(notice)·처리 버튼(actions)·닫기 버튼.
// 요청·출고, 반납·정산, 재고 관리가 같이 쓴다.
export default function AdminDetailPanel({ title, onClose, notice, actions, children }) {
  return (
    <>
      {/* 좁은 화면에서는 패널이 목록 위로 뜨므로, 바깥을 누르면 닫히게 한다 */}
      <div className="fixed inset-0 z-30 bg-slate-900/20 xl:hidden" onClick={onClose} />
      <aside
        aria-label={title}
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white border-l border-slate-200 shadow-xl xl:sticky xl:top-4 xl:bottom-auto xl:z-auto xl:shrink-0 xl:w-[27.5rem] xl:max-h-[calc(100vh-6rem)] xl:rounded-xl xl:border xl:shadow-sm"
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-xl font-extrabold text-[#0F2540]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="상세 닫기" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">{children}</div>

        <div className="shrink-0 px-5 py-3.5 border-t border-slate-200 bg-white xl:rounded-b-xl">
          {notice && <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2.5 text-[13px] leading-relaxed text-orange-800">{notice}</p>}
          <div className="flex flex-wrap gap-2">
            {actions}
            <button type="button" onClick={onClose} className={`grow ${ACTION_BUTTON} font-semibold text-slate-600 border-slate-300 bg-white hover:bg-slate-100`}>
              닫기
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// 기본 정보 표: rows는 [이름, 내용] 목록이고 내용이 비면 그 줄은 숨긴다
export function DetailInfo({ rows }) {
  return (
    <dl className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden text-sm">
      {rows.filter(([, value]) => value).map(([label, value]) => (
        <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)]">
          <dt className="bg-slate-50 px-3 py-2 text-slate-500">{label}</dt>
          <dd className="px-3 py-2 font-medium text-slate-900 leading-relaxed break-keep [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
