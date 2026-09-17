import {
  LayoutDashboard, FileText, ClipboardList,
  FileBarChart, Bell, Activity, AlertTriangle,
} from "lucide-react";

const SEVERITY_COLOR = {
  HIGH: "#1f1b1b",
  MEDIUM: "#F59E0B",
  LOW: "#3B82F6",
};

const STATUS_LABEL = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};

const STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  CONFIRMING: "bg-sky-200 text-sky-800",
  RESPONDING: "bg-rose-200 text-rose-800",
  RECOVERING: "bg-yellow-200 text-yellow-800",
  CLOSED: "bg-emerald-200 text-emerald-800",
};

// 백엔드 IncidentStatus enum과 동일한 순서. "바로 다음 단계로만 이동 가능" 규칙을
// 화면에서도 그대로 반영하기 위해 씀 (다음 상태 버튼 하나만 보여주는 용도)
const STATUS_ORDER = ["RECEIVED", "CONFIRMING", "RESPONDING", "RECOVERING", "CLOSED"];

// 시민 ReportForm.jsx와 동일한 재난유형 목록 - 제보 관리 탭 요약 칩에서 0건인 유형도 같이 보여주기 위함
const REPORT_DISASTER_TYPES = ["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"];

// 시/도 17개 고정 목록 - 실제 제보 데이터랑 상관없이 항상 다 보여주고, 고른 지역에 제보가 있으면 그것만 필터링
const REGION_OPTIONS = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
  "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도",
];

// 제보 처리 상태 - 사건전환된 제보도 원본 데이터를 지우지 않고 상태만 바꿔서 이력으로 보존함
const REPORT_STATUS_LABEL = { RECEIVED: "접수", LINKED: "사건전환 완료" };
const REPORT_STATUS_STYLE = {
  RECEIVED: "bg-slate-200 text-slate-700",
  LINKED: "bg-emerald-100 text-emerald-700",
};

// 접수일시 필터 - 너무 오래된/의미없는 연도(0000년 등) 입력 방지용 하한선
const MIN_REPORT_DATE = "2020-01-01";

// Date -> "YYYY-MM-DD" (input[type=date] 값 포맷). 날짜 필터 기본값이 하드코딩된 특정 날짜로
// 박혀있으면 다음날이 돼도 안 바뀌는 문제가 생기므로, 항상 이 함수로 "오늘" 기준으로 계산해서 씀.
const toDateInputValue = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// 날짜 필터 기본 범위: 오늘로부터 daysBack일 전 ~ 오늘
const getDefaultDateRange = (daysBack) => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - daysBack);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
};

// 한글 받침 유무에 따라 "으로"/"로" 조사를 붙여줌 (받침 없거나 받침이 ㄹ이면 "로", 그 외엔 "으로")
const withRo = (word) => {
  if (!word) return word;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${word}로`;
  const jong = (last - 0xac00) % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
};

// 서버가 주는 시각 문자열을 "2026-09-13 11:24" 형태(24시간제)로 통일해서 표시
const formatDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "N분 전" / "N시간 전" 형태 - 담당 사건 목록, 최근 활동 카드에서 사용
const formatTimeAgo = (iso) => {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
};

// "01012344321" / "010-1234-4321" 등 어떤 형태로 들어와도 "010-****-4321"처럼 가운데를 가려서 표시
const maskPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone; // 형식이 이상하면 마스킹하지 않고 원본 그대로
  const first = digits.slice(0, 3);
  const last = digits.slice(-4);
  return `${first}-****-${last}`;
};

const sameDay = (isoA, dateB) => {
  if (!isoA) return false;
  const a = new Date(isoA);
  return a.getFullYear() === dateB.getFullYear() && a.getMonth() === dateB.getMonth() && a.getDate() === dateB.getDate();
};

// 지도 마커 색상 - 사건 상태(Incident.status) 5단계 기준, 서로 겹치지 않게 1:1 매핑
// 긴급(위험도 HIGH·미종료)은 상태가 아니라 별도 오버레이라 색을 바꾸지 않고 테두리 링으로만 표시(buildMarkerImage 참고)
const markerColorOf = (inc) => {
  if (inc.status === "RECEIVED") return "#64748B"; // 접수
  if (inc.status === "CONFIRMING") return "#3B82F6"; // 확인중
  if (inc.status === "RESPONDING") return "#F59E0B"; // 대응중
  if (inc.status === "RECOVERING") return "#8B5CF6"; // 복구중
  return "#10B981"; // 해결(CLOSED)
};

const DISASTER_TYPE_COLOR = {
  침수: "#3B82F6", 화재: "#EF4444", 산사태: "#8B5CF6", 태풍: "#06B6D4",
  폭염: "#F59E0B", 강풍: "#64748B", 한파: "#0EA5E9", 기타: "#94A3B8",
};

// 지도 마커에 넣을 재난유형별 이모지 - 색상 핀만으로는 무슨 재난인지 구분이 안 돼서 추가
const DISASTER_TYPE_EMOJI = {
  침수: "💧", 화재: "🔥", 산사태: "⛰️", 태풍: "🌀", 폭염: "☀️", 강풍: "💨", 한파: "❄️", 기타: "⚠️",
};

// 원형 점 대신 "핀" 모양 마커 - 위쪽 흰 원 안에 재난유형 이모지를 넣어 지도만 보고도 무슨 사건인지 알 수 있게 함
// 긴급(심각도 HIGH·미종료)은 색을 바꾸는 대신 핀 테두리에 빨간 점선 링을 둘러서 "상태 위에 얹힌 경고" 느낌으로 구분함
const buildMarkerImage = (inc) => {
  const color = markerColorOf(inc);
  const emoji = DISASTER_TYPE_EMOJI[inc.disasterType] || "⚠️";
  const isUrgent = inc.status !== "CLOSED" && inc.severity === "HIGH";
  const ring = isUrgent
    ? `<circle cx="17" cy="16" r="15.5" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="3 2"/>`
    : `<circle cx="17" cy="16" r="15.5" fill="none" stroke="white" stroke-width="2"/>`;
  // 흰 배경 원 없이 핀 전체를 상태 색으로 채워서, 멀리서/축소된 지도에서도 색만으로 상태가 바로 구분되게 함
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 25 17 25s17-13 17-25C34 7.6 26.4 0 17 0z" fill="${color}"/>
    ${ring}
    <text x="17" y="21" font-size="15" text-anchor="middle">${emoji}</text>
  </svg>`;
  return new window.kakao.maps.MarkerImage(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    new window.kakao.maps.Size(34, 42),
    { offset: new window.kakao.maps.Point(17, 42) }
  );
};

// 공지사항 - 별도 백엔드 API가 없어 화면 구성용으로 고정해둔 안내 문구
const STATIC_NOTICES = [
  { icon: AlertTriangle, tone: "text-red-500", title: "[긴급] 호우주의보 발효에 따른 비상근무 체계 가동", date: "오늘" },
  { icon: Bell, tone: "text-blue-500", title: "[안내] 추석 연휴 재난상황실 운영 안내", date: "어제" },
  { icon: Bell, tone: "text-blue-500", title: "[안내] 시스템 정기 점검 일정 안내", date: "이번 주" },
  { icon: Bell, tone: "text-blue-500", title: "[안내] 여름철 폭염 대응 지침 업데이트", date: "이번 달" },
];

const NAV_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard, label: "대시보드" },
  { key: "reports", icon: ClipboardList, label: "제보 관리" },
  { key: "incidents", icon: FileText, label: "사건 관리" },
  { key: "publicInfo", icon: Activity, label: "공공 정보" },
  { key: "statistics", icon: FileBarChart, label: "통계 보고서" },
];

// 공공 정보 페이지의 지역 콤보박스에서 쓰는 17개 시도 목록 + 각 시도의 대표 좌표/구 이름.
// /api/environment/shelters가 guName(구/군 단위)+좌표 기준이라, 시도를 고르면 그 시도의
// 시청/도청 소재 구를 대신 넣어서 "근처 대피시설"을 보여주는 방식으로 씀.
const SIDO_CENTER = {
  "서울특별시": { guName: "중구", lat: 37.5665, lng: 126.9780 },
  "부산광역시": { guName: "연제구", lat: 35.1796, lng: 129.0756 },
  "대구광역시": { guName: "중구", lat: 35.8714, lng: 128.6014 },
  "인천광역시": { guName: "남동구", lat: 37.4563, lng: 126.7052 },
  "광주광역시": { guName: "서구", lat: 35.1595, lng: 126.8526 },
  "대전광역시": { guName: "서구", lat: 36.3504, lng: 127.3845 },
  "울산광역시": { guName: "남구", lat: 35.5384, lng: 129.3114 },
  "세종특별자치시": { guName: "세종특별자치시", lat: 36.4801, lng: 127.2891 },
  "경기도": { guName: "팔달구", lat: 37.2636, lng: 127.0286 },
  "강원특별자치도": { guName: "춘천시", lat: 37.8813, lng: 127.7298 },
  "충청북도": { guName: "청주시", lat: 36.6424, lng: 127.4890 },
  "충청남도": { guName: "홍성군", lat: 36.6008, lng: 126.6650 },
  "전북특별자치도": { guName: "전주시", lat: 35.8242, lng: 127.1480 },
  "전라남도": { guName: "무안군", lat: 34.9866, lng: 126.3916 },
  "경상북도": { guName: "안동시", lat: 36.5684, lng: 128.7294 },
  "경상남도": { guName: "창원시", lat: 35.2280, lng: 128.6811 },
  "제주특별자치도": { guName: "제주시", lat: 33.4996, lng: 126.5312 },
};

export {
  SEVERITY_COLOR,
  STATUS_LABEL,
  STATUS_STYLE,
  STATUS_ORDER,
  REPORT_DISASTER_TYPES,
  REGION_OPTIONS,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_STYLE,
  MIN_REPORT_DATE,
  toDateInputValue,
  getDefaultDateRange,
  withRo,
  formatDateTime,
  formatTimeAgo,
  maskPhone,
  sameDay,
  markerColorOf,
  DISASTER_TYPE_COLOR,
  DISASTER_TYPE_EMOJI,
  buildMarkerImage,
  STATIC_NOTICES,
  NAV_ITEMS,
  SIDO_CENTER,
};