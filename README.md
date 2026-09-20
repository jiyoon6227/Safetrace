# SafeTrace

대전·세종·충청권을 중심으로 기획한 **재난·안전 제보 및 상황관리 플랫폼** 개인 프로젝트입니다.

SafeTrace는 단순히 재난 정보를 보여주는 데서 끝나지 않고, 시민 제보가 접수된 이후 **검토 → 사건 연결/생성 → 담당자 배정 → 대응 → 종료**까지의 처리 흐름을 추적할 수 있도록 구성했습니다.

---

## 1. 프로젝트 핵심

### 시민(USER)
- 회원가입 / 로그인 / 이메일 인증
- 재난·안전 현장 제보 및 사진 첨부
- 내 제보 처리 상태 확인
- 관심지역 등록 및 대표 관심지역 설정
- 가족 등록 / 수락 / 삭제
- 가족 안전확인 요청 및 응답
- 프로필 / 비밀번호 / 알림 설정 / 회원탈퇴
- 공지사항, 재난문자, 대피시설, 날씨·대기질 등 공공안전정보 조회
- AI 안전 브리핑 및 자유질문

### 담당자(STAFF)
- 관제 대시보드
- 시민 제보 검토
- 제보 검토중 / 반려 / 사건 연결 처리
- 사건 생성 및 담당자 배정
- 사건 상태 변경 및 처리 이력 관리
- 연결 제보 확인
- 공공정보 확인
- 공지사항 등록 / 수정 / 삭제
- 통계·보고 화면 확인

> 권한은 `USER`, `STAFF` 두 종류를 사용합니다.

---

## 2. 주요 처리 흐름

```text
시민 제보
   ↓
RECEIVED
   ↓
담당자 검토
   ↓
REVIEWING
   ├─ 기존 사건 연결 → LINKED
   ├─ 신규 사건 생성 → LINKED
   └─ 반려 → REJECTED

사건
   ↓
담당자 배정
   ↓
상태 변경 및 처리 이력 저장
   ↓
종료
```

서버에서 허용된 상태 전이와 담당자 권한을 검증하며, 제보 처리 UPDATE에도 현재 상태 조건을 적용해 잘못된 중복 처리를 방지합니다.

---

## 3. 주요 기능

### 인증 / 회원
- Spring Security + JWT 인증
- USER / STAFF 권한 분리
- 이메일 인증코드 기반 회원가입
- 비밀번호 변경 및 재설정
- 이메일 인증 상태 재사용 방지
- 회원탈퇴(Soft Delete)
- 탈퇴 회원의 로그인 아이디 재사용 가능
  - 활성 회원만 대상으로 하는 Oracle 함수 기반 UNIQUE INDEX 적용
- JWT 만료 / 무효 토큰 처리

### 시민 제보 / 사건 관리
- 현장 제보 등록
- 다중 사진 업로드
- 위도·경도 및 주소 저장
- 거리 기반 주변 사건 조회
- 제보 검토 / 반려 / 사건 연결
- 사건 생성 및 담당 STAFF 배정
- 사건 상태 변경 및 처리 이력 관리
- 종료 사건 관리
- 동일 제보의 중복 처리 방지

### 실시간 처리
- WebSocket 기반 실시간 갱신
- 사건 상태 변경
- 제보 상태 변경
- 가족 안전확인 요청 / 응답
- WebSocket Handshake 시 JWT 검증
- 연결 종료 시 자동 재연결 처리

### 가족 안전확인
- 가족 등록 요청 / 수락 / 삭제
- `ACCEPTED` 상태의 가족에게만 안전확인 요청 가능
- 로그인 상태에서 안전확인 응답
- 이메일 링크 토큰으로 비로그인 응답 가능
- 토큰 만료 및 재사용 방지
- 탈퇴 회원은 현재 가족 목록에서 제외
- 가족 검색 API 응답을 전용 DTO로 제한해 불필요한 개인정보 노출 최소화

### 관심지역 / 알림
- 관심지역 다중 등록
- 회원당 대표 관심지역 1개 제한
- 관심지역 기반 재난 알림
- 내 제보 상태 변경 알림
- 알림 조회 / 삭제
- 탈퇴 회원에게 신규 알림 생성 방지

### 공공 안전정보
공공 API를 이용해 실제 데이터를 조회합니다.

- 기상청 현재 날씨
- 기상특보
- 대기질
- 자외선 지수
- 민방위 대피시설
- 전국 / 지역별 재난문자
- 기간별 재난문자 조회

### AI 안전 도우미
Groq API를 이용합니다.

- 현재 위치 기반 AI 안전 브리핑
- 날씨 + 주변 진행 사건 + 재난문자 + 대피시설 정보를 종합해 요약
- 자유질문
- 필요한 경우 SafeTrace 내부 데이터와 공공안전 데이터를 조회해 답변
- 서버 단위 일일 토큰 사용량 안전 한도 적용

### 공지사항
- 비로그인 사용자 포함 조회 가능
- STAFF 등록 / 수정 / 삭제
- 공지 유형
  - 일반
  - 긴급
  - 점검
- 상단 고정
- 조회수
- 이미지 첨부

---

## 4. 기술 스택

### Backend
- Java 21
- Spring Boot 3.3.4
- Spring Security
- JWT (`jjwt 0.12.6`)
- MyBatis
- Oracle DB
- WebSocket
- Spring Mail
- Bean Validation
- Lombok
- JUnit 5
- Mockito

### Frontend
- React 19
- JavaScript
- Vite 8
- Tailwind CSS 4
- lucide-react

### External / Open API
- 공공데이터포털
- 기상청
- 에어코리아
- 재난문자 / 민방위 대피시설 관련 공공데이터
- Groq API

---

## 5. 프로젝트 구조

```text
safe/
├─ frontend/
│  ├─ src/
│  │  ├─ api/
│  │  │  ├─ client.js
│  │  │  └─ socket.js
│  │  ├─ components/
│  │  ├─ data/
│  │  ├─ hooks/
│  │  ├─ pages/
│  │  │  ├─ ControlBoard/
│  │  │  ├─ MyPage/
│  │  │  ├─ LoginPage.jsx
│  │  │  ├─ NoticePage.jsx
│  │  │  ├─ PublicDisasterPage.jsx
│  │  │  ├─ ReportForm.jsx
│  │  │  ├─ ReportPage.jsx
│  │  │  ├─ SafetyCheckResponsePage.jsx
│  │  │  ├─ SafetyGuidePage.jsx
│  │  │  ├─ SafetyMapPage.jsx
│  │  │  ├─ SearchPage.jsx
│  │  │  └─ ShelterPage.jsx
│  │  ├─ MainPage.jsx
│  │  ├─ main.jsx
│  │  └─ index.css
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
│
└─ backend/
   ├─ pom.xml
   ├─ application.yml.example
   ├─ schema.sql
   ├─ 백엔드_실행가이드.md
   └─ src/
      ├─ main/
      │  ├─ java/com/safetrace/
      │  │  ├─ ai/
      │  │  ├─ config/
      │  │  ├─ controller/
      │  │  ├─ domain/
      │  │  ├─ dto/
      │  │  ├─ external/
      │  │  ├─ mapper/
      │  │  ├─ service/
      │  │  ├─ util/
      │  │  └─ websocket/
      │  └─ resources/
      │     └─ mappers/
      └─ test/
         └─ java/com/safetrace/service/
            ├─ IncidentServiceTest.java
            ├─ MemberServiceTest.java
            └─ ReportServiceTest.java
```

---

## 6. 로컬 실행

### 6-1. Oracle DB 준비

`backend/schema.sql`을 실행해 테이블, 시퀀스, 인덱스 및 테스트 데이터를 생성합니다.

### 6-2. Backend 설정

`backend/application.yml.example`을 참고해 로컬의 `backend/application.yml`을 작성합니다.

주요 설정값:
- Oracle DB 접속 정보
- JWT Secret
- Gmail / SMTP 정보
- 공공데이터 API Key
- Groq API Key

실제 `backend/application.yml`은 `.gitignore`에 포함되어 GitHub에 업로드되지 않도록 관리합니다.

### 6-3. Backend 실행

```bash
cd backend
mvn spring-boot:run
```

기본 포트:

```text
http://localhost:8080
```

### 6-4. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

기본 주소:

```text
http://localhost:5173
```

개발 환경에서는 Vite Proxy가 `/api`, `/uploads` 요청을 Spring Boot `8080`으로 전달합니다.

---

## 7. 테스트

JUnit 5와 Mockito를 이용해 핵심 비즈니스 로직에 대한 단위 테스트를 작성했습니다.

### 테스트 항목
- 사건 상태 전이 규칙 검증
  - 허용되지 않은 단계 건너뛰기 방지
  - 사건 종료 시 조치내역 필수 검증
- 회원가입 / 비밀번호 재설정 시 이메일 인증 상태 검증
- 동일 제보를 여러 담당자가 동시에 처리할 때 중복 연결 방지

실행:

```bash
cd backend
mvn clean test
```

현재 테스트 결과:

```text
Tests run: 6
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

---

## 8. 빌드

### Frontend

```bash
cd frontend
npm run build
```

성공 시:

```text
frontend/dist/
```

생성

### Backend

```bash
cd backend
mvn clean package
```

성공 시:

```text
backend/target/safetrace-backend-0.0.1-SNAPSHOT.jar
```

생성

---

## 9. 보안 / 데이터 정합성 처리

- 실제 `application.yml` Git 추적 제외
- Maven UTF-8 인코딩 명시
- JWT 기반 REST API 인증
- WebSocket Handshake JWT 검증
- USER / STAFF 권한 분리
- 탈퇴 회원 접근 차단
- 활성 회원 기준 로그인 아이디 유일성 보장
- 이메일 인증 성공 상태 재사용 방지
- 가족 검색 API 응답 데이터 최소화
- 가족 안전확인 대상 서버 검증
- 담당자 배정 시 활성 STAFF 여부 서버 검증
- 사건 상태 전이 서버 검증
- 사건 종료 시 조치내역 필수 검증
- 제보 UPDATE 쿼리에 상태 조건 적용
- 회원당 대표 관심지역 1개 DB 레벨 보장

---

## 10. 현재 상태

### 완료
- 핵심 USER / STAFF 기능
- 인증 / 권한
- 제보 / 사건 Workflow
- 가족 안전확인
- 관심지역 / 알림
- WebSocket 실시간 반영
- 공공데이터 연동
- AI 안전 브리핑 / 자유질문
- 공지사항
- JUnit / Mockito 핵심 로직 테스트
- 프론트 Production Build 성공
- 백엔드 Maven Package 성공

### 실제 배포 시 추가 예정
- GCP VM 배포
- 실제 외부 IP / 도메인 확정 후 CORS 설정
- HTTPS 적용
- WebSocket `wss://` 배포 환경 대응
- Reverse Proxy 설정

### 현재 미적용
- Redis 캐싱
- Resilience4j Circuit Breaker

---

## 11. 프로젝트 차별점

기존의 단순 재난정보 조회 서비스와 달리 SafeTrace는 **시민 제보 이후의 대응 과정 자체를 추적**하는 데 초점을 두었습니다.

```text
공공 안전정보
     +
시민 현장 제보
     +
담당자 대응 Workflow
     +
가족 안전확인
     +
실시간 상태 반영
     +
AI 안전 도우미
```

이를 하나의 서비스 안에서 연결해 시민은 자신의 제보가 어떻게 처리되고 있는지 확인하고, 담당자는 제보를 실제 사건 단위로 관리할 수 있도록 구현했습니다.
