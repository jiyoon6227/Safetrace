import React from "react";
import {
  Bell, Camera, ChevronDown, ChevronLeft, ChevronRight, Clock, MapPin, ShieldAlert, X,
} from "lucide-react";
import { STATUS_LABEL, STATUS_STYLE, DISASTER_ICON, STATUS_BANNER, STATUS_DOT, DETAIL_PROGRESS_STEPS, DETAIL_STEP_BY_STATUS, STATUS_LOG_FALLBACK_TEXT } from "./constants";
import { formatDateTime, formatDateTimeFull, formatRelativeTime } from "./utils";

// 대응상황 추적 모달
export default function TrackingModal({
  trackingStatusFilter,
  setTrackingStatusFilter,
  trackingTypeFilter,
  setTrackingTypeFilter,
  trackingSort,
  setTrackingSort,
  detailIncidentId,
  setDetailIncidentId,
  detailTimeline,
  detailTimelineLoading,
  detailTimelineSort,
  setDetailTimelineSort,
  pendingReportAddresses,
  openIncidentDetail,
  closeTracking,
  detailPendingReportId,
  setDetailPendingReportId,
  detailIncident,
  detailPendingReport,
  groupedIncidents,
  detailReports,
  detailPhotoUrl,
  latestDetailLog,
  detailDescription,
  detailTimelineSorted,
  trackingDisasterTypes,
  reportStateOf,
  pendingReports,
  trackingProgressCount,
  trackingClosedCount,
  trackingRejectedCount,
  filteredTrackingItems,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {(detailIncidentId || detailPendingReportId) && (
              <button
                onClick={() => { setDetailIncidentId(null); setDetailPendingReportId(null); }}
                className="text-slate-400 hover:text-[#0F2540] -ml-1 p-1 shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {detailIncidentId ? (
              <h2 className="font-bold text-[#0F2540]">대응상황 상세</h2>
            ) : detailPendingReportId ? (
              <h2 className="font-bold text-[#0F2540]">제보 상세</h2>
            ) : (
              <div className="min-w-0">
                <h2 className="font-extrabold text-[#0B2A52] flex items-center gap-2"><Camera className="w-5 h-5 text-blue-600 shrink-0" /> 내 현장제보 목록</h2>
                <p className="text-xs text-slate-400 mt-0.5">내가 제보한 현장의 처리 현황을 한눈에 확인할 수 있습니다.</p>
              </div>
            )}
          </div>
          <button onClick={closeTracking} className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* 목록 모드: 연결된 사건이 여러 개일 때 */}
          {!detailIncidentId && !detailPendingReportId && (
            <div>
              {/* 필터 + 정렬 */}
              <div className="flex items-center flex-wrap gap-2 mb-4">
                {[
                  ["all", `전체 ${groupedIncidents.length + pendingReports.length}`],
                  ["progress", `진행중 ${trackingProgressCount}`],
                  ["closed", `완료 ${trackingClosedCount}`],
                  ["rejected", `반려 ${trackingRejectedCount}`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTrackingStatusFilter(key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition ${
                      trackingStatusFilter === key ? "bg-[#0B2A52] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    } cursor-pointer`}
                  >
                    {label}
                  </button>
                ))}
                {trackingDisasterTypes.length > 0 && (
                  <>
                    <span className="w-px h-5 bg-slate-200 shrink-0" />
                    <div className="relative shrink-0">
                      <select
                        value={trackingTypeFilter || ""}
                        onChange={(e) => setTrackingTypeFilter(e.target.value || null)}
                        className="appearance-none text-xs font-bold text-slate-500 border border-slate-200 rounded-full pl-3 pr-7 py-1.5 outline-none"
                      >
                        <option value="">재난유형: 전체</option>
                        {trackingDisasterTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </>
                )}
                <div className="relative ml-auto shrink-0">
                  <select
                    value={trackingSort}
                    onChange={(e) => setTrackingSort(e.target.value)}
                    className="appearance-none text-xs font-bold text-slate-500 border border-slate-200 rounded-full pl-3 pr-7 py-1.5 outline-none"
                  >
                    <option value="newest">최신순</option>
                    <option value="oldest">오래된순</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <ul className="space-y-3">
                {filteredTrackingItems.map((item) => {
                  if (item.kind === "report") {
                    const report = item.report;
                    const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;
                    const reportState = reportStateOf(report);

                    return (
                      <li
                        key={item.key}
                        onClick={() => setDetailPendingReportId(report.reportId)}
                        className="rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition p-3 flex items-center gap-4"
                      >
                        <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {report.photoUrl ? (
                            <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <DisasterIcon className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <b className="text-sm text-[#0B2A52] truncate">{report.content || `${report.disasterType} 제보`}</b>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${reportState.style}`}>
                              {reportState.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            {formatDateTimeFull(report.createdAt)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{pendingReportAddresses[report.reportId] || "주소 확인 중..."}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </li>
                    );
                  }

                  const { incidentId, incident, reports } = item;
                  const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                  const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || ShieldAlert;
                  const STEP_BY_STATUS = { RECEIVED: 1, CONFIRMING: 2, RESPONDING: 3, RECOVERING: 4, CLOSED: 5 };
                  const activeStep = STEP_BY_STATUS[incident?.status] || 1;

                  return (
                    <li
                      key={item.key}
                      onClick={() => openIncidentDetail(incidentId)}
                      className="rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition p-3 flex items-center gap-4"
                    >
                      <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <DisasterIcon className="w-6 h-6 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="text-sm text-[#0B2A52] truncate">{incident?.title || `사건 #${incidentId}`}</b>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"}`}>
                            {incident ? STATUS_LABEL[incident.status] || incident.status : "확인 중"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}
                          {incident?.updatedAt && <span> · 마지막 업데이트 {formatRelativeTime(incident.updatedAt)}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{incident?.region}</span>
                        </div>
                      </div>
                      <div className="hidden md:block w-[200px] shrink-0">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((step) => (
                            <React.Fragment key={step}>
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${step <= activeStep ? "bg-blue-600" : "bg-slate-300"}`} />
                              {step < 5 && <div className={`h-[2px] flex-1 ${step < activeStep ? "bg-blue-600" : "bg-slate-200"}`} />}
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="grid grid-cols-5 text-[9px] text-slate-400 mt-1 text-center leading-tight">
                          <span>접수</span><span>확인중</span><span>대응중</span><span>복구중</span><span>종료</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </li>
                  );
                })}

                {filteredTrackingItems.length === 0 && (
                  <p className="text-sm text-slate-400 py-8 text-center">조건에 맞는 제보가 없습니다.</p>
                )}
              </ul>

              <div className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-400">
                <Bell className="w-3.5 h-3.5 shrink-0" /> 최대 1년 전까지의 제보 내역을 확인할 수 있습니다.
              </div>
            </div>
          )}

          {/* 상세 모드: 사진+설명 배너 + 6단계 진행바 + 타임라인(정렬 가능) + 담당부서/번호/최근업데이트/지도 정보패널 */}
          {/* 검토 대기중 제보 상세 - 아직 Incident가 없어서 타임라인/진행바 없이 제보 원본만 보여줌 */}
          {detailPendingReportId && detailPendingReport && (() => {
            const DetailDisasterIcon = DISASTER_ICON[detailPendingReport.disasterType] || ShieldAlert;
            const detailReportState = reportStateOf(detailPendingReport);
            return (
              <div>
                <div className="rounded-xl overflow-hidden mb-5 bg-slate-50 border border-slate-200">
                  <div className="flex gap-4 p-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/60 flex items-center justify-center shrink-0">
                      {detailPendingReport.photoUrl ? (
                        <img src={detailPendingReport.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <DetailDisasterIcon className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${detailReportState.style}`}>
                          {detailReportState.label}
                        </span>
                        <span className="text-[11px] text-slate-500">#{detailPendingReport.reportId}</span>
                      </div>
                      <h3 className="font-bold text-[#0F2540] text-base mb-1">{detailPendingReport.disasterType} 제보</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{pendingReportAddresses[detailPendingReport.reportId] || "주소 확인 중..."}</span>
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 shrink-0" /> {formatDateTimeFull(detailPendingReport.createdAt)} 등록
                      </p>
                    </div>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-[#0F2540] mb-2">제보 내용</h4>
                <p className="text-sm text-slate-600 leading-6 whitespace-pre-wrap mb-5">
                  {detailPendingReport.content || "작성된 상세 설명이 없습니다."}
                </p>

                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-[12px] text-blue-700">
                  <Bell className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {detailReportState.code === "REVIEWING"
                    ? "담당자가 제보 내용을 검토하고 있어요. 사건으로 연결되면 여기서 사건 처리 진행상황을 확인할 수 있어요."
                    : detailReportState.code === "REJECTED"
                      ? "이 제보는 반려된 상태입니다. 자세한 사유는 내 제보 내역에서 확인할 수 있어요."
                      : "제보가 등록되었습니다. 담당자 검토 후 사건으로 연결되면 여기서 처리 진행상황을 확인할 수 있어요."}
                </div>
              </div>
            );
          })()}

          {detailIncidentId && (
            <div>
              {detailIncident && (() => {
                const DetailDisasterIcon = DISASTER_ICON[detailReports[0]?.disasterType || detailIncident.disasterType] || ShieldAlert;
                return (
                  <div className={`rounded-xl overflow-hidden mb-5 ${STATUS_BANNER[detailIncident.status] || "bg-slate-50 border border-slate-200"}`}>
                    <div className="flex gap-4 p-4">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/60 flex items-center justify-center shrink-0">
                        {detailPhotoUrl ? (
                          <img src={detailPhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <DetailDisasterIcon className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${STATUS_STYLE[detailIncident.status] || ""}`}>
                            {STATUS_LABEL[detailIncident.status] || detailIncident.status}
                          </span>
                          <span className="text-[11px] text-slate-500">#{detailIncident.incidentId}</span>
                        </div>
                        <h3 className="font-bold text-[#0F2540] text-base mb-1 truncate">{detailIncident.title}</h3>
                        {/* 도로명 주소 필드 부재로 region 표시 - 한 줄 고정 (줄바꿈 시 아이콘 정렬 어긋남) */}
                        <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{detailIncident.region}</span>
                        </p>
                        {/* 제보 주소 바로 밑에 현재 진행상황 멘트 - 사진 영역을 침범하지 않도록 텍스트 컬럼 안에 위치 */}
                        {detailDescription && (
                          <p className="text-xs text-slate-600 leading-5 mt-1.5 line-clamp-2">{detailDescription}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 6단계 진행바 - RECEIVED/CONFIRMING/RESPONDING/RECOVERING/CLOSED를 접수~완료 6칸에 배치 */}
              {detailIncident && (() => {
                const activeStep = DETAIL_STEP_BY_STATUS[detailIncident.status] || 1;
                return (
                  <div className="mb-5">
                    <div className="flex items-center">
                      {DETAIL_PROGRESS_STEPS.map((label, idx) => {
                        const step = idx + 1;
                        const reached = step <= activeStep;
                        return (
                          <React.Fragment key={label}>
                            <div
                              className={`w-3.5 h-3.5 rounded-full shrink-0 ${reached ? "bg-blue-600" : "bg-slate-300"} ${
                                step === activeStep ? "ring-4 ring-blue-100" : ""
                              }`}
                            />
                            {step < DETAIL_PROGRESS_STEPS.length && (
                              <div className={`h-[3px] flex-1 ${step < activeStep ? "bg-blue-600" : "bg-slate-200"}`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-6 text-[10px] text-slate-400 mt-1.5 text-center leading-tight">
                      {DETAIL_PROGRESS_STEPS.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[#0F2540]">처리 타임라인</h4>
                <div className="relative">
                  <select
                    value={detailTimelineSort}
                    onChange={(e) => setDetailTimelineSort(e.target.value)}
                    className="appearance-none text-[11px] font-bold text-slate-500 border border-slate-200 rounded-full pl-3 pr-6 py-1 outline-none cursor-pointer"
                  >
                    <option value="oldest">오래된순</option>
                    <option value="newest">최신순</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              {detailTimelineLoading ? (
                <p className="text-xs text-slate-400">불러오는 중...</p>
              ) : detailTimeline.length === 0 ? (
                <p className="text-xs text-slate-400">아직 기록이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {detailTimelineSorted.map((log, i) => {
                    const isLast = i === detailTimelineSorted.length - 1;
                    return (
                      <div key={log.logId} className="flex gap-2">
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className={`w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm ${
                              STATUS_DOT[log.newStatus] || "bg-slate-400"
                            } ${log.logId === latestDetailLog?.logId ? "ring-2 ring-offset-1 ring-slate-200" : ""}`}
                          />
                          {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                        </div>
                        <div className="min-w-0 flex-1 rounded-lg border border-slate-100 px-2.5 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#0F2540]">
                              {STATUS_LABEL[log.newStatus] || log.newStatus}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.changedAt)}</span>
                          </div>
                          {/* memo가 비어있는 로그도 단계별 설명이 안 보이는 일이 없도록 상태별 기본 문구로 대체 */}
                          <div className="text-xs text-slate-600 mt-0.5">
                            {log.memo || STATUS_LOG_FALLBACK_TEXT[log.newStatus] || "-"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
