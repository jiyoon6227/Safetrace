const WS_URL = "ws://localhost:8080/ws/incidents";
const SAFETY_CHECK_WS_URL = "ws://localhost:8080/ws/safety-check";
const REPORT_WS_URL = "ws://localhost:8080/ws/reports";

// 백엔드가 재시작되거나(devtools hot reload 등) 네트워크가 잠깐 끊기면
// WebSocket 연결이 끊어진 채로 남아서, 그 이후 상태 변경이 화면에 영원히
// 반영되지 않는 문제가 있었음. onclose 때마다 일정 시간 뒤 재연결을 시도하도록
// 공통 래퍼로 뺐다. label은 콘솔 경고 문구 구분용.
function connectWithRetry(url, onMessage, label) {
  let socket = null;
  let retryTimer = null;
  let closedByClient = false;

  const open = () => {
    socket = new WebSocket(url);

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
      // 화면 기능 자체는 (새로고침하면) 정상 동작하니 재연결 전까지는
      // 조용히 대기하다가 3초 뒤 다시 붙는다.
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

// 백엔드 IncidentWebSocketHandler에 연결해서, 메시지 올 때마다 onMessage로 넘겨줌.
export function connectIncidentSocket(onMessage) {
  return connectWithRetry(WS_URL, onMessage, "사건 상태");
}

// 가족 안전확인용 - SafetyCheckWebSocketHandler에 연결.
// eventType이 SAFETY_CHECK_REQUESTED / SAFETY_CHECK_RESPONDED로 옴
// 백엔드는 전체 broadcast라
// "나랑 관련된 알림인지"는 onMessage 쪽에서
// requesterId / targetMemberId로 걸러야 함.
export function connectSafetyCheckSocket(onMessage) {
  return connectWithRetry(SAFETY_CHECK_WS_URL, onMessage, "안전확인");
}

// 제보 상태 실시간 갱신용
// 등록 / 검토중 / 사건연결 / 반려 변경을 전달한다.
export function connectReportSocket(onMessage) {
  return connectWithRetry(REPORT_WS_URL, onMessage, "제보");
}