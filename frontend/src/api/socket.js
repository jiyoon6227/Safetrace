import { authFetch } from "./client";

// WebSocket 주소는 현재 origin 기준으로 조립 (localhost 고정 시 배포 환경에서 연결 불가)
// https 환경은 wss 사용, 로컬 개발은 vite /ws 프록시 경유
function wsOrigin() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

const WS_URL = `${wsOrigin()}/ws/incidents`;
const SAFETY_CHECK_WS_URL = `${wsOrigin()}/ws/safety-check`;
const REPORT_WS_URL = `${wsOrigin()}/ws/reports`;

// 브라우저 WebSocket은 fetch처럼 Authorization 헤더를 직접 넣을 수 없다.
// JWT를 접속 주소에 실으면 서버·프록시 접속 로그에 JWT가 남기 때문에,
// 로그인 상태로 1회용 티켓(30초 유효)을 받아 handshake URL의 query parameter로 전달한다.
// 백엔드 JwtWebSocketHandshakeInterceptor가 티켓을 확인하고 memberId/role을 세션에 저장한다.
async function buildAuthenticatedUrl(baseUrl) {
  const { ticket } = await authFetch("/api/ws/ticket", { method: "POST" });

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}ticket=${encodeURIComponent(ticket)}`;
}

// 연결 종료 시 자동 재연결 (백엔드 재시작·네트워크 단절 대비)
// 재연결마다 티켓을 새로 받는다 (티켓은 한 번 쓰면 사라짐)
function connectWithRetry(baseUrl, onMessage, label) {
  let socket = null;
  let retryTimer = null;
  let closedByClient = false;

  const open = async () => {
    // 로그아웃 상태에서는 WebSocket 연결을 만들지 않는다.
    if (!localStorage.getItem("token")) return;

    let authenticatedUrl;
    try {
      authenticatedUrl = await buildAuthenticatedUrl(baseUrl);
    } catch {
      // 티켓을 못 받았으면 잠시 뒤 다시 시도 (토큰이 무효하면 authFetch가 토큰을 지워서 다음 시도부터는 멈춤)
      if (!closedByClient) retryTimer = setTimeout(open, 3000);
      return;
    }

    // 티켓을 기다리는 사이에 화면이 닫혔으면 연결하지 않는다.
    if (closedByClient) return;

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