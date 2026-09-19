import React from "react";
import { Megaphone } from "lucide-react";
import ServicePageLayout from "../components/ServicePageLayout";
import ReportForm from "./ReportForm";

export default function ReportPage({ onNavigate, onSuccess }) {

  return (
    <ServicePageLayout
      activeNav="report"
      onNavigate={onNavigate}
      sectionTitle="서비스 안내"
      pageTitle="현장 제보"
      description="주변에서 발견한 재난·안전 위험 상황을 직접 제보해주세요."
      breadcrumbParent="서비스 안내"
    >
      <div className="mb-6 flex items-start gap-4 border border-blue-100 bg-[#F5F9FD] px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
          <Megaphone className="h-5 w-5" />
        </div>

        <div>
          <p className="text-[14px] font-extrabold text-[#17283E]">
            여러분의 제보가 더 안전한 지역사회를 만듭니다.
          </p>
          <p className="mt-1 break-keep text-[12px] leading-5 text-slate-500">
            현장에서 확인한 상황과 위치를 알려주세요. 접수된 제보는 담당자가 확인 후 처리합니다.
          </p>
        </div>
      </div>

      <ReportForm
        variant="page"
        onClose={() => onNavigate("home")}
        onSuccess={onSuccess}
      />
    </ServicePageLayout>
  );
}
