import { RefreshCw, RotateCcw, Search } from "lucide-react";
import { REQUEST_STATUS_FILTERS } from "../../constants/resource";

export const FILTER_CONTROL = "border border-slate-300 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#0F2540]";

// 목록 위의 상태 칩(건수 포함)·검색창(조회 버튼·Enter로 적용)·새로고침. data는 useMyResources(또는 useAdminReturns)가 돌려준 값이고,
// children은 검색창 앞에 끼울 화면별 조건(예: STAFF의 사건 선택)이다. data에 search가 없으면 검색창은 숨긴다. 입력 중인 검색어(keywordInput)는 조회 전까지 목록에 영향이 없고, 적용된 검색어는 data.keyword다.
// ADMIN 요청·출고 관리는 검색창을 위에 두고(searchFirst) 요청 기간 입력(withDates)과 초기화 버튼을 함께 보여준다. filterLabel은 칩 줄 앞의 이름표다 (품목 관리는 분류별).
export default function ResourceFilterBar({
  data, filters = REQUEST_STATUS_FILTERS, children, searchFirst, withDates, placeholder = "품목명, 사유, 사건명으로 검색하세요.", dateLabel = "요청일", filterLabel = "상태별 보기",
}) {
  const counts = data.summary?.counts || {};
  const searchable = Boolean(data.search);
  const tall = withDates ? " h-10" : ""; // ADMIN은 입력칸과 버튼 높이를 맞춘다
  const BTN = `flex items-center justify-center gap-1.5 border rounded-lg px-3.5 py-2 text-[13px] font-bold transition cursor-pointer disabled:opacity-50${tall}`;
  const BUTTON = `${BTN} border-slate-300 bg-white text-slate-600 hover:bg-slate-100`;
  const startStatus = data.defaultStatus ?? ""; // 처음부터 상태가 정해진 목록(미정산 출고)은 초기화해도 그 상태로 돌아간다
  const filtered = Boolean(data.keywordInput || data.keyword || data.status !== startStatus || data.dates?.from || data.dates?.to);
  const reset = () => {
    data.search(""); // 입력값과 적용된 검색어를 모두 비운다
    data.changeDates({ from: "", to: "" });
    data.changeStatus(startStatus);
  };
  const refresh = (
    <button type="button" onClick={data.reload} disabled={data.loading} className={BUTTON}>
      <RefreshCw className={`w-4 h-4 ${data.loading ? "animate-spin" : ""}`} /> 새로고침
    </button>
  );
  return (
    <div className={`rounded-xl border border-slate-200 bg-white flex ${searchFirst ? "flex-col-reverse gap-3.5 p-4" : "flex-col gap-3 p-3.5"}`}>
      <div className={`flex flex-wrap items-center gap-1.5 ${searchFirst ? "border-t border-slate-100 pt-3.5" : ""} ${searchFirst && !filters.length ? "hidden" : ""}`}>
        {searchFirst && <span className="mr-1 text-[13px] font-bold text-slate-500">{filterLabel}</span>}
        {filters.map((filter) => (
          <button
            key={filter.value || "all"}
            type="button"
            onClick={() => data.changeStatus(filter.value)}
            className={`text-[13px] font-bold rounded-full px-3.5 py-1.5 transition cursor-pointer ${
              data.status === filter.value ? "bg-[#0F2540] text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {filter.label} ({filter.value ? counts[filter.value] || 0 : data.summary?.total || 0})
          </button>
        ))}
        {!searchable && <span className="ml-auto">{refresh}</span>}
      </div>
      {searchable && (
        <div className={`flex gap-2 ${withDates ? "flex-wrap items-center" : "flex-col sm:flex-row sm:items-center"}`}>
          {children}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              data.search();
            }}
            className={`flex flex-1 gap-2 ${withDates ? "min-w-[15rem]" : "min-w-0"}`}
          >
            <input
              type="text"
              value={data.keywordInput}
              onChange={(e) => data.setKeywordInput(e.target.value)}
              maxLength={50}
              placeholder={placeholder}
              aria-label="자원 요청 검색"
              className={`${FILTER_CONTROL} min-w-0 flex-1${tall}`}
            />
            <button type="submit" className={`${BTN} border-[#0F2540] bg-[#0F2540] text-white hover:bg-[#193A5B]`}>
              <Search className="w-4 h-4" /> 조회
            </button>
          </form>
          {withDates && (
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
              {dateLabel}
              {["from", "to"].map((key) => (
                <span key={key} className="flex items-center gap-1.5">
                  {key === "to" && <span className="text-slate-400">~</span>}
                  <input
                    type="date"
                    value={data.dates[key]}
                    onChange={(e) => data.changeDates({ ...data.dates, [key]: e.target.value })}
                    aria-label={key === "from" ? "요청 기간 시작일" : "요청 기간 종료일"}
                    className={`${FILTER_CONTROL} w-[9.5rem]${tall}`}
                  />
                </span>
              ))}
            </div>
          )}
          {withDates && (
            <button type="button" onClick={reset} disabled={!filtered} className={BUTTON}>
              <RotateCcw className="w-4 h-4" /> 초기화
            </button>
          )}
          {refresh}
        </div>
      )}
    </div>
  );
}
