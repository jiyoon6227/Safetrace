import { Loader2, X } from "lucide-react";

export default function BulkMergeModal({
  bulkMergeSubmitting, setBulkMergeOpen, selectedReportIds, bulkMergeLoading, bulkMergeCandidates,
  incidentRank, handleBulkLinkToIncident, startBulkNewIncident,
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
      onClick={() => !bulkMergeSubmitting && setBulkMergeOpen(false)}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540]">선택한 제보 {selectedReportIds.size}건 합치기</h3>
          <button
            onClick={() => setBulkMergeOpen(false)}
            disabled={bulkMergeSubmitting}
            className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          체크한 제보 전부가 아래에서 고른 사건 하나에 연결됩니다. 이미 다른 사건에 연결된 제보가 있으면 그 사건도 후보에 포함되고, 나머지는 첫 번째로 선택한 제보의 재난유형·위치 기준으로 찾았습니다.
        </p>

        {bulkMergeLoading ? (
          <div className="h-[140px] flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />후보 사건을 찾는 중...
          </div>
        ) : bulkMergeCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-600">병합 가능한 기존 사건이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">선택한 제보들을 묶어서 새 사건으로 등록해주세요.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 mb-2">
            {bulkMergeCandidates.map((inc) => (
              <div key={inc.incidentId} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0F2540] truncate">{inc.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1">사건 #{incidentRank.get(inc.incidentId) ?? inc.incidentId} · {inc.region}</p>
                </div>
                <button
                  type="button"
                  disabled={bulkMergeSubmitting}
                  onClick={() => handleBulkLinkToIncident(inc.incidentId)}
                  className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                >
                  이 사건에 연결
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={startBulkNewIncident}
          disabled={bulkMergeSubmitting}
          className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
        >
          {selectedReportIds.size}건을 묶어서 새 사건으로 만들기
        </button>
      </div>
    </div>
  );
}
