import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { getCurrentUser } from "../api/client";
import SiteHeader from "./SiteHeader";

export const SERVICE_MENU_ITEMS = [
  { key: "disaster-info", label: "재난정보" },
  { key: "safety-map", label: "안전지도" },
  { key: "shelters", label: "대피시설 찾기" },
  { key: "report", label: "현장 제보" },
  { key: "safety-guides", label: "행동요령" },
  { key: "notices", label: "공지사항" },
];

export function buildServiceSidebarItems(activeKey, onNavigate) {
  const move = (page, state = {}) => {
    if (typeof onNavigate === "function") {
      onNavigate(page, state);
    }
  };

  return SERVICE_MENU_ITEMS.map((item) => ({
    ...item,
    active: item.key === activeKey,
    onClick: () => {
      if (item.key === activeKey) return;

      if (item.key === "report") {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          window.alert("로그인이 필요한 서비스입니다.");
          move("login");
          return;
        }
        move("report");
        return;
      }

      if (item.key === "safety-guides") {
        move("safety-guides", { safetyGuideKey: "FLOOD" });
        return;
      }

      move(item.key);
    },
  }));
}

export default function ServicePageLayout({
  activeNav,
  onNavigate,
  sectionTitle = "서비스 안내",
  pageTitle,
  description,
  breadcrumbParent = "서비스 안내",
  sidebarItems,
  headerAction = null,
  wide = false,
  children,
}) {
  const resolvedSidebarItems = Array.isArray(sidebarItems)
    ? sidebarItems
    : buildServiceSidebarItems(activeNav, onNavigate);

  const containerWidth = wide ? "max-w-[1450px]" : "max-w-[1180px]";

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <SiteHeader active={activeNav} onNavigate={onNavigate} />

      <div className="border-b border-blue-100 bg-[#EDF4FB]">
        <div
          className={`mx-auto flex h-11 ${containerWidth} items-center gap-2 px-6 text-[11px] text-slate-500`}
        >
          <Home className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3" />
          <span>{breadcrumbParent}</span>
          <ChevronRight className="h-3 w-3" />
          <strong className="font-bold text-[#0B5FB3]">{pageTitle}</strong>
        </div>
      </div>

      <main
        className={`mx-auto grid ${containerWidth} gap-10 px-6 py-12 lg:grid-cols-[210px_minmax(0,1fr)]`}
      >
        <aside className="hidden lg:block">
          <h2 className="border-b-2 border-[#0B5FB3] pb-3 text-[22px] font-extrabold tracking-tight text-[#0B2A52]">
            {sectionTitle}
          </h2>

          <nav className="mt-3 border-t border-slate-200">
            {resolvedSidebarItems.map((item) => (
              <button
                key={item.key || item.label}
                type="button"
                onClick={item.onClick}
                className={`flex w-full cursor-pointer items-center justify-between border-b border-slate-200 px-3 py-3.5 text-left text-[13px] font-semibold transition-colors ${
                  item.active
                    ? "bg-[#1269C7] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-[#0B5FB3]"
                }`}
              >
                <span>{item.label}</span>
                {item.active && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col gap-4 border-b-2 border-[#26384E] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[30px] font-extrabold tracking-tight text-[#17283E]">
                {pageTitle}
              </h1>
              {description && (
                <p className="mt-2 break-keep text-[12px] leading-5 text-slate-500">
                  {description}
                </p>
              )}
            </div>
            {headerAction}
          </div>

          <div className="mt-7">{children}</div>
        </section>
      </main>
    </div>
  );
}
