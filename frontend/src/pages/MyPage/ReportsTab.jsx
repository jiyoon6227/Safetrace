import { useEffect, useState } from "react";
import { MapPin, Camera, ChevronRight, X, XCircle, Clock, Search, FileText } from "lucide-react";
import { authFetch } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  STATUS_LABEL_KO, DISASTER_ICON, REPORT_STATUS_FILTERS, REPORT_STATE_LABEL, REPORT_STATE_STYLE, DISASTER_TYPE_STYLE,
  DISASTER_TYPE_TEXT_COLOR, REPORT_STATUS_STYLE, REPORT_STATUS_DOT,
  formatDateTime, formatDateTimeFull,
} from "./constants";

// ---- 내 제보 내역 --------------------------------------------------------------

export default function ReportsTab({ reports = [], loading, onChanged }) {
  const [incidentInfo, setIncidentInfo] = useState({});
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" | "oldest"
  const [reportPage, setReportPage] = useState(1);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null); // 사진 확대 모달
  const [detailReportId, setDetailReportId] = useState(null); // 상세보기 모달
  useEscapeKey(!!previewPhotoUrl, () => setPreviewPhotoUrl(null));
  useEscapeKey(!!detailReportId, () => setDetailReportId(null));
  const [detailTimeline, setDetailTimeline] = useState([]);
  const [detailTimelineLoading, setDetailTimelineLoading] = useState(false);
  // 사건에 아직 연결 안 된 제보는 incident.region이 없어서(사건 자체가 없음) 위치가 항상 "-"로 뜸.
  // 제보 자체엔 위경도만 있어서, 카카오 리버스 지오코딩으로 좌표 -> 주소 문자열을 따로 조회해둠.
  const [reportAddresses, setReportAddresses] = useState({});

  useEffect(() => {
    const uniqueIds = [...new Set(reports.filter((r) => r.incidentId).map((r) => r.incidentId))];
    uniqueIds.forEach((id) => {
      if (!incidentInfo[id]) {
        authFetch(`/api/incidents/${id}`)
          .then((data) => setIncidentInfo((prev) => ({ ...prev, [id]: data })))
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  useEffect(() => {
    const targets = reports.filter((r) => !r.incidentId && !reportAddresses[r.reportId]);
    if (targets.length === 0 || !window.kakao?.maps) return;
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      targets.forEach((r) => {
        if (r.latitude == null || r.longitude == null) return;
        geocoder.coord2Address(r.longitude, r.latitude, (result, status) => {
          const addr =
            status === window.kakao.maps.services.Status.OK && result[0]
              ? result[0].road_address?.address_name || result[0].address?.address_name || "주소 확인 불가"
              : "주소 확인 불가";
          setReportAddresses((prev) => ({ ...prev, [r.reportId]: addr }));
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  // 제보 상태와 사건 상태를 분리한다.
  // 제보: 등록 -> 검토중 -> 사건연결 / 반려
  // 사건: 접수 -> 확인중 -> 대응중 -> 복구중 -> 종료
  const reportStateOf = (report) => {
    const code = report.status || (report.incidentId ? "LINKED" : "RECEIVED");
    return {
      code,
      label: REPORT_STATE_LABEL[code] || code,
      style: REPORT_STATE_STYLE[code] || REPORT_STATE_STYLE.RECEIVED,
    };
  };

  const incidentStateOf = (report) => {
    if (!report.incidentId) return null;
    const incident = incidentInfo[report.incidentId];
    if (!incident) return { label: "사건 확인 중...", style: "bg-slate-100 text-slate-500" };
    return {
      label: `사건 ${STATUS_LABEL_KO[incident.status] || incident.status}`,
      style: REPORT_STATUS_STYLE[incident.status] || REPORT_STATUS_STYLE.RECEIVED,
    };
  };

  const q = searchQuery.trim();
  const filtered = reports
    .filter((r) => filter === "all" || reportStateOf(r).code === filter)
    .filter((r) => {
      if (!q) return true;
      const incident = r.incidentId ? incidentInfo[r.incidentId] : null;
      const haystack = `${incident?.title || ""} ${r.content || ""} ${incident?.region || ""} ${r.disasterType}`;
      return haystack.includes(q);
    });
  const sorted = [...filtered].sort((a, b) =>
    sortOrder === "newest" ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt)
  );

  const REPORT_PAGE_SIZE = 5;
  const reportTotalPages = Math.max(1, Math.ceil(sorted.length / REPORT_PAGE_SIZE));
  const pagedReports = sorted.slice(
    (reportPage - 1) * REPORT_PAGE_SIZE,
    reportPage * REPORT_PAGE_SIZE
  );

  useEffect(() => {
    setReportPage(1);
  }, [filter, searchQuery, sortOrder]);

  useEffect(() => {
    if (reportPage > reportTotalPages) setReportPage(reportTotalPages);
  }, [reportPage, reportTotalPages]);

  const countOf = (group) => reports.filter((r) => group === "all" || reportStateOf(r).code === group).length;

  const openDetail = async (report) => {
    setDetailReportId(report.reportId);
    if (!report.incidentId) {
      setDetailTimeline([]);
      return;
    }
    setDetailTimelineLoading(true);
    try {
      const data = await authFetch(`/api/incidents/${report.incidentId}/timeline`);
      setDetailTimeline(data);
    } catch {
      setDetailTimeline([]);
    } finally {
      setDetailTimelineLoading(false);
    }
  };

  const detailReport = sorted.find((r) => r.reportId === detailReportId) || reports.find((r) => r.reportId === detailReportId);
  const detailIncident = detailReport?.incidentId ? incidentInfo[detailReport.incidentId] : null;
  const detailReportState = detailReport ? reportStateOf(detailReport) : null;
  const detailIncidentState = detailReport ? incidentStateOf(detailReport) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F2540]">내 제보 내역</h2>
        <p className="text-sm text-slate-500">내가 등록한 현장제보와 처리 상태를 확인할 수 있습니다.</p>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {REPORT_STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition cursor-pointer ${
              filter === key ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {label}
            <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center bg-blue-500 text-white">
              {countOf(key)}
            </span>
          </button>
        ))}

        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3.5 py-2 ml-auto">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제보 제목이나 내용을 검색하세요."
            className="w-full bg-transparent outline-none text-xs placeholder:text-slate-400"
          />
        </div>

        <div className="relative shrink-0">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="appearance-none text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full pl-3.5 pr-8 py-2 outline-none cursor-pointer"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-400 p-5">불러오는 중...</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">해당하는 제보가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 tracking-wide">
                  <th className="px-5 py-4 align-middle">제보 내용</th>
                  <th className="px-4 py-4 align-middle whitespace-nowrap text-center">유형</th>
                  <th className="px-4 py-4 align-middle whitespace-nowrap text-center">등록일시</th>
                  <th className="px-4 py-4 align-middle text-center">위치</th>
                  <th className="px-4 py-4 align-middle whitespace-nowrap text-center">상태</th>
                  <th className="px-5 py-4 align-middle whitespace-nowrap text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {pagedReports.map((r) => {
                  const reportState = reportStateOf(r);
                  const incidentState = incidentStateOf(r);
                  const incident = r.incidentId ? incidentInfo[r.incidentId] : null;
                  const DisasterIcon = DISASTER_ICON[r.disasterType] || Camera;
                  const d = new Date(r.createdAt);
                  const dateLabel = d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
                  const timeLabel = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={r.reportId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition align-middle">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => r.photoUrl && setPreviewPhotoUrl(`http://localhost:8080${r.photoUrl}`)}
                            className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                            aria-label="사진 확대"
                          >
                            {r.photoUrl ? (
                              <img src={`http://localhost:8080${r.photoUrl}`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-[#0F2540] truncate">{incident?.title || `${r.disasterType} 제보`}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">#{r.reportId}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5 max-w-[260px]">{r.content || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${DISASTER_TYPE_TEXT_COLOR[r.disasterType] || "text-slate-600"}`}>
                          <DisasterIcon className="w-3.5 h-3.5 shrink-0" />{r.disasterType}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>
                            <span className="block tabular-nums">{dateLabel}</span>
                            <span className="block tabular-nums text-slate-400">{timeLabel}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle max-w-[190px]">
                        <span className="flex items-start justify-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                          <span className="leading-snug">{incident?.region || reportAddresses[r.reportId] || "주소 확인 중..."}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${reportState.style}`}>{reportState.label}</span>
                          {incidentState && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${incidentState.style}`}>{incidentState.label}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle text-center whitespace-nowrap">
                        <button
                          onClick={() => openDetail(r)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 hover:text-blue-600 transition cursor-pointer"
                        >
                          상세보기 <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && sorted.length > 0 && reportTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => setReportPage((prev) => Math.max(1, prev - 1))}
              disabled={reportPage === 1}
              className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
                reportPage === 1
                  ? "border-slate-200 text-slate-300 cursor-not-allowed"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              ‹
            </button>

            {Array.from({ length: reportTotalPages }, (_, index) => {
              const page = index + 1;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setReportPage(page)}
                  className={`min-w-8 h-8 px-2 rounded-lg text-sm font-bold transition cursor-pointer ${
                    reportPage === page
                      ? "bg-[#0F2540] text-white"
                      : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setReportPage((prev) => Math.min(reportTotalPages, prev + 1))}
              disabled={reportPage === reportTotalPages}
              className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
                reportPage === reportTotalPages
                  ? "border-slate-200 text-slate-300 cursor-not-allowed"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* 첨부사진 확대 미리보기 모달 */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white cursor-pointer"
              aria-label="닫기"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewPhotoUrl} alt="첨부사진" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* 상세보기 모달 - 제보 내용 + 처리 타임라인 */}
      {detailReportId && detailReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setDetailReportId(null)}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="font-extrabold text-[#0F2540]">제보 상세</h2>
              <button onClick={() => setDetailReportId(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${detailReportState.style}`}>{detailReportState.label}</span>
                {detailIncidentState && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${detailIncidentState.style}`}>{detailIncidentState.label}</span>
                )}
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${DISASTER_TYPE_STYLE[detailReport.disasterType] || "bg-slate-100 text-slate-600"}`}>
                  {detailReport.disasterType}
                </span>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">#{detailReport.reportId}</span>
              </div>

              {detailReport.photoUrl && (
                <img
                  src={`http://localhost:8080${detailReport.photoUrl}`}
                  alt=""
                  className="w-full h-44 object-cover rounded-xl cursor-pointer"
                  onClick={() => setPreviewPhotoUrl(`http://localhost:8080${detailReport.photoUrl}`)}
                />
              )}

              <div>
                <h3 className="font-bold text-[#0F2540] text-sm mb-1">{detailIncident?.title || `${detailReport.disasterType} 제보`}</h3>
                <p className="text-sm text-slate-600 leading-6">{detailReport.content || "등록된 내용이 없습니다."}</p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {formatDateTimeFull(detailReport.createdAt)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {detailIncident?.region || reportAddresses[detailReport.reportId] || "주소 확인 중..."}
              </div>

              {detailReport.status === "REJECTED" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
                  <div className="flex items-center gap-2 text-rose-600">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <h4 className="text-sm font-extrabold">반려 사유</h4>
                  </div>
                  <p className="mt-2 text-[13px] leading-5 text-slate-700 whitespace-pre-wrap">
                    {detailReport.rejectReason || "반려 사유가 기록되지 않았습니다."}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-[#0F2540] mb-2">처리 타임라인</h4>
                {detailReport.status === "REJECTED" ? (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    담당자 검토 후 반려 처리된 제보입니다.
                  </div>
                ) : !detailReport.incidentId ? (
                  <p className="text-xs text-slate-400">아직 담당자 확인 전입니다.</p>
                ) : detailTimelineLoading ? (
                  <p className="text-xs text-slate-400">불러오는 중...</p>
                ) : detailTimeline.length === 0 ? (
                  <p className="text-xs text-slate-400">아직 기록이 없습니다.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailTimeline.map((log, i) => (
                      <div key={log.logId} className="flex gap-2">
                        <div className="flex flex-col items-center shrink-0">
                          <span className={`w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm ${REPORT_STATUS_DOT[log.newStatus] || "bg-slate-400"}`} />
                          {i < detailTimeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                        </div>
                        <div className="min-w-0 flex-1 rounded-lg border border-slate-100 px-2.5 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#0F2540]">{STATUS_LABEL_KO[log.newStatus] || log.newStatus}</span>
                            <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.changedAt)}</span>
                          </div>
                          {log.memo && <div className="text-xs text-slate-600 mt-0.5">{log.memo}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
