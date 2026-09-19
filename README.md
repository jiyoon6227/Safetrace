
c23fc086-4931-4dc2-8e77-a66b3e6b90ec.png

safe(20260919-175851).zip
ZIP 아카이브

붙여넣은 텍스트 (1)(20260919-175932).txt
문서
지금 화면이 아예안떠 너가 마지막에 작업물주고 사용량다해서 새채팅 킨거거든 그거 코드 옮겻는데 저래

ac0e5ce3-5471-4069-bd16-2ca7f28442c7.png
메인페이지에서 이부분은 뭘 넣어야할까? 내부 사건? 아니면 실제 재난 문자?

fe04ff0d-482c-4243-9785-67c2ff3d5110.png
마이페이지 저 헤더 가운데 마이페이지 글자 좀 너무 작아보여 딱 여기 마이페이지다 싶게 크게

69d384b2-9fd3-47e1-a4c6-fbc1af554a07.png
07e19ce8-0d29-4687-bc2d-693fa67de586.png

safe(20260919-184159).zip
ZIP 아카이브
공통 푸터에서 2번째 부분 세로높이 줄여줄수있어? 글자만 딱 들어가게 

5ff3976f-30d9-47be-ac3d-c18a27a78704.png
나 저러케똑같은 계정으로 탈퇴하고 가입하려니까 막히네 왜이러지?


붙여넣은 텍스트 (1)(20260919-185539).txt
문서
 ---> 그럼 여기에 수정해서 줄래? 초기화해서 한번에 , 사용할수잇게


safe(20260919-192149).zip
ZIP 아카이브
나 이제 프로젝트 완성한건가? 전체적으로 한번 봐줄래? ㅠㅠㅠㅠㅠㅠㅠㅠㅠ

응, ADMIN 완전히 없애는 방향으로 정리하는 게 맞아. 네 DB 자체는 이미 ROLE IN ('USER', 'STAFF')라서 DB 설계는 USER/STAFF 2역할로 되어 있어. 


문제는 일부 프론트/백엔드 코드에 예전 ADMIN 흔적이 남아 있었던 거야.

그리고 아까 2번 WebSocket 보안 수정 + ADMIN 제거를 합쳐서 다시 만들어놨어. 이 ZIP에는 schema.sql이 없어서 네가 방금 적용한 1번 재가입 DB 수정은 건드리지 않아.

2번 WebSocket 보안 + ADMIN 제거 통합 ZIP

수정/신규 파일은 이거야.

[신규] backend/src/main/java/com/safetrace/config/JwtWebSocketHandshakeInterceptor.java

[수정] backend/src/main/java/com/safetrace/config/WebSocketConfig.java

[수정] backend/src/main/java/com/safetrace/config/SecurityConfig.java

[수정] backend/src/main/java/com/safetrace/websocket/IncidentWebSocketHandler.java

[수정] backend/src/main/java/com/safetrace/websocket/SafetyCheckWebSocketHandler.java

[수정] backend/src/main/java/com/safetrace/websocket/ReportWebSocketHandler.java
STAFF || ADMIN → STAFF만

[수정] backend/src/main/java/com/safetrace/controller/IncidentController.java
전부 hasRole('STAFF') or hasRole('ADMIN') → hasRole('STAFF')

[수정] backend/src/main/java/com/safetrace/controller/ReportController.java
마찬가지로 STAFF만

[수정] frontend/src/MainPage.jsx
STAFF || ADMIN 체크 제거 → STAFF만 관제화면 진입, 관리자 대시보드 분기도 삭제하고 담당자 대시보드로 통일

[수정] frontend/src/pages/MyPage/constants.js
ADMIN: "관리자" 제거

[수정] frontend/src/api/socket.js

[수정] backend/pom.xml
주석 USER/STAFF/ADMIN → USER/STAFF

[수정] README.md
문서에 남아 있던 ADMIN 설명도 전부 제거

중요한 건 아까 준 safetrace_step2_websocket_security.zip 대신 지금 이 통합 ZIP을 사용하면 돼. 이미 아까 파일을 옮겼어도 지금 ZIP 내용으로 다시 덮어쓰면 괜찮아.

최종 역할 구조는 이제 딱 이렇게 돼:

USER  = 시민
STAFF = 재난 담당 직원
그리고 실제 권한도:

USER
 ├─ 제보
 ├─ 내 제보 추적
 ├─ 안전확인
 ├─ 관심지역
 └─ 일반 서비스

STAFF
 ├─ 관제 대시보드
 ├─ 제보 검토
 ├─ 사건 생성/배정
 ├─ 사건 상태 변경
 └─ 공지 관리
이게 오히려 네 프로젝트 규모에서는 더 깔끔해. ADMIN 페이지를 억지로 별도로 만들지 않고 STAFF가 운영 역할까지 맡는 구조로 설명하면 돼.

이 통합본 적용하고 백엔드 재시작해서 오류 없으면, 다음은 아까 전체 점검 3번이었던 “가족이 아닌 사람에게 안전확인 요청을 보낼 수 있는 문제” 바로 고치자.


파일 각각줘..

응, 각각 바로 줄게. 경로도 같이 적을게.
지금 아래 파일들만 프로젝트의 같은 위치에 덮어쓰면 돼.

[신규] backend/src/main/java/com/safetrace/config/JwtWebSocketHandshakeInterceptor.java
JwtWebSocketHandshakeInterceptor.java

[수정] backend/src/main/java/com/safetrace/config/WebSocketConfig.java
WebSocketConfig.java

[수정] backend/src/main/java/com/safetrace/config/SecurityConfig.java
SecurityConfig.java

[수정] backend/src/main/java/com/safetrace/controller/IncidentController.java
IncidentController.java

[수정] backend/src/main/java/com/safetrace/controller/ReportController.java
ReportController.java

[수정] backend/src/main/java/com/safetrace/websocket/IncidentWebSocketHandler.java
IncidentWebSocketHandler.java

[수정] backend/src/main/java/com/safetrace/websocket/ReportWebSocketHandler.java
ReportWebSocketHandler.java

[수정] backend/src/main/java/com/safetrace/websocket/SafetyCheckWebSocketHandler.java
SafetyCheckWebSocketHandler.java

[수정] frontend/src/api/socket.js
socket.js

[수정] frontend/src/MainPage.jsx
MainPage.jsx

[수정] frontend/src/pages/MyPage/constants.js
constants.js

[수정] backend/pom.xml
pom.xml

[수정] 프로젝트 루트 README.md
README.md

신규 파일은 1개만이야: JwtWebSocketHandshakeInterceptor.java.
나머지는 전부 기존 파일 덮어쓰기야.

schema.sql은 이번 묶음에 없으니까, 네가 방금 수정한 재가입 SQL은 그대로 유지하면 돼.


JwtWebSocketHandshakeInterceptor.java
코드


WebSocketConfig.java
코드


SecurityConfig.java
코드


IncidentController.java
코드


ReportController.java
코드


IncidentWebSocketHandler.java
코드


ReportWebSocketHandler.java
코드


SafetyCheckWebSocketHandler.java
코드


socket.js
코드


MainPage.jsx
코드


constants.js
코드


pom.xml
코드


README.md
문서

접기

js 파일 안열려 ..

응, socket.js는 그냥 글자로 전체 코드 줄게. 아래 그대로 복붙하면 돼.

[수정] 파일 위치
frontend/src/api/socket.js

const WS_URL = "ws://localhost:8080/ws/incidents";
const SAFETY_CHECK_WS_URL = "ws://localhost:8080/ws/safety-check";
const REPORT_WS_URL = "ws://localhost:8080/ws/reports";

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
신규 파일 아니고 기존 socket.js 전체 덮어쓰기야.

그리고 앞으로 JS 파일은 다운로드 링크 말고 그냥 전체 코드로 줄게.


라이브러리
/
README.md


세이프트레이스 (SafeTrace)
대전·세종·충청권 재난 상황관리·대응 플랫폼 개인 프로젝트

폴더 구조
safe/
├── frontend/                 ← React 화면 (JavaScript, Vite)
│   ├── src/
│   │   ├── App.jsx           ← 시민 홈 화면 (페이지 라우팅 포함)
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx               로그인 / 회원가입 / 이메일 인증
│   │   │   ├── MyPage.jsx                  마이페이지 (프로필·가족·관심지역)
│   │   │   ├── ReportForm.jsx              현장 제보 등록
│   │   │   ├── SafetyCheckResponsePage.jsx 이메일 링크로 들어오는 안전확인 응답 화면
│   │   │   └── ControlBoard.jsx            STAFF 관제 대시보드
│   │   ├── api/
│   │   │   ├── client.js     JWT 포함 fetch 래퍼 (authFetch, getCurrentUser)
│   │   │   └── socket.js     WebSocket 연결 (사건/안전확인 실시간 갱신)
│   │   └── index.css
│   └── vite.config.js
│
└── backend/                  ← Spring Boot 서버 (Java 21)
    ├── pom.xml
    ├── application.yml.example   ← 복사해서 application.yml로 만들고 본인 값 채우기
    ├── schema.sql                ← Oracle DDL
    ├── 백엔드_실행가이드.md        ← 여기부터 읽으세요
    └── src/main/java/com/safetrace/
        ├── domain/         엔티티 (Incident, Report, Member, FamilyRelation, SafetyCheck 등)
        ├── mapper/         MyBatis 매퍼 인터페이스 (+ resources/mappers/*.xml)
        ├── service/        핵심 로직 (Workflow, 중복탐지, 가족관계, 안전확인, 메일)
        ├── controller/     REST API
        ├── websocket/      실시간 알림 (Incident / SafetyCheck)
        └── config/         Security, JWT, WebSocket, CORS, 예외처리
시작하는 순서
backend/application.yml.example을 backend/application.yml로 복사하고 DB 접속정보·JWT 시크릿·메일 계정 등을 본인 값으로 채우기

backend/백엔드_실행가이드.md 읽고 Spring Boot 서버 먼저 띄우기 (IntelliJ 추천, 8080 포트)

frontend 폴더에서:

npm install
npm run dev
(5173 포트, 백엔드는 별도로 8080에서 떠 있어야 함)

기술 스택
Backend: Spring Boot 3.3.4, Java 21, Spring Security + JWT(jjwt), MyBatis, Oracle DB, WebSocket, Spring Mail, Lombok

Frontend: React 19, Vite, Tailwind CSS 4, lucide-react

완성된 것
✅ 로그인 / 회원가입 / 이메일 인증코드
✅ JWT 인증 + 권한 분리 (USER / STAFF, @PreAuthorize)
✅ Incident 생성·조회·상태전이(6단계 Workflow)·타임라인
✅ 시민제보(Report) 등록 API + 사진 업로드
✅ 시민제보 중복탐지 로직 (위경도 거리계산) 및 사건 연결
✅ 가족관계 등록/수락/삭제 + 가족 안전확인 요청·응답 (로그인 상태 또는 이메일 링크로 응답)
✅ WebSocket 실시간 브로드캐스트 (사건 상태 변경, 안전확인 요청/응답)
✅ 마이페이지 (프로필 수정, 비밀번호 변경, 알림설정, 관심지역, 회원탈퇴)
✅ 시민 홈 화면 UI (React)
✅ STAFF 관제 대시보드 (ControlBoard.jsx) — 제보 목록, 사건 배정, 상태 전이

아직 안 된 것 / 알려진 이슈
⬜ 공공데이터 API 연동 (재난문자/기상) — 홈 화면의 날씨·재난정보는 정적 더미 데이터
⬜ Redis 캐싱
⬜ Resilience4j 장애대응

