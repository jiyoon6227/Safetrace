import { useEffect } from "react";

// 팝업/모달이 열려있을 때 ESC 키를 누르면 닫히게 하는 공통 훅.
// isOpen이 false일 땐 리스너 자체를 등록 안 해서, 닫혀있는 동안 불필요하게 계속 듣고 있지 않음.
export function useEscapeKey(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
}