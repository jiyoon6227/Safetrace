import { Loader2 } from "lucide-react";
import TablePagination from "../ControlBoard/TablePagination";
import { MY_RESOURCES_PAGE_SIZE } from "../ControlBoard/useMyResources";

export const LOADING = (
  <div className="text-xs text-slate-400 py-12 text-center flex items-center justify-center gap-1.5">
    <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
  </div>
);

// 표는 놓인 칸 폭(@container)에 맞춰 칸을 줄인다. 줄어든 내용은 첫 칸 아래에 덧붙여 보인다 (예: @3xl:hidden 줄)
export const SHOW_3XL = "hidden @3xl:table-cell";
export const SHOW_4XL = "hidden @4xl:table-cell";
export const SHOW_5XL = "hidden @5xl:table-cell";
const CELL = "px-3 py-3.5 @3xl:px-3.5";

// ADMIN 목록 표 - 요청·출고, 반납 신청, 미정산 출고가 같이 쓴다. 상세 패널을 여는 행 선택, 빈 목록·불러오는 중 안내, 쪽 번호까지 맡는다.
// columns: [{ head, show(칸 숨김 클래스), cell(행) => 내용 }], data는 useMyResources가 돌려준 값
export default function AdminTable({ data, columns, rowKey, selectedKey, onSelect, emptyText }) {
  const { items, total, page } = data;
  const first = (page - 1) * MY_RESOURCES_PAGE_SIZE + 1;
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-[13px] text-slate-600 border-b border-slate-200">
            <tr>
              {columns.map(({ head, show = "" }) => <th key={head} className={`${CELL} py-3 font-bold ${show}`}>{head}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row) => {
              const selected = rowKey(row) === selectedKey;
              return (
                <tr
                  key={rowKey(row)}
                  onClick={() => onSelect(row)}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(row)}
                  tabIndex={0}
                  className={`cursor-pointer transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#244D7C] ${selected ? "bg-[#EAF1FB]" : "hover:bg-slate-50"}`}
                >
                  {columns.map(({ head, show = "", cell }, index) => (
                    <td key={head} className={`${CELL} ${show} ${index === 0 && selected ? "shadow-[inset_3px_0_0_#244D7C]" : ""}`}>{cell(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (data.loading ? LOADING : !data.error && <p className="py-12 text-center text-sm font-bold text-slate-500">{emptyText}</p>)}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-slate-500">
          총 {total}건{items.length > 0 && ` 중 ${first}-${first + items.length - 1}건`}
        </span>
        <TablePagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / MY_RESOURCES_PAGE_SIZE))} setPage={data.setPage} />
      </div>
    </>
  );
}
