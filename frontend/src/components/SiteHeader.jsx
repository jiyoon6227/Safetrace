import React from "react";
import { Search, ShieldAlert, UserRound, LogIn } from "lucide-react";
import { getCurrentUser } from "../api/client";

const NAV_ITEMS = [
  { key: "disaster-info", label: "재난정보" },
  { key: "safety-map", label: "안전지도" },
  { key: "shelters", label: "대피시설" },
  { key: "report", label: "현장 제보" },
  { key: "safety-guides", label: "행동요령" },
  { key: "notices", label: "공지사항" },
];

export default function SiteHeader({ active = "", onNavigate }) {
  const currentUser = getCurrentUser();

  const move = (page, state = {}) => {
    if (typeof onNavigate === "function") {
      onNavigate(page, state);
    }
  };

  const handleReport = () => {
    if (!currentUser) {
      window.alert("로그인이 필요한 서비스입니다.");
      move("login");
      return;
    }
    move("report");
  };

  const handleAccount = () => {
    if (!currentUser) {
      move("login");
      return;
    }
    move(currentUser.role === "STAFF" ? "staff" : "mypage");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-[74px] max-w-[1450px] items-center justify-between gap-6 px-6">
        <button
          type="button"
          onClick={() => move("home")}
          className="flex shrink-0 cursor-pointer items-center gap-3 text-left transition-opacity hover:opacity-80"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2A52] shadow-sm">
            <ShieldAlert className="h-5 w-5 text-amber-400" strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <strong className="block text-[19px] font-extrabold tracking-tight text-[#0B2A52]">세이프트레이스</strong>
            <span className="block text-[10px] text-slate-400">함께 만드는 더 안전한 일상</span>
          </span>
        </button>

        <nav className="hidden h-full items-stretch lg:flex" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            const onClick = item.key === "report" ? handleReport : () => move(item.key);

            return (
              <button
                key={item.key}
                type="button"
                onClick={onClick}
                className={`relative flex min-w-[96px] cursor-pointer items-center justify-center px-4 text-[15px] font-bold transition-colors ${
                  isActive ? "text-[#0B5FB3]" : "text-[#102A46] hover:text-[#0B5FB3]"
                }`}
              >
                {item.label}
                {isActive && <span className="absolute inset-x-4 bottom-0 h-[3px] bg-[#0B5FB3]" />}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => move("search")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center text-[#0B2A52] transition-colors hover:text-[#0B5FB3]"
            aria-label="통합검색"
            title="통합검색"
          >
            <Search className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={handleAccount}
            className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-[#0B2A52] transition-colors hover:text-[#0B5FB3]"
          >
            {currentUser ? <UserRound className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            <span>{currentUser ? (currentUser.role === "STAFF" ? "담당자 화면" : "마이페이지") : "로그인"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
