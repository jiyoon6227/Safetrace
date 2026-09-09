const BASE_URL = "http://localhost:8080";

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

  if (res.status === 401 || res.status === 403) {
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

  if (res.status === 401 || res.status === 403) {
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