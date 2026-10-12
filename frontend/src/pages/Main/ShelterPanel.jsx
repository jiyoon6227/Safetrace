import {
  ArrowRight, Building2, MapPin, Navigation, Search,
} from "lucide-react";

// 대피시설 찾기 패널
export default function ShelterPanel({
  shelterPanelRef,
  weatherLocation,
  weatherLocationLabel,
  weatherLocating,
  quickShelterLoading,
  quickShelterError,
  quickShelterQuery,
  setQuickShelterQuery,
  setQuickShelterRefreshKey,
  requestWeatherLocation,
  filteredQuickShelters,
  formatShelterDistance,
  goTo,
}) {
  return (
    <section ref={shelterPanelRef} className="max-w-[1450px] mx-auto px-6 pt-4">
      <div className="bg-white rounded-[22px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[20px] font-extrabold text-[#0B2A52]">가까운 대피시설</h2>
                {weatherLocation && (
                  <span className="text-[11px] text-slate-400 truncate">
                    {String(weatherLocationLabel || "").replace(/\s*기준\s*$/, "")} 기준
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">현재 위치에서 가까운 실제 민방위 대피시설을 거리순으로 보여드립니다.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-9 w-full sm:w-[320px] border border-slate-200 rounded-lg px-3 flex items-center gap-2 focus-within:border-blue-300">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={quickShelterQuery}
                onChange={(e) => setQuickShelterQuery(e.target.value)}
                placeholder="시설명 또는 주소 검색"
                className="flex-1 min-w-0 text-xs outline-none"
              />
            </div>
          </div>
        </div>

        {!weatherLocation ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-[#0B2A52]">가까운 대피시설을 보려면 현재 위치가 필요합니다.</p>
            <button
              type="button"
              onClick={requestWeatherLocation}
              disabled={weatherLocating}
              className="mt-4 h-10 px-5 rounded-xl bg-[#0B2A52] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {weatherLocating ? "위치 확인 중..." : "내 위치 확인하기"}
            </button>
          </div>
        ) : quickShelterLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">가까운 대피시설을 불러오는 중입니다.</div>
        ) : quickShelterError ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-red-500">{quickShelterError}</p>
            <button
              type="button"
              onClick={() => setQuickShelterRefreshKey((value) => value + 1)}
              className="mt-3 text-xs font-bold text-blue-600 cursor-pointer"
            >
              다시 확인하기
            </button>
          </div>
        ) : filteredQuickShelters.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            검색 조건에 맞는 대피시설이 없습니다. 시설명이나 주소를 다시 확인해주세요.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQuickShelters.slice(0, 3).map((shelter, index) => (
              <div key={`${shelter.name || "대피시설"}-${shelter.address || index}`} className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="text-sm font-extrabold">{index + 1}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-[#0B2A52]">{shelter.name || "대피시설"}</h3>
                    {index === 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">가장 가까운 곳</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">{shelter.address || "주소 정보 없음"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    {shelter.floorType && <span className="px-2 py-1 rounded-md bg-slate-100">{shelter.floorType}</span>}
                    {shelter.capacity && <span className="px-2 py-1 rounded-md bg-slate-100">수용인원 {shelter.capacity}명</span>}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-sm font-extrabold text-blue-600 shrink-0">
                  <MapPin className="w-4 h-4" />
                  {formatShelterDistance(shelter.distanceM)}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    goTo("shelters", {
                      shelterFocus: {
                        name: shelter.name || "",
                        address: shelter.address || "",
                        latitude: shelter.latitude ?? null,
                        longitude: shelter.longitude ?? null,
                      },
                    })
                  }
                  className="h-9 px-3 rounded-lg border border-blue-100 text-blue-600 text-xs font-bold flex items-center gap-1.5 shrink-0 hover:bg-blue-50 cursor-pointer"
                >
                  <Navigation className="w-4 h-4" />
                  지도에서 보기
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            {weatherLocation ? `가까운 순 · ${filteredQuickShelters.length}개 확인` : "현재 위치 확인 필요"}
          </span>
          <button
            type="button"
            onClick={() => goTo("shelters")}
            className="text-xs font-extrabold text-[#0B2A52] hover:text-blue-600 flex items-center gap-1 cursor-pointer"
          >
            전체 대피시설 보기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
