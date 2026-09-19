import React from "react";
import NearbySafetyMap from "../components/NearbySafetyMap";
import ServicePageLayout from "../components/ServicePageLayout";

export default function SafetyMapPage({ onBackToHome, onNavigate, focusIncidentId = null }) {
  const move = (page, state = {}) => {
    if (typeof onNavigate === "function") onNavigate(page, state);
  };


  return (
    <ServicePageLayout
      activeNav="safety-map"
      onNavigate={onNavigate}
      sectionTitle="서비스 안내"
      pageTitle="내 주변 안전지도"
      breadcrumbParent="서비스 안내"
      description="현재 위치를 기준으로 주변의 진행 중인 현장 상황과 대피시설을 지도에서 확인할 수 있습니다."
    >
      <NearbySafetyMap mode="full" focusIncidentId={focusIncidentId} />

      <div className="mt-5 border border-slate-200 bg-[#F7F9FC] px-5 py-4 text-[12px] leading-6 text-slate-600">
        로그인하지 않아도 현재 위치 기준 안전지도를 확인할 수 있습니다. 현장 상황은 공개 가능한 사건만 표시되며,
        대피시설은 공공데이터를 기준으로 제공합니다.
      </div>
    </ServicePageLayout>
  );
}
