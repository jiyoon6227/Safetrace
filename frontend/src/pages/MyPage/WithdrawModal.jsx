import { useState } from "react";
import { X } from "lucide-react";
import { authFetch } from "../../api/client";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export default function WithdrawModal({ onClose }) {
  const [error, setError] = useState("");
  useEscapeKey(true, onClose);

  const handleWithdraw = async () => {
    try {
      await authFetch("/api/mypage", { method: "DELETE" });
      localStorage.removeItem("token");
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-red-600">회원탈퇴</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-600 bg-red-50 rounded-lg p-3 mb-4">
          탈퇴하면 다시 로그인할 수 없습니다. 작성한 제보/사건 이력은 삭제되지 않고 그대로 보존됩니다. 정말 탈퇴하시겠습니까?
        </p>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleWithdraw} className="flex-1 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg py-2.5 cursor-pointer">
            탈퇴 확정
          </button>
          <button onClick={onClose} className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 cursor-pointer">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
