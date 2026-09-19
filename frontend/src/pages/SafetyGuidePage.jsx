import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CloudRain,
  Flame,
  MapPin,
  Mountain,
  Phone,
  ShieldAlert,
  Snowflake,
  Sun,
  Waves,
  Wind,
} from "lucide-react";
import ServicePageLayout from "../components/ServicePageLayout";
import { SAFETY_GUIDES, SAFETY_GUIDE_ORDER, getSafetyGuide } from "../data/safetyGuides";

const ICONS = {
  FLOOD: CloudRain,
  EARTHQUAKE: Waves,
  FIRE: Flame,
  TYPHOON: Wind,
  WILDFIRE: Mountain,
  HEATWAVE: Sun,
  COLDWAVE: Snowflake,
};

export default function SafetyGuidePage({
  initialGuideKey = "FLOOD",
  onBackToHome,
  onOpenShelters,
  onNavigate,
}) {
  const [activeKey, setActiveKey] = useState(
    SAFETY_GUIDES[initialGuideKey] ? initialGuideKey : "FLOOD"
  );
  const [checkedChecklist, setCheckedChecklist] = useState({});

  const guide = useMemo(() => getSafetyGuide(activeKey), [activeKey]);
  const ActiveIcon = ICONS[activeKey] || ShieldAlert;

  const toggleChecklist = (index) => {
    setCheckedChecklist((prev) => ({
      ...prev,
      [activeKey]: {
        ...(prev[activeKey] || {}),
        [index]: !prev[activeKey]?.[index],
      },
    }));
  };

  const sidebarItems = SAFETY_GUIDE_ORDER.map((key) => ({
    key,
    label: SAFETY_GUIDES[key].label,
    active: activeKey === key,
    onClick: () => setActiveKey(key),
  }));

  return (
    <ServicePageLayout
      activeNav="safety-guides"
      onNavigate={onNavigate}
      sectionTitle="행동요령"
      pageTitle={`${guide.label} 행동요령`}
      breadcrumbParent="행동요령"
      description={guide.shortDescription}
      sidebarItems={sidebarItems}
      headerAction={
        <a
          href={guide.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center border border-slate-300 bg-white px-4 text-[12px] font-bold text-slate-600 hover:border-[#0B5FB3] hover:text-[#0B5FB3]"
        >
          공식 출처 확인 ↗
        </a>
      }
    >
      <div className="border-y border-slate-200 bg-[#F7F9FC] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-blue-100 bg-blue-50 text-[#0B5FB3]">
            <ActiveIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] font-bold text-[#0B2A52]">{guide.label} 대비 핵심 안내</p>
            <p className="mt-1 text-[11px] text-slate-500">상황별 순서에 따라 필요한 행동을 확인하세요.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {guide.phases.map((phase, index) => (
          <article key={phase.id} className="border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#0B2A52] text-[12px] font-extrabold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-[15px] font-extrabold text-[#17283E]">{phase.title}</h3>
                <p className="mt-1 text-[11px] text-slate-500">{phase.subtitle}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {phase.items.map((text) => (
                <div key={text} className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-600">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="border border-slate-200 bg-white p-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-[15px] font-extrabold text-[#17283E]">핵심 체크리스트</h3>
            <p className="mt-1 text-[11px] text-slate-500">{guide.label} 대비 전 확인할 항목입니다.</p>
          </div>

          <div className="mt-4 space-y-2">
            {guide.checklist.map((text, index) => {
              const checked = Boolean(checkedChecklist[activeKey]?.[index]);
              return (
                <button
                  key={text}
                  type="button"
                  onClick={() => toggleChecklist(index)}
                  aria-pressed={checked}
                  className={`flex w-full cursor-pointer items-center gap-3 border px-3 py-3 text-left text-[12px] transition-colors ${
                    checked
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                      checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className={checked ? "font-semibold" : ""}>{text}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border border-slate-200 bg-white p-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-[15px] font-extrabold text-[#17283E]">긴급 연락</h3>
            <p className="mt-1 text-[11px] text-slate-500">위급한 상황에서는 관계 기관에 즉시 신고하세요.</p>
          </div>

          <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            <div className="flex items-center justify-between py-4">
              <div>
                <strong className="text-[18px] font-extrabold text-[#17283E]">119</strong>
                <p className="mt-1 text-[11px] text-slate-500">화재·구조·구급</p>
              </div>
              <Phone className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <strong className="text-[18px] font-extrabold text-[#17283E]">112</strong>
                <p className="mt-1 text-[11px] text-slate-500">경찰 긴급신고</p>
              </div>
              <Phone className="h-5 w-5 text-slate-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenShelters}
            className="mt-5 flex h-10 w-full cursor-pointer items-center justify-center gap-2 bg-[#0B2A52] text-[12px] font-bold text-white hover:bg-[#153D68]"
          >
            <MapPin className="h-4 w-4" /> 관련 대피시설 보기 <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>

      <div className="mt-6 border border-slate-200 bg-[#F7F9FC] px-5 py-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#0B5FB3]" />
          <div>
            <strong className="text-[13px] text-[#17283E]">꼭 기억하세요</strong>
            <p className="mt-1 break-keep text-[12px] leading-6 text-slate-600">
              실제 재난이 발생한 경우에는 재난문자, 소방·경찰·지자체 등 관계기관의 현장 안내를 우선해서 따라주세요.
            </p>
          </div>
        </div>
      </div>
    </ServicePageLayout>
  );
}
