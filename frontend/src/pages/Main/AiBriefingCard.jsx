import {
  ArrowRight, Bot, MessageCircle, RefreshCw,
} from "lucide-react";

// AI 상황 브리핑 카드
export default function AiBriefingCard({
  weatherLocation,
  aiBriefing,
  aiBriefingLoading,
  aiBriefingError,
  setAiBriefingRefreshKey,
  openAiChat,
}) {
  return (
    <section className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-extrabold text-[#0B2A52] flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </span>
          AI 상황 브리핑
          <span className="rounded-full bg-rose-50 text-rose-500 px-2 py-0.5 text-[9px] font-extrabold">Beta</span>
        </h2>

        <button
          type="button"
          onClick={() => setAiBriefingRefreshKey((value) => value + 1)}
          disabled={!weatherLocation || aiBriefingLoading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          title="AI 브리핑 새로고침"
          aria-label="AI 브리핑 새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${aiBriefingLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-3 min-h-[60px]">
        {!weatherLocation ? (
          <p className="text-[12px] leading-5 text-slate-500">
            내 위치를 확인하면 주변 재난·날씨·현장정보를 바탕으로 AI 브리핑을 생성합니다.
          </p>
        ) : aiBriefingLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
            주변 정보를 분석해 AI 상황 브리핑을 생성하고 있습니다...
          </div>
        ) : aiBriefingError ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-5 text-rose-500">{aiBriefingError}</p>
            <button
              type="button"
              onClick={() => setAiBriefingRefreshKey((value) => value + 1)}
              className="shrink-0 h-8 px-3 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <p className="text-[12px] leading-5 text-slate-600 whitespace-pre-line">
            {aiBriefing || "현재 위치의 AI 상황 브리핑을 준비하고 있습니다."}
          </p>
        )}
      </div>

      <button
        type="button"
        className="mt-3 w-full h-9 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition cursor-pointer"
        onClick={openAiChat}
      >
        <MessageCircle className="w-4 h-4" /> AI 안전 도우미에게 질문하기 <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
}
