const BASE_URL = "";

// 401 응답 시 토큰 삭제 후 auth:invalid 이벤트 발생 (탈퇴·DB 초기화 등 서버 기준 무효 토큰)
// 403은 권한 부족이므로 로그아웃 제외
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

  // 권한 없음 - 서버 메시지 우선, 없으면 기본 문구
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "인증이 필요하거나 권한이 없습니다.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
  }

  return res.json();
}

// Content-Type 미지정 (FormData의 multipart boundary를 브라우저가 생성)
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

  // 권한 없음 - 서버 메시지 우선, 없으면 기본 문구
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "인증이 필요하거나 권한이 없습니다.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "파일 업로드 중 오류가 발생했습니다.");
  }

  return res.json();
}

// JWT payload를 base64 디코딩해 memberId, role, name 추출
//
// atob 결과를 TextDecoder로 UTF-8 재해석 (atob만 쓰면 한글 깨짐)
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

    return {
      memberId: Number(payload.sub),
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

// 토큰 만료시각(ms) 조회 (SessionExpiryModal 남은 시간 계산용)
export function getTokenExpiryMs() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = decodeJwtPayload(token);

    return payload.exp
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

// 세션 연장: /api/auth/refresh로 재발급 후 localStorage 토큰 교체 (실패 시 authFetch의 401 처리)
export async function refreshToken() {
  const data = await authFetch("/api/auth/refresh", {
    method: "POST",
  });

  localStorage.setItem("token", data.token);

  window.dispatchEvent(
    new Event("auth:refreshed")
  );

  return data.token;
}

// 마이페이지 "최근 알림" - 재난 알림(관심지역 반경 매칭)/제보 알림(내 제보 상태변경).
// 서버가 실제 이벤트(Incident 생성/상태변경) 시점에 만들어둔 알림만 내려줌.
export function getNotifications() {
  return authFetch("/api/notifications");
}

export function deleteNotification(
  notificationId
) {
  return authFetch(
    `/api/notifications/${notificationId}`,
    {
      method: "DELETE",
    }
  );
}

export function deleteAllNotifications() {
  return authFetch("/api/notifications", {
    method: "DELETE",
  });
}