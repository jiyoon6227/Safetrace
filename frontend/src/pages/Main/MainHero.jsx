import {
  ArrowRight, Camera, CheckCircle2, ChevronRight, MapPin, Navigation, Search, ShieldAlert,
} from "lucide-react";
import mainBg from "../../assets/main.png";
import { distanceKm } from "./utils";

// 메인 히어로
export default function MainHero({
  headerSearchQuery,
  setHeaderSearchQuery,
  headerSearchInputRef,
  mainNearbyIncident,
  mainNearbyIncidentLoading,
  weatherLocation,
  goTo,
  submitHeroSearch,
  handleReportPageClick,
}) {
  return (
          <section className="relative overflow-hidden bg-[#071A31]">
            {/* 배경 이미지는 object-cover로 비율 유지 (100% 100% 강제 시 창 폭에 따라 찌그러짐) */}
            <img
              src={mainBg}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
            />
            <div className="absolute inset-0 bg-[#04182b]/10 pointer-events-none" />

            <div className="relative max-w-[1450px] mx-auto px-5 sm:px-6 lg:px-8 py-9 sm:py-11 lg:py-12 grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-7 lg:gap-12 items-center">
              <div className="max-w-[590px]">
                <div className="text-[10px] sm:text-[11px] tracking-[0.42em] font-bold text-white/80 mb-3 sm:mb-4">SAFETRACE</div>
                <h1 className="text-[38px] sm:text-[46px] xl:text-[54px] leading-[1.08] font-black tracking-tight text-white">
                  오늘도,<br />
                  <span className="text-[#36A3FF]">더 안전한 내일을</span> 위해
                </h1>
                <p className="mt-4 sm:mt-5 text-[14px] sm:text-[16px] leading-6 sm:leading-7 font-medium text-white/95">
                  작은 관심이 더 안전한 일상을 만듭니다.<br />
                  세이프트레이스는 언제나 함께합니다.
                </p>
               <div className="mt-5 bg-white rounded-2xl h-[54px] sm:h-[58px] shadow-xl shadow-black/20 border border-white/80 flex items-center px-4 sm:px-5 w-full max-w-[510px]">
      <button
        type="button"
        onClick={submitHeroSearch}
        aria-label="검색"
        className="mr-3 shrink-0 cursor-pointer"
      >
        <Search className="w-5 h-5 text-[#0B2A52]" />
      </button>
      <input
        ref={headerSearchInputRef}
        value={headerSearchQuery}
        onChange={(e) => setHeaderSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            submitHeroSearch();
          }
        }}
        className="w-full min-w-0 outline-none bg-transparent text-sm placeholder:text-slate-400"
        placeholder="지역, 재난 유형, 키워드를 검색해보세요."
      />
    </div>
              </div>

              <div className="w-full bg-white/95 backdrop-blur-[2px] rounded-[22px] shadow-2xl shadow-slate-900/15 p-5 sm:p-6 border border-white/80">
                <div className="flex items-start sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 font-bold text-[#0B2A52] text-sm sm:text-base">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${mainNearbyIncident ? "bg-red-50" : "bg-emerald-50"}`}>
                      {mainNearbyIncident ? (
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                    지금, 내 주변에 발생한 재난
                  </div>
                  <button onClick={() => goTo("disaster-info")} className="text-xs sm:text-sm text-slate-500 flex items-center gap-0.5 hover:text-blue-600 transition cursor-pointer shrink-0">더보기 <ChevronRight className="w-4 h-4" /></button>
                </div>

                {!weatherLocation ? (
                  <>
                    <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-[#0B2A52]">내 위치를 확인해주세요</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      위치 권한을 허용하면 내 주변 반경 3km 내 진행 중인 사건을 바로 보여드려요.
                    </p>
                  </>
                ) : mainNearbyIncidentLoading ? (
                  <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-slate-300">불러오는 중...</h2>
                ) : mainNearbyIncident ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h2 className="text-[26px] sm:text-[31px] font-extrabold tracking-tight text-[#0B2A52]">{mainNearbyIncident.title}</h2>
                      <span className="px-3 py-1 rounded-full bg-red-50 text-red-500 text-xs font-bold">{mainNearbyIncident.disasterType}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <MapPin className="w-4 h-4 text-[#0B2A52] shrink-0" /> 내 위치에서 약 {mainNearbyIncident.distanceKm.toFixed(1)}km
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {mainNearbyIncident.region}에서 {mainNearbyIncident.disasterType} 상황이 진행 중입니다.<br className="hidden sm:block" /> 가까운 대피시설을 확인하고, 안전에 유의하세요.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-[#0B2A52]">현재 반경 3km 내 접수된 재난이 없습니다</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      평온한 상황이에요. 그래도 이상한 상황을 발견하면 바로 제보해주세요.
                    </p>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                  <button onClick={() => goTo("safety-map", { focusIncidentId: mainNearbyIncident?.incidentId ?? null })} className="h-12 rounded-xl bg-[#0B2A52] hover:bg-[#173b65] transition text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                    <Navigation className="w-4 h-4" /> 주변 재난지도 보기 <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={handleReportPageClick} className="h-12 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-[#0B2A52] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                    <Camera className="w-4 h-4" /> 현장 제보하기
                  </button>
                </div>
              </div>
            </div>
          </section>
  );
}
