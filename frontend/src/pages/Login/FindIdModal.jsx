import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

// 아이디 찾기 - 이름+이메일 일치하면 가입한 이메일로 아이디를 보내줌
export default function FindIdModal({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(""); // 성공 메시지 (있으면 성공 화면으로 전환)
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/find-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "일치하는 회원 정보가 없습니다.");
      }
      const data = await res.json();
      setResult(data.message);
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
          <h2 className="font-bold text-[#0F2540] text-lg">아이디 찾기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="text-center py-4">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">{result}</p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#0B2A52] text-white text-sm font-bold cursor-pointer hover:bg-[#0B2A52]/90"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="가입하신 이름을 입력하세요"
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
              {loading ? "확인 중..." : "아이디 찾기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
