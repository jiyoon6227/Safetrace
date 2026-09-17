import React from "react";
import { ArrowLeft, MapPin, ShieldAlert } from "lucide-react";
import NearbySafetyMap from "../components/NearbySafetyMap";

export default function SafetyMapPage({ onBackToHome }) {
  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1450px] items-center justify-between px-6">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex cursor-pointer items-center gap-3 rounded-xl transition-all duration-200 hover:opacity-80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2A52] shadow-sm">
              <ShieldAlert className="h-5 w-5 text-amber-400" strokeWidth={2.4} />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xl font-extrabold tracking-tight text-[#0B2A52]">세이프트레이스</div>
              <div className="text-[10px] text-slate-400">함께 만드는 더 안전한 일상</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onBackToHome}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#0B2A52] transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" /> 메인으로
          </button>
        </div>
      </header>

      <section className="border-b border-blue-100 bg-gradient-to-r from-[#0B2A52] via-[#103D70] to-[#15538C]">
        <div className="mx-auto flex min-h-[170px] max-w-[1450px] items-center px-6 py-8">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-blue-200">
              <MapPin className="h-4 w-4" /> SAFETRACE SAFETY MAP
            </div>
            <h1 className="text-[32px] font-black tracking-[-0.03em] text-white">내 주변 안전지도</h1>
            <p className="mt-2 text-sm text-blue-100">
              현재 위치를 기준으로 주변의 진행 중인 현장 상황과 대피시설을 지도에서 확인하세요.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1450px] px-6 py-7">
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-400">
          <button type="button" onClick={onBackToHome} className="cursor-pointer rounded px-1 transition-colors hover:text-blue-600">홈</button>
          <span>›</span>
          <span className="font-bold text-slate-600">내 주변 안전지도</span>
        </div>

        <NearbySafetyMap mode="full" />

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-xs leading-5 text-blue-800">
          로그인하지 않아도 현재 위치 기준 안전지도를 볼 수 있습니다. 빨간 마커는 SafeTrace에서 처리 중인 공개 현장 사건,
          초록 마커는 공공데이터 기반 대피시설입니다. 검토 전 원본 제보는 지도에 바로 노출하지 않습니다.
        </div>
      </main>
    </div>
  );
}
