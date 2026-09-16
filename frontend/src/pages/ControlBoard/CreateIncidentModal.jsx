import { X, Loader2, Search, Camera } from "lucide-react";

export default function CreateIncidentModal({
  bulkLinkReportIds,
  linkAfterCreateReportId,
  setShowCreateIncidentModal,
  setLinkAfterCreateReportId,
  setBulkLinkReportIds,
  setCreateError,
  setPhotoFile,
  setPhotoPreviewUrl,
  handleCreateIncident,
  newIncident,
  setNewIncident,
  handleAddressSearch,
  geocoding,
  photoPreviewUrl,
  handlePhotoChange,
  handleRemovePhoto,
  createError,
  createLoading,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540]">
            {bulkLinkReportIds ? `새 사건(Incident) 등록 · 제보 ${bulkLinkReportIds.length}건 묶음` : linkAfterCreateReportId ? "새 사건(Incident) 등록" : "새 사건 직접 등록"}
          </h3>
          <button
            onClick={() => {
              setShowCreateIncidentModal(false);
              setLinkAfterCreateReportId(null);
              setBulkLinkReportIds(null);
              setCreateError("");
              setPhotoFile(null);
              setPhotoPreviewUrl(null);
            }}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          {bulkLinkReportIds
            ? `체크한 제보 ${bulkLinkReportIds.length}건이 모두 이 사건 하나로 연결됩니다. 대표로 첫 번째 제보 정보를 채워뒀으니 필요하면 수정하세요.`
            : linkAfterCreateReportId
            ? "재난유형·지역·위치가 이 제보 정보로 자동 채워져 있습니다. 필요하면 주소를 다시 검색해 수정해도 됩니다."
            : "제보 없이 담당자가 직접 사건을 등록합니다. 아래 버튼으로 주소를 검색해 위치를 확인해주세요."}
        </p>

        <form onSubmit={handleCreateIncident} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">사건명</label>
            <input
              type="text"
              value={newIncident.title}
              onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              placeholder="예: 유성구 궁동 침수"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">재난유형</label>
              <select
                value={newIncident.disasterType}
                onChange={(e) => setNewIncident({ ...newIncident, disasterType: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              >
                {["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">위험도</label>
              <select
                value={newIncident.severity}
                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">위치</label>
            <button
              type="button"
              onClick={handleAddressSearch}
              disabled={geocoding}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              주소 검색
            </button>
            {newIncident.region && newIncident.latitude && newIncident.longitude ? (
              <p className="text-xs text-emerald-600 mt-1.5">✓ {newIncident.region}</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">주소 검색으로 위치를 확인해주세요.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">현장 사진 (선택)</label>
            {!photoPreviewUrl ? (
              <label className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-dashed border-slate-300 rounded-lg py-4 hover:bg-slate-50 cursor-pointer">
                <Camera className="w-4 h-4" />
                사진 첨부하기
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            ) : (
              <div className="relative">
                <img src={photoPreviewUrl} alt="현장 사진 미리보기" className="w-full h-40 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {createError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
          )}

          <button
            type="submit"
            disabled={createLoading}
            className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
          >
            {createLoading
              ? "등록 중..."
              : bulkLinkReportIds
              ? `등록하고 제보 ${bulkLinkReportIds.length}건 연결하기`
              : linkAfterCreateReportId
              ? "등록하고 제보 연결하기"
              : "사건 등록하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
