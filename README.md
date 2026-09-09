# 세이프트레이스 (SafeTrace)

대전·세종·충청권 재난 상황관리·대응 플랫폼 개인 프로젝트

## 폴더 구조

```
safe/
├── frontend/                 ← React 화면 (JavaScript, Vite)
│   ├── src/
│   │   ├── App.jsx           ← 시민 홈 화면 (페이지 라우팅 포함)
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx               로그인 / 회원가입 / 이메일 인증
│   │   │   ├── MyPage.jsx                  마이페이지 (프로필·가족·관심지역)
│   │   │   ├── ReportForm.jsx              현장 제보 등록
│   │   │   ├── SafetyCheckResponsePage.jsx 이메일 링크로 들어오는 안전확인 응답 화면
│   │   │   └── ControlBoard.jsx            STAFF/ADMIN 관제 대시보드
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
```

## 시작하는 순서

1. `backend/application.yml.example`을 `backend/application.yml`로 복사하고 DB 접속정보·JWT 시크릿·메일 계정 등을 본인 값으로 채우기
2. `backend/백엔드_실행가이드.md` 읽고 Spring Boot 서버 먼저 띄우기 (IntelliJ 추천, 8080 포트)
3. `frontend` 폴더에서:
   ```
   npm install
   npm run dev
   ```
   (5173 포트, 백엔드는 별도로 8080에서 떠 있어야 함)

## 기술 스택

- **Backend**: Spring Boot 3.3.4, Java 21, Spring Security + JWT(jjwt), MyBatis, Oracle DB, WebSocket, Spring Mail, Lombok
- **Frontend**: React 19, Vite, Tailwind CSS 4, lucide-react

## 완성된 것

✅ 로그인 / 회원가입 / 이메일 인증코드
✅ JWT 인증 + 권한 분리 (USER / STAFF / ADMIN, `@PreAuthorize`)
✅ Incident 생성·조회·상태전이(6단계 Workflow)·타임라인
✅ 시민제보(Report) 등록 API + 사진 업로드
✅ 시민제보 중복탐지 로직 (위경도 거리계산) 및 사건 연결
✅ 가족관계 등록/수락/삭제 + 가족 안전확인 요청·응답 (로그인 상태 또는 이메일 링크로 응답)
✅ WebSocket 실시간 브로드캐스트 (사건 상태 변경, 안전확인 요청/응답)
✅ 마이페이지 (프로필 수정, 비밀번호 변경, 알림설정, 관심지역, 회원탈퇴)
✅ 시민 홈 화면 UI (React)
✅ STAFF/ADMIN 관제 대시보드 (`ControlBoard.jsx`) — 제보 목록, 사건 배정, 상태 전이

## 아직 안 된 것 / 알려진 이슈

⬜ 공공데이터 API 연동 (재난문자/기상) — 홈 화면의 날씨·재난정보는 정적 더미 데이터
⬜ Redis 캐싱
⬜ Resilience4j 장애대응
