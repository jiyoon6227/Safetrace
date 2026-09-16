import { Link2, X, Image as ImageIcon } from "lucide-react";
import { formatDateTime } from "./constants";

export default function LinkedReportsModal({
  setShowLinkedReportsModal,
  linkedReports,
  pagedLinkedReports,
  linkedReportsModalPage,
  setLinkedReportsModalPage,
  linkedReportsModalTotalPages,
  setActiveNav,
  setSelectedReportId,
  setViewingPhotoUrl,
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-6"
      onClick={() => setShowLinkedReportsModal(false)}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[680px] max-h-[82vh] overflow-hidden border border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Link2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[17px] font-extrabold text-[#0F2540]">연결된 제보 전체보기 ({linkedReports.length}건)</h3>
              <p className="mt-1 text-[12px] text-slate-400">현재 사건에 연결된 모든 제보를 접수일시 기준으로 확인할 수 있습니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLinkedReportsModal(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <colgroup>
                <col className="w-[82px]" />
                <col className="w-[86px]" />
                <col />
                <col className="w-[138px]" />
                <col className="w-[72px]" />
              </colgroup>

              <thead className="bg-slate-100">
                <tr className="border-b border-slate-300">
                  <th className="border-r border-slate-200 px-3 py-3 text-center text-[12px] font-bold text-[#0F2540] whitespace-nowrap">제보번호</th>
                  <th className="border-r border-slate-200 px-3 py-3 text-center text-[12px] font-bold text-[#0F2540] whitespace-nowrap">재난유형</th>
                  <th className="border-r border-slate-200 px-3 py-3 text-center text-[12px] font-bold text-[#0F2540] whitespace-nowrap">제보내용</th>
                  <th className="border-r border-slate-200 px-3 py-3 text-center text-[12px] font-bold text-[#0F2540] whitespace-nowrap">접수일시</th>
                  <th className="px-3 py-3 text-center text-[12px] font-bold text-[#0F2540] whitespace-nowrap">첨부</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {pagedLinkedReports.map((report) => (
                  <tr
                    key={report.reportId}
                    onClick={() => {
                      setShowLinkedReportsModal(false);
                      setActiveNav("reports");
                      setSelectedReportId(report.reportId);
                    }}
                    className="border-b border-slate-200 last:border-b-0 hover:bg-blue-50/60 transition-colors cursor-pointer"
                  >
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center font-extrabold text-[#0F2540] whitespace-nowrap">#R-{report.reportId}</td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                        {report.disasterType || "-"}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-[13px] text-slate-600 leading-5" title={report.content}>
                      <div className="line-clamp-2">{report.content || "-"}</div>
                    </td>
                    <td className="border-r border-slate-200 px-3 py-3.5 text-center text-[12px] text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateTime(report.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {report.photoUrl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingPhotoUrl(`http://localhost:8080${report.photoUrl}`);
                          }}
                          className="relative inline-flex w-8 h-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition cursor-pointer"
                          aria-label={`제보 #R-${report.reportId} 첨부 사진 보기`}
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[12px] text-slate-500">
            <span className="justify-self-start">총 {linkedReports.length}건</span>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={linkedReportsModalPage === 1}
                onClick={() => setLinkedReportsModalPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ‹
              </button>

              {Array.from({ length: linkedReportsModalTotalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setLinkedReportsModalPage(page)}
                  className={`w-8 h-8 rounded-lg border text-[12px] font-bold transition cursor-pointer ${linkedReportsModalPage === page ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={linkedReportsModalPage === linkedReportsModalTotalPages}
                onClick={() => setLinkedReportsModalPage((p) => Math.min(linkedReportsModalTotalPages, p + 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ›
              </button>
            </div>

            <span className="justify-self-end">{linkedReportsModalPage} / {linkedReportsModalTotalPages} 페이지</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1 flex items-center gap-2 rounded-lg bg-blue-50 px-3.5 py-2.5 text-[12px] text-slate-500">
              <span className="w-5 h-5 rounded-full border border-blue-500 text-blue-600 flex items-center justify-center font-bold shrink-0">i</span>
              <span>연결된 제보는 접수일시 기준으로 최신순 정렬되어 있습니다.</span>
            </div>

            <button
              type="button"
              onClick={() => setShowLinkedReportsModal(false)}
              className="shrink-0 min-w-[92px] h-10 rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-bold text-[#0F2540] hover:bg-slate-50 transition cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
