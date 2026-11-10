import { ChevronDown, ClipboardList, Menu, User } from "lucide-react";

export default function ControlBoardHeader({
  setSidebarOpen, notifRef, notifOpen, setNotifOpen, dashboardReceivedCount, setActiveNav, profileRef,
  profileOpen, setProfileOpen, member, currentUser, handleBackToHome, onLogout,
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 -ml-1.5 transition-colors cursor-pointer shrink-0"
          aria-label="메뉴 열고 닫기"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="미확인 제보"
          >
            {/* 종 대신 클립보드 아이콘 (실시간 접수대기 제보 수, 알림 피드와 구분) */}
            <ClipboardList className="w-4.5 h-4.5" />
            {dashboardReceivedCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white">
                {dashboardReceivedCount > 9 ? "9+" : dashboardReceivedCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-8 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-[#0F2540]">미확인 제보</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">현재 확인이 필요한 제보 {dashboardReceivedCount}건</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false);
                  setActiveNav("reports");
                }}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-[#0F2540] hover:bg-slate-50 cursor-pointer"
              >
                제보 관리에서 확인하기 →
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {member?.profileImageUrl ? (
                <img src={member.profileImageUrl} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="text-left leading-tight hidden sm:block max-w-[120px]">
              <div className="text-xs font-bold text-[#0F2540] truncate">{(currentUser?.name || member?.name || "담당자")}님</div>
              <div className="text-[10px] text-slate-400 truncate">{member?.address || "담당자"}</div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-10 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-[#0F2540]">{currentUser?.name || member?.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{member?.email || "-"}</p>
              </div>
              <button onClick={handleBackToHome} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                홈으로
              </button>
              <button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
