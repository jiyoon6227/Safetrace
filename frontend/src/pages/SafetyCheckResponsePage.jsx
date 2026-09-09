import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE_URL = "http://localhost:8080";

// 이메일 안전확인 링크(?safetyCheckToken=xxx)로 들어왔을 때 뜨는 화면.
// 로그인 없이 토큰만으로 응답하므로 authFetch가 아니라 순수 fetch를 직접 씀.
export default function SafetyCheckResponsePage({ token, onDone }) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMessage, setErrorMessage] = useState("");
  const [respondedAs, setRespondedAs] = useState(null); // "SAFE" | "HELP"

  const respond = async (value) => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`${BASE_URL}/api/safety-checks/token/${token}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "응답 처리 중 오류가 발생했습니다.");
      }
      setRespondedAs(value);
      setStatus("done");
    } catch (err) {
      setErrorMessage(err.message || "응답 처리 중 오류가 발생했습니다.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#0F2540] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
        </div>

        {status === "done" ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h1 className="font-bold text-[#0F2540] mb-1">응답이 전달되었습니다</h1>
            <p className="text-sm text-slate-500 mb-6">
              {respondedAs === "SAFE" ? "안전하다고 알렸습니다." : "도움이 필요하다고 알렸습니다."}
            </p>
            <button
              onClick={onDone}
              className="w-full text-sm font-bold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 cursor-pointer"
            >
              세이프트레이스 홈으로
            </button>
          </>
        ) : (
          <>
            <h1 className="font-bold text-[#0F2540] mb-1">가족이 안전확인을 요청했습니다</h1>
            <p className="text-sm text-slate-500 mb-6">현재 상태를 알려주세요.</p>

            {status === "error" && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{errorMessage}</p>
            )}

            <div className="space-y-2">
              <button
                onClick={() => respond("SAFE")}
                disabled={status === "loading"}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg py-3 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> 안전해요
              </button>
              <button
                onClick={() => respond("HELP")}
                disabled={status === "loading"}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg py-3 disabled:opacity-50 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" /> 도움이 필요해요
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-5">
              이 링크는 한 번만 사용할 수 있으며, 일정 시간이 지나면 만료됩니다.
              만료된 경우 로그인 후 다시 응답해주세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
