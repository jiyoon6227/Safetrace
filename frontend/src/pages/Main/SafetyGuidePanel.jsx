import {
  ArrowRight, GraduationCap, MapPin, ShieldAlert,
} from "lucide-react";
import { SAFETY_GUIDES, SAFETY_GUIDE_ORDER, getSafetyGuide } from "../../data/safetyGuides";
import { SAFETY_GUIDE_ICONS } from "./constants";

// 재난 행동요령 패널
export default function SafetyGuidePanel({
  safetyGuidePanelRef,
  activeSafetyGuideKey,
  setActiveSafetyGuideKey,
  openShelterPanel,
  goTo,
}) {
  const guide = getSafetyGuide(activeSafetyGuideKey);
  return (
    <section ref={safetyGuidePanelRef} className="max-w-[1450px] mx-auto px-6 pt-4">
      <div className="bg-white rounded-[22px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[20px] font-extrabold text-[#0B2A52]">재난 행동요령</h2>
              <p className="text-[11px] text-slate-400 mt-1">재난 유형을 선택해 지금 필요한 핵심 행동요령을 확인하세요.</p>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 pt-4 flex gap-2 overflow-x-auto">
          {SAFETY_GUIDE_ORDER.map((key) => {
            const item = SAFETY_GUIDES[key];
            const Icon = SAFETY_GUIDE_ICONS[key] || ShieldAlert;
            const active = activeSafetyGuideKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSafetyGuideKey(key)}
                className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#0B2A52] border-[#0B2A52] text-white"
                    : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" /> {item.label}
              </button>
            );
          })}
        </div>

        <div className="px-5 sm:px-6 py-5">
          <div className="rounded-2xl bg-orange-50/70 border border-orange-100 px-4 py-3 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-extrabold text-[#0B2A52]">{guide.label} 핵심 행동요령</div>
              <div className="text-xs text-slate-500 mt-1">{guide.shortDescription}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
            {guide.quickTips.map((tip, index) => (
              <article
                key={tip.title}
                className="min-h-[104px] rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-sm font-black shrink-0 shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[14px] font-extrabold text-[#0B2A52] leading-5">{tip.title}</h3>
                    <div className="w-8 h-[2px] bg-blue-100 rounded-full my-2" />
                    <p className="text-[12px] font-medium text-slate-600 leading-5">{tip.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-[11px] text-slate-400">공식 국민행동요령을 바탕으로 핵심 내용을 요약했습니다.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openShelterPanel}
              className="h-9 px-4 rounded-lg border border-slate-200 text-[#0B2A52] text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-4 h-4" /> 가까운 대피시설 보기
            </button>
            <button
              type="button"
              onClick={() => goTo("safety-guides", { safetyGuideKey: activeSafetyGuideKey })}
              className="h-9 px-4 rounded-lg bg-[#0B2A52] text-white text-xs font-bold hover:bg-[#173b65] flex items-center gap-1.5 cursor-pointer"
            >
              상세 행동요령 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
