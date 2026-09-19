import { useEffect, useState } from "react";
import {
  ClipboardList, FileText, Clock, Link2, X, Search, XCircle, Image as ImageIcon,
  Bell, Eye, EyeOff, Loader2,
} from "lucide-react";
import {
  REPORT_DISASTER_TYPES, REGION_OPTIONS, MIN_REPORT_DATE, formatDateTime, maskPhone,
  STATUS_STYLE, STATUS_LABEL,
} from "./constants";

export default function ReportsTab({
  reportError,
  totalReports,
  receivedReports,
  reviewingReports,
  linkedReportsCount,
  rejectedReports,
  reportStatusFilter,
  setReportStatusFilter,
  reportTypeFilter,
  setReportTypeFilter,
  reportRegionFilter,
  setReportRegionFilter,
  reportSortOrder,
  setReportSortOrder,
  reportDateFrom,
  reportDateTo,
  todayStr,
  handleReportDateFromChange,
  handleReportDateFromBlur,
  handleReportDateToChange,
  handleReportDateToBlur,
  applyReportDateFilter,
  reportSearchQuery,
  setReportSearchQuery,
  selectedReportIds,
  setSelectedReportIds,
  openBulkMerge,
  openRejectModal,
  reports,
  reportAddresses,
  reportsLoading,
  filteredReports,
  allPageSelected,
  selectablePagedReports,
  pagedReports,
  selectedReportId,
  setSelectedReportId,
  setCandidates,
  setReportError,
  openReportCandidates,
  toggleReportSelected,
  incidentRank,
  setActiveNav,
  openIncidentDetail,
  reportPage,
  reportTotalPages,
  setReportPage,
  renderTablePagination,
  selectedReport,
  reportPhotos,
  setViewingPhotoUrl,
  selectedLinkedIncident,
  handleMarkReviewing,
  candidatesLoading,
  candidates,
  handleLinkReport,
  startNewIncidentFromReport,
}) {
  const [showReporterPhone, setShowReporterPhone] = useState(false);

  useEffect(() => {
    setShowReporterPhone(false);
  }, [selectedReport?.reportId]);

  return (
    <main className="px-5 py-4 bg-[#F7F9FC] min-h-[calc(100vh-64px)]">
      {reportError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
          {reportError}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">제보 관리</h2>
          <p className="text-[13px] text-slate-500 mt-2">
            시민이 등록한 제보를 확인하고 검토하여 사건으로 연결할 수 있습니다.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pt-1">
          <span>홈</span><span>›</span><span className="text-slate-500">제보 관리</span>
        </div>
      </div>

      {/* 상단 요약 카드 - 넓은 화면에서만 5개 한 줄, 좁아지면 2~3열로 쌓임 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
        {[
          { key: "all", label: "전체 제보", value: totalReports, sub: "전체 제보 건수", icon: ClipboardList, box: "bg-blue-100 text-blue-700" },
          { key: "RECEIVED", label: "등록", value: receivedReports, sub: totalReports ? `전체의 ${Math.round((receivedReports / totalReports) * 1000) / 10}%` : "전체의 0%", icon: FileText, box: "bg-blue-100 text-blue-700" },
          { key: "REVIEWING", label: "검토중", value: reviewingReports, sub: totalReports ? `전체의 ${Math.round((reviewingReports / totalReports) * 1000) / 10}%` : "전체의 0%", icon: Clock, box: "bg-amber-100 text-amber-700" },
          { key: "LINKED", label: "사건연결", value: linkedReportsCount, sub: totalReports ? `전체의 ${Math.round((linkedReportsCount / totalReports) * 1000) / 10}%` : "전체의 0%", icon: Link2, box: "bg-emerald-100 text-emerald-700" },
          { key: "REJECTED", label: "반려", value: rejectedReports, sub: totalReports ? `전체의 ${Math.round((rejectedReports / totalReports) * 1000) / 10}%` : "전체의 0%", icon: X, box: "bg-rose-100 text-rose-700" },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => { setReportStatusFilter(card.key); setReportTypeFilter(null); }}
            className={`h-[92px] bg-white rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
              reportStatusFilter === card.key ? "border-[#0F2540] shadow-sm" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 h-full">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.box}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-600">{card.label}</p>
                <p className="text-[25px] leading-7 font-extrabold text-[#0F2540] mt-0.5">
                  {card.value}<span className="text-xs font-semibold ml-1">건</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 목록 카드 */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-3">
        {/* 필터 툴바 - 좁아지면 여러 줄로 자연스럽게 감싸짐 */}
        <div className="px-3 py-2.5 flex items-center flex-wrap gap-2 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "all", label: `전체 (${totalReports})` },
              { key: "RECEIVED", label: `등록 (${receivedReports})` },
              { key: "REVIEWING", label: `검토중 (${reviewingReports})` },
              { key: "LINKED", label: `사건연결 (${linkedReportsCount})` },
              { key: "REJECTED", label: `반려 (${rejectedReports})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReportStatusFilter(tab.key)}
                className={`h-8 px-3 rounded-lg text-xs font-bold border-2 transition-colors cursor-pointer whitespace-nowrap ${
                  reportStatusFilter === tab.key
                    ? "bg-[#0F2540] border-[#0F2540] text-white hover:bg-[#16345c]"
                    : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            <select
              value={reportTypeFilter || ""}
              onChange={(e) => setReportTypeFilter(e.target.value || null)}
              className="h-8 min-w-[104px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none cursor-pointer"
            >
              <option value="">전체 유형</option>
              {REPORT_DISASTER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>

            <select
              value={reportRegionFilter || ""}
              onChange={(e) => setReportRegionFilter(e.target.value || null)}
              className="h-8 min-w-[104px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none cursor-pointer"
            >
              <option value="">전체 지역</option>
              {REGION_OPTIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <select
              value={reportSortOrder}
              onChange={(e) => setReportSortOrder(e.target.value)}
              className="h-8 min-w-[92px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none cursor-pointer"
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>

            <div className="h-8 rounded-lg border border-slate-200 bg-white px-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus-within:border-blue-400 focus-within:bg-blue-50/40 focus-within:shadow-sm">
              <input
                type="date"
                value={reportDateFrom}
                min={MIN_REPORT_DATE}
                max={reportDateTo || todayStr}
                onChange={(e) => handleReportDateFromChange(e.target.value)}
                onBlur={handleReportDateFromBlur}
                className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
              />
              <span className="text-slate-300">~</span>
              <input
                type="date"
                value={reportDateTo}
                min={reportDateFrom || MIN_REPORT_DATE}
                max={todayStr}
                onChange={(e) => handleReportDateToChange(e.target.value)}
                onBlur={handleReportDateToBlur}
                className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
              />
            </div>

            <button
              type="button"
              onClick={applyReportDateFilter}
              className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold hover:bg-[#16345c] transition-colors cursor-pointer whitespace-nowrap"
            >
              조회
            </button>

            <div className="h-8 w-full sm:w-[275px] rounded-lg border border-slate-200 bg-white px-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                placeholder="제보 내용, 주소, 신고자 검색..."
                className="w-full bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {selectedReportIds.size > 0 && (
          <div className="px-3 py-2.5 flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 bg-amber-50">
            <span className="text-xs font-bold text-amber-700">{selectedReportIds.size}건 선택됨</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openBulkMerge}
                className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-[#0F2540] hover:bg-[#1B3A5C] text-white text-xs font-bold cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" /> 선택 합치기
              </button>
              <button
                type="button"
                onClick={() => openRejectModal("bulk")}
                disabled={reports.some((r) => selectedReportIds.has(r.reportId) && r.status === "LINKED")}
                title="이미 사건으로 연결된 제보가 포함돼 있으면 반려할 수 없습니다."
                className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-3.5 h-3.5" /> 선택 반려
              </button>
              <button
                type="button"
                onClick={() => setSelectedReportIds(new Set())}
                className="h-8 px-3 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 cursor-pointer"
              >
                선택 해제
              </button>
            </div>
          </div>
        )}

        {reportsLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">제보를 불러오는 중입니다...</div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">조건에 맞는 제보가 없습니다.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] table-fixed text-[13px]">
                <colgroup>
                  <col className="w-[42px]" />
                  <col className="w-[92px]" />
                  <col className="w-[100px]" />
                  <col className="w-[230px]" />
                  <col className="w-[120px]" />
                  <col className="w-[160px]" />
                  <col className="w-[270px]" />
                  <col className="w-[130px]" />
                  <col className="w-[160px]" />
                  <col className="w-[100px]" />
                </colgroup>
                <thead>
                  <tr className="h-11 bg-[#E9ECEF] text-[12px] font-bold text-[#556070] border-y border-[#CBD5E1]">
                    <th className="px-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        disabled={selectablePagedReports.length === 0}
                        onChange={() =>
                          setSelectedReportIds((prev) => {
                            const next = new Set(prev);
                            if (allPageSelected) selectablePagedReports.forEach((r) => next.delete(r.reportId));
                            else selectablePagedReports.forEach((r) => next.add(r.reportId));
                            return next;
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-30"
                      />
                    </th>
                    <th className="px-2 font-semibold text-center">제보번호</th>
                    <th className="px-2 font-semibold text-center">재난유형</th>
                    <th className="px-2 font-semibold text-center">내용</th>
                    <th className="px-2 font-semibold text-center">신고자</th>
                    <th className="px-2 font-semibold text-center">등록일시</th>
                    <th className="px-2 font-semibold text-center">주소</th>
                    <th className="px-2 font-semibold text-center">상태</th>
                    <th className="px-2 font-semibold text-center">연결 사건</th>
                    <th className="px-2 font-semibold text-center">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReports.map((r) => {
                    const linked = !!r.incidentId;
                    const selected = selectedReportId === r.reportId;
                    return (
                      <tr
                        key={r.reportId}
                        onClick={() => {
                          setSelectedReportId(r.reportId);
                          if (linked) { setCandidates([]); setReportError(""); }
                          else openReportCandidates(r.reportId);
                        }}
                        className={`h-[44px] border-b border-[#E1E5EB] cursor-pointer transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-slate-50/90"}`}
                      >
                        <td className="px-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedReportIds.has(r.reportId)}
                            disabled={r.status === "REJECTED"}
                            onChange={() => toggleReportSelected(r.reportId)}
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="px-2 text-center align-middle font-bold text-[#0F2540] whitespace-nowrap">#R-{r.reportId}</td>
                        <td className="px-2 text-center align-middle">
                          <span className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600">
                            {r.disasterType}
                          </span>
                        </td>
                        <td className="px-2 text-center align-middle text-slate-700" title={r.content}><span className="mx-auto block max-w-[205px] truncate">{r.content || "-"}</span></td>
                        <td className="px-2 text-center align-middle text-slate-600"><span className="mx-auto block max-w-[95px] truncate">{r.reporterName || `#${r.memberId}`}</span></td>
                        <td className="px-2 text-center align-middle text-slate-600 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                        <td className="px-2 text-center align-middle text-slate-600" title={reportAddresses[r.reportId]}><span className="mx-auto block max-w-[245px] truncate">{reportAddresses[r.reportId] || "주소 확인 중..."}</span></td>
                        <td className="px-2 text-center align-middle">
                          {linked ? (
                            <span className="inline-flex rounded-md bg-emerald-50 text-emerald-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">사건연결</span>
                          ) : r.status === "REVIEWING" ? (
                            <span className="inline-flex rounded-md bg-amber-50 text-amber-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">검토중</span>
                          ) : r.status === "REJECTED" ? (
                            <span className="inline-flex rounded-md bg-rose-50 text-rose-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">반려</span>
                          ) : (
                            <span className="inline-flex rounded-md bg-blue-50 text-blue-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">등록</span>
                          )}
                        </td>
                        <td className="px-2 text-center align-middle">
                          {linked ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setActiveNav("incidents"); openIncidentDetail(r.incidentId); }}
                              className="text-[11px] font-bold text-blue-600 hover:underline whitespace-nowrap cursor-pointer"
                            >사건 #{incidentRank.get(r.incidentId) ?? r.incidentId} 보기 ↗</button>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-2 text-center align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); setSelectedReportId(r.reportId);
                              if (linked) setCandidates([]); else openReportCandidates(r.reportId);
                            }}
                            className="h-7 px-3 rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >상세보기</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">총 {filteredReports.length}건의 제보가 있습니다.</p>
              <div className="scale-[0.92] origin-right overflow-x-auto max-w-full">{renderTablePagination(reportPage, reportTotalPages, setReportPage)}</div>
            </div>
          </>
        )}
      </div>

      {/* 하단 상세 - 넓은 화면에선 왼쪽 55%/오른쪽 45%, 좁아지면 위아래로 쌓임 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-3 items-stretch">
        <section className="bg-white rounded-xl border border-slate-200 p-4 min-h-[255px]">
          <h3 className="text-[15px] font-extrabold text-[#0F2540] mb-3">제보 상세</h3>

          {!selectedReport ? (
            <div className="h-[205px] rounded-lg bg-slate-50 flex items-center justify-center text-sm text-slate-400">
              제보를 선택하면 상세 정보가 표시됩니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[320px_1fr] gap-5">
              <div>
                <div className="h-[205px] rounded-lg overflow-hidden bg-slate-100">
                  {selectedReport.photoUrl ? (
                    <img src={selectedReport.photoUrl} alt="제보 첨부" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-10 h-10" /></div>
                  )}
                </div>
                {reportPhotos.length > 1 && (
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    {reportPhotos.slice(1).map((url, index) => (
                      <button
                        key={url + index}
                        type="button"
                        onClick={() => setViewingPhotoUrl(url)}
                        className="h-12 rounded-md overflow-hidden border border-slate-200 hover:shadow-md transition cursor-pointer"
                      >
                        <img src={url} alt={`추가 사진 ${index + 2}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <dl className="text-[12px] divide-y divide-slate-100">
                <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">제보번호</dt><dd className="font-bold text-[#0F2540]">#R-{selectedReport.reportId}</dd></div>
                <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">재난유형</dt><dd className="font-semibold text-slate-700">{selectedReport.disasterType}</dd></div>
                <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">제보 내용</dt><dd className="text-slate-600 leading-5 line-clamp-2">{selectedReport.content || "-"}</dd></div>
                <div className="grid grid-cols-[92px_1fr] py-2">
                  <dt className="text-slate-400">신고자</dt>
                  <dd className="text-slate-700 flex items-center gap-1.5 min-w-0">
                    <span>
                      {selectedReport.reporterName || `#${selectedReport.memberId}`}
                      {selectedReport.reporterPhone && ` (${showReporterPhone ? selectedReport.reporterPhone : maskPhone(selectedReport.reporterPhone)})`}
                    </span>
                    {selectedReport.reporterPhone && (
                      <button
                        type="button"
                        onClick={() => setShowReporterPhone((prev) => !prev)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-[#0F2540] hover:bg-slate-100 transition-colors cursor-pointer"
                        title={showReporterPhone ? "전화번호 숨기기" : "전화번호 보기"}
                        aria-label={showReporterPhone ? "전화번호 숨기기" : "전화번호 보기"}
                      >
                        {showReporterPhone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">등록일시</dt><dd className="text-slate-700">{formatDateTime(selectedReport.createdAt)}</dd></div>
                <div className="grid grid-cols-[92px_1fr] py-2"><dt className="text-slate-400">주소</dt><dd className="text-slate-700 truncate">{reportAddresses[selectedReport.reportId] || "주소 확인 중..."}</dd></div>
              </dl>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 min-h-[255px]">
          {selectedReport?.incidentId ? (
            <>
              <h3 className="text-[15px] font-extrabold text-[#0F2540] mb-3">연결된 사건 정보</h3>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-3 flex items-start gap-3">
                <Link2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-emerald-700">이 제보는 사건으로 연결되었습니다.</p>
                  <p className="text-[11px] text-emerald-600 leading-5 mt-0.5">원본 제보는 삭제되지 않고 사건과 연결되어 계속 보관됩니다.<br />제보와 사건의 처리 과정을 함께 추적할 수 있습니다.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-4 items-center">
                <dl className="text-[12px] space-y-1.5">
                  <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">사건번호</dt><dd className="font-bold text-blue-600">#{incidentRank.get(selectedReport.incidentId) ?? selectedReport.incidentId}</dd></div>
                  <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">사건 제목</dt><dd className="font-semibold text-slate-700 truncate">{selectedLinkedIncident?.title || `${selectedReport.disasterType} 관련 사건`}</dd></div>
                  <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">현재 상태</dt><dd>{selectedLinkedIncident ? <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_STYLE[selectedLinkedIncident.status] || "bg-slate-100 text-slate-600"}`}>{STATUS_LABEL[selectedLinkedIncident.status] || selectedLinkedIncident.status}</span> : <span className="text-slate-500">-</span>}</dd></div>
                  <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">담당자</dt><dd className="text-slate-700">{selectedLinkedIncident?.assignedStaffName || "-"}</dd></div>
                  <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">최초 신고 제보</dt><dd className="text-slate-700">
                    {selectedLinkedIncident?.sourceReportId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedReportId(selectedLinkedIncident.sourceReportId)}
                        className={`font-bold hover:underline cursor-pointer ${selectedLinkedIncident.sourceReportId === selectedReport.reportId ? "text-amber-700" : "text-blue-600"}`}
                      >
                        #R-{selectedLinkedIncident.sourceReportId}{selectedLinkedIncident.sourceReportId === selectedReport.reportId && " (이 제보)"}
                      </button>
                    ) : "-"}
                  </dd></div>
                  <div className="grid grid-cols-[82px_1fr]"><dt className="text-slate-400">사건 생성일</dt><dd className="text-slate-700">{selectedLinkedIncident?.createdAt ? formatDateTime(selectedLinkedIncident.createdAt) : "-"}</dd></div>
                </dl>
                <button
                  type="button"
                  onClick={() => { setActiveNav("incidents"); openIncidentDetail(selectedReport.incidentId); }}
                  className="h-10 rounded-lg bg-[#0F2540] text-white text-sm font-bold hover:bg-[#183A60] cursor-pointer"
                >사건 상세 보기 ↗</button>
              </div>
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-600 flex items-center gap-2">
                <Bell className="w-4 h-4 shrink-0" /> 제보가 사건으로 연결되어도, 원본 제보 데이터는 그대로 보존되며 목록에서 확인할 수 있습니다.
              </div>
            </>
          ) : selectedReport?.status === "REJECTED" ? (
            <>
              <h3 className="text-[15px] font-extrabold text-[#0F2540] mb-3">반려 정보</h3>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-rose-600">이 제보는 반려되었습니다.</p>
                  <p className="text-[12px] text-rose-500 leading-5 mt-2 whitespace-pre-line">
                    {selectedReport.rejectReason || "사유가 기록되지 않았습니다."}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 flex items-center gap-2">
                <Bell className="w-4 h-4 shrink-0" /> 반려된 제보도 삭제되지 않고 이력으로 그대로 보존됩니다.
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-[15px] font-extrabold text-[#0F2540]">병합 후보 사건</h3>
                {selectedReport && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedReport.status === "RECEIVED" && (
                      <button
                        type="button"
                        onClick={() => handleMarkReviewing(selectedReport.reportId)}
                        className="h-7 flex items-center gap-1 px-2.5 rounded-md border border-amber-300 bg-amber-100 text-amber-800 text-[11px] font-bold hover:bg-amber-200 hover:border-amber-400 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> 검토 시작
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openRejectModal(selectedReport.reportId)}
                      className="h-7 flex items-center gap-1 px-2.5 rounded-md border border-rose-300 bg-rose-100 text-rose-700 text-[11px] font-bold hover:bg-rose-200 hover:border-rose-400 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 반려
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 mb-3">같은 재난유형 · 최근 30분 이내 · 반경 500m의 기존 사건을 자동으로 찾아 보여줍니다.</p>
              {!selectedReport ? (
                <div className="h-[185px] rounded-lg bg-slate-50 flex items-center justify-center text-sm text-slate-400">제보를 먼저 선택해주세요.</div>
              ) : candidatesLoading ? (
                <div className="h-[185px] flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />후보 사건을 찾는 중...</div>
              ) : candidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-600">병합 가능한 기존 사건이 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">해당 제보가 독립적인 사건이라면 새로운 사건으로 등록해주세요.</p>
                  <button type="button" onClick={() => startNewIncidentFromReport(selectedReport)} className="w-full h-9 mt-4 rounded-lg bg-[#0F2540] text-white text-xs font-bold cursor-pointer">이 제보로 새 사건 만들기</button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {candidates.map((inc) => (
                    <div key={inc.incidentId} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="text-sm font-bold text-[#0F2540] truncate">{inc.title}</p><p className="text-[11px] text-slate-400 mt-1">사건 #{incidentRank.get(inc.incidentId) ?? inc.incidentId} · {inc.region}</p></div>
                      <button type="button" onClick={() => handleLinkReport(inc.incidentId)} className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold cursor-pointer shrink-0">이 사건에 연결</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => startNewIncidentFromReport(selectedReport)} className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">별개의 새 사건으로 등록</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
