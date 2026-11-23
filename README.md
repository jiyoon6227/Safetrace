# SafeTrace

**재난·안전 제보 및 상황관리 플랫폼** 개인 프로젝트입니다.

SafeTrace는 단순히 재난 정보를 보여주는 데서 끝나지 않고, 시민 제보가 접수된 이후 **검토 → 사건 연결/생성 → 담당자 배정 → 대응 → 종료**까지의 처리 흐름을 추적할 수 있도록 구성했습니다. 대응에 필요한 장비·물품의 **요청 → 승인 → 출고 → 반납·정산**도 사건과 연결해 관리합니다.

| 항목 | 내용 |
|---|---|
| **프로젝트&nbsp;유형** | 개인 프로젝트 (기획 · 설계 · 개발 · 배포) |
| **개발&nbsp;기간** | 2026.09 ~ 2026.11 |
| **개발&nbsp;인원** | 1명 |
| **GitHub** | https://github.com/jiyoon6227/Safetrace |

---

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [테스트 계정](#테스트-계정)
- [주요 기능](#주요-기능)
- [핵심 처리 흐름](#핵심-처리-흐름)
- [보안 및 데이터 정합성](#보안-및-데이터-정합성)
- [기술 스택](#기술-스택)
- [외부 연동 API](#외부-연동-api)
- [테스트](#테스트)
- [프로젝트 구조](#프로젝트-구조)
- [배포 구조](#배포-구조)
- [로컬 실행 방법](#로컬-실행-방법)
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
- **STAFF(담당자)** — 제보 검토, 사건 연결/생성, 담당자 배정, 상태 변경 및 처리 이력 관리, 자원 요청·반납 신청
- **ADMIN(자원 관리자)** — 자원 요청 승인·반려·출고, 반납 확인·손실 확정, 재고·품목 관리

> 권한은 `USER`, `STAFF`, `ADMIN` 세 종류를 사용합니다.

---

## 테스트 계정

### Demo Account

`backend/schema.sql` 실행 시 아래 테스트 계정이 생성됩니다.

| 구분 | ID | PW | 용도 |
|---|---|---|---|
| **STAFF** | `staff` | `1234` | 담당자 관제·제보 검토·사건 처리 |
| **STAFF(부서별)** | `fire_staff` · `road_staff` · `health_staff` | `1234` | 소방본부·도로관리과·보건소 담당자 (자원 요청) |
| **ADMIN** | `admin` | `1234` | 자원 요청 승인·출고, 반납 확인, 재고 관리 |
| **USER&nbsp;1** | `user1` | `1234` | 시민 제보·관심지역·가족 안전확인 |
| **USER&nbsp;2** | `user2` | `1234` | 가족 안전확인 상호 테스트 |

> `user1`과 `user2`는 테스트 데이터에서 가족 관계가 `ACCEPTED` 상태로 연결되어 있어 가족 안전확인 기능을 바로 확인할 수 있습니다.
>
> 테스트 계정은 시연용 계정이며 실제 개인정보를 사용하지 않습니다.

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
- 재난 유형별 행동요령 조회
- 통합 검색 (재난정보 · 대피시설 · 행동요령 · 공지사항)

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

#### 자원 요청 및 반납
- 사건에서 자원 요청 / 요청 취소
- 출고 후 도착 확인, 반납 신청
- 사건 종료 전, 함께 정리될 출고 전 요청을 미리 확인
- 요청 처리 이력 타임라인 조회

### 관리자(ADMIN)

#### 자원 요청 처리
- 요청 승인(가용 재고 예약) / 반려(사유 필수)
- 출고 처리 — 반납형 장비와 소모품을 구분해 재고에 반영
- 반납 확인 / 반려, 분실·파손 수량 손실 확정

#### 재고 관리
- 품목·재고 등록 및 수정, 입고·수량 조정, 사용 중지 / 재사용
- 재고·품목 변경 이력 조회

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

```text
Report A ─┐
Report B ─┼── Incident
Report C ─┘
```

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

### 4. 자원 요청 → 출고 → 반납

```text
STAFF 자원 요청 (REQUESTED)
        ↓
ADMIN 승인 (APPROVED, 가용 재고 예약)   ※ 반려 시 REJECTED, 사유 필수
        ↓
ADMIN 출고
   ├─ 소모품  → COMPLETED (총보유량 차감)
   └─ 반납형  → DISPATCHED
                  ↓
              도착 확인 → STAFF 반납 신청
                  ↓
              ADMIN 반납 확인 (재고 복구) / 손실 확정
                  ↓
              남은 수량이 모두 처리되면 SETTLED
```

- 출고 전에는 요청을 취소할 수 있고, 승인 후 취소하면 예약한 재고가 복구됩니다.
- 사건을 종료하면 출고 전 요청이 함께 취소됩니다. 담당자가 화면에서 확인한 목록과 서버의 목록이 다르면(그 사이 새 요청이 생긴 경우 등) 409로 거절합니다.
- 이미 출고된 자원은 사건이 종료돼도 반납·손실 처리를 이어갈 수 있습니다.

---

## 보안 및 데이터 정합성

### 인증 / 인가
- BCrypt 비밀번호 암호화
- Spring Security + JWT 인증
- `USER` / `STAFF` / `ADMIN` 권한 분리
- `@EnableMethodSecurity` 기반 STAFF·ADMIN 전용 API 접근제어
- 자원 처리 시 역할을 토큰이 아닌 DB의 현재 값으로 재확인 (탈퇴·권한 변경 직후의 오래된 토큰 방어)
- REST API 무효 인증 요청에 HTTP 401 반환
- JWT 인증 후 발급받은 1회용 티켓(30초 유효)으로 WebSocket 연결 검증
- Local / Production 허용 Origin 분리

### 데이터 정합성
- 회원탈퇴 Soft Delete
- 활성 회원 사이에서만 LOGIN_ID 중복을 막는 Oracle 함수 기반 UNIQUE INDEX
- 회원당 대표 관심지역 1개를 DB UNIQUE INDEX로 보장
- 제보 처리 UPDATE에 현재 상태 조건 적용
- 사건 상태 전이 규칙 서버 검증
- 트랜잭션 커밋 이후 WebSocket 이벤트 전송
- 가족 안전확인 요청 대상 서버 검증
- 이메일 응답 토큰 만료 및 재사용 방지
- AI API 일일 토큰 사용량 안전한도 적용
- 자원 요청 상태 전이를 서버에서 검증하고, 재고 행 잠금 · 조건부 UPDATE · DB `CHECK` 제약으로 재고 정합성 보장 (상태·재고·이력은 한 트랜잭션, 삭제 대신 사용 중지와 이력으로 관리)

---

## 기술 스택

| 분류 | 기술 |
|---|---|
| **Language** | Java 21, JavaScript |
| **Backend** | Spring Boot 3.5.16, Spring Security, JWT, MyBatis, WebSocket |
| **Frontend** | React, Vite, Tailwind CSS, lucide-react |
| **Database** | Oracle DB |
| **Build&nbsp;/&nbsp;Test** | Maven, JUnit 5, Mockito, Vitest |
| **Infra** | GCP VM, Nginx, HTTPS |
| **Mail** | Spring Mail, Gmail SMTP |
| **AI** | Groq API |
| **Map** | Kakao Maps JavaScript SDK |

---

## 외부 연동 API

| API | 용도 |
|---|---|
| **행정안전부&nbsp;재난안전데이터공유플랫폼** | 전국·지역별 긴급재난문자 및 기간별 재난문자 조회 |
| **기상청&nbsp;단기예보&nbsp;/&nbsp;특보&nbsp;API** | 현재 날씨 및 기상특보 조회 |
| **기상청&nbsp;생활기상지수&nbsp;API** | 자외선 지수 조회 |
| **AirKorea** | 미세먼지·초미세먼지 등 대기질 조회 (서버 10분 캐시, 조회 실패 시 직전 조회값 사용) |
| **민방위&nbsp;대피시설&nbsp;공공데이터** | 지역·현재 위치 기반 대피시설 조회 (구 단위 조회 결과를 서버에서 6시간 캐시, 갱신 실패 시 이전 결과 사용) |
| **Kakao&nbsp;Maps** | 사건·대피시설 지도 표시, 주소↔좌표 변환, MarkerClusterer |
| **Daum&nbsp;Postcode** | 주소 검색 |
| **Groq&nbsp;API** | 공공안전정보 + 내부 사건 데이터를 결합한 AI 안전 브리핑 및 질의응답 |
| **Gmail&nbsp;SMTP** | 이메일 인증 및 가족 안전확인 링크 발송 |

> API Key, JWT Secret, DB 접속 비밀번호, Gmail 앱 비밀번호 등 민감정보는 환경변수 또는 Git 추적 제외 설정파일로 관리합니다.

---

## 테스트

JUnit 5와 Mockito로 핵심 비즈니스 로직과 권한을 검증하고, 재고 동시성은 실제 Oracle에 붙는 통합 테스트로 확인합니다.

### 주요 테스트 대상
- 사건 상태 전이 규칙, 허용되지 않은 단계 건너뛰기 차단, 사건 종료 시 처리내역 검증
- 회원가입 / 비밀번호 재설정 이메일 인증 상태 검증
- 동일 제보 중복 처리 방지
- 담당자가 아닌 STAFF의 사건 상태 변경 · 정보 수정 · 현장 사진 추가 차단
- 반경 500m 안의 같은 유형 사건만 중복 후보로 포함
- 제보 사진은 작성자 본인과 STAFF만 열람 가능
- 이미 응답한 안전확인 요청에 다시 응답 불가 (사이트 · 이메일 링크 모두)
- 안전확인 요청 저장이 실패하면 메일 · 알림을 보내지 않음
- 두 지점 사이 거리 계산(GeoUtils)
- 자원 요청의 승인 · 출고 · 반납 · 손실 처리 규칙과 수량 계산
- 자원 관리 API의 역할별 접근 제어 (비로그인 · USER · STAFF · ADMIN)
- 통계 집계 (기간 · 지역 · 유형 조건)

### Oracle 통합 테스트
- 가용 재고보다 많은 요청을 동시에 승인해도 허용된 만큼만 승인되는지
- 같은 요청의 동시 승인 · 출고 · 반납 확인이 한 번만 반영되는지
- 사건 종료와 새 요청 생성이 겹쳐도 한쪽만 성공하는지
- 처리 도중 실패하면 요청 · 재고 · 사건 상태가 모두 되돌아가는지
- 커밋 뒤 WebSocket 전송이 실패해도 DB 결과가 유지되는지

개발 DB를 건드리지 않도록 `SAFETRACE_TEST_DB_PASSWORD`가 없으면 건너뛰고, 접속 계정 이름이 `_TEST`로 끝나지 않으면 시작하지 않습니다.

```bash
cd backend
mvn clean test
```

프론트는 재난문자 지역 매칭 로직(`utils/disasterRegion.js`)과 자원 관리 화면의 상수·입력 검증(`constants/resource.js`)을 Vitest로 검증합니다.

```bash
cd frontend
npm test
```

---

## 프로젝트 구조

```text
safe/
├─ frontend/
│  ├─ src/
│  │  ├─ api/                  # REST / WebSocket 클라이언트
│  │  ├─ components/
│  │  ├─ constants/            # 상태·유형·자원 관련 상수
│  │  ├─ data/                 # 재난 유형별 행동요령(safetyGuides.json)
│  │  ├─ hooks/
│  │  ├─ pages/
│  │  │  ├─ Admin/             # ADMIN 자원·재고 관리 화면
│  │  │  ├─ ControlBoard/      # STAFF 관제 화면 (자원 요청 포함)
│  │  │  ├─ Main/             # 메인 화면 영역별 컴포넌트
│  │  │  ├─ MyPage/
│  │  │  ├─ ReportForm.jsx
│  │  │  ├─ ReportPage.jsx
│  │  │  ├─ SafetyCheckResponsePage.jsx
│  │  │  ├─ SafetyMapPage.jsx
│  │  │  ├─ ShelterPage.jsx
│  │  │  └─ NoticePage.jsx
│  │  ├─ utils/                # 공통 함수 (재난문자 지역 매칭, 대피시설 조회·캐시 등)
│  │  ├─ MainPage.jsx
│  │  └─ main.jsx
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
│
└─ backend/
   ├─ schema.sql
   ├─ application.yml.example
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
      │  │  ├─ util/
      │  │  └─ websocket/
      │  └─ resources/
      │     ├─ application.yml          # Git 제외
      │     ├─ application-local.yml    # Git 제외
      │     ├─ application-prod.yml     # Git 제외
      │     └─ mappers/
      └─ test/
         └─ java/com/safetrace/
            ├─ config/
            ├─ controller/
            ├─ oracle/          # 실제 Oracle 통합 테스트
            ├─ service/
            ├─ util/
            └─ websocket/
```

---

## 배포 구조

GCP VM에 배포해 운영했던 구성입니다. 현재는 운영을 중단한 상태입니다.

```text
사용자 브라우저
      ↓ HTTPS
   운영 도메인
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

- **Cloud**: GCP Compute Engine Windows VM
- **Reverse Proxy**: Nginx (`/api`, `/uploads`, `/ws` → `127.0.0.1:8081`)
- **Database**: Oracle XE (`10.178.0.2:1521/xe`, GCP VM 내부 사설 IP)
- **HTTPS 적용**
- 운영 Backend 프로필(`prod`) 분리
- 운영 Frontend URL을 환경설정으로 관리해 CORS / WebSocket Origin에 공통 적용
- 외부 IP가 변경되어도 Nginx의 `127.0.0.1:8081`과 DB 내부 IP `10.178.0.2`는 수정하지 않습니다.

### 운영 설정

운영 환경에서는 프로필을 분리해 사용했습니다.

| 파일 | 내용 |
|---|---|
| `application.yml` | 공통 설정 (메일 · MyBatis · JWT · 외부 API) |
| `application-local.yml` | 로컬 DB · 포트 · 프론트 주소(`http://localhost:5173`) |
| `application-prod.yml` | 운영 DB · 포트 · 프론트 주소(운영 도메인) |

운영 DB는 같은 GCP VM의 Oracle XE에 내부 IP로 연결합니다.

```yaml
server:
  port: 8081

spring:
  datasource:
    url: jdbc:oracle:thin:@//10.178.0.2:1521/xe

app:
  frontend-base-url: https://your-domain.com
```

> `JWT_SECRET`, `GMAIL_APP_PASSWORD`, `GROQ_API_KEY`는 서버 환경변수로 주입하며, 실제 설정 파일은 Git에 커밋하지 않습니다.

---

## 로컬 실행 방법

### 요구 사항

- JDK 21
- Maven 3.x
- Node.js / npm
- Oracle Database (XE 기준, `localhost:1521`)
- 기능별 외부 API Key (선택)

### 1. DB 초기화

`backend/schema.sql`을 실행합니다. **기존 `SF_` 테이블 · 시퀀스를 삭제한 뒤 다시 생성하므로, 데이터가 없는 별도 테스트용 DB(계정)에서만 실행하세요.**

```text
테이블 생성
→ 시퀀스 생성
→ 인덱스 생성
→ 배포/시연용 테스트 데이터 생성
```

> 테스트 데이터의 시각은 실행 시점 기준(예: 40분 전)으로 들어가므로, 시연 전에 다시 실행하면 대시보드의 "오늘" 집계가 채워진 상태로 확인할 수 있습니다.

### 2. Backend 설정

`backend/application.yml.example`을 `backend/src/main/resources/application.yml`로 복사한 뒤 값을 채웁니다.
로컬에서는 이 파일 하나로 실행하며 환경변수는 필요 없습니다.

| 설정 | 구분 | 설명 |
|---|---|---|
| `spring.datasource` (url · username · password) | **필수** | 1단계에서 `schema.sql`을 실행한 DB 접속 정보 (기본 주소 `jdbc:oracle:thin:@localhost:1521:xe`) |
| `jwt.secret` | **필수** | 32바이트 이상의 임의 문자열 |
| `publicdata` · `safetydata` 서비스 키 | 선택 | 날씨 · 대기질 · 대피시설 · 재난문자 조회 |
| `groq.api-key` | 선택 | AI 안전 브리핑 · 질문 |
| `spring.mail` (Gmail 앱 비밀번호) | 선택 | 이메일 인증 · 가족 안전확인 메일 발송 |

> 선택 값은 해당 기능에만 필요합니다. 회원가입은 이메일 인증이 필요하므로, 메일 설정 없이 확인할 때는 [테스트 계정](#테스트-계정)으로 로그인하세요.
>
> 실제 `application.yml`은 Git에 커밋하지 않습니다.

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

> 지도는 `frontend/index.html`에 들어 있는 Kakao Maps JavaScript 키로 불러옵니다. 다른 환경에서 실행하려면 본인 키로 바꾸고, 카카오 개발자 콘솔에 실행 도메인을 등록해야 합니다.

---

## 향후 개선

- Redis 캐싱 적용
- Resilience4j Circuit Breaker / Retry 적용
- 외부 API 장애 상황에 대한 Fallback 고도화
- WebSocket 및 대량 제보 부하 테스트
- 재난 유형별 중복 사건 탐지 거리·시간 기준 세분화
- CI/CD 자동 배포 구성

---

## License

개인 포트폴리오 프로젝트