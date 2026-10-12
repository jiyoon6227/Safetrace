import {
  Bot, RefreshCw, Send, X,
} from "lucide-react";
import { AI_SUGGESTED_QUESTIONS } from "./constants";

// AI 안전 도우미 채팅 모달
export default function AiChatModal({
  weatherLocation,
  weatherLocationLabel,
  aiChatInput,
  setAiChatInput,
  aiChatLoading,
  aiChatError,
  aiChatMessages,
  aiChatEndRef,
  closeAiChat,
  sendAiChatMessage,
  requestWeatherLocation,
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeAiChat();
      }}
    >
      <div className="flex h-[min(720px,86vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-[#0B2A52]">AI 안전 도우미</h2>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-500">Beta</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {weatherLocation
                  ? `${weatherLocationLabel || "현재 위치"} · 실시간 안전정보 기반`
                  : "지역 지정 질문 가능 · 내 주변 질문은 위치 확인 필요"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAiChat}
            disabled={aiChatLoading}
            className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="AI 안전 도우미 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {AI_SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => sendAiChatMessage(question)}
                disabled={aiChatLoading}
                className="shrink-0 cursor-pointer rounded-full border border-blue-100 bg-white px-3 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
          <div className="space-y-3">
            {aiChatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <span className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12px] leading-5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md bg-slate-100 text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {aiChatLoading && (
              <div className="flex justify-start">
                <span className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-[12px] text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  현재 안전정보를 확인해 답변하고 있습니다...
                </div>
              </div>
            )}

            <div ref={aiChatEndRef} />
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-3">
          {!weatherLocation && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              <span>서울·화성시처럼 지역을 직접 물어볼 수 있어요. "내 주변" 질문은 위치 확인이 필요합니다.</span>
              <button
                type="button"
                onClick={requestWeatherLocation}
                className="shrink-0 cursor-pointer font-bold underline underline-offset-2"
              >
                내 위치 확인
              </button>
            </div>
          )}

          {aiChatError && (
            <p className="mb-2 text-[11px] text-rose-500">{aiChatError}</p>
          )}

          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-300 focus-within:bg-white">
            <textarea
              value={aiChatInput}
              onChange={(e) => setAiChatInput(e.target.value.slice(0, 1200))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendAiChatMessage();
                }
              }}
              disabled={aiChatLoading}
              rows={2}
              placeholder="재난·안전과 관련해 궁금한 내용을 입력하세요..."
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[12px] leading-5 text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => sendAiChatMessage()}
              disabled={!aiChatInput.trim() || aiChatLoading}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="질문 보내기"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400">
            <span>현재 상황은 SafeTrace 수집 데이터 기준이며 긴급 상황에서는 공식 안내를 우선하세요.</span>
            <span>{aiChatInput.length}/1200</span>
          </div>
        </div>
      </div>
    </div>
  );
}
