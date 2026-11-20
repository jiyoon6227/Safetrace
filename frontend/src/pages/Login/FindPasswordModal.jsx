import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

// 비밀번호 찾기 - 아이디+이메일 확인 → 이메일 인증코드 확인 → 새 비밀번호 설정, 3단계
export default function FindPasswordModal({ onClose }) {
  const [step, setStep] = useState(1); // 1: 아이디+이메일, 2: 인증코드, 3: 새 비밀번호
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "일치하는 회원 정보가 없습니다.");
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "인증번호가 올바르지 않거나 만료되었습니다.");
      }
      setVerificationToken(data.verificationToken);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== newPasswordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, email, newPassword, verificationToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "비밀번호 변경에 실패했습니다.");
      }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#0F2540] text-lg">비밀번호 찾기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.</p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#0B2A52] text-white text-sm font-bold cursor-pointer hover:bg-[#0B2A52]/90"
            >
              확인
            </button>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">아이디</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="아이디를 입력하세요"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="가입하신 이메일을 입력하세요"
              />
            </div>

            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#0B2A52] text-white text-sm font-bold cursor-pointer hover:bg-[#0B2A52]/90 disabled:opacity-60"
            >
              {loading ? "확인 중..." : "인증번호 받기"}
            </button>
          </form>
        ) : step === 2 ? (
          <form onSubmit={handleVerifyCode} className="space-y-3.5">
            <p className="text-xs text-slate-500">{email}로 보낸 인증번호를 입력해주세요.</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder="인증번호 6자리"
            />

            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#0B2A52] text-white text-sm font-bold cursor-pointer hover:bg-[#0B2A52]/90 disabled:opacity-60"
            >
              {loading ? "확인 중..." : "인증확인"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="새 비밀번호를 입력하세요"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">새 비밀번호 확인</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="새 비밀번호를 한번 더 입력하세요"
              />
            </div>

            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#0B2A52] text-white text-sm font-bold cursor-pointer hover:bg-[#0B2A52]/90 disabled:opacity-60"
            >
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
