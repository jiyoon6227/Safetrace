import { Loader2, Package } from "lucide-react";
import { MY_RESOURCES_PAGE_SIZE, useMyResources } from "./useMyResources";
import ResourceFilterBar from "./ResourceFilterBar";
import ResourceRequestCard from "./ResourceRequestCard";
import ResourceSummaryCards from "./ResourceSummaryCards";
import ReturnApplyModal from "./ReturnApplyModal";
import TablePagination from "./TablePagination";

const CONTROL = "border border-slate-300 rounded-lg bg-white px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#0F2540]";

// 사이드바 "자원 관리" 탭 - 내가 보낸 전체 자원 요청을 상태·사건·검색어로 찾고, 취소·도착 확인·반납 신청을 한다.
export default function ResourcesTab({
  currentUser, incidents, incidentRank, initialIncidentId, onOpenIncident, onGoIncidents, setToast,
}) {
  const data = useMyResources({ initialIncidentId, setToast });
  const totalPages = Math.max(1, Math.ceil(data.total / MY_RESOURCES_PAGE_SIZE));

  // 사건 선택 목록: 사건 관리와 같은 번호(#I-n)와 제목. 주소로 들어온 사건이 목록에 없어도 선택값은 유지한다.
  const incidentOptions = Array.isArray(incidents) ? incidents : [];
  const selectedMissing = data.incidentId && !incidentOptions.some((inc) => inc.incidentId === data.incidentId);
  const hasFilter = Boolean(data.status || data.incidentId || data.keyword);

  const returnRequest = data.returnTarget
    ? data.items.find((r) => r.requestId === data.returnTarget.requestId) || data.returnTarget
    : null;

  return (
    <main className="px-5 py-4 bg-[#F7F9FC] min-h-[calc(100vh-64px)]">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">자원 관리</h1>
          <p className="text-[13px] text-slate-500 mt-2">내가 요청한 자원을 확인하고 도착 확인과 반납 신청을 합니다.</p>
        </div>

        <ResourceSummaryCards summary={data.summary} />

        <ResourceFilterBar data={data}>
          <select
            value={data.incidentId ?? ""}
            onChange={(e) => data.changeIncident(e.target.value ? Number(e.target.value) : null)}
            aria-label="사건 선택"
            className={`${CONTROL} font-semibold sm:w-60 max-w-full`}
          >
            <option value="">전체 사건</option>
            {selectedMissing && <option value={data.incidentId}>사건 {data.incidentId}</option>}
            {incidentOptions.map((inc) => (
              <option key={inc.incidentId} value={inc.incidentId}>
                #I-{incidentRank.get(inc.incidentId)} {inc.title}
              </option>
            ))}
          </select>
        </ResourceFilterBar>

        {data.error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{data.error}</div>}

        <h2 className="flex items-center gap-1.5 text-base font-extrabold text-[#0F2540] pt-1">
          <Package className="w-4 h-4 text-[#244D7C]" /> 자원 요청 목록 ({data.total}건)
        </h2>

        {data.loading && data.items.length === 0 ? (
          <div className="text-xs text-slate-400 py-12 text-center flex items-center justify-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중...
          </div>
        ) : data.items.length === 0 ? (
          !data.error && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
              <Package className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600 mt-2">
                {hasFilter ? "조건에 맞는 자원 요청이 없습니다" : "아직 요청한 자원이 없습니다"}
              </p>
              <p className="text-xs text-slate-400 mt-1">자원 요청은 사건 관리에서 사건을 열어 보낼 수 있습니다.</p>
              <button
                type="button"
                onClick={onGoIncidents}
                className="mt-3 text-xs font-bold text-[#0F2540] border border-[#0F2540] rounded-lg px-3.5 py-2 hover:bg-slate-100 cursor-pointer"
              >
                사건 관리로 이동
              </button>
            </div>
          )
        ) : (
          <>
            <ul className="space-y-3">
              {data.items.map((request) => (
                <ResourceRequestCard
                  key={request.requestId}
                  request={request}
                  incidentLabel={incidentRank.get(request.incidentId) ? `#I-${incidentRank.get(request.incidentId)}` : ""}
                  currentUser={currentUser}
                  busy={data.actingId !== null}
                  history={data.histories[request.requestId]}
                  onToggleHistory={data.toggleHistory}
                  onCancel={data.cancelRequest}
                  onArrive={data.arriveRequest}
                  onOpenReturn={data.openReturnModal}
                  onOpenIncident={onOpenIncident}
                />
              ))}
            </ul>
            <TablePagination currentPage={data.page} totalPages={totalPages} setPage={data.setPage} />
          </>
        )}
      </div>

      {returnRequest && (
        <ReturnApplyModal
          request={returnRequest}
          applications={data.returnApplications}
          applicationsLoading={data.returnLoading}
          applicationsError={data.returnLoadError}
          submitting={data.returnSubmitting}
          submitError={data.returnSubmitError}
          onSubmit={data.submitReturn}
          onClose={data.closeReturnModal}
        />
      )}
    </main>
  );
}
