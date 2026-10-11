// 세션 만료 임박 알림 팝업
// - 기능: 로그인 토큰(JWT) 만료 5분 전부터 "연장하시겠습니까?" 팝업을 띄움
// - "연장하기" 누르면 /api/auth/refresh 호출해서 새 토큰을 받아 localStorage 교체 (만료시간 리셋)
// - 응답 없이 만료되면 자동 로그아웃 (토큰 삭제 + auth:invalid)
import { useEffect, useRef, useState } from "react";
import { getTokenExpiryMs, refreshToken } from "../api/client";

// 만료 이만큼 전부터 "연장하시겠습니까?" 팝업을 띄움
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5분

// 남은 시간을 "분:초" 형태로 화면에 보여주기 위한 포맷 함수
function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// main.jsx에서 단독 마운트하는 독립 컴포넌트 (MainPage가 페이지별로 조기 return)
// props 없이 localStorage 토큰을 1초마다 확인
export default function SessionExpiryModal() {
  const [visible, setVisible] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [extending, setExtending] = useState(false);
  const loggedOutRef = useRef(false); // 만료로 인한 자동로그아웃 이벤트를 한 번만 쏘기 위한 가드

  useEffect(() => {
    const tick = () => {
      const expiryMs = getTokenExpiryMs();

      // 비로그인 상태 - 팝업도 필요 없고 가드도 초기화
      if (!expiryMs) {
        setVisible(false);
        loggedOutRef.current = false;
        return;
      }

      const left = expiryMs - Date.now();

      if (left <= 0) {
        // 만료 시각 경과 - client.js 401 처리와 동일하게 토큰 삭제 + auth:invalid 발생
        if (!loggedOutRef.current) {
          loggedOutRef.current = true;
          localStorage.removeItem("token");
          window.dispatchEvent(new Event("auth:invalid"));
        }
        setVisible(false);
        return;
      }

      loggedOutRef.current = false;
      setRemainingMs(left);
      setVisible(left <= WARNING_BEFORE_MS);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // "연장하기" 버튼 클릭 시 - 서버에 새 토큰 요청
  const handleExtend = async () => {
    setExtending(true);
    try {
      await refreshToken(); // 내부에서 localStorage 토큰을 새 걸로 교체함
      setVisible(false); // 팝업 닫기 - 다음 tick에서 새로 늘어난 만료시각 기준으로 다시 판단됨
    } catch {
      // 연장 실패 시 401 처리는 authFetch에서 완료, 팝업만 닫기
      setVisible(false);
    } finally {
      setExtending(false);
    }
  };

  // "로그아웃" 버튼 클릭 시 - 연장 안 하고 바로 로그아웃
  const handleLogoutNow = () => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth:invalid")); // MainPage.jsx가 이 이벤트 듣고 화면 상태 정리
    setVisible(false);
  };

  // 만료 5분 이내로 들어오기 전까지는 아무것도 렌더링 안 함
  if (!visible) return null;

  // 만료 임박 팝업 UI - 남은 시간 카운트다운 + 연장/로그아웃 버튼
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-800">세션이 곧 만료됩니다</h2>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-semibold text-red-500">{formatRemaining(remainingMs)}</span> 후
          자동으로 로그아웃됩니다. 계속 이용하시겠습니까?
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={handleLogoutNow}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            로그아웃
          </button>
          <button
            onClick={handleExtend}
            disabled={extending}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {extending ? "연장 중..." : "연장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
