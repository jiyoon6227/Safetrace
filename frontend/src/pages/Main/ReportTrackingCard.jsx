import React from "react";
import {
  Building2, Camera, ChevronRight, Clock, Droplets, MapPin, ShieldAlert,
} from "lucide-react";
import { STATUS_LABEL, STATUS_STYLE, DISASTER_ICON } from "./constants";
import { formatDateTimeFull } from "./utils";

// 내 현장제보 추적 카드
export default function ReportTrackingCard({
  token,
  goTo,
  myReportsLoading,
  setTrackingOpen,
  setDetailIncidentId,
  pendingReportAddresses,
  handleReportClick,
  openIncidentDetail,
  openTrackingOverview,
  setDetailPendingReportId,
  reportStateOf,
  primaryTrackingItem,
  otherTrackingItems,
  trackingProgressCount,
  trackingClosedCount,
  trackingRejectedCount,
}) {
  return (
    <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-[17px] font-extrabold text-[#0B2A52] flex items-center gap-2">
            <Camera className="w-4.5 h-4.5 text-blue-600" /> 내 현장제보 추적
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            내가 제보한 현장의 처리 상황을 실시간으로 확인할 수 있습니다.
          </p>
        </div>
        <button
          onClick={openTrackingOverview}
          className="text-xs text-[#0B2A52] flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer shrink-0 mt-0.5"
        >
          전체보기 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!token ? (
        <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
          <p className="text-sm font-bold text-[#0B2A52]">내 제보 처리과정을 확인하세요</p>
          <p className="text-[11px] text-slate-400 mt-1">등록한 제보와 연결 사건의 진행상태를 볼 수 있습니다.</p>
          <button
            onClick={() => goTo("login")}
            className="mt-3 h-8 px-4 rounded-lg bg-[#0B2A52] text-white text-xs font-bold cursor-pointer"
          >
            로그인
          </button>
        </div>
      ) : myReportsLoading ? (
        <p className="text-sm text-slate-400 py-5 text-center">불러오는 중...</p>
      ) : primaryTrackingItem ? (
        <div>
          {/* 대표 제보/사건 */}
          {primaryTrackingItem.kind === "incident" ? (() => {
            const { incidentId, incident, reports } = primaryTrackingItem;
            const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
            const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || Droplets;
            const PRIMARY_STEP_BY_STATUS = {
              RECEIVED: 1,
              CONFIRMING: 2,
              RESPONDING: 3,
              RECOVERING: 3,
              CLOSED: 4,
            };
            const activeStep = PRIMARY_STEP_BY_STATUS[incident?.status] || 1;
            const steps = ["접수", "담당자 배정", "현장 확인", "처리 완료"];

            return (
              <button
                onClick={() => openIncidentDetail(incidentId)}
                className="w-full text-left rounded-xl border border-blue-100 bg-blue-50/40 hover:border-blue-200 hover:shadow-sm transition cursor-pointer p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[68px] h-[64px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <DisasterIcon className="w-6 h-6 text-blue-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-[14px] text-[#0B2A52] truncate">
                        {incident?.title || `${reports[0]?.disasterType || "현장"} 제보`}
                      </b>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${
                          STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {incident ? STATUS_LABEL[incident.status] || incident.status : "확인중"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{incident?.region || "내 주변 신고 위치"}</span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <div className="mt-3 px-1">
                  <div className="flex items-center">
                    {[1, 2, 3, 4].map((step) => (
                      <React.Fragment key={step}>
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            step <= activeStep ? "bg-blue-600" : "bg-slate-300"
                          } ${step === activeStep ? "ring-2 ring-blue-100" : ""}`}
                        />
                        {step < 4 && (
                          <div
                            className={`h-[2px] flex-1 ${
                              step < activeStep ? "bg-blue-600" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 text-[9px] text-slate-400 mt-1 text-center">
                    {steps.map((step) => (
                      <span key={step}>{step}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })() : (() => {
            const report = primaryTrackingItem.report;
            const reportState = reportStateOf(report);
            const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;
            const REPORT_STEP_BY_STATUS = { RECEIVED: 1, REVIEWING: 2, LINKED: 3, REJECTED: 1 };
            const activeStep = REPORT_STEP_BY_STATUS[reportState.code] || 1;
            const steps = ["접수", "검토중", "사건 연결", "처리 완료"];

            return (
              <button
                onClick={() => {
                  setTrackingOpen(true);
                  setDetailIncidentId(null);
                  setDetailPendingReportId(report.reportId);
                }}
                className="w-full text-left rounded-xl border border-blue-100 bg-blue-50/40 hover:border-blue-200 hover:shadow-sm transition cursor-pointer p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[68px] h-[64px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {report.photoUrl ? (
                      <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <DisasterIcon className="w-6 h-6 text-blue-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-[14px] text-[#0B2A52] truncate">
                        {report.content || `${report.disasterType || "현장"} · 제보 #${report.reportId}`}
                      </b>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${reportState.style}`}>
                        {reportState.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">{formatDateTimeFull(report.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {pendingReportAddresses[report.reportId] || report.address || "주소 확인 중..."}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <div className="mt-3 px-1">
                  <div className="flex items-center">
                    {[1, 2, 3, 4].map((step) => (
                      <React.Fragment key={step}>
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            step <= activeStep ? "bg-blue-600" : "bg-slate-300"
                          }`}
                        />
                        {step < 4 && (
                          <div
                            className={`h-[2px] flex-1 ${
                              step < activeStep ? "bg-blue-600" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 text-[9px] text-slate-400 mt-1 text-center">
                    {steps.map((step) => (
                      <span key={step}>{step}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })()}

          {/* 다른 제보 현황 - 한 줄에 1개씩, 모두 표시 */}
          {otherTrackingItems.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-[13px] text-[#0B2A52]">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  다른 제보 현황
                </div>

                <div className="text-[10px] text-slate-500">
                  진행 중 <b className="text-blue-600">{trackingProgressCount}건</b>
                  <span className="mx-1">·</span>
                  완료 <b className="text-emerald-500">{trackingClosedCount}건</b>
                  {trackingRejectedCount > 0 && (
                    <>
                      <span className="mx-1">·</span>
                      반려 <b className="text-rose-500">{trackingRejectedCount}건</b>
                    </>
                  )}
                </div>
              </div>

              {/* 한 줄에 한 건씩, otherTrackingItems 전체 표시 */}
              <div className="space-y-2">
                {otherTrackingItems.map((item) => {
                  if (item.kind === "report") {
                    const report = item.report;
                    const reportState = reportStateOf(report);
                    const DisasterIcon = DISASTER_ICON[report.disasterType] || ShieldAlert;

                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setTrackingOpen(true);
                          setDetailIncidentId(null);
                          setDetailPendingReportId(report.reportId);
                        }}
                        className="w-full min-w-0 rounded-xl border border-slate-100 bg-white p-3 text-left hover:border-slate-200 hover:shadow-sm transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-[58px] h-[58px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {report.photoUrl ? (
                              <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <DisasterIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <b className="text-[13px] font-extrabold text-[#0B2A52] truncate">
                                {`${report.disasterType || "현장"} · 제보 #${report.reportId}`}
                              </b>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${reportState.style}`}>
                                {reportState.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 min-w-0">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">{formatDateTimeFull(report.createdAt)}</span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 min-w-0">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {pendingReportAddresses[report.reportId] || report.address || "주소 확인 중..."}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                      </button>
                    );
                  }

                  const { incidentId, incident, reports } = item;
                  const photoUrl = reports.find((r) => r.photoUrl)?.photoUrl;
                  const DisasterIcon = DISASTER_ICON[reports[0]?.disasterType] || ShieldAlert;

                  return (
                    <button
                      key={item.key}
                      onClick={() => openIncidentDetail(incidentId)}
                      className="w-full min-w-0 rounded-xl border border-slate-100 bg-white p-3 text-left hover:border-slate-200 hover:shadow-sm transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-[58px] h-[58px] rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <DisasterIcon className="w-5 h-5 text-blue-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <b className="text-[13px] font-extrabold text-[#0B2A52] truncate">
                              {incident?.title || `${reports[0]?.disasterType || "현장"} · 제보 #${reports[0]?.reportId || ""}`}
                            </b>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                STATUS_STYLE[incident?.status] || "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {incident ? STATUS_LABEL[incident.status] || incident.status : "확인중"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 min-w-0">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {formatDateTimeFull(incident?.updatedAt || reports[0]?.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 min-w-0">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{incident?.region || "내 주변 신고 위치"}</span>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 px-4 py-4 text-center">
          <p className="text-sm font-bold text-[#0B2A52]">아직 등록한 제보가 없습니다.</p>
          <button
            onClick={handleReportClick}
            className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            현장 제보하기
          </button>
        </div>
      )}
    </section>
  );
}
