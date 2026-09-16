import {
  FileText, ClipboardList, Search, Activity, RefreshCw, CheckCircle2, Plus, X,
  MapPin, AlertTriangle, User, Building2, Clock, Link2, Loader2, Camera,
} from "lucide-react";
import {
  STATUS_LABEL, STATUS_STYLE, STATUS_ORDER, REPORT_DISASTER_TYPES, REGION_OPTIONS,
  MIN_REPORT_DATE, formatDateTime, withRo,
} from "./constants";

export default function IncidentsTab({
  incidentCounts,
  incidentStatusFilter,
  setIncidentStatusFilter,
  incidentTypeFilter,
  setIncidentTypeFilter,
  incidentRegionFilter,
  setIncidentRegionFilter,
  incidentSeverityFilter,
  setIncidentSeverityFilter,
  incidentSortOrder,
  setIncidentSortOrder,
  incidentDateFrom,
  incidentDateTo,
  todayStr,
  handleIncidentDateFromChange,
  handleIncidentDateFromBlur,
  handleIncidentDateToChange,
  handleIncidentDateToBlur,
  applyIncidentDateFilter,
  incidentSearchQuery,
  setIncidentSearchQuery,
  setIncidentPage,
  startNewIncidentDirect,
  loading,
  filteredIncidents,
  pagedIncidents,
  selectedIncidentId,
  toggleIncidentDetail,
  incidentRank,
  openEditIncidentModal,
  renderTablePagination,
  incidentPage,
  incidentTotalPages,
  selectedIncident,
  detailError,
  closeIncidentDetail,
  member,
  timeline,
  nextStatus,
  handleAssignToMe,
  actionLoading,
  memo,
  setMemo,
  handleChangeStatus,
  linkedReports,
  setShowLinkedReportsModal,
  linkedReportsLoading,
  setActiveNav,
  setSelectedReportId,
  setViewingPhotoUrl,
  fieldPhotoUploading,
  incidentPhotos,
  fieldPhotoInputRef,
  handleFieldPhotoSelected,
  MAX_INCIDENT_PHOTOS,
}) {
  return (
    <main className="px-5 py-4 bg-[#F7F9FC] min-h-[calc(100vh-64px)]">
      <div className="space-y-3">
        {/* 사건 관리 제목 */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl sm:text-[28px] leading-none font-extrabold text-[#0F2540]">사건 관리</h1>
            <p className="text-[13px] text-slate-500 mt-2">
              접수된 제보를 바탕으로 생성된 사건을 확인하고 처리 과정을 관리합니다.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pt-1"><span>홈</span><span>›</span><span className="text-slate-500">사건 관리</span></div>
        </div>

        {/* 사건 상태 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { key: "ALL", label: "전체 사건", sub: "등록된 전체 사건 수", icon: FileText, tone: "bg-blue-100 text-blue-700" },
            { key: "RECEIVED", label: "접수", sub: "신규 접수된 사건", icon: ClipboardList, tone: "bg-blue-100 text-blue-700" },
            { key: "CONFIRMING", label: "확인중", sub: "현장 확인 진행 중", icon: Search, tone: "bg-sky-100 text-sky-700" },
            { key: "RESPONDING", label: "대응중", sub: "현장 조치 진행 중", icon: Activity, tone: "bg-indigo-100 text-indigo-700" },
            { key: "RECOVERING", label: "복구중", sub: "복구 작업 진행 중", icon: RefreshCw, tone: "bg-orange-100 text-orange-700" },
            { key: "CLOSED", label: "종료", sub: "조치 완료된 사건", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
          ].map((card) => {
            const Icon = card.icon;
            const active = incidentStatusFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setIncidentStatusFilter(card.key)}
                className={`h-[92px] bg-white rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                  active
                    ? "border-[#0F2540] shadow-sm ring-1 ring-[#0F2540]/10"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3 h-full">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-600">{card.label}</div>
                    <div className="text-[25px] leading-7 font-extrabold text-[#0F2540] mt-0.5">
                      {incidentCounts[card.key]}<span className="text-xs font-semibold ml-1">건</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">{card.sub}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 상태 탭 + 검색 / 필터 : 제보관리와 동일한 구성 */}
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* 사건 상태 탭 */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { key: "ALL", label: "전체" },
                { key: "RECEIVED", label: "접수" },
                { key: "CONFIRMING", label: "확인중" },
                { key: "RESPONDING", label: "대응중" },
                { key: "RECOVERING", label: "복구중" },
                { key: "CLOSED", label: "종료" },
              ].map((tab) => {
                const active = incidentStatusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setIncidentStatusFilter(tab.key);
                      setIncidentPage(1);
                    }}
                    className={`h-8 px-3 rounded-lg border text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? "bg-[#0F2540] border-[#0F2540] text-white shadow-sm"
                        : "bg-white border-slate-300 text-slate-600 hover:border-[#0F2540]/50 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label} ({incidentCounts[tab.key]})
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2 min-w-0">
              <select
                value={incidentTypeFilter}
                onChange={(e) => { setIncidentTypeFilter(e.target.value); setIncidentPage(1); }}
                className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
              >
                <option value="ALL">전체 유형</option>
                {REPORT_DISASTER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>

              <select
                value={incidentRegionFilter}
                onChange={(e) => { setIncidentRegionFilter(e.target.value); setIncidentPage(1); }}
                className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
              >
                <option value="ALL">전체 지역</option>
                {REGION_OPTIONS.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>

              <select
                value={incidentSeverityFilter}
                onChange={(e) => { setIncidentSeverityFilter(e.target.value); setIncidentPage(1); }}
                className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
              >
                <option value="ALL">전체 위험도</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>

              <select
                value={incidentSortOrder}
                onChange={(e) => setIncidentSortOrder(e.target.value)}
                className="h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-600 bg-white hover:border-slate-300 cursor-pointer"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>

              <div className="h-8 rounded-lg border border-slate-200 bg-white px-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus-within:border-blue-400 focus-within:bg-blue-50/40 focus-within:shadow-sm">
                <input
                  type="date"
                  value={incidentDateFrom}
                  min={MIN_REPORT_DATE}
                  max={incidentDateTo || todayStr}
                  onChange={(e) => handleIncidentDateFromChange(e.target.value)}
                  onBlur={handleIncidentDateFromBlur}
                  className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                />
                <span className="text-slate-300">~</span>
                <input
                  type="date"
                  value={incidentDateTo}
                  min={incidentDateFrom || MIN_REPORT_DATE}
                  max={todayStr}
                  onChange={(e) => handleIncidentDateToChange(e.target.value)}
                  onBlur={handleIncidentDateToBlur}
                  className="h-full border-0 p-0 bg-transparent outline-none cursor-pointer text-slate-600 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                />
              </div>

              <button
                type="button"
                onClick={applyIncidentDateFilter}
                className="h-8 px-3 rounded-lg bg-[#0F2540] text-white text-xs font-bold hover:bg-[#16345c] transition-colors cursor-pointer whitespace-nowrap"
              >
                조회
              </button>

              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 h-8 w-[240px] transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  value={incidentSearchQuery}
                  onChange={(e) => { setIncidentSearchQuery(e.target.value); setIncidentPage(1); }}
                  placeholder="사건명, 지역, 재난유형 검색..."
                  className="w-full text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 기존 사건 목록 */}
        <section className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-[#0F2540]">기존 사건 목록</h3>
            <button
              type="button"
              onClick={startNewIncidentDirect}
              className="h-8 px-4 rounded-lg bg-[#0F2540] text-white text-xs font-bold flex items-center gap-1.5 transition hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> 사건 생성
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">검색 결과가 없습니다.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] table-fixed text-[13px]">
                  <thead>
                    <tr className="h-10 bg-[#E9ECEF] text-[12px] font-bold text-[#556070] border-y border-[#CBD5E1]">
                      <th className="px-4 py-3 text-center">사건번호</th>
                      <th className="px-4 py-3 text-left">사건명</th>
                      <th className="px-4 py-3 text-center">재난유형</th>
                      <th className="px-4 py-3 text-left">지역</th>
                      <th className="px-4 py-3 text-center">위험도</th>
                      <th className="px-4 py-3 text-center">담당자</th>
                      <th className="px-4 py-3 text-center">상태</th>
                      <th className="px-4 py-3 text-center">접수일시</th>
                      <th className="px-4 py-3 text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedIncidents.map((inc) => (
                      <tr
                        key={inc.incidentId}
                        onClick={() => toggleIncidentDetail(inc.incidentId)}
                        className={`h-[42px] border-b border-slate-200 last:border-0 transition-colors duration-150 cursor-pointer ${
                          selectedIncidentId === inc.incidentId ? "bg-blue-50" : "bg-white hover:bg-slate-50/90"
                        }`}
                      >
                        <td className="px-3 py-2 text-center font-bold text-[#0F2540]">#I-{incidentRank.get(inc.incidentId)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-700 max-w-[220px] truncate" title={inc.title}>{inc.title}</td>
                        <td className="px-3 py-2 text-center text-slate-500">{inc.disasterType}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[280px] truncate" title={inc.region}>{inc.region}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-extrabold ${
                            inc.severity === "HIGH"
                              ? "bg-red-100 text-red-600"
                              : inc.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-600"
                                : "bg-blue-100 text-blue-600"
                          }`}>
                            {inc.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">
                          {inc.assignedStaffName || (inc.assignedStaffId ? `#${inc.assignedStaffId}` : "미배정")}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_STYLE[inc.status] || "bg-slate-100 text-slate-600"}`}>
                            {STATUS_LABEL[inc.status] || inc.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(inc.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleIncidentDetail(inc.incidentId)}
                              className="border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-[#0F2540] hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                            >
                              상세보기
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditIncidentModal(inc)}
                              className="border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                            >
                              수정
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between border-t border-slate-200 bg-slate-50/60">
                <p className="text-xs text-slate-400">총 {filteredIncidents.length}건의 사건이 있습니다.</p>
                {renderTablePagination(incidentPage, incidentTotalPages, setIncidentPage)}
              </div>
            </>
          )}
        </section>

        {/* 사건 상세: 같은 사건 행/상세보기 재클릭 또는 X 버튼으로 닫힘 */}
        {selectedIncident ? (
          <section className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3.5">
              {detailError && (
                <div className="mb-3 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
                  {detailError}
                </div>
              )}

              {/* 첫 번째 시안처럼: 왼쪽에 사건 상세/진행, 오른쪽에 연결 제보/사진을 처음부터 나란히 배치 */}
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_355px] gap-3.5 min-w-0 items-start">
                <div className="min-w-0">
                  {/* 사건 상세 헤더 */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-base font-extrabold text-[#0F2540]">사건 상세 정보</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditIncidentModal(selectedIncident)}
                        className="bg-[#0F2540] text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] transition cursor-pointer"
                      >
                        사건 수정
                      </button>
                      <button
                        type="button"
                        onClick={closeIncidentDetail}
                        aria-label="사건 상세 닫기"
                        title="닫기"
                        className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 hover:border-slate-400 transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 사건 제목: 기본정보와 구분되도록 별도 영역 */}
                  <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 mb-3">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5">사건 제목</div>
                    <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                      <span className="text-[19px] font-extrabold text-[#0F2540]">#I-{incidentRank.get(selectedIncident.incidentId)}</span>
                      <span className="text-[19px] font-extrabold text-[#0F2540] min-w-0 truncate">{selectedIncident.title}</span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[selectedIncident.status] || "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABEL[selectedIncident.status] || selectedIncident.status}
                      </span>
                    </div>
                  </div>

                  {/* 핵심 정보 */}
                  <div className={`grid grid-cols-2 md:grid-cols-3 ${selectedIncident.sourceReportId ? "xl:grid-cols-7" : "xl:grid-cols-6"} gap-2 mb-4`}>
                    <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px] xl:col-span-2">
                      <MapPin className="w-4 h-4 text-[#244D7C] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 leading-none font-semibold">발생 위치</div>
                        <div className="text-[12px] font-semibold text-slate-700 truncate mt-1" title={selectedIncident.region}>{selectedIncident.region}</div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                      <AlertTriangle className="w-4 h-4 text-[#244D7C] shrink-0" />
                      <div>
                        <div className="text-[11px] text-slate-500 leading-none font-semibold">위험도</div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          selectedIncident.severity === "HIGH"
                            ? "bg-red-100 text-red-600"
                            : selectedIncident.severity === "MEDIUM"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-blue-100 text-blue-600"
                        }`}>{selectedIncident.severity}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                      <User className="w-4 h-4 text-[#244D7C] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 leading-none font-semibold">담당자</div>
                        <div className="text-[12px] font-semibold text-slate-700 mt-1 truncate">
                          {selectedIncident.assignedStaffName || (selectedIncident.assignedStaffId ? `#${selectedIncident.assignedStaffId}` : "미배정")}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                      <Building2 className="w-4 h-4 text-[#244D7C] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 leading-none font-semibold">담당 부서</div>
                        <div className="text-[12px] font-semibold text-slate-700 mt-1 truncate">{member?.departmentName || "-"}</div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px]">
                      <Clock className="w-4 h-4 text-[#244D7C] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 leading-none font-semibold">최종 업데이트</div>
                        <div className="text-[12px] font-semibold text-slate-700 whitespace-nowrap mt-1">{formatDateTime(selectedIncident.updatedAt || selectedIncident.createdAt)}</div>
                      </div>
                    </div>
                    {selectedIncident.sourceReportId && (
                      <button
                        type="button"
                        onClick={() => { setActiveNav("reports"); setSelectedReportId(selectedIncident.sourceReportId); }}
                        title="이 제보로 사건이 처음 만들어졌습니다. 클릭하면 제보 상세로 이동합니다."
                        className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 flex items-center gap-2.5 min-h-[66px] hover:bg-slate-100 transition cursor-pointer text-left"
                      >
                        <Link2 className="w-4 h-4 text-[#244D7C] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-500 leading-none font-semibold">최초 신고</div>
                          <div className="text-[12px] font-semibold text-slate-700 mt-1">#R-{selectedIncident.sourceReportId}</div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* 사건 진행 상황 */}
                  <div className="rounded-xl border border-slate-300 bg-white px-3 py-3.5 mb-3">
                    <h4 className="text-[13px] font-extrabold text-[#0F2540] mb-3">사건 진행 상황</h4>
                    <div className="grid grid-cols-5 gap-1.5">
                      {STATUS_ORDER.map((status, index) => {
                        const currentIndex = STATUS_ORDER.indexOf(selectedIncident.status);
                        const completed = index < currentIndex;
                        const current = index === currentIndex;
                        const statusLogs = timeline.filter((item) => item.newStatus === status);
                        const log = statusLogs[statusLogs.length - 1];
                        const fallbackDate = status === "RECEIVED" ? selectedIncident.createdAt : null;
                        const fallbackMemo = status === "RECEIVED" ? "사건이 접수되었습니다." : "아직 진행되지 않았습니다.";

                        return (
                          <div key={status} className="relative min-w-0">
                            {index < STATUS_ORDER.length - 1 && (
                              <div className={`absolute top-[15px] left-1/2 w-[calc(100%+0.5rem)] h-[2px] ${index < currentIndex ? "bg-blue-500" : "bg-slate-200"}`} />
                            )}
                            <div className="relative z-10 flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                completed
                                  ? "bg-blue-500 border-blue-500 text-white"
                                  : current
                                    ? "bg-blue-600 border-blue-600 text-white shadow-md ring-4 ring-blue-100"
                                    : "bg-slate-100 border-slate-200 text-slate-500"
                              }`}>
                                {completed ? "✓" : index + 1}
                              </div>
                              <div className={`text-xs font-bold mt-2 ${current ? "text-blue-700" : "text-slate-700"}`}>{STATUS_LABEL[status]}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 text-center min-h-[15px]">
                                {log?.changedAt || fallbackDate ? formatDateTime(log?.changedAt || fallbackDate) : "-"}
                              </div>
                              <div className={`w-full mt-2.5 min-h-[78px] rounded-lg border px-3 py-2 text-[11px] leading-[1.55] break-words transition-colors ${
                                current
                                  ? "border-blue-200 bg-blue-50 text-blue-800"
                                  : completed
                                    ? "border-slate-200 bg-white text-slate-600"
                                    : "border-slate-200 bg-slate-50/80 text-slate-400"
                              }`}>
                                {log?.memo || fallbackMemo}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 다음 단계 진행 */}
                  <div className="rounded-xl border border-slate-300 bg-white p-3">
                    {!nextStatus ? (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-3 py-2.5 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" /> 종료된 사건입니다. 각 단계의 진행 내용은 위에서 확인할 수 있습니다.
                      </div>
                    ) : !selectedIncident.assignedStaffId ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                        <div>
                          <p className="text-xs font-bold text-amber-800">담당자 배정이 필요합니다.</p>
                          <p className="text-[11px] text-amber-600 mt-0.5">담당자가 지정되어야 다음 단계로 진행할 수 있습니다.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAssignToMe}
                          disabled={actionLoading}
                          className="shrink-0 text-xs font-bold text-[#0F2540] border border-amber-200 bg-white rounded-lg px-3 py-2 hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                        >
                          내가 담당하기
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-xs font-extrabold text-[#0F2540]">다음 단계 진행 내용</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">입력한 내용은 {STATUS_LABEL[nextStatus]} 단계의 진행 기록으로 남습니다.</div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{memo.length}/500</span>
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value.slice(0, 500))}
                            placeholder={nextStatus === "CLOSED" ? "종료 사유 및 최종 조치 내용을 입력하세요." : `${STATUS_LABEL[nextStatus]} 단계로 진행할 내용을 입력하세요.`}
                            rows={2}
                            maxLength={500}
                            className="flex-1 resize-none border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={handleChangeStatus}
                            disabled={actionLoading}
                            className="min-w-[145px] bg-[#0F2540] text-white rounded-lg px-4 text-xs font-bold hover:bg-[#193A5B] hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            {withRo(STATUS_LABEL[nextStatus])} 진행
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 첫 번째 시안처럼 상세 상단부터 연결 제보/사진 배치 */}
                <aside className="space-y-2.5 min-w-0">
                  <div className="border border-slate-300 rounded-xl p-3 shadow-sm bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-extrabold text-[#0F2540]">연결된 제보 ({linkedReports.length}건)</h4>
                      {linkedReports.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowLinkedReportsModal(true)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          전체보기 ›
                        </button>
                      )}
                    </div>

                    {linkedReportsLoading ? (
                      <div className="text-xs text-slate-400 py-5 text-center">불러오는 중...</div>
                    ) : linkedReports.length === 0 ? (
                      <div className="text-xs text-slate-400 py-5 text-center">연결된 제보가 없습니다.</div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-slate-300">
                        <table className="w-full text-[11px] table-fixed">
                          <colgroup>
                            <col className="w-[62px]" />
                            <col className="w-[68px]" />
                            <col />
                            <col className="w-[94px]" />
                          </colgroup>

                          <thead className="bg-slate-100">
                            <tr className="border-b border-slate-300">
                              <th className="border-r border-slate-200 px-2 py-2.5 text-center text-[10px] font-bold text-slate-600 whitespace-nowrap">제보번호</th>
                              <th className="border-r border-slate-200 px-2 py-2.5 text-center text-[10px] font-bold text-slate-600 whitespace-nowrap">재난유형</th>
                              <th className="border-r border-slate-200 px-3 py-2.5 text-center text-[10px] font-bold text-slate-600 whitespace-nowrap">제보내용</th>
                              <th className="px-2 py-2.5 text-center text-[10px] font-bold text-slate-600 whitespace-nowrap">접수일시</th>
                            </tr>
                          </thead>

                          <tbody className="bg-white">
                            {linkedReports.slice(0, 4).map((report) => (
                              <tr
                                key={report.reportId}
                                onClick={() => { setActiveNav("reports"); setSelectedReportId(report.reportId); }}
                                className="border-b border-slate-200 last:border-b-0 hover:bg-blue-50/50 transition-colors cursor-pointer"
                              >
                                <td className="border-r border-slate-200 px-2 py-3 text-center font-bold text-[#0F2540] whitespace-nowrap">#R-{report.reportId}</td>
                                <td className="border-r border-slate-200 px-2 py-3 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                    {report.disasterType || "-"}
                                  </span>
                                </td>
                                <td className="border-r border-slate-200 px-3 py-3 text-center text-slate-600 truncate" title={report.content}>{report.content || "-"}</td>
                                <td className="px-2 py-3 text-center text-slate-500 whitespace-nowrap tabular-nums">{formatDateTime(report.createdAt).slice(5)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-300 rounded-xl p-3 shadow-sm bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-extrabold text-[#0F2540]">
                        제보자 첨부 사진 {linkedReports.filter((r) => r.photoUrl).length > 0 && `(${linkedReports.filter((r) => r.photoUrl).length})`}
                      </h4>
                      {linkedReports.filter((r) => r.photoUrl).length > 4 && (
                        <button
                          type="button"
                          onClick={() => { setActiveNav("reports"); }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          전체보기 ›
                        </button>
                      )}
                    </div>
                    {linkedReports.some((report) => report.photoUrl) ? (
                      <div className="grid grid-cols-2 gap-2">
                        {linkedReports.filter((report) => report.photoUrl).slice(0, 4).map((report) => (
                          <button
                            key={report.reportId}
                            type="button"
                            onClick={() => setViewingPhotoUrl(`http://localhost:8080${report.photoUrl}`)}
                            className="overflow-hidden rounded-lg border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
                          >
                            <img src={`http://localhost:8080${report.photoUrl}`} alt="제보 첨부" className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 rounded-lg py-6 text-center text-[11px] text-slate-400">첨부된 제보 사진이 없습니다.</div>
                    )}
                  </div>

                  <div className="border border-slate-300 rounded-xl p-3 shadow-sm bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-[#0F2540]">현장 확인 사진</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">제보 사진과 별도로 담당자가 현장을 확인한 사진입니다. (최대 {MAX_INCIDENT_PHOTOS}장)</p>
                      </div>
                      <button
                        type="button"
                        disabled={fieldPhotoUploading || incidentPhotos.length >= MAX_INCIDENT_PHOTOS}
                        onClick={() => fieldPhotoInputRef.current?.click()}
                        className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#0F2540] border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition cursor-pointer disabled:opacity-50"
                      >
                        {fieldPhotoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        {fieldPhotoUploading ? "업로드 중..." : "현장 사진 추가"}
                      </button>
                      <input
                        ref={fieldPhotoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFieldPhotoSelected}
                        className="hidden"
                      />
                    </div>
                    {incidentPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {incidentPhotos.map((url, index) => (
                          <button
                            key={url + index}
                            type="button"
                            onClick={() => setViewingPhotoUrl(`http://localhost:8080${url}`)}
                            className="overflow-hidden rounded-lg border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer group"
                          >
                            <img
                              src={`http://localhost:8080${url}`}
                              alt={`현장 확인 사진 ${index + 1}`}
                              className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-200 rounded-lg py-5 text-center bg-slate-50/50">
                        <Camera className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <div className="text-[11px] text-slate-400">현장 확인 사진이 등록되면 여기에 표시됩니다.</div>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl py-14 text-center text-sm text-slate-400">
            위 목록에서 사건을 선택하면 상세 정보가 표시됩니다.
          </div>
        )}
      </div>
    </main>
  );
}
