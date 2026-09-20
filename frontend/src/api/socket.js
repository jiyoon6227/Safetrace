// 현재 페이지 origin 기준으로 동적 조립한다(client.js의 BASE_URL="" 상대경로 패턴과 동일한 이유).
// localhost:8080을 문자열로 박아두면 배포 후 다른 사람 브라우저에서는 "localhost"가 그 사람
// 자신의 컴퓨터를 가리켜버려서 실시간 기능이 전부 조용히 끊긴다.
// https로 배포되면 브라우저가 보안상 wss://만 허용하므로 location.protocol을 보고 자동 전환.
// 로컬 개발 때는 vite.config.js의 /ws 프록시(ws: true)가 8080으로 그대로 넘겨준다.
function wsOrigin() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

const WS_URL = `${wsOrigin()}/ws/incidents`;
const SAFETY_CHECK_WS_URL = `${wsOrigin()}/ws/safety-check`;
const REPORT_WS_URL = `${wsOrigin()}/ws/reports`;

// 브라우저 WebSocket은 fetch처럼 Authorization 헤더를 직접 넣을 수 없어서
// 현재 로그인 JWT를 handshake URL의 query parameter로 전달한다.
// 백엔드 JwtWebSocketHandshakeInterceptor가 이 값을 검증하고 memberId/role을 세션에 저장한다.
function buildAuthenticatedUrl(baseUrl) {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

// 백엔드가 재시작되거나(devtools hot reload 등) 네트워크가 잠깐 끊기면
// WebSocket 연결이 끊어진 채로 남아서, 그 이후 상태 변경이 화면에 영원히
// 반영되지 않는 문제가 있었음.
// onclose 때마다 일정 시간 뒤 재연결을 시도하도록 공통 래퍼로 뺐다.
// 재연결할 때마다 localStorage의 최신 JWT를 다시 읽는다.
function connectWithRetry(baseUrl, onMessage, label) {
  let socket = null;
  let retryTimer = null;
  let closedByClient = false;

  const open = () => {
    const authenticatedUrl = buildAuthenticatedUrl(baseUrl);

    // 로그아웃 상태에서는 WebSocket 연결을 만들지 않는다.
    if (!authenticatedUrl) return;

    socket = new WebSocket(authenticatedUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // 파싱 안 되는 메시지는 무시
      }
    };

    socket.onerror = () => {
      console.warn(`${label} WebSocket 연결 실패 - 재연결을 시도합니다.`);
    };

    socket.onclose = () => {
      if (closedByClient) return;

      // 화면 기능 자체는 REST 재조회로 정상 동작하므로 3초 뒤 재연결.
      // 토큰이 갱신됐다면 다음 연결에서는 새 토큰을 사용한다.
      retryTimer = setTimeout(open, 3000);
    };
  };

  open();

  return {
    close() {
      closedByClient = true;
      clearTimeout(retryTimer);
      socket?.close();
    },
  };
}

export function connectIncidentSocket(onMessage) {
  return connectWithRetry(WS_URL, onMessage, "사건 상태");
}

export function connectSafetyCheckSocket(onMessage) {
  return connectWithRetry(SAFETY_CHECK_WS_URL, onMessage, "안전확인");
}

export function connectReportSocket(onMessage) {
  return connectWithRetry(REPORT_WS_URL, onMessage, "제보");
}