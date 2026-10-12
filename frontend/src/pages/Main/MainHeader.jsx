import {
  Bell, ChevronDown, Search, ShieldAlert, Users,
} from "lucide-react";

// 메인 헤더
export default function MainHeader({
  currentUser,
  isStaff,
  token,
  profileMenuOpen,
  setProfileMenuOpen,
  profileMenuRef,
  requireLogin,
  activeSafetyGuideKey,
  goTo,
  myProfile,
  handleLogout,
  handleReportPageClick,
  unreadNotificationCount,
}) {
  return (
          <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
            <div className="max-w-[1450px] mx-auto px-6 h-[72px] flex items-center justify-between">
              <button onClick={() => goTo("home")} className="flex items-center gap-3 hover:opacity-80 transition cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-[#0B2A52] flex items-center justify-center shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-400" strokeWidth={2.4} />
                </div>
                <div className="text-left leading-tight">
                  <div className="font-extrabold text-xl text-[#0B2A52] tracking-tight">세이프트레이스</div>
                  <div className="text-[10px] text-slate-400">함께 만드는 더 안전한 일상</div>
                </div>
              </button>

              <nav className="hidden lg:flex items-center gap-10 text-[16px] font-semibold text-[#0B2A52]">
                <button onClick={() => goTo("disaster-info")} className="hover:text-blue-600 cursor-pointer transition">재난정보</button>
                <button onClick={() => goTo("safety-map")} className="hover:text-blue-600 cursor-pointer transition">안전지도</button>
                <button onClick={() => goTo("shelters", { shelterRegionId: null })} className="hover:text-blue-600 cursor-pointer transition">대피시설</button>
                <button onClick={handleReportPageClick} className="hover:text-blue-600 cursor-pointer transition">현장 제보</button>
                <button onClick={() => goTo("safety-guides", { safetyGuideKey: activeSafetyGuideKey })} className="hover:text-blue-600 cursor-pointer transition">행동요령</button>
                <button onClick={() => goTo("notices")} className="hover:text-blue-600 cursor-pointer transition">공지사항</button>
              </nav>

              <div className="flex items-center gap-4 text-[#0B2A52]">
                <button
                  type="button"
                  onClick={() => goTo("search")}
                  className="hidden md:flex w-9 h-9 items-center justify-center hover:bg-slate-100 transition cursor-pointer"
                  aria-label="통합검색"
                  title="통합검색"
                >
                  <Search className="w-5 h-5" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => requireLogin(() => goTo("mypage", { mypageTab: "notify" }))}
                    className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
                    aria-label="알림"
                  >
                    <Bell className="w-5 h-5" />
                    {token && unreadNotificationCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                        {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                      </span>
                    )}
                  </button>
                </div>
               {token ? (
      <>
        {isStaff && (
      <button onClick={() => goTo("staff")} className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 cursor-pointer">
        담당자 화면
      </button>
    )}
        <div className="relative hidden sm:block" ref={profileMenuRef}>
          <button onClick={() => setProfileMenuOpen((v) => !v)} className="flex items-center gap-2 font-bold text-sm cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-[#0B2A52] text-white flex items-center justify-center overflow-hidden shrink-0">
              {myProfile?.profileImageUrl ? (
                <img src={myProfile.profileImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </div>
            {myProfile?.name || currentUser?.name}님 <ChevronDown className={`w-4 h-4 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {profileMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50">
              <button
                onClick={() => { setProfileMenuOpen(false); goTo("mypage"); }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#0B2A52] hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition"
              >
                마이페이지
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 cursor-pointer transition"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </>
    ) : (
      <button onClick={() => goTo("login")} className="text-sm font-bold hover:text-blue-600 transition cursor-pointer">로그인</button>
    )}
              </div>
            </div>
          </header>
  );
}
