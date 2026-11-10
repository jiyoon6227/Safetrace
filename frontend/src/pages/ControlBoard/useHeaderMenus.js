import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../api/client";

// 헤더 - 프로필/미확인 제보 드롭다운, 내 정보(부서 표시용)
export function useHeaderMenus() {
  const [member, setMember] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // 햄버거로 열고 닫는 사이드바(기본 열림)
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  useEffect(() => {
    authFetch("/api/mypage").then(setMember).catch(() => {});
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
