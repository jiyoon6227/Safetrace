import {
  ShieldAlert, User, Users, Bell, MapPin, Camera, CheckCircle2, AlertTriangle,
  Home, Heart, Clock, Flame, Droplets, Mountain, Wind, Thermometer, Snowflake,
  FileText, Building2,
} from "lucide-react";

export const TABS = [
  { key: "info", label: "내 정보", icon: User },
  { key: "family", label: "가족 관리", icon: Users },
  { key: "safety", label: "안전확인 이력", icon: ShieldAlert },
  { key: "reports", label: "내 제보 내역", icon: Camera },
  { key: "regions", label: "관심 지역", icon: MapPin },
  { key: "notify", label: "알림", icon: Bell },
];

export const RELATION_TYPES = ["배우자", "자녀", "부모님", "형제자매", "가족"];

export const REGION_LABELS = [
  { value: "우리집", icon: Home },
  { value: "부모님댁", icon: Users },
  { value: "회사", icon: Building2 },
  { value: "가족 보호", icon: Heart },
  { value: "관심지역", icon: MapPin },
];

export const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }

    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

export const ROLE_LABEL = {
  USER: "시민 사용자",
  STAFF: "담당 직원",
  ADMIN: "관리자",
};

export const formatDateTime = (iso) => {
  if (!iso) return "-";

  const d = new Date(iso);

  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTimeFull = (iso) => {
  if (!iso) return "-";

  const d = new Date(iso);

  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const SAFETY_STATUS_LABEL = {
  PENDING: "응답 대기중",
  SAFE: "안전 확인 완료",
  HELP: "도움 필요",
};

export const SAFETY_STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  SAFE: "bg-emerald-100 text-emerald-700",
  HELP: "bg-red-100 text-red-700",
};

export const SAFETY_STATUS_ICON = {
  PENDING: Clock,
  SAFE: CheckCircle2,
  HELP: AlertTriangle,
};

export const NOTIFICATION_FILTERS = [
  { key: "all", label: "전체" },
  { key: "disaster", label: "재난 알림" },
  { key: "safety", label: "안전확인" },
  { key: "report", label: "제보 알림" },
  { key: "etc", label: "기타" },
];

export const NOTIFICATION_META = {
  disaster: {
    label: "재난 알림",
    icon: AlertTriangle,
    iconWrap: "bg-red-50",
    iconColor: "text-red-500",
  },

  safety: {
    label: "안전확인",
    icon: Users,
    iconWrap: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },

  report: {
    label: "제보 알림",
    icon: FileText,
    iconWrap: "bg-blue-50",
    iconColor: "text-blue-600",
  },

  etc: {
    label: "기타",
    icon: Bell,
    iconWrap: "bg-slate-100",
    iconColor: "text-slate-500",
  },
};

export const notificationTime = (iso) => {
  if (!iso) return "";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "";

  const diff = Math.max(0, Date.now() - d.getTime());

  const min = Math.floor(diff / 60000);

  if (min < 1) return "방금 전";

  if (min < 60) return `${min}분 전`;

  const hour = Math.floor(min / 60);

  if (hour < 24) return `${hour}시간 전`;

  const day = Math.floor(hour / 24);

  if (day < 7) return `${day}일 전`;

  return d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
};

export const buildNotificationItems = ({
  sentChecks,
  receivedChecks,
  myReports,
  regions,
  dbNotifications = [],
}) => {
  const items = [];

  receivedChecks.forEach((c) => {
    items.push({
      id: `safety-received-${c.checkId}`,
      type: "safety",

      title:
        c.status === "PENDING"
          ? `${c.requesterName || "가족"}님이 안전확인을 요청했습니다.`
          : "안전확인 요청에 응답했습니다.",

      desc: c.incidentTitle
        ? `${c.incidentTitle} 관련 안전확인 요청입니다.`
        : "안전 여부를 확인해 주세요.",

      createdAt: c.requestedAt,
    });
  });

  sentChecks
    .filter((c) => c.status === "SAFE" || c.status === "HELP")
    .forEach((c) => {
      items.push({
        id: `safety-sent-${c.checkId}-${c.status}`,
        type: "safety",

        title:
          c.status === "SAFE"
            ? `${c.targetMemberName || "가족"}님이 안전하다고 응답했습니다.`
            : `${c.targetMemberName || "가족"}님이 도움이 필요하다고 응답했습니다.`,

        desc: c.incidentTitle
          ? `${c.incidentTitle} 관련 안전확인 응답입니다.`
          : "안전확인 응답이 도착했습니다.",

        createdAt: c.confirmedAt || c.requestedAt,
      });
    });

  myReports.forEach((r) => {
    items.push({
      id: `report-${r.reportId}`,
      type: "report",

      title: `${r.disasterType || "재난"} 제보가 등록되었습니다.`,

      desc: r.content
        ? `제보 #${r.reportId} · ${r.content}`
        : `제보 #${r.reportId}의 처리 현황을 확인할 수 있습니다.`,

      createdAt: r.createdAt,
    });
  });

  regions.forEach((r) => {
    items.push({
      id: `region-${r.memberRegionId}`,
      type: "etc",

      title: `${r.regionLabel || "관심지역"}이 등록되어 있습니다.`,

      desc:
        r.regionName ||
        "관심지역 알림 대상 지역입니다.",

      createdAt: r.createdAt || null,
    });
  });

  dbNotifications.forEach((n) => {
    items.push({
      id: `db-${n.notificationId}`,

      type:
        n.type === "DISASTER"
          ? "disaster"
          : "report",

      title: n.title,
      desc: n.content,
      createdAt: n.createdAt,

      incidentId:
        n.incidentId || null,
    });
  });

  return items
    .filter((item) => item.createdAt)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .slice(0, 30);
};


/* ======================================================
   사건 상태
   접수 → 확인중 → 대응중 → 복구중 → 종료
====================================================== */

export const STATUS_LABEL_KO = {
  RECEIVED: "접수",
  CONFIRMING: "확인중",
  RESPONDING: "대응중",
  RECOVERING: "복구중",
  CLOSED: "종료",
};


/* ======================================================
   다음 우편번호
====================================================== */

export function loadDaumPostcodeScript() {
  if (
    window.daum &&
    window.daum.Postcode
  ) {
    return;
  }

  if (
    document.getElementById(
      "daum-postcode-script"
    )
  ) {
    return;
  }

  const script =
    document.createElement("script");

  script.id =
    "daum-postcode-script";

  script.src =
    "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

  script.async = true;

  document.body.appendChild(script);
}


/* ======================================================
   재난 유형 아이콘
====================================================== */

export const DISASTER_ICON = {
  화재: Flame,
  침수: Droplets,
  산사태: Mountain,
  강풍: Wind,
  폭염: Thermometer,
  한파: Snowflake,
};


/* ======================================================
   제보 상태

   등록 → 검토중 → 사건연결
                ↘ 반려

   DB 상태값은 그대로 사용
   RECEIVED = 등록
====================================================== */

export const REPORT_STATE_LABEL = {
  RECEIVED: "등록",
  REVIEWING: "검토중",
  LINKED: "사건연결",
  REJECTED: "반려",
};

export const REPORT_STATUS_FILTERS = [
  {
    key: "all",
    label: "전체",
  },

  {
    key: "RECEIVED",
    label: "등록",
  },

  {
    key: "REVIEWING",
    label: "검토중",
  },

  {
    key: "LINKED",
    label: "사건연결",
  },

  {
    key: "REJECTED",
    label: "반려",
  },
];


/* ======================================================
   재난 유형 색상
====================================================== */

export const DISASTER_TYPE_STYLE = {
  화재:
    "bg-orange-50 text-orange-600",

  침수:
    "bg-blue-50 text-blue-600",

  폭염:
    "bg-rose-50 text-rose-600",

  산사태:
    "bg-amber-50 text-amber-700",

  강풍:
    "bg-slate-100 text-slate-600",

  한파:
    "bg-sky-50 text-sky-600",
};

export const DISASTER_TYPE_TEXT_COLOR = {
  화재: "text-orange-600",
  침수: "text-blue-600",
  폭염: "text-rose-600",
  산사태: "text-amber-700",
  강풍: "text-slate-600",
  한파: "text-sky-600",
};


/* ======================================================
   위험도
====================================================== */

export const SEVERITY_LABEL_KO = {
  HIGH: "위험도 높음",
  MEDIUM: "위험도 보통",
  LOW: "위험도 낮음",
};

export const SEVERITY_STYLE = {
  HIGH:
    "bg-red-50 text-red-600",

  MEDIUM:
    "bg-amber-50 text-amber-600",

  LOW:
    "bg-blue-50 text-blue-600",
};


/* ======================================================
   제보 상태 색상
====================================================== */

export const REPORT_STATE_STYLE = {
  RECEIVED:
    "bg-blue-50 text-blue-700",

  REVIEWING:
    "bg-amber-50 text-amber-700",

  LINKED:
    "bg-emerald-50 text-emerald-700",

  REJECTED:
    "bg-rose-50 text-rose-700",
};


/* ======================================================
   제보에 연결된 사건 상태 색상
====================================================== */

export const REPORT_STATUS_STYLE = {
  RECEIVED:
    "bg-slate-600 text-white",

  CONFIRMING:
    "bg-sky-600 text-white",

  RESPONDING:
    "bg-rose-600 text-white",

  RECOVERING:
    "bg-amber-500 text-white",

  CLOSED:
    "bg-emerald-600 text-white",
};


/* ======================================================
   상세 타임라인
====================================================== */

export const REPORT_STATUS_DOT = {
  RECEIVED: "bg-slate-300",
  CONFIRMING: "bg-amber-400",
  RESPONDING: "bg-emerald-400",
  RECOVERING: "bg-sky-400",
  CLOSED: "bg-slate-400",
};


/* ======================================================
   시도 약칭
====================================================== */

export const SIDO_SHORT_NAME = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",

  경기도: "경기",

  강원도: "강원",
  강원특별자치도: "강원",

  충청북도: "충북",
  충청남도: "충남",

  전라북도: "전북",
  전북특별자치도: "전북",

  전라남도: "전남",

  경상북도: "경북",
  경상남도: "경남",

  제주특별자치도: "제주",
};

export const SAFETY_HISTORY_FILTERS = [
  {
    key: "all",
    label: "전체",
  },

  {
    key: "sent",
    label: "보낸 요청",
  },

  {
    key: "received",
    label: "받은 요청",
  },
];