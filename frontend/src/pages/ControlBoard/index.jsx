import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCurrentUser } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { toDateInputValue } from "./constants";
import DashboardTab from "./DashboardTab";
import ReportsTab from "./ReportsTab";
import IncidentsTab from "./IncidentsTab";
import PublicInfoTab from "./PublicInfoTab";
import StatisticsReportTab from "./StatisticsReportTab";
import CreateIncidentModal from "./CreateIncidentModal";
import EditIncidentModal from "./EditIncidentModal";
import RejectModal from "./RejectModal";
import LinkedReportsModal from "./LinkedReportsModal";
import PhotoViewerModal from "./PhotoViewerModal";
import BulkMergeModal from "./BulkMergeModal";
import ResourceRequestModal from "./ResourceRequestModal";
import IncidentCloseConfirmModal from "./IncidentCloseConfirmModal";
import ControlBoardHeader from "./ControlBoardHeader";
import ControlBoardSidebar from "./ControlBoardSidebar";
import TablePagination from "./TablePagination";
import { useControlBoardData } from "./useControlBoardData";
import { useCreateIncidentForm } from "./useCreateIncidentForm";
import { useDashboardMap } from "./useDashboardMap";
import { useDashboardStats } from "./useDashboardStats";
import { useEditIncidentForm } from "./useEditIncidentForm";
import { useHeaderMenus } from "./useHeaderMenus";
import { useIncidentActions } from "./useIncidentActions";
import { useIncidentDetail } from "./useIncidentDetail";
import { useIncidentFilters } from "./useIncidentFilters";
import { useIncidentResources } from "./useIncidentResources";
import { useReportBulkActions } from "./useReportBulkActions";
import { useReportManagement } from "./useReportManagement";

const CONTROL_BOARD_TABS = new Set(["dashboard", "reports", "incidents", "publicInfo", "statistics"]);

export default function ControlBoard({ onBackToHome, onLogout, onOpenNotices }) {
  const currentUser = getCurrentUser();

  // 현재 탭은 URL의 ?tab=... 값을 기준으로 정해서 브라우저 새로고침 후에도 같은 탭을 유지한다.
  // 홈으로 나가면 tab이 없는 주소가 되므로 다시 STAFF로 들어오면 대시보드부터 시작한다.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeNav = CONTROL_BOARD_TABS.has(tabParam) ? tabParam : "dashboard";
  const setActiveNav = (nextTab) => {
    setSearchParams(nextTab === "dashboard" ? {} : { tab: nextTab });
  };

  const handleBackToHome = useCallback(() => {
    onBackToHome?.();
  }, [onBackToHome]);

  // 사건 연결/등록 성공 토스트
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);
  useEscapeKey(!!viewingPhotoUrl, () => setViewingPhotoUrl(null));

  const today = new Date();
  const todayStr = toDateInputValue(today); // 접수일시 필터 - 오늘 날짜(미래 선택 방지용)

  const {
    member, profileOpen, setProfileOpen, sidebarOpen, setSidebarOpen, notifOpen, setNotifOpen, profileRef,
    notifRef,
  } = useHeaderMenus();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const {
    reports, reportsLoading, selectedReportId, setSelectedReportId, reportPhotos, candidates, setCandidates,
    candidatesLoading, reportError, setReportError, reportAddresses, reportSearchQuery, setReportSearchQuery,
    reportTypeFilter, setReportTypeFilter, reportRegionFilter, setReportRegionFilter, reportSortOrder,
    setReportSortOrder, reportStatusFilter, setReportStatusFilter, reportDateFrom, reportDateTo, reportPage,
    setReportPage, selectedReportIds, setSelectedReportIds, resolveReportAddress, loadReports,
    resetReportFilters, openReportCandidates, handleLinkReport, handleMarkReviewing,
    handleReportDateFromChange, handleReportDateFromBlur, handleReportDateToChange, handleReportDateToBlur,
    applyReportDateFilter, totalReports, receivedReports, linkedReportsCount, reviewingReports,
    rejectedReports, filteredReports, reportTotalPages, pagedReports, selectablePagedReports, allPageSelected,
    selectedReport, selectedLinkedIncident,
  } = useReportManagement({ incidents, setToast, todayStr });

  const {
    rejectTarget, setRejectTarget, rejectReasonInput, setRejectReasonInput, rejectSubmitting, bulkMergeOpen,
    setBulkMergeOpen, bulkMergeCandidates, bulkMergeLoading, bulkMergeSubmitting, openRejectModal,
    submitReject, toggleReportSelected, openBulkMerge, handleBulkLinkToIncident,
  } = useReportBulkActions({
    reports, selectedReportIds, setSelectedReportIds, selectedReportId, setSelectedReportId, setCandidates,
    setReportError, loadReports, setToast,
  });

  const {
    selectedIncidentId, setSelectedIncidentId, selectedIncidentIdRef, timeline, linkedReports,
    linkedReportsLoading, memo, setMemo, actionLoading, setActionLoading, detailError, setDetailError,
    closeIncidentDetail, toggleIncidentDetail, incidentPhotos, setIncidentPhotos, linkedReportPhotos,
    showAllLinkedReportPhotos, setShowAllLinkedReportPhotos, showLinkedReportsModal,
    setShowLinkedReportsModal, linkedReportsModalPage, setLinkedReportsModalPage,
    linkedReportsModalTotalPages, pagedLinkedReports, openIncidentDetail, closeDetail, selectedIncident,
    nextStatus,
  } = useIncidentDetail({ incidents, resolveReportAddress });

  const {
    incidentSearchQuery, setIncidentSearchQuery, incidentSortOrder, setIncidentSortOrder,
    incidentStatusFilter, setIncidentStatusFilter, incidentTypeFilter, setIncidentTypeFilter,
    incidentRegionFilter, setIncidentRegionFilter, incidentSeverityFilter, setIncidentSeverityFilter,
    incidentDateFrom, incidentDateTo, incidentPage, setIncidentPage, handleIncidentDateFromChange,
    handleIncidentDateFromBlur, handleIncidentDateToChange, handleIncidentDateToBlur, applyIncidentDateFilter,
    incidentTotalCount, incidentCounts, incidentRank, incidentTotalPages, pagedIncidents, incidentListLoading,
  } = useIncidentFilters({ incidents, selectedIncidentId, closeDetail, setToast, todayStr });

  // 지도 초기화 실패 메시지를 첫 사건 조회가 지우는 순서가 있어 useDashboardMap을 useControlBoardData보다 먼저 호출한다.
  const {
    mapRef, mapTypeFilter, setMapTypeFilter, mapUrgentOnly, setMapUrgentOnly, dashboardReports, mapLayers,
    setMapLayers, mapType, setMapType, drawMarkers, handleZoom, handleLocateReset,
  } = useDashboardMap({
    activeNav, setActiveNav, incidents, setError, openIncidentDetail, setSelectedReportId,
  });

  const { loadIncidents } = useControlBoardData({
    activeNav, incidents, drawMarkers, dashboardReports, mapTypeFilter, mapLayers, mapUrgentOnly,
    setIncidents, setLoading, setError, loadReports, setSelectedReportId, setCandidates,
    selectedIncidentIdRef, openIncidentDetail,
  });

  // 사건 상세의 자원 요청 영역 (요청 목록·요청 모달·취소)
  const resources = useIncidentResources({ selectedIncidentId, setToast });

  const {
    fieldPhotoUploading, fieldPhotoInputRef, MAX_INCIDENT_PHOTOS, handleFieldPhotoSelected, handleAssignToMe,
    handleChangeStatus, closurePreview, closureSubmitting, closureError, confirmClosure, cancelClosure,
  } = useIncidentActions({
    currentUser, selectedIncident, nextStatus, memo, setMemo, setActionLoading, setDetailError,
    incidentPhotos, setIncidentPhotos, loadIncidents, openIncidentDetail, setToast,
    afterStatusChange: resources.loadRequests,
  });

  const {
    editIncident, setEditIncident, showEditIncidentModal, setShowEditIncidentModal, editLoading, editError,
    setEditError, editGeocoding, openEditIncidentModal, handleEditAddressSearch, handleUpdateIncident,
  } = useEditIncidentForm({ selectedIncidentIdRef, loadIncidents, openIncidentDetail, setToast });

  const {
    newIncident, setNewIncident, createLoading, createError, setCreateError, linkAfterCreateReportId,
    setLinkAfterCreateReportId, showCreateIncidentModal, setShowCreateIncidentModal, bulkLinkReportIds,
    setBulkLinkReportIds, startBulkNewIncident, startNewIncidentFromReport, startNewIncidentDirect, geocoding,
    setPhotoFile, photoPreviewUrl, setPhotoPreviewUrl, handleAddressSearch, handlePhotoChange,
    handleRemovePhoto, handleCreateIncident,
  } = useCreateIncidentForm({
    reports, reportAddresses, selectedReportIds, setSelectedReportIds, setBulkMergeOpen, loadReports,
    loadIncidents, setToast,
  });

  const {
    dashboardReceivedCount, stats, statCards, myTaskCards, mapStatusChips, dailyStats, dailyMax, recentActivity,
  } = useDashboardStats({
    incidents, dashboardReports, today, setActiveNav, setSelectedIncidentId,
    setIncidentSearchQuery, setIncidentStatusFilter, setIncidentTypeFilter, setIncidentRegionFilter,
    setIncidentSeverityFilter, setIncidentSortOrder, setIncidentPage,
  });

  const handleNavClick = (key) => {
    if (!key) return;
    if (key === activeNav) {
      // 이미 활성화된 탭을 다시 누른 경우 - activeNav 값이 그대로라 setActiveNav만으론
      // 리렌더가 안 일어나므로, 그 탭의 새로고침 함수를 직접 호출해줌
      if (key === "reports") { resetReportFilters(); loadReports(); }
      else if (key === "incidents") {
        setSelectedIncidentId(null);
        setIncidentSearchQuery("");
        setIncidentStatusFilter("ALL");
        setIncidentTypeFilter("ALL");
        setIncidentRegionFilter("ALL");
        setIncidentSeverityFilter("ALL");
        setIncidentSortOrder("newest");
        setIncidentPage(1);
        loadIncidents();
      }
      else if (key === "dashboard") loadIncidents();
    } else {
      if (key === "incidents") {
        setSelectedIncidentId(null);
        setIncidentSearchQuery("");
        setIncidentStatusFilter("ALL");
        setIncidentTypeFilter("ALL");
        setIncidentRegionFilter("ALL");
        setIncidentSeverityFilter("ALL");
        setIncidentSortOrder("newest");
        setIncidentPage(1);
      }
      setActiveNav(key);
    }
  };

  const renderTablePagination = (currentPage, totalPages, setPage) => (
    <TablePagination currentPage={currentPage} totalPages={totalPages} setPage={setPage} />
  );

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* 사이드바 - 햄버거로 폭을 접었다 펼쳤다 하는 방식(모바일/데스크톱 공통) */}
      <ControlBoardSidebar
        sidebarOpen={sidebarOpen}
        handleBackToHome={handleBackToHome}
        activeNav={activeNav}
        handleNavClick={handleNavClick}
        member={member}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      {/* 메인 */}
      <div className="flex-1 min-w-0">
        {/* 헤더 */}
        <ControlBoardHeader
          setSidebarOpen={setSidebarOpen}
          notifRef={notifRef}
          notifOpen={notifOpen}
          setNotifOpen={setNotifOpen}
          dashboardReceivedCount={dashboardReceivedCount}
          setActiveNav={setActiveNav}
          profileRef={profileRef}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          member={member}
          currentUser={currentUser}
          handleBackToHome={handleBackToHome}
          onLogout={onLogout}
        />

        {activeNav === "dashboard" && (
          <DashboardTab
            error={error}
            currentUser={currentUser}
            member={member}
            today={today}
            loadIncidents={loadIncidents}
            statCards={statCards}
            myTaskCards={myTaskCards}
            mapStatusChips={mapStatusChips}
            mapTypeFilter={mapTypeFilter}
            setMapTypeFilter={setMapTypeFilter}
            mapUrgentOnly={mapUrgentOnly}
            setMapUrgentOnly={setMapUrgentOnly}
            urgentCount={stats.urgent}
            mapLayers={mapLayers}
            setMapLayers={setMapLayers}
            mapType={mapType}
            setMapType={setMapType}
            mapRef={mapRef}
            handleZoom={handleZoom}
            handleLocateReset={handleLocateReset}
            loading={loading}
            incidents={incidents}
            setActiveNav={setActiveNav}
            recentActivity={recentActivity}
            dailyStats={dailyStats}
            dailyMax={dailyMax}
            onOpenNotices={onOpenNotices}
          />
        )}

        {activeNav === "reports" && (
          <ReportsTab
            reportError={reportError}
            totalReports={totalReports}
            receivedReports={receivedReports}
            reviewingReports={reviewingReports}
            linkedReportsCount={linkedReportsCount}
            rejectedReports={rejectedReports}
            reportStatusFilter={reportStatusFilter}
            setReportStatusFilter={setReportStatusFilter}
            reportTypeFilter={reportTypeFilter}
            setReportTypeFilter={setReportTypeFilter}
            reportRegionFilter={reportRegionFilter}
            setReportRegionFilter={setReportRegionFilter}
            reportSortOrder={reportSortOrder}
            setReportSortOrder={setReportSortOrder}
            reportDateFrom={reportDateFrom}
            reportDateTo={reportDateTo}
            todayStr={todayStr}
            handleReportDateFromChange={handleReportDateFromChange}
            handleReportDateFromBlur={handleReportDateFromBlur}
            handleReportDateToChange={handleReportDateToChange}
            handleReportDateToBlur={handleReportDateToBlur}
            applyReportDateFilter={applyReportDateFilter}
            reportSearchQuery={reportSearchQuery}
            setReportSearchQuery={setReportSearchQuery}
            selectedReportIds={selectedReportIds}
            setSelectedReportIds={setSelectedReportIds}
            openBulkMerge={openBulkMerge}
            openRejectModal={openRejectModal}
            reports={reports}
            reportAddresses={reportAddresses}
            reportsLoading={reportsLoading}
            filteredReports={filteredReports}
            allPageSelected={allPageSelected}
            selectablePagedReports={selectablePagedReports}
            pagedReports={pagedReports}
            selectedReportId={selectedReportId}
            setSelectedReportId={setSelectedReportId}
            setCandidates={setCandidates}
            setReportError={setReportError}
            openReportCandidates={openReportCandidates}
            toggleReportSelected={toggleReportSelected}
            incidentRank={incidentRank}
            setActiveNav={setActiveNav}
            openIncidentDetail={openIncidentDetail}
            reportPage={reportPage}
            reportTotalPages={reportTotalPages}
            setReportPage={setReportPage}
            renderTablePagination={renderTablePagination}
            selectedReport={selectedReport}
            reportPhotos={reportPhotos}
            setViewingPhotoUrl={setViewingPhotoUrl}
            selectedLinkedIncident={selectedLinkedIncident}
            handleMarkReviewing={handleMarkReviewing}
            candidatesLoading={candidatesLoading}
            candidates={candidates}
            handleLinkReport={handleLinkReport}
            startNewIncidentFromReport={startNewIncidentFromReport}
          />
        )}

        {activeNav === "incidents" && (
          <IncidentsTab
            incidentCounts={incidentCounts}
            incidentStatusFilter={incidentStatusFilter}
            setIncidentStatusFilter={setIncidentStatusFilter}
            incidentTypeFilter={incidentTypeFilter}
            setIncidentTypeFilter={setIncidentTypeFilter}
            incidentRegionFilter={incidentRegionFilter}
            setIncidentRegionFilter={setIncidentRegionFilter}
            incidentSeverityFilter={incidentSeverityFilter}
            setIncidentSeverityFilter={setIncidentSeverityFilter}
            incidentSortOrder={incidentSortOrder}
            setIncidentSortOrder={setIncidentSortOrder}
            incidentDateFrom={incidentDateFrom}
            incidentDateTo={incidentDateTo}
            todayStr={todayStr}
            handleIncidentDateFromChange={handleIncidentDateFromChange}
            handleIncidentDateFromBlur={handleIncidentDateFromBlur}
            handleIncidentDateToChange={handleIncidentDateToChange}
            handleIncidentDateToBlur={handleIncidentDateToBlur}
            applyIncidentDateFilter={applyIncidentDateFilter}
            incidentSearchQuery={incidentSearchQuery}
            setIncidentSearchQuery={setIncidentSearchQuery}
            setIncidentPage={setIncidentPage}
            startNewIncidentDirect={startNewIncidentDirect}
            loading={loading || incidentListLoading}
            incidentTotalCount={incidentTotalCount}
            pagedIncidents={pagedIncidents}
            selectedIncidentId={selectedIncidentId}
            toggleIncidentDetail={toggleIncidentDetail}
            incidentRank={incidentRank}
            openEditIncidentModal={openEditIncidentModal}
            renderTablePagination={renderTablePagination}
            incidentPage={incidentPage}
            incidentTotalPages={incidentTotalPages}
            selectedIncident={selectedIncident}
            detailError={detailError}
            closeIncidentDetail={closeIncidentDetail}
            member={member}
            timeline={timeline}
            nextStatus={nextStatus}
            handleAssignToMe={handleAssignToMe}
            actionLoading={actionLoading}
            memo={memo}
            setMemo={setMemo}
            handleChangeStatus={handleChangeStatus}
            linkedReports={linkedReports}
            setShowLinkedReportsModal={setShowLinkedReportsModal}
            linkedReportsLoading={linkedReportsLoading}
            linkedReportPhotos={linkedReportPhotos}
            showAllLinkedReportPhotos={showAllLinkedReportPhotos}
            setShowAllLinkedReportPhotos={setShowAllLinkedReportPhotos}
            setActiveNav={setActiveNav}
            setSelectedReportId={setSelectedReportId}
            setViewingPhotoUrl={setViewingPhotoUrl}
            fieldPhotoUploading={fieldPhotoUploading}
            incidentPhotos={incidentPhotos}
            fieldPhotoInputRef={fieldPhotoInputRef}
            handleFieldPhotoSelected={handleFieldPhotoSelected}
            MAX_INCIDENT_PHOTOS={MAX_INCIDENT_PHOTOS}
            currentUser={currentUser}
            resources={resources}
          />
        )}

        {activeNav === "publicInfo" && <PublicInfoTab />}
        {activeNav === "statistics" && <StatisticsReportTab />}

      </div>

      {/* 연결된 제보 전체보기 팝업 */}
      {showLinkedReportsModal && (
        <LinkedReportsModal
          setShowLinkedReportsModal={setShowLinkedReportsModal}
          linkedReports={linkedReports}
          pagedLinkedReports={pagedLinkedReports}
          linkedReportsModalPage={linkedReportsModalPage}
          setLinkedReportsModalPage={setLinkedReportsModalPage}
          linkedReportsModalTotalPages={linkedReportsModalTotalPages}
          setActiveNav={setActiveNav}
          setSelectedReportId={setSelectedReportId}
          setViewingPhotoUrl={setViewingPhotoUrl}
        />
      )}

      {/* 첨부 사진 확대보기 팝업 */}
      {viewingPhotoUrl && (
        <PhotoViewerModal viewingPhotoUrl={viewingPhotoUrl} setViewingPhotoUrl={setViewingPhotoUrl} />
      )}

      {/* "이 제보로 새 사건 만들기" 모달 - 탭 이동 없이 팝업으로 처리 */}
      {showCreateIncidentModal && (
        <CreateIncidentModal
          bulkLinkReportIds={bulkLinkReportIds}
          linkAfterCreateReportId={linkAfterCreateReportId}
          setShowCreateIncidentModal={setShowCreateIncidentModal}
          setLinkAfterCreateReportId={setLinkAfterCreateReportId}
          setBulkLinkReportIds={setBulkLinkReportIds}
          setCreateError={setCreateError}
          setPhotoFile={setPhotoFile}
          setPhotoPreviewUrl={setPhotoPreviewUrl}
          handleCreateIncident={handleCreateIncident}
          newIncident={newIncident}
          setNewIncident={setNewIncident}
          handleAddressSearch={handleAddressSearch}
          geocoding={geocoding}
          photoPreviewUrl={photoPreviewUrl}
          handlePhotoChange={handlePhotoChange}
          handleRemovePhoto={handleRemovePhoto}
          createError={createError}
          createLoading={createLoading}
        />
      )}

      {/* 사건 수정 모달 - "새 사건 등록" 모달과 필드 구성은 같고, editIncident를 채운 채로 열림 */}
      {showEditIncidentModal && editIncident && (
        <EditIncidentModal
          editIncident={editIncident}
          setEditIncident={setEditIncident}
          setShowEditIncidentModal={setShowEditIncidentModal}
          setEditError={setEditError}
          handleUpdateIncident={handleUpdateIncident}
          handleEditAddressSearch={handleEditAddressSearch}
          editGeocoding={editGeocoding}
          editError={editError}
          editLoading={editLoading}
        />
      )}

      {/* 반려 모달 - 사유 입력 필수, 단건/일괄(rejectTarget === "bulk") 공용 */}
      {rejectTarget && (
        <RejectModal
          rejectTarget={rejectTarget}
          setRejectTarget={setRejectTarget}
          rejectSubmitting={rejectSubmitting}
          selectedReportIds={selectedReportIds}
          rejectReasonInput={rejectReasonInput}
          setRejectReasonInput={setRejectReasonInput}
          submitReject={submitReject}
        />
      )}

      {/* 체크박스로 여러 건을 골라 한번에 합치는 모달 - 첫 번째 선택 건 기준으로 후보를 찾음 */}
      {bulkMergeOpen && (
        <BulkMergeModal
          bulkMergeSubmitting={bulkMergeSubmitting}
          setBulkMergeOpen={setBulkMergeOpen}
          selectedReportIds={selectedReportIds}
          bulkMergeLoading={bulkMergeLoading}
          bulkMergeCandidates={bulkMergeCandidates}
          incidentRank={incidentRank}
          handleBulkLinkToIncident={handleBulkLinkToIncident}
          startBulkNewIncident={startBulkNewIncident}
        />
      )}

      {/* 자원 요청 모달 - 사건 상세의 "자원 요청" 버튼으로 열림 */}
      {resources.requestModalOpen && selectedIncident && (
        <ResourceRequestModal
          incident={selectedIncident}
          incidentLabel={`#I-${incidentRank.get(selectedIncident.incidentId)}`}
          stocks={resources.stocks}
          stocksLoading={resources.stocksLoading}
          stocksError={resources.stocksError}
          submitting={resources.submitting}
          submitError={resources.submitError}
          onSubmit={resources.submitRequest}
          onClose={resources.closeRequestModal}
        />
      )}

      {/* 사건 종료 확인 모달 - 취소될 출고 전 요청이나 미반납 출고 건이 있을 때만 열림 */}
      {closurePreview && selectedIncident && (
        <IncidentCloseConfirmModal
          incidentLabel={`#I-${incidentRank.get(selectedIncident.incidentId)}`}
          incident={selectedIncident}
          preview={closurePreview}
          submitting={closureSubmitting}
          error={closureError}
          onConfirm={confirmClosure}
          onCancel={cancelClosure}
        />
      )}

      {/* 사건 연결/등록 성공 토스트 - MainPage.jsx 제보 접수 토스트와 동일한 스타일 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F2540] text-white text-sm font-semibold rounded-lg px-4 py-3 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
