// 안전수칙 문구는 데이터 파일(safetyGuides.json)에 두고, 여기서는 화면이 쓰는 이름으로 내보낸다.
import data from "./safetyGuides.json";

export const SAFETY_GUIDE_ORDER = data.order;
export const SAFETY_GUIDES = data.guides;

export const getSafetyGuide = (key) =>
  SAFETY_GUIDES[key] || SAFETY_GUIDES.FLOOD;
