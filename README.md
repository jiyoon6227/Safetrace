# SafeTrace

대전·세종·충청권을 중심으로 기획한 **재난·안전 제보 및 상황관리 플랫폼** 개인 프로젝트입니다.

SafeTrace는 단순히 재난 정보를 보여주는 데서 끝나지 않고, 시민 제보가 접수된 이후 **검토 → 사건 연결/생성 → 담당자 배정 → 대응 → 종료**까지의 처리 흐름을 추적할 수 있도록 구성했습니다.

| 항목 | 내용 |
|---|---|
| **프로젝트 유형** | 개인 프로젝트 (기획 · 설계 · 개발 · 배포) |
| **개발 기간** | 2026.09 · 약 3주 |
| **개발 인원** | 1명 |
| **Live Service** | https://safetrace.kr |
| **GitHub** | https://github.com/jiyoon6227/Safetrace |

---

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [주요 기능](#주요-기능)
- [핵심 처리 흐름](#핵심-처리-흐름)
- [기술 스택](#기술-스택)
- [외부 연동 API](#외부-연동-api)
- [보안 및 데이터 정합성](#보안-및-데이터-정합성)
- [주요 문제 해결](#주요-문제-해결)
- [테스트](#테스트)
- [프로젝트 구조](#프로젝트-구조)
- [배포 구조](#배포-구조)
- [로컬 실행 방법](#로컬-실행-방법)
- [배포 및 테스트 계정](#배포-및-테스트-계정)
- [향후 개선](#향후-개선)

---

## 프로젝트 소개

기존 재난 서비스가 **정보 제공 또는 신고 접수**에 집중되어 있다는 점에서 출발해,  
SafeTrace는 **제보 이후의 처리 과정 자체를 시민이 확인할 수 있는 서비스**를 목표로 설계했습니다.

```text
시민 현장 제보
      ↓
담당자 검토
      ↓
기존 사건 연결 / 신규 사건 생성
      ↓
담당자 배정
      ↓
대응 및 복구
      ↓
처리 이력 기록
      ↓
종료
```

### 사용자 역할

- **USER(시민)** — 현장 제보, 처리상태 확인, 관심지역·공공안전정보 조회, 가족 안전확인
- **STAFF(담당자)** — 제보 검토, 사건 연결/생성, 담당자 배정, 상태 변경 및 처리 이력 관리

> 권한은 `USER`, `STAFF` 두 종류를 사용합니다.

---

## 주요 기능

### 시민(USER)

#### 재난·안전 제보
- 재난·안전 현장 제보
- 다중 사진 첨부
- 내 제보 처리상태 확인

#### 관심지역 및 공공안전정보
- 관심지역 다중 등록
- 대표 관심지역 설정
- 관심지역 기반 재난 알림
- 재난문자 조회
- 대피시설 조회
- 날씨 / 기상특보 조회
- 대기질 / 자외선 지수 조회
- 지도 기반 사건·대피시설 확인

#### 가족 안전확인
- 가족 등록 요청 / 수락 / 삭제
- 가족 안전확인 요청 / 응답
- 이메일 링크를 통한 비로그인 안전확인 응답

#### AI 및 회원 기능
- AI 안전 브리핑 및 자유질문
- 회원가입 / 로그인 / 이메일 인증
- 프로필 / 비밀번호 / 알림 설정
- 공지사항 조회
- 회원탈퇴

### 담당자(STAFF)

#### 제보 및 사건 관리
- 관제 대시보드
- 시민 제보 목록 / 상세 조회
- 제보 검토중 / 반려 처리
- 주변 기존 사건 후보 조회
- 기존 사건 연결
- 신규 사건 생성
- 연결된 제보 및 현장 사진 확인

#### 대응 관리
- 사건 담당자 배정
- 사건 상태 단계별 변경
- 상태 변경 이력 관리
- 처리 메모 관리

#### 운영 기능
- 공공안전정보 조회
- 공지사항 등록 / 수정 / 삭제
- 통계·보고 화면 조회

---

## 핵심 처리 흐름

### 1. 시민 제보 → 사건 관리

```text
시민 제보 등록
    ↓
RECEIVED
    ↓
담당자 검토
    ↓
REVIEWING
    ├─ 기존 사건 연결 → LINKED
    ├─ 신규 사건 생성 → LINKED
    └─ 반려 → REJECTED
```

- 시민이 등록한 `Report`와 실제 대응 단위인 `Incident`를 분리했습니다.
- 여러 시민이 같은 상황을 제보하더라도 하나의 Incident에 여러 Report를 연결할 수 있습니다.
- 동일 재난 유형, 최근 시간대, 거리 조건을 기준으로 주변 Incident 후보를 조회해 담당자에게 제시합니다.
- 완전 자동 병합 대신 담당자가 최종 판단하도록 해 잘못된 사건 병합 가능성을 줄였습니다.
- 이미 처리된 제보는 현재 상태 조건을 포함한 UPDATE로 중복 처리를 차단합니다.

---

### 2. 사건 상태 전이

```text
접수 → 확인중 → 대응중 → 복구중 → 종료
```

- 상태 변경 규칙을 서버에서 검증합니다.
- 단계를 건너뛰는 변경을 차단합니다.
- 상태가 변경될 때마다 `SF_INCIDENT_LOG`에 이력을 누적합니다.
- 사건 종료 단계에서는 처리내역을 남기도록 검증합니다.

이를 통해 UI 조작이나 API 직접 호출로 인해 비정상적인 상태 변경이 발생하지 않도록 했습니다.

---

### 3. 가족 안전확인

```text
가족 관계 요청
   ↓
상대방 수락(ACCEPTED)
   ↓
안전확인 요청
   ↓
로그인 응답 또는 이메일 토큰 응답
   ↓
SAFE / HELP
```

- 수락된 가족에게만 안전확인 요청이 가능합니다.
- 이메일 응답 링크는 UUID 기반 토큰, 만료시간, 응답시간을 이용해 재사용을 방지합니다.
- 응답 결과는 WebSocket을 통해 요청자 화면에 실시간 반영합니다.

---

## 기술 스택

| 분류 | 기술 |
|---|---|
| **Language** | Java 21, JavaScript |
| **Backend** | Spring Boot, Spring Security, JWT, MyBatis, WebSocket |
| **Frontend** | React, Vite, Tailwind CSS, lucide-react |
| **Database** | Oracle DB |
| **Build / Test** | Maven, JUnit 5, Mockito |
| **Infra** | GCP VM, Nginx, HTTPS |
| **Mail** | Spring Mail, Gmail SMTP |
| **AI** | Groq API |
| **Map** | Kakao Maps JavaScript SDK |

---

## 외부 연동 API

| API | 용도 |
|---|---|
| **행정안전부 재난안전데이터공유플랫폼** | 전국·지역별 긴급재난문자 및 기간별 재난문자 조회 |
| **기상청 단기예보 / 특보 API** | 현재 날씨 및 기상특보 조회 |
| **기상청 생활기상지수 API** | 자외선 지수 조회 |
| **AirKorea** | 미세먼지·초미세먼지 등 대기질 조회 |
| **민방위 대피시설 공공데이터** | 지역·현재 위치 기반 대피시설 조회 |
| **Kakao Maps** | 사건·대피시설 지도 표시, 주소↔좌표 변환, MarkerClusterer |
| **Daum Postcode** | 주소 검색 |
| **Groq API** | 공공안전정보 + 내부 사건 데이터를 결합한 AI 안전 브리핑 및 질의응답 |
| **Gmail SMTP** | 이메일 인증 및 가족 안전확인 링크 발송 |

> API Key, JWT Secret, DB 접속 비밀번호, Gmail 앱 비밀번호 등 민감정보는 환경변수 또는 Git 추적 제외 설정파일로 관리합니다.

---

## 보안 및 데이터 정합성

### 인증 / 인가
- BCrypt 비밀번호 암호화
- Spring Security + JWT 인증
- `USER` / `STAFF` 권한 분리
- `@EnableMethodSecurity` 기반 STAFF 전용 API 접근제어
- REST API 무효 인증 요청에 HTTP 401 반환
- WebSocket Handshake 단계 JWT 검증
- Local / Production 허용 Origin 분리

### 데이터 정합성
- 회원탈퇴 Soft Delete
- 활성 회원 사이에서만 LOGIN_ID 중복을 막는 Oracle 함수 기반 UNIQUE INDEX
- 회원당 대표 관심지역 1개를 DB UNIQUE INDEX로 보장
- 제보 처리 UPDATE에 현재 상태 조건 적용
- 사건 상태 전이 규칙 서버 검증
- 가족 안전확인 요청 대상 서버 검증
- 이메일 응답 토큰 만료 및 재사용 방지
- AI API 일일 토큰 사용량 안전한도 적용

---

## 주요 문제 해결

### 1. 운영 환경 CORS / WebSocket Origin 분리

**문제**  
로컬 주소 기준으로 허용 Origin이 고정되어 운영 도메인에서 REST API / WebSocket 연결 문제가 발생할 수 있었습니다.

**해결**  
`app.frontend-base-url`을 `local`, `prod` 프로필로 분리하고 `SecurityConfig`, `WebSocketConfig`에서 동일 설정값을 사용하도록 변경했습니다.

```text
local → http://localhost:5173
prod  → https://safetrace.kr
```

이를 통해 개발 환경과 운영 환경의 허용 Origin을 설정파일 기준으로 관리할 수 있도록 했습니다.

---

### 2. 동일 지역명 재난문자 혼입 방지

**문제**  
`동구`, `중구`, `서구`처럼 여러 시·도에 동일한 행정구역명이 존재해 지역명만으로 조회할 경우 다른 지역의 재난문자가 함께 노출될 수 있었습니다.

**해결**  
시·도 + 구 단위 조회를 우선 적용하고 fallback 결과에도 시·도 일치 여부를 추가 검증했습니다.

```text
기존
구 단위 조회

개선
시·도 + 구 단위 조회
      +
fallback 결과 시·도 재검증
```

이를 통해 사용자가 선택한 실제 지역의 재난문자만 표시하도록 개선했습니다.

---

### 3. 동일 제보 중복 처리 방지

**문제**  
두 명의 담당자가 같은 제보를 거의 동시에 처리하면 하나의 Report가 서로 다른 Incident에 연결될 가능성이 있었습니다.

**해결**  
UPDATE 조건에 단순히 Report ID만 사용하지 않고 현재 상태도 함께 포함했습니다.

```sql
UPDATE SF_REPORT
SET STATUS = 'LINKED'
WHERE REPORT_ID = ?
  AND STATUS = 'REVIEWING'
```

먼저 처리된 요청이 상태를 변경하면 이후 요청은 갱신 대상이 없어 처리되지 않도록 했습니다.

이를 통해 Frontend의 버튼 비활성화에만 의존하지 않고 서버와 DB에서 최종 데이터 정합성을 보장했습니다.

---

### 4. Report와 Incident 분리 설계

**문제**  
시민 제보를 그대로 Incident로 사용하면 동일한 사고에 대해 여러 시민이 제보할 때 실제 사건도 여러 건으로 생성될 수 있습니다.

**해결**  
시민 제보 `Report`와 실제 대응 단위 `Incident`를 별도 엔티티로 분리했습니다.

```text
Report A ─┐
Report B ─┼── Incident
Report C ─┘
```

이를 통해 여러 제보를 하나의 실제 사건으로 묶어 관리할 수 있도록 했습니다.

---

### 5. DB 처리 완료 이후 WebSocket 전파

**문제**  
DB Transaction이 완료되기 전에 WebSocket 메시지가 먼저 전송되면 사용자가 알림을 받은 직후 데이터를 다시 조회했을 때 변경 내용이 아직 반영되지 않은 상태를 확인할 가능성이 있었습니다.

**해결**  
데이터 처리가 정상적으로 완료된 이후 실시간 이벤트가 전달되도록 처리 순서를 구성했습니다.

```text
DB 처리
   ↓
Transaction Commit
   ↓
WebSocket Event
   ↓
Frontend 실시간 갱신
```

이를 통해 DB 상태와 실시간 화면 상태가 어긋나는 문제를 줄였습니다.

---

## 테스트

JUnit 5와 Mockito를 사용해 핵심 비즈니스 로직에 대한 단위 테스트를 작성했습니다.

### 주요 테스트 대상
- 사건 상태 전이 규칙
- 허용되지 않은 단계 건너뛰기 차단
- 사건 종료 시 처리내역 검증
- 회원가입 / 비밀번호 재설정 이메일 인증 상태 검증
- 동일 제보 중복 처리 방지

```bash
cd backend
mvn clean test
```

---

## 프로젝트 구조

```text
safe/
├─ frontend/
│  ├─ src/
│  │  ├─ api/                  # REST / WebSocket 클라이언트
│  │  ├─ components/
│  │  ├─ data/
│  │  ├─ hooks/
│  │  ├─ pages/
│  │  │  ├─ ControlBoard/      # STAFF 관제 화면
│  │  │  ├─ MyPage/
│  │  │  ├─ ReportForm.jsx
│  │  │  ├─ ReportPage.jsx
│  │  │  ├─ SafetyCheckResponsePage.jsx
│  │  │  ├─ SafetyMapPage.jsx
│  │  │  ├─ ShelterPage.jsx
│  │  │  └─ NoticePage.jsx
│  │  ├─ MainPage.jsx
│  │  └─ main.jsx
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
│
└─ backend/
   ├─ schema.sql
   ├─ pom.xml
   └─ src/
      ├─ main/
      │  ├─ java/com/safetrace/
      │  │  ├─ ai/             # AI Tool Function
      │  │  ├─ config/         # Security / JWT / WebSocket
      │  │  ├─ controller/
      │  │  ├─ domain/
      │  │  ├─ dto/
      │  │  ├─ external/       # 날씨·재난문자·대기질·대피시설 API
      │  │  ├─ mapper/
      │  │  ├─ service/
      │  │  └─ websocket/
      │  └─ resources/
      │     ├─ application.yml
      │     ├─ application-local.yml
      │     ├─ application-prod.yml
      │     └─ mappers/
      └─ test/
         └─ java/com/safetrace/service/
```

---

## 배포 구조

```text
사용자 브라우저
      ↓ HTTPS
   safetrace.kr
      ↓
     Nginx
   ├─ React 정적 파일
   ├─ /api     → Spring Boot
   ├─ /uploads → Spring Boot
   └─ /ws      → WebSocket
      ↓
Spring Boot (prod)
      ↓
   Oracle DB
```

- **Cloud**: GCP VM
- **Reverse Proxy**: Nginx
- **Domain**: `safetrace.kr`
- **HTTPS 적용**
- 운영 Backend 프로필 분리
- 운영 Frontend URL을 환경설정으로 분리해 CORS / WebSocket Origin에 공통 적용

---

## 로컬 실행 방법

### 요구 사항

- JDK 21
- Maven 3.x
- Node.js / npm
- Oracle Database
- 기능별 외부 API Key

### 1. DB 초기화

`backend/schema.sql`을 실행합니다.

```text
테이블 생성
→ 시퀀스 생성
→ 인덱스 생성
→ 배포/시연용 테스트 데이터 생성
```

### 2. Backend 설정

프로젝트는 `local`, `prod` 프로필을 분리해 사용합니다.

주요 설정값:

```text
Oracle DB 접속 정보
JWT_SECRET
GMAIL_APP_PASSWORD
공공데이터 API Key
재난안전데이터 API Key
GROQ_API_KEY
```

민감정보는 GitHub에 커밋하지 않습니다.

### 3. Backend 실행

```bash
cd backend
mvn spring-boot:run
```

로컬 기본 포트:

```text
http://localhost:8080
```

### 4. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

기본 주소:

```text
http://localhost:5173
```

Vite 개발 서버는 `/api`, `/uploads`, `/ws` 요청을 Spring Boot `8080`으로 Proxy합니다.

---

## 배포 및 테스트 계정

### Live Service

- **URL**: https://safetrace.kr
- **GitHub**: https://github.com/jiyoon6227/Safetrace

### Demo Account

`backend/schema.sql` 실행 시 아래 테스트 계정이 생성됩니다.

| 구분 | ID | PW | 용도 |
|---|---|---|---|
| **STAFF** | `staff` | `1234` | 담당자 관제·제보 검토·사건 처리 |
| **USER 1** | `user1` | `1234` | 시민 제보·관심지역·가족 안전확인 |
| **USER 2** | `user2` | `1234` | 가족 안전확인 상호 테스트 |

> `user1`과 `user2`는 테스트 데이터에서 가족 관계가 `ACCEPTED` 상태로 연결되어 있어 가족 안전확인 기능을 바로 확인할 수 있습니다.
>
> 테스트 계정은 시연용 계정이며 실제 개인정보를 사용하지 않습니다.

---

## 향후 개선

- Redis 캐싱 적용
- Resilience4j Circuit Breaker / Retry 적용
- 외부 API 장애 상황에 대한 Fallback 고도화
- WebSocket 및 대량 제보 부하 테스트
- 재난 유형별 중복 사건 탐지 거리·시간 기준 세분화
- CI/CD 자동 배포 구성

> Redis와 Resilience4j는 현재 프로젝트에 적용된 기술이 아니라 향후 개선 계획으로 분리했습니다.

---

## License

개인 포트폴리오 프로젝트