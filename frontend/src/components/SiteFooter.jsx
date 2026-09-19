import React from "react";
import { ShieldAlert } from "lucide-react";

export default function SiteFooter({ onNavigate, showWithdraw = false, onWithdraw }) {
  const go = (page, state = {}) => {
    if (typeof onNavigate === "function") {
      onNavigate(page, state);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white text-slate-600">
      {/* 얇은 상단 바 - 모든 페이지가 이 SiteFooter 하나로 통일해서 씀 (예전엔 페이지마다 따로 있었음) */}
      <div className="border-b border-slate-200">
        <div className="mx-auto max-w-[1450px] px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div><b className="text-[#0B2A52]">세이프트레이스</b> · 재난 상황관리·대응 플랫폼</div>
          <div className="flex items-center gap-5">
            <span>이용약관</span>
            <span>개인정보처리방침</span>
            <span>서비스 소개</span>
            {showWithdraw && (
              <button type="button" onClick={onWithdraw} className="cursor-pointer hover:text-red-500">회원탈퇴</button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1450px] px-6 pt-6 pb-0 bg-[#F7F8FA]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(220px,0.9fr)_minmax(220px,0.9fr)]">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => go("home")}
              className="flex cursor-pointer items-center gap-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B2A52]">
                <ShieldAlert className="h-5 w-5 text-amber-400" strokeWidth={2.4} />
              </span>

              <span>
                <strong className="block text-[17px] font-extrabold text-[#0B2A52]">
                  세이프트레이스
                </strong>
                <span className="block text-[10px] text-slate-400">
                  함께 만드는 더 안전한 일상
                </span>
              </span>
            </button>

            <div className="mt-5 space-y-1.5 break-keep text-[11px] leading-5 text-slate-500">
              <p>(00000) 대전광역시 안전로 00, 세이프트레이스</p>
              <p>
                대표전화 <span className="font-semibold text-slate-600">000-0000-0000</span>
                <span className="mx-2 text-slate-300">|</span>
                이메일 <span className="font-semibold text-slate-600">safetrace@example.com</span>
              </p>
              <p>운영시간 평일 09:00 ~ 18:00</p>
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-extrabold text-[#0B2A52]">서비스 바로가기</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[12px]">
              <button type="button" onClick={() => go("disaster-info")} className="w-fit cursor-pointer hover:text-blue-700">재난정보</button>
              <button type="button" onClick={() => go("safety-map")} className="w-fit cursor-pointer hover:text-blue-700">안전지도</button>
              <button type="button" onClick={() => go("safety-guides", { safetyGuideKey: "FLOOD" })} className="w-fit cursor-pointer hover:text-blue-700">행동요령</button>
              <button type="button" onClick={() => go("notices")} className="w-fit cursor-pointer hover:text-blue-700">공지사항</button>
              <button type="button" onClick={() => go("shelters")} className="w-fit cursor-pointer hover:text-blue-700">대피시설 찾기</button>
              <button type="button" onClick={() => go("home")} className="w-fit cursor-pointer hover:text-blue-700">메인으로</button>
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-extrabold text-[#0B2A52]">긴급 연락</h3>
            <div className="mt-3 space-y-2 text-[12px]">
              <p><span className="mr-2 font-extrabold text-[#0B2A52]">119</span>화재·구조·구급</p>
              <p><span className="mr-2 font-extrabold text-[#0B2A52]">112</span>경찰 긴급신고</p>
            </div>
            <p className="mt-3 break-keep text-[11px] leading-5 text-slate-400">
              실제 재난 상황에서는 관계 기관의 공식 안내와 현장 통제를 우선해 주세요.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 py-2 text-[10px] leading-none text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 SafeTrace. All rights reserved.</span>
          <span>재난·안전 제보 및 처리과정 추적 서비스</span>
        </div>
      </div>
    </footer>
  );
}
