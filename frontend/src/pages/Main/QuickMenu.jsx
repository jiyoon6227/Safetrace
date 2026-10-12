import { quickMenu } from "./constants";

// 퀵메뉴
export default function QuickMenu({
  requireLogin,
  openShelterPanel,
  openSafetyGuidePanel,
  goTo,
  handleReportClick,
}) {
  return (
    <section className="relative z-20 -mt-7 max-w-[1450px] mx-auto px-6">
      <div className="bg-white rounded-[22px] shadow-lg shadow-slate-900/8 border border-slate-200 grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
        {quickMenu.map(({ icon: Icon, label, title, sub }, index) => {
          const iconStyles = [
            "bg-blue-50 text-blue-600",
            "bg-emerald-50 text-emerald-600",
            "bg-orange-50 text-orange-500",
            "bg-violet-50 text-violet-600",
          ];

          const handleClick = () => {
            if (label === "대피시설") {
              openShelterPanel();
              return;
            }
            if (label === "현장제보") {
              handleReportClick();
              return;
            }
            if (label === "행동요령") {
              openSafetyGuidePanel();
              return;
            }
            if (label === "가족확인") {
              requireLogin(() => goTo("mypage", { mypageTab: "family" }));
              return;
            }
          };

          return (
            <button
              key={label}
              onClick={handleClick}
              className={`group px-5 py-4 sm:py-5 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors cursor-pointer border-slate-200 ${
                index % 2 === 0 ? "border-r" : ""
              } ${index < 2 ? "border-b lg:border-b-0" : ""} ${index !== 3 ? "lg:border-r" : ""}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconStyles[index]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[#0B2A52] text-sm group-hover:text-blue-600 transition-colors">{title}</div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">{sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
