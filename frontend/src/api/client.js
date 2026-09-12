const BASE_URL = "http://localhost:8080";

// 토큰은 서명/만료시간이 멀쩡해도 서버(DB) 쪽에서 무효가 될 수 있음
// (회원 탈퇴, DB 초기화 등으로 더 이상 존재하지 않는 회원). 그런 경우 백엔드는 401을 준다.
// 이럴 때 프론트가 계속 그 토큰을 들고 "로그인된 척" 하지 않도록, 401을 받으면
// 이 자리에서 바로 토큰을 지우고 전역 이벤트로 앱에 "로그아웃됐다"고 알린다.
// (403은 로그인 자체는 유효하지만 권한이 없는 것이므로 로그아웃 처리하지 않는다.)
function handleUnauthorized() {
  localStorage.removeItem("token");
  window.dispatchEvent(new Event("auth:invalid"));
}

// 로그인 시 저장해둔 토큰을 모든 요청에 자동으로 실어 보내는 공통 함수
export async function authFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("로그인이 만료되었거나 더 이상 유효하지 않습니다.");
  }

  if (res.status === 403) {
    throw new Error("인증이 필요하거나 권한이 없습니다.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
  }

  return res.json();
}

// 사진 등 파일 업로드용. Content-Type은 지정하지 않음 — FormData를 body로 넘기면
// 브라우저가 boundary 포함된 multipart/form-data 헤더를 알아서 만들어주는데,
// 여기서 "application/json" 같은 값을 강제로 넣으면 그게 깨져버림.
export async function authUpload(path, formData) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("로그인이 만료되었거나 더 이상 유효하지 않습니다.");
  }

  if (res.status === 403) {
    throw new Error("인증이 필요하거나 권한이 없습니다.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "파일 업로드 중 오류가 발생했습니다.");
  }

  return res.json();
}

// JWT는 "헤더.내용.서명" 구조라, 가운데 부분(내용)만 base64 디코딩하면
// 토큰 만들 때 넣었던 memberId, role, name을 서버 호출 없이 바로 꺼내볼 수 있음
//
// 주의: atob()만 쓰면 한글 등 멀티바이트 UTF-8 문자가 깨짐(예: "곽지윤" → "ê³½ì§€ìœ¤").
// atob는 base64를 "바이트값 그대로"만 문자열로 풀기 때문에, UTF-8로 인코딩된 다국어 텍스트를
// 다시 UTF-8로 재해석해줘야 원래 글자가 나옴 (TextDecoder 사용).
function decodeJwtPayload(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(json);
}

export function getCurrentUser() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token);
    return { memberId: Number(payload.sub), role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

// 토큰의 만료시각을 ms 단위(Date.now()랑 바로 비교 가능한 형태)로 꺼내옴
// SessionExpiryModal이 "얼마나 남았는지" 계산할 때 씀
export function getTokenExpiryMs() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token);
    return payload.exp ? payload.exp * 1000 : null; // JWT의 exp는 "초" 단위라 1000 곱해서 ms로 변환
  } catch {
    return null;
  }
}

// 세션 연장 - 아직 유효한 토큰으로 백엔드 /api/auth/refresh를 호출해서
// 만료시간이 새로 늘어난 토큰을 발급받고, localStorage에 있는 기존 토큰을 그걸로 교체함.
// 실패(401 등)하면 authFetch가 알아서 토큰 삭제 + "auth:invalid" 이벤트까지 처리해줌.
export async function refreshToken() {
  const data = await authFetch("/api/auth/refresh", { method: "POST" });
  localStorage.setItem("token", data.token); // 만료시간 갱신된 새 토큰으로 교체
  window.dispatchEvent(new Event("auth:refreshed")); // 필요하면 다른 컴포넌트도 이 이벤트로 감지 가능
  return data.token;
}

// 마이페이지 "최근 알림" - 재난 알림(관심지역 반경 매칭)/제보 알림(내 제보 상태변경).
// 서버가 실제 이벤트(Incident 생성/상태변경) 시점에 만들어둔 알림만 내려줌.
export function getNotifications() {
  return authFetch("/api/notifications");
}

export function deleteNotification(notificationId) {
  return authFetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
}

export function deleteAllNotifications() {
  return authFetch("/api/notifications", { method: "DELETE" });
}