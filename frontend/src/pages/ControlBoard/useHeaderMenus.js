import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

const DESKTOP_QUERY = "(min-width: 1024px)";

// 헤더 - 프로필/미확인 제보 드롭다운, 내 정보(부서 표시용)
export function useHeaderMenus() {
  const [member, setMember] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches); // 햄버거로 열고 닫는 사이드바 (넓은 화면은 열림, 모바일은 본문이 가려지지 않게 닫힘)
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  useEffect(() => {
    authFetch("/api/mypage").then(setMember).catch(() => {});
  }, []);
  // 창 크기가 1024px 경계를 넘나들 때만 자동으로 맞춤 (PC 안에서 크기만 바꾸면 사용자가 연/닫은 상태 유지)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = (e) => setSidebarOpen(e.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return {
    member, profileOpen, setProfileOpen, sidebarOpen, setSidebarOpen, notifOpen, setNotifOpen, profileRef,
    notifRef,
  };
}
