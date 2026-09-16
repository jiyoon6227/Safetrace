import { X, Loader2, Search } from "lucide-react";

export default function EditIncidentModal({
  editIncident,
  setEditIncident,
  setShowEditIncidentModal,
  setEditError,
  handleUpdateIncident,
  handleEditAddressSearch,
  editGeocoding,
  editError,
  editLoading,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#0F2540]">사건 정보 수정</h3>
          <button
            onClick={() => {
              setShowEditIncidentModal(false);
              setEditIncident(null);
              setEditError("");
            }}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          상태(진행 단계)와 담당자는 여기서 바꿀 수 없습니다. 상세 패널의 워크플로우를 이용해주세요.
        </p>

        <form onSubmit={handleUpdateIncident} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">사건명</label>
            <input
              type="text"
              value={editIncident.title}
              onChange={(e) => setEditIncident({ ...editIncident, title: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
              placeholder="예: 유성구 궁동 침수"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">재난유형</label>
              <select
                value={editIncident.disasterType}
                onChange={(e) => setEditIncident({ ...editIncident, disasterType: e.target.value })}
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
                value={editIncident.severity}
                onChange={(e) => setEditIncident({ ...editIncident, severity: e.target.value })}
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
              onClick={handleEditAddressSearch}
              disabled={editGeocoding}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              {editGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              주소 다시 검색
            </button>
            {editIncident.region && editIncident.latitude && editIncident.longitude ? (
              <p className="text-xs text-emerald-600 mt-1.5">✓ {editIncident.region}</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">주소 검색으로 위치를 확인해주세요.</p>
            )}
          </div>

          <p className="text-[11px] text-slate-400">현장 사진은 저장 후 상세패널의 "현장 사진 추가"에서 관리할 수 있습니다.</p>

          {editError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
          )}

          <button
            type="submit"
            disabled={editLoading}
            className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
          >
            {editLoading ? "저장 중..." : "수정 내용 저장"}
          </button>
        </form>
      </div>
    </div>
  );
}
