-- ============================================
-- SafeTrace DB 전체 초기화 + 계정 + 테스트 데이터
-- 이 파일 전체를 통째로 선택해서 한 번에 실행(F5)하면 끝.
-- Postman 필요 없음 - 비밀번호는 미리 암호화해서 넣어놨음.
-- PK는 IDENTITY가 아닌 SEQUENCE 방식으로 채번함.
-- ============================================

-- 1. 기존 테이블/시퀀스 전부 삭제 (재실행 시 충돌 방지, FK 있는 테이블부터 역순으로 삭제)
DROP TABLE SF_NOTIFICATION CASCADE CONSTRAINTS;
DROP TABLE SF_SAFETY_CHECK CASCADE CONSTRAINTS;
DROP TABLE SF_FAMILY_RELATION CASCADE CONSTRAINTS;
DROP TABLE SF_MEMBER_REGION CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT_LOG CASCADE CONSTRAINTS;
DROP TABLE SF_REPORT CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT CASCADE CONSTRAINTS;
DROP TABLE SF_MEMBER CASCADE CONSTRAINTS;

DROP SEQUENCE SEQ_SF_MEMBER;
DROP SEQUENCE SEQ_SF_MEMBER_REGION;
DROP SEQUENCE SEQ_SF_INCIDENT;
DROP SEQUENCE SEQ_SF_INCIDENT_LOG;
DROP SEQUENCE SEQ_SF_REPORT;
DROP SEQUENCE SEQ_SF_FAMILY_RELATION;
DROP SEQUENCE SEQ_SF_SAFETY_CHECK;
DROP SEQUENCE SEQ_SF_NOTIFICATION;

-- 2. 회원 테이블============================================
--    시민(USER)과 담당 직원(STAFF)을 같은 테이블에서 ROLE로 구분
--    마이페이지(내 정보관리/알림설정/탈퇴)용 컬럼까지 포함
CREATE TABLE SF_MEMBER (
    MEMBER_ID                 NUMBER          PRIMARY KEY,        -- 회원 PK (SEQ_SF_MEMBER로 채번)
    LOGIN_ID                  VARCHAR2(50)    NOT NULL UNIQUE,    -- 로그인 아이디, 중복 불가
    PASSWORD                  VARCHAR2(200)   NOT NULL,           -- BCrypt 등으로 암호화된 비밀번호
    NAME                      VARCHAR2(50)    NOT NULL,           -- 회원 이름
    EMAIL                     VARCHAR2(100),                      -- 안전확인 메일 발송용 이메일
    PHONE                     VARCHAR2(20),                       -- 전화번호
    PROFILE_IMAGE_URL         VARCHAR2(500),                      -- 프로필 이미지 경로
    ADDRESS                   VARCHAR2(200),                      -- 주소 (시/군/구 수준, 배송 등 실사용 목적 아님)
    ADDRESS_DETAIL            VARCHAR2(200),                      -- 상세주소
    ROLE                      VARCHAR2(20)    DEFAULT 'USER' NOT NULL,  -- 권한 구분: USER(시민) / STAFF(담당 직원) / ADMIN(관리자)
    EMAIL_NOTIFY_ENABLED      CHAR(1)         DEFAULT 'Y' NOT NULL,  -- 가족 안전확인 이메일 알림 수신 여부 (Y/N)
    DISASTER_NOTIFY_ENABLED   CHAR(1)         DEFAULT 'Y' NOT NULL,  -- 관심지역 재난 알림 수신 여부 (Y/N)
    REPORT_NOTIFY_ENABLED     CHAR(1)         DEFAULT 'Y' NOT NULL,  -- 내 제보 상태변경 알림 수신 여부 (Y/N)
    IS_WITHDRAWN              CHAR(1)         DEFAULT 'N' NOT NULL,  -- 탈퇴 여부 (Y/N) - 소프트 삭제, 실제 행은 안 지움
    WITHDRAWN_AT               TIMESTAMP,                          -- 탈퇴 처리 일시 (미탈퇴 시 NULL)
    CREATED_AT                TIMESTAMP       DEFAULT SYSTIMESTAMP  -- 가입일시
);

COMMENT ON TABLE SF_MEMBER IS '회원 (시민 USER / 담당직원 STAFF / 관리자 ADMIN 통합 테이블)';
COMMENT ON COLUMN SF_MEMBER.MEMBER_ID IS '회원 PK (SEQ_SF_MEMBER로 채번)';
COMMENT ON COLUMN SF_MEMBER.LOGIN_ID IS '로그인 아이디, 중복 불가';
COMMENT ON COLUMN SF_MEMBER.PASSWORD IS 'BCrypt 등으로 암호화된 비밀번호';
COMMENT ON COLUMN SF_MEMBER.NAME IS '회원 이름';
COMMENT ON COLUMN SF_MEMBER.EMAIL IS '안전확인 메일 발송용 이메일';
COMMENT ON COLUMN SF_MEMBER.PHONE IS '전화번호';
COMMENT ON COLUMN SF_MEMBER.PROFILE_IMAGE_URL IS '프로필 이미지 경로';
COMMENT ON COLUMN SF_MEMBER.ADDRESS IS '주소 (시/군/구 수준, 배송 등 실사용 목적 아님)';
COMMENT ON COLUMN SF_MEMBER.ADDRESS_DETAIL IS '상세주소';
COMMENT ON COLUMN SF_MEMBER.ROLE IS '권한 구분: USER(시민) / STAFF(담당 직원) / ADMIN(관리자)';
COMMENT ON COLUMN SF_MEMBER.EMAIL_NOTIFY_ENABLED IS '가족 안전확인 이메일 알림 수신 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER.DISASTER_NOTIFY_ENABLED IS '관심지역 재난 알림 수신 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER.REPORT_NOTIFY_ENABLED IS '내 제보 상태변경 알림 수신 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER.IS_WITHDRAWN IS '탈퇴 여부 (Y/N) - 소프트 삭제, 실제 행은 안 지움';
COMMENT ON COLUMN SF_MEMBER.WITHDRAWN_AT IS '탈퇴 처리 일시 (미탈퇴 시 NULL)';
COMMENT ON COLUMN SF_MEMBER.CREATED_AT IS '가입일시';

-- 2-1. 회원 관심지역 테이블============================================
--      회원 한 명이 관심지역을 여러 개 등록할 수 있도록 별도 테이블로 분리
--      (공공정보 탭의 기상특보 연동, 재난 알림 필터링에 사용 예정)
CREATE TABLE SF_MEMBER_REGION (
    MEMBER_REGION_ID  NUMBER          PRIMARY KEY,  -- 관심지역 PK (SEQ_SF_MEMBER_REGION으로 채번)
    MEMBER_ID         NUMBER          NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 회원 FK
    REGION_CODE       VARCHAR2(20),                 -- 지역 코드 (공공 API 연동 시 사용, 당장은 NULL 가능)
    REGION_NAME       VARCHAR2(100)   NOT NULL,     -- 지역명/주소 (예: 대전광역시 유성구 어은동 123-4)
    LATITUDE          NUMBER(10,6),                 -- 위도 (지도 마커, 날씨/대기질 조회용)
    LONGITUDE         NUMBER(10,6),                 -- 경도 (지도 마커, 날씨/대기질 조회용)
    REGION_LABEL      VARCHAR2(20)    DEFAULT '관심지역' NOT NULL,  -- 라벨: 우리집/가족보호/관심지역 (자유 텍스트)
    IS_PRIMARY        CHAR(1)         DEFAULT 'N' NOT NULL,  -- 대표 관심지역 여부 (Y/N)
    CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP  -- 등록일시
);

COMMENT ON TABLE SF_MEMBER_REGION IS '회원 관심지역 - 한 회원이 여러 지역을 등록 가능';
COMMENT ON COLUMN SF_MEMBER_REGION.MEMBER_REGION_ID IS '관심지역 PK (SEQ_SF_MEMBER_REGION으로 채번)';
COMMENT ON COLUMN SF_MEMBER_REGION.MEMBER_ID IS '회원 FK';
COMMENT ON COLUMN SF_MEMBER_REGION.REGION_CODE IS '지역 코드 (공공 API 연동 시 사용, 당장은 NULL 가능)';
COMMENT ON COLUMN SF_MEMBER_REGION.REGION_NAME IS '지역명/주소 (예: 대전광역시 유성구 어은동 123-4)';
COMMENT ON COLUMN SF_MEMBER_REGION.LATITUDE IS '위도 (지도 마커, 날씨/대기질 조회용)';
COMMENT ON COLUMN SF_MEMBER_REGION.LONGITUDE IS '경도 (지도 마커, 날씨/대기질 조회용)';
COMMENT ON COLUMN SF_MEMBER_REGION.REGION_LABEL IS '라벨: 우리집/가족보호/관심지역 (자유 텍스트)';
COMMENT ON COLUMN SF_MEMBER_REGION.IS_PRIMARY IS '대표 관심지역 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER_REGION.CREATED_AT IS '등록일시';

-- 3. 사건(재난) 테이블============================================
--    시민 제보가 병합/승격되어 만들어지거나, 담당자가 직접 생성하는 실제 대응 대상
CREATE TABLE SF_INCIDENT (
    INCIDENT_ID       NUMBER          PRIMARY KEY,  -- 사건 PK (SEQ_SF_INCIDENT로 채번)
    TITLE             VARCHAR2(200)   NOT NULL,  -- 사건 제목
    DISASTER_TYPE     VARCHAR2(30)    NOT NULL,  -- 재난 유형 (예: 침수, 화재, 산사태)
    SEVERITY          VARCHAR2(10)    NOT NULL,  -- 심각도 (예: LOW, MEDIUM, HIGH)
    STATUS            VARCHAR2(20)    DEFAULT 'RECEIVED',  -- 진행 상태 (접수→확인중→대응중→수습중→종료 등)
    REGION            VARCHAR2(100)   NOT NULL,  -- 발생 지역명
    LATITUDE          NUMBER(10,6),              -- 위도 (지도 표시용)
    LONGITUDE         NUMBER(10,6),              -- 경도 (지도 표시용)
    PHOTO_URL         VARCHAR2(500),             -- 현장 사진 (STAFF가 직접 등록할 때 선택 첨부, 제보 기반이면 NULL일 수 있음)
    ASSIGNED_STAFF_ID  NUMBER          REFERENCES SF_MEMBER(MEMBER_ID),  -- 담당 직원 FK (미배정 시 NULL)
    CLOSE_REASON      VARCHAR2(500),             -- 종료 사유 (STATUS='CLOSED'일 때 기록)
    CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP,  -- 사건 생성일시
    UPDATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP   -- 최종 수정일시
);

COMMENT ON TABLE SF_INCIDENT IS '사건(재난) - 제보가 병합/승격되거나 담당자가 직접 생성하는 실제 대응 대상';
COMMENT ON COLUMN SF_INCIDENT.INCIDENT_ID IS '사건 PK (SEQ_SF_INCIDENT로 채번)';
COMMENT ON COLUMN SF_INCIDENT.TITLE IS '사건 제목';
COMMENT ON COLUMN SF_INCIDENT.DISASTER_TYPE IS '재난 유형 (예: 침수, 화재, 산사태)';
COMMENT ON COLUMN SF_INCIDENT.SEVERITY IS '심각도 (예: LOW, MEDIUM, HIGH)';
COMMENT ON COLUMN SF_INCIDENT.STATUS IS '진행 상태 (접수→확인중→대응중→수습중→종료 등)';
COMMENT ON COLUMN SF_INCIDENT.REGION IS '발생 지역명';
COMMENT ON COLUMN SF_INCIDENT.LATITUDE IS '위도 (지도 표시용)';
COMMENT ON COLUMN SF_INCIDENT.LONGITUDE IS '경도 (지도 표시용)';
COMMENT ON COLUMN SF_INCIDENT.PHOTO_URL IS '현장 사진 (STAFF가 직접 등록할 때 선택 첨부)';
COMMENT ON COLUMN SF_INCIDENT.ASSIGNED_STAFF_ID IS '담당 직원 FK (미배정 시 NULL)';
COMMENT ON COLUMN SF_INCIDENT.CLOSE_REASON IS '종료 사유 (STATUS=CLOSED일 때 기록)';
COMMENT ON COLUMN SF_INCIDENT.CREATED_AT IS '사건 생성일시';
COMMENT ON COLUMN SF_INCIDENT.UPDATED_AT IS '최종 수정일시';

-- 3-1. 사건 상태 변경 이력 테이블============================================
--      사건의 STATUS가 바뀔 때마다 한 줄씩 쌓아서 처리 히스토리를 추적
CREATE TABLE SF_INCIDENT_LOG (
    LOG_ID       NUMBER      PRIMARY KEY,  -- 로그 PK (SEQ_SF_INCIDENT_LOG로 채번)
    INCIDENT_ID  NUMBER      NOT NULL REFERENCES SF_INCIDENT(INCIDENT_ID),  -- 대상 사건 FK
    PREV_STATUS  VARCHAR2(20),               -- 변경 전 상태 (최초 생성 시 NULL)
    NEW_STATUS   VARCHAR2(20)    NOT NULL,   -- 변경 후 상태
    MEMO         VARCHAR2(500),              -- 담당자가 남긴 처리 메모
    CHANGED_BY   NUMBER          REFERENCES SF_MEMBER(MEMBER_ID),  -- 변경한 직원 FK
    CHANGED_AT   TIMESTAMP   DEFAULT SYSTIMESTAMP  -- 변경 일시
);

COMMENT ON TABLE SF_INCIDENT_LOG IS '사건 상태 변경 이력 - STATUS가 바뀔 때마다 한 줄씩 쌓임';
COMMENT ON COLUMN SF_INCIDENT_LOG.LOG_ID IS '로그 PK (SEQ_SF_INCIDENT_LOG로 채번)';
COMMENT ON COLUMN SF_INCIDENT_LOG.INCIDENT_ID IS '대상 사건 FK';
COMMENT ON COLUMN SF_INCIDENT_LOG.PREV_STATUS IS '변경 전 상태 (최초 생성 시 NULL)';
COMMENT ON COLUMN SF_INCIDENT_LOG.NEW_STATUS IS '변경 후 상태';
COMMENT ON COLUMN SF_INCIDENT_LOG.MEMO IS '담당자가 남긴 처리 메모';
COMMENT ON COLUMN SF_INCIDENT_LOG.CHANGED_BY IS '변경한 직원 FK';
COMMENT ON COLUMN SF_INCIDENT_LOG.CHANGED_AT IS '변경 일시';

-- 4. 시민 제보 테이블============================================
--    시민이 앱/웹에서 올린 신고 원본. 아직 사건(SF_INCIDENT)과 연결 안 된 상태로 시작
--    담당자가 검토 후 기존 사건에 병합(LINKED)하거나 신규 사건으로 등록함
CREATE TABLE SF_REPORT (
    REPORT_ID     NUMBER      PRIMARY KEY,  -- 제보 PK (SEQ_SF_REPORT로 채번)
    MEMBER_ID     NUMBER      NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 제보한 시민 FK
    DISASTER_TYPE VARCHAR2(30) NOT NULL,   -- 시민이 선택한 재난 유형
    CONTENT       VARCHAR2(1000),          -- 제보 내용(설명)
    LATITUDE      NUMBER(10,6) NOT NULL,   -- 제보 위치 위도
    LONGITUDE     NUMBER(10,6) NOT NULL,   -- 제보 위치 경도
    PHOTO_URL     VARCHAR2(500),           -- 첨부 사진 URL
    INCIDENT_ID   NUMBER      REFERENCES SF_INCIDENT(INCIDENT_ID),  -- 연결된 사건 FK (병합 전엔 NULL)
    STATUS        VARCHAR2(20) DEFAULT 'RECEIVED',  -- 제보 처리 상태 (RECEIVED / LINKED 등)
    CREATED_AT    TIMESTAMP   DEFAULT SYSTIMESTAMP  -- 제보 등록일시
);

COMMENT ON TABLE SF_REPORT IS '시민 제보 - 담당자 검토 후 기존 사건 병합 또는 신규 사건 등록';
COMMENT ON COLUMN SF_REPORT.REPORT_ID IS '제보 PK (SEQ_SF_REPORT로 채번)';
COMMENT ON COLUMN SF_REPORT.MEMBER_ID IS '제보한 시민 FK';
COMMENT ON COLUMN SF_REPORT.DISASTER_TYPE IS '시민이 선택한 재난 유형';
COMMENT ON COLUMN SF_REPORT.CONTENT IS '제보 내용(설명)';
COMMENT ON COLUMN SF_REPORT.LATITUDE IS '제보 위치 위도';
COMMENT ON COLUMN SF_REPORT.LONGITUDE IS '제보 위치 경도';
COMMENT ON COLUMN SF_REPORT.PHOTO_URL IS '첨부 사진 URL';
COMMENT ON COLUMN SF_REPORT.INCIDENT_ID IS '연결된 사건 FK (병합 전엔 NULL)';
COMMENT ON COLUMN SF_REPORT.STATUS IS '제보 처리 상태 (RECEIVED / LINKED 등)';
COMMENT ON COLUMN SF_REPORT.CREATED_AT IS '제보 등록일시';

-- 5. 가족 관계 테이블============================================
--    "가족 안전확인" 기능용. 한쪽이 등록 요청하면 상대방이 수락(ACCEPTED)해야 실제 연결됨
--    그룹 개념 없이 1:1 관계로 관리 (지금 규모에는 이게 더 단순하고 충분함)
CREATE TABLE SF_FAMILY_RELATION (
    RELATION_ID       NUMBER      PRIMARY KEY,  -- 관계 PK (SEQ_SF_FAMILY_RELATION으로 채번)
    MEMBER_ID         NUMBER      NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 요청한 사람 FK
    FAMILY_MEMBER_ID  NUMBER      NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 가족으로 등록된 상대방 FK
    RELATION_TYPE     VARCHAR2(20) DEFAULT '가족',  -- 관계 (배우자/자녀/부모님/형제자매/가족 등, 요청자 기준 자유입력)
    STATUS            VARCHAR2(20) DEFAULT 'PENDING',  -- 관계 상태 (PENDING / ACCEPTED)
    CREATED_AT        TIMESTAMP   DEFAULT SYSTIMESTAMP  -- 등록 요청일시
);

COMMENT ON TABLE SF_FAMILY_RELATION IS '가족 관계 (1:1) - 안전확인 기능용, 상대방 수락(ACCEPTED) 시 연결 완료';
COMMENT ON COLUMN SF_FAMILY_RELATION.RELATION_ID IS '관계 PK (SEQ_SF_FAMILY_RELATION으로 채번)';
COMMENT ON COLUMN SF_FAMILY_RELATION.MEMBER_ID IS '요청한 사람 FK';
COMMENT ON COLUMN SF_FAMILY_RELATION.FAMILY_MEMBER_ID IS '가족으로 등록된 상대방 FK';
COMMENT ON COLUMN SF_FAMILY_RELATION.RELATION_TYPE IS '관계 (배우자/자녀/부모님/형제자매/가족 등, 요청자 기준 자유입력)';
COMMENT ON COLUMN SF_FAMILY_RELATION.STATUS IS '관계 상태 (PENDING / ACCEPTED)';
COMMENT ON COLUMN SF_FAMILY_RELATION.CREATED_AT IS '등록 요청일시';

-- 6. 안전확인 요청/응답 테이블============================================
--    "안전확인 요청" 버튼을 누르면 대상 가족 수만큼 한 줄씩 생성됨
--    INCIDENT_ID는 nullable: 홈에서 그냥 요청하면 NULL, 특정 사건 상세에서 요청하면 그 사건 ID가 들어감
--    이메일 링크로 로그인 없이 응답할 수 있도록 TOKEN 관련 컬럼 포함 (만료시간 + 재사용 방지용 응답시각)
CREATE TABLE SF_SAFETY_CHECK (
    CHECK_ID         NUMBER      PRIMARY KEY,  -- 안전확인 PK (SEQ_SF_SAFETY_CHECK로 채번)
    REQUESTER_ID     NUMBER      NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 요청 보낸 사람 FK
    TARGET_MEMBER_ID NUMBER      NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 확인 대상(가족) FK
    INCIDENT_ID      NUMBER      REFERENCES SF_INCIDENT(INCIDENT_ID),  -- 관련 사건 FK (일반 요청이면 NULL)
    STATUS           VARCHAR2(20) DEFAULT 'PENDING',  -- 응답 상태 (PENDING / SAFE / HELP)
    TOKEN            VARCHAR2(100),                    -- 이메일 링크 인증용 토큰
    TOKEN_EXPIRES_AT TIMESTAMP,                         -- 토큰 만료 일시 (만료 후엔 링크로 응답 불가)
    REQUESTED_AT     TIMESTAMP   DEFAULT SYSTIMESTAMP,  -- 요청 일시
    CONFIRMED_AT     TIMESTAMP                          -- 응답 일시, 미응답 시 NULL (값이 있으면 토큰 재사용 불가로 처리)
);

COMMENT ON TABLE SF_SAFETY_CHECK IS '안전확인 요청/응답 - 요청 버튼 클릭 시 대상 가족 수만큼 생성, 사건과 선택적으로 연결됨';
COMMENT ON COLUMN SF_SAFETY_CHECK.CHECK_ID IS '안전확인 PK (SEQ_SF_SAFETY_CHECK로 채번)';
COMMENT ON COLUMN SF_SAFETY_CHECK.REQUESTER_ID IS '요청 보낸 사람 FK';
COMMENT ON COLUMN SF_SAFETY_CHECK.TARGET_MEMBER_ID IS '확인 대상(가족) FK';
COMMENT ON COLUMN SF_SAFETY_CHECK.INCIDENT_ID IS '관련 사건 FK (일반 요청이면 NULL)';
COMMENT ON COLUMN SF_SAFETY_CHECK.STATUS IS '응답 상태 (PENDING / SAFE / HELP)';
COMMENT ON COLUMN SF_SAFETY_CHECK.TOKEN IS '이메일 링크 인증용 토큰';
COMMENT ON COLUMN SF_SAFETY_CHECK.TOKEN_EXPIRES_AT IS '토큰 만료 일시 (만료 후엔 링크로 응답 불가)';
COMMENT ON COLUMN SF_SAFETY_CHECK.REQUESTED_AT IS '요청 일시';
COMMENT ON COLUMN SF_SAFETY_CHECK.CONFIRMED_AT IS '응답 일시, 미응답 시 NULL (값이 있으면 토큰 재사용 불가로 처리)';

-- 6-1. 알림 테이블============================================
--      마이페이지 "최근 알림" 중 재난 알림(관심지역 반경 매칭)/제보 알림(상태변경)을
--      실제 이벤트 발생 시점에 서버가 직접 생성해서 쌓아두는 테이블.
--      (안전확인/기타 알림은 이미 있는 데이터를 프론트에서 그때그때 조합해서 보여주므로
--       별도 저장 안 함 - 이 테이블은 그 방식으로는 안 되는 두 종류만 다룸)
CREATE TABLE SF_NOTIFICATION (
    NOTIFICATION_ID  NUMBER          PRIMARY KEY,  -- 알림 PK (SEQ_SF_NOTIFICATION으로 채번)
    MEMBER_ID        NUMBER          NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 알림 받는 회원 FK
    TYPE             VARCHAR2(20)    NOT NULL,     -- 알림 종류 (DISASTER / REPORT)
    TITLE            VARCHAR2(200)   NOT NULL,     -- 알림 제목 (보통 Incident 제목)
    CONTENT          VARCHAR2(500),                -- 알림 내용
    INCIDENT_ID      NUMBER          REFERENCES SF_INCIDENT(INCIDENT_ID),  -- 관련 사건 FK (없으면 NULL)
    CREATED_AT       TIMESTAMP       DEFAULT SYSTIMESTAMP  -- 알림 생성일시
);

COMMENT ON TABLE SF_NOTIFICATION IS '알림 - 재난 알림(관심지역 반경 매칭)/제보 알림(내 제보 상태변경)을 이벤트 시점에 생성';
COMMENT ON COLUMN SF_NOTIFICATION.NOTIFICATION_ID IS '알림 PK (SEQ_SF_NOTIFICATION으로 채번)';
COMMENT ON COLUMN SF_NOTIFICATION.MEMBER_ID IS '알림 받는 회원 FK';
COMMENT ON COLUMN SF_NOTIFICATION.TYPE IS '알림 종류 (DISASTER / REPORT)';
COMMENT ON COLUMN SF_NOTIFICATION.TITLE IS '알림 제목 (보통 Incident 제목)';
COMMENT ON COLUMN SF_NOTIFICATION.CONTENT IS '알림 내용';
COMMENT ON COLUMN SF_NOTIFICATION.INCIDENT_ID IS '관련 사건 FK (없으면 NULL)';
COMMENT ON COLUMN SF_NOTIFICATION.CREATED_AT IS '알림 생성일시';

-- 지역+상태로 사건 목록 조회할 때 자주 쓰이므로 복합 인덱스 생성
CREATE INDEX IDX_SF_INCIDENT_REGION_STATUS ON SF_INCIDENT(REGION, STATUS);
-- 재난유형+시간순으로 제보 조회/통계 낼 때 자주 쓰이므로 복합 인덱스 생성
CREATE INDEX IDX_SF_REPORT_TYPE_TIME ON SF_REPORT(DISASTER_TYPE, CREATED_AT);
-- 특정 회원 기준으로 가족 목록 조회할 때 자주 쓰이므로 인덱스 생성
CREATE INDEX IDX_SF_FAMILY_MEMBER ON SF_FAMILY_RELATION(MEMBER_ID);
-- 특정 요청자 기준으로 안전확인 현황 조회할 때 자주 쓰이므로 인덱스 생성
CREATE INDEX IDX_SF_SAFETY_REQUESTER ON SF_SAFETY_CHECK(REQUESTER_ID);
-- 특정 회원 기준으로 관심지역 목록 조회할 때 자주 쓰이므로 인덱스 생성
CREATE INDEX IDX_SF_MEMBER_REGION_MEMBER ON SF_MEMBER_REGION(MEMBER_ID);
-- 특정 회원의 최근 알림을 시간순으로 조회할 때 자주 쓰이므로 복합 인덱스 생성
CREATE INDEX IDX_SF_NOTIFICATION_MEMBER_TIME ON SF_NOTIFICATION(MEMBER_ID, CREATED_AT);

-- 7. 시퀀스 생성 (각 테이블 PK 채번용)============================================
CREATE SEQUENCE SEQ_SF_MEMBER START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_MEMBER_REGION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT_LOG START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_REPORT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_FAMILY_RELATION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_SAFETY_CHECK START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_NOTIFICATION START WITH 1 INCREMENT BY 1 NOCACHE;

-- 더미 데이터 --
-- STAFF 계정만
INSERT INTO SF_MEMBER (MEMBER_ID, LOGIN_ID, PASSWORD, NAME, EMAIL, ROLE)
VALUES (SEQ_SF_MEMBER.NEXTVAL, 's', '$2a$10$3G6nByOWnMaAmupkwHj5felIP08YE9eT8lN7Wf2z1wgTgR4sBarfq', '곽지윤', 'test123@example.com', 'STAFF');
COMMIT;