import {
  Camera, CloudRain, Flame, GraduationCap, Home, Mountain, Snowflake, Thermometer, Users, Waves, Wind,
} from "lucide-react";

// ---- 색상/토큰 -----------------------------------------------------------
// 신뢰감 있는 네이비(공공/안전) + 경보용 레드 + 대응중 앰버 + 완료 그린
// 정보 제공형 사이트가 아니라 "추적형" 서비스라는 걸 타임라인 컴포넌트로 강조

export const quickMenu = [
  { icon: Home, label: "대피시설", title: "대피시설 찾기", sub: "가까운 대피시설을 확인하세요" },
  { icon: Camera, label: "현장제보", title: "현장 제보하기", sub: "지금, 바로 제보해주세요" },
  { icon: GraduationCap, label: "행동요령", title: "행동요령", sub: "재난별 행동요령을 확인하세요" },
  { icon: Users, label: "가족확인", title: "가족 안전확인", sub: "가족의 안전 상태를 확인하세요" },
];

export const SAFETY_GUIDE_ICONS = {
  FLOOD: CloudRain,
  EARTHQUAKE: Waves,
  FIRE: Flame,
  TYPHOON: Wind,
  WILDFIRE: Mountain,
  HEATWAVE: Thermometer,
  COLDWAVE: Snowflake,
};

export const AI_SUGGESTED_QUESTIONS = [
  "현재 주변 위험 상황이 뭐야?",
  "지금 밖에 나가도 될까?",
  "가까운 대피시설은 어디야?",
  "침수 시 주의사항 알려줘.",
];

// 모달 상세화면 상단 배너 배경 (은은한 톤)
export const STATUS_BANNER = {
  RECEIVED: "bg-slate-100 border border-slate-200",
  CONFIRMING: "bg-sky-100 border border-sky-200",
  RESPONDING: "bg-rose-100 border border-rose-200",
  RECOVERING: "bg-yellow-100 border border-yellow-200",
  CLOSED: "bg-emerald-100 border border-emerald-200",
};

// 타임라인 점 색 (뱃지보다 진하게, 시각적으로 딱 떨어지게)
export const STATUS_DOT = {
  RECEIVED: "bg-slate-300",
  CONFIRMING: "bg-sky-400",
  RESPONDING: "bg-rose-400",
  RECOVERING: "bg-yellow-400",
  CLOSED: "bg-emerald-400",
};

// "대응상황 상세" 진행바 - STATUS 5개를 6칸에 배치 (CONFIRMING은 담당자배정·현장확인 사이라 3칸째로 표시)
export const DETAIL_PROGRESS_STEPS = ["접수", "담당자배정", "현장확인", "대응중", "복구중", "완료"];
export const DETAIL_STEP_BY_STATUS = { RECEIVED: 1, CONFIRMING: 3, RESPONDING: 4, RECOVERING: 5, CLOSED: 6 };

// 담당자가 로그에 memo를 안 남긴 경우에도 타임라인 각 단계에 짧은 설명이 비어 보이지 않도록 하는 기본 문구
export const STATUS_LOG_FALLBACK_TEXT = {
  RECEIVED: "시민 제보가 접수되었습니다.",
  CONFIRMING: "담당 부서에서 제보 내용을 확인하고 있습니다.",
  RESPONDING: "현장 대응이 진행되고 있습니다.",
  RECOVERING: "복구 작업이 진행되고 있습니다.",
  CLOSED: "사건 처리가 완료되었습니다.",
};

export const WEATHER_LOCATION_CACHE_KEY = "safetrace:last-location";
