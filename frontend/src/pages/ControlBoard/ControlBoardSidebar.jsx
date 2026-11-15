import { useState } from "react";
import { ChevronDown, ShieldAlert, LogOut, User } from "lucide-react";
import { NAV_ITEMS } from "./constants";

export default function ControlBoardSidebar({
  sidebarOpen, handleBackToHome, activeNav, handleNavClick, member, currentUser, onLogout,
  navItems = NAV_ITEMS, roleLabel = "담당자", // ADMIN 화면은 자기 메뉴와 역할 이름을 넘긴다
}) {
  // 접어 둔 그룹 메뉴의 key. 처음에는 비어 있어 모든 그룹이 펼쳐져 있다
  const [closedGroups, setClosedGroups] = useState({});

  return (
    <aside
      className={`bg-[#0F2540] text-slate-300 flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ${
        sidebarOpen ? "w-56" : "w-0"
      }`}
    >
      <div className="w-56 flex flex-col h-full">
        <button
          type="button"
          onClick={handleBackToHome}
          className="flex items-center gap-2 px-5 py-5 hover:opacity-80 transition text-left cursor-pointer"
        >
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-white">세이프트레이스</span>
        </button>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ key, icon: Icon, label, children }) =>
            children ? (
              // 그룹 메뉴: 제목을 누르면 화면 이동 없이 하위 메뉴만 펼치거나 접는다 (ADMIN의 자원 업무)
              <div key={label} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={!closedGroups[key]}
                  onClick={() => setClosedGroups((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 cursor-pointer ${
                    children.some((child) => child.key === activeNav) ? "text-white font-semibold" : ""
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${closedGroups[key] ? "" : "rotate-180"}`} />
                </button>
                {!closedGroups[key] && children.map((child) => (
                  <button
                    key={child.key}
                    onClick={() => handleNavClick(child.key)}
                    className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-lg text-[13px] ${
                      activeNav === child.key ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5"
                    } cursor-pointer`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" /> {child.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                key={label}
                onClick={() => handleNavClick(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  activeNav === key ? "bg-white/10 text-white font-semibold" : "hover:bg-white/5"
                } cursor-pointer`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            )
          )}
        </nav>
        <div className="px-3 py-4 border-t border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {member?.profileImageUrl ? (
              <img src={member.profileImageUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{(currentUser?.name || member?.name || "담당자")}님</div>
            <div className="text-xs text-slate-400 truncate">{roleLabel}</div>
          </div>
        </div>
        <div className="px-3 pb-5 space-y-3">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </div>
    </aside>
  );
}
