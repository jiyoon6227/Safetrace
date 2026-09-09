-- ============================================
-- SafeTrace DB 전체 초기화 + 계정 + 테스트 데이터
-- 이 파일 전체를 통째로 선택해서 한 번에 실행(F5)하면 끝.
-- Postman 필요 없음 - 비밀번호는 미리 암호화해서 넣어놨음.
-- PK는 IDENTITY가 아닌 SEQUENCE 방식으로 채번함.
-- ============================================

-- 1. 기존 테이블/시퀀스 전부 삭제 (재실행 시 충돌 방지, FK 있는 테이블부터 역순으로 삭제)
DROP TABLE SF_SAFETY_CHECK CASCADE CONSTRAINTS;
DROP TABLE SF_FAMILY_RELATION CASCADE CONSTRAINTS;
DROP TABLE SF_MEMBER_REGION CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT_LOG CASCADE CONSTRAINTS;
DROP TABLE SF_REPORT CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT CASCADE CONSTRAINTS;
DROP TABLE SF_MEMBER CASCADE CONSTRAINTS;
DROP TABLE SF_DEPARTMENT CASCADE CONSTRAINTS;

DROP SEQUENCE SEQ_SF_MEMBER;
DROP SEQUENCE SEQ_SF_MEMBER_REGION;
DROP SEQUENCE SEQ_SF_INCIDENT;
DROP SEQUENCE SEQ_SF_INCIDENT_LOG;
DROP SEQUENCE SEQ_SF_REPORT;
DROP SEQUENCE SEQ_SF_FAMILY_RELATION;
DROP SEQUENCE SEQ_SF_SAFETY_CHECK;
DROP SEQUENCE SEQ_SF_DEPARTMENT;

-- 2. 부서 테이블============================================
--    STAFF/ADMIN 소속 표시 및 사건 목록 필터용. SF_MEMBER가 이 테이블을 참조하므로
--    SF_MEMBER보다 먼저 생성되어야 함.
CREATE TABLE SF_DEPARTMENT (
    DEPARTMENT_ID  NUMBER          PRIMARY KEY,        -- 부서 PK (SEQ_SF_DEPARTMENT로 채번)
    NAME           VARCHAR2(100)   NOT NULL,            -- 부서명 (예: '유성구청 재난안전과')
    REGION         VARCHAR2(100),                       -- 담당 지역 (SF_INCIDENT.REGION과 매칭용, 예: '대전 유성구')
    PHONE          VARCHAR2(20),                        -- 대표번호 (선택)
    CREATED_AT     TIMESTAMP       DEFAULT SYSTIMESTAMP -- 등록일시
);

COMMENT ON TABLE SF_DEPARTMENT IS '담당 부서 - STAFF 소속 표시 및 사건 목록 필터용';
COMMENT ON COLUMN SF_DEPARTMENT.DEPARTMENT_ID IS '부서 PK (SEQ_SF_DEPARTMENT로 채번)';
COMMENT ON COLUMN SF_DEPARTMENT.NAME IS '부서명';
COMMENT ON COLUMN SF_DEPARTMENT.REGION IS '담당 지역 (SF_INCIDENT.REGION과 매칭용)';
COMMENT ON COLUMN SF_DEPARTMENT.PHONE IS '대표번호';
COMMENT ON COLUMN SF_DEPARTMENT.CREATED_AT IS '등록일시';

-- 3. 회원 테이블============================================
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
    DEPARTMENT_ID              NUMBER          REFERENCES SF_DEPARTMENT(DEPARTMENT_ID),  -- 소속 부서 FK (STAFF/ADMIN만 값 있음, USER는 NULL)
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
COMMENT ON COLUMN SF_MEMBER.DEPARTMENT_ID IS '소속 부서 FK (STAFF/ADMIN만 값 있음, USER는 NULL)';
COMMENT ON COLUMN SF_MEMBER.EMAIL_NOTIFY_ENABLED IS '가족 안전확인 이메일 알림 수신 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER.DISASTER_NOTIFY_ENABLED IS '관심지역 재난 알림 수신 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER.REPORT_NOTIFY_ENABLED IS '내 제보 상태변경 알림 수신 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER.IS_WITHDRAWN IS '탈퇴 여부 (Y/N) - 소프트 삭제, 실제 행은 안 지움';
COMMENT ON COLUMN SF_MEMBER.WITHDRAWN_AT IS '탈퇴 처리 일시 (미탈퇴 시 NULL)';
COMMENT ON COLUMN SF_MEMBER.CREATED_AT IS '가입일시';

-- 3-1. 회원 관심지역 테이블============================================
--      회원 한 명이 관심지역을 여러 개 등록할 수 있도록 별도 테이블로 분리
--      (공공정보 탭의 기상특보 연동, 재난 알림 필터링에 사용 예정)
CREATE TABLE SF_MEMBER_REGION (
    MEMBER_REGION_ID  NUMBER          PRIMARY KEY,  -- 관심지역 PK (SEQ_SF_MEMBER_REGION으로 채번)
    MEMBER_ID         NUMBER          NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 회원 FK
    REGION_CODE       VARCHAR2(20),                 -- 지역 코드 (공공 API 연동 시 사용, 당장은 NULL 가능)
    REGION_NAME       VARCHAR2(100)   NOT NULL,     -- 지역명 (예: 대전 유성구)
    IS_PRIMARY        CHAR(1)         DEFAULT 'N' NOT NULL,  -- 대표 관심지역 여부 (Y/N)
    CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP  -- 등록일시
);

COMMENT ON TABLE SF_MEMBER_REGION IS '회원 관심지역 - 한 회원이 여러 지역을 등록 가능';
COMMENT ON COLUMN SF_MEMBER_REGION.MEMBER_REGION_ID IS '관심지역 PK (SEQ_SF_MEMBER_REGION으로 채번)';
COMMENT ON COLUMN SF_MEMBER_REGION.MEMBER_ID IS '회원 FK';
COMMENT ON COLUMN SF_MEMBER_REGION.REGION_CODE IS '지역 코드 (공공 API 연동 시 사용, 당장은 NULL 가능)';
COMMENT ON COLUMN SF_MEMBER_REGION.REGION_NAME IS '지역명 (예: 대전 유성구)';
COMMENT ON COLUMN SF_MEMBER_REGION.IS_PRIMARY IS '대표 관심지역 여부 (Y/N)';
COMMENT ON COLUMN SF_MEMBER_REGION.CREATED_AT IS '등록일시';

-- 4. 사건(재난) 테이블============================================
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
COMMENT ON COLUMN SF_INCIDENT.ASSIGNED_STAFF_ID IS '담당 직원 FK (미배정 시 NULL)';
COMMENT ON COLUMN SF_INCIDENT.CLOSE_REASON IS '종료 사유 (STATUS=CLOSED일 때 기록)';
COMMENT ON COLUMN SF_INCIDENT.CREATED_AT IS '사건 생성일시';
COMMENT ON COLUMN SF_INCIDENT.UPDATED_AT IS '최종 수정일시';

-- 4-1. 사건 상태 변경 이력 테이블============================================
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

-- 5. 시민 제보 테이블============================================
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

-- 6. 가족 관계 테이블============================================
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

-- 7. 안전확인 요청/응답 테이블============================================
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

-- 8. 시퀀스 생성 (각 테이블 PK 채번용)============================================
CREATE SEQUENCE SEQ_SF_DEPARTMENT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_MEMBER START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_MEMBER_REGION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT_LOG START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_REPORT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_FAMILY_RELATION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_SAFETY_CHECK START WITH 1 INCREMENT BY 1 NOCACHE;

-- 9. 부서 시드 데이터 (대전 4개 구 기준)============================================
--    PHONE은 실제 번호 아니라서 일부러 비워둠 - 필요하면 나중에 UPDATE로 채워넣기
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME, REGION) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '유성구청 재난안전과', '대전 유성구');
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME, REGION) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '서구청 재난안전과', '대전 서구');
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME, REGION) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '동구청 재난안전과', '대전 동구');
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME, REGION) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '대덕구청 재난안전과', '대전 대덕구');
COMMIT;

-- 10. 테스트 계정 2개 직접 삽입 (비밀번호는 미리 암호화된 값, 둘 다 원문 비번은 1234)
--    test123  = STAFF 계정 (담당자 로그인용) - 유성구청 재난안전과 소속으로 배정
--    citizen01 = 시민(USER) 계정 (제보자 로그인용)
--    PK는 SEQ_SF_MEMBER.NEXTVAL로 직접 채번
--    알림설정/탈퇴여부는 컬럼 기본값(EMAIL_NOTIFY_ENABLED='Y' 등)을 그대로 사용하므로 INSERT에서 생략
INSERT INTO SF_MEMBER (MEMBER_ID, LOGIN_ID, PASSWORD, NAME, EMAIL, ROLE, DEPARTMENT_ID)
VALUES (SEQ_SF_MEMBER.NEXTVAL, 's', '$2a$10$3G6nByOWnMaAmupkwHj5felIP08YE9eT8lN7Wf2z1wgTgR4sBarfq', '곽지윤', 'test123@example.com', 'STAFF',
        (SELECT DEPARTMENT_ID FROM SF_DEPARTMENT WHERE REGION = '대전 유성구'));

INSERT INTO SF_MEMBER (MEMBER_ID, LOGIN_ID, PASSWORD, NAME, EMAIL, ROLE)
VALUES (SEQ_SF_MEMBER.NEXTVAL, 'u', '$2a$10$3G6nByOWnMaAmupkwHj5felIP08YE9eT8lN7Wf2z1wgTgR4sBarfq', '김민준', 'citizen01@example.com', 'USER');

COMMIT;

-- 11. 테스트용 사건 4건 + 상태 이력 + 제보 4건 + 가족관계 + 관심지역을 한 번에 생성
--    방금 INSERT한 회원의 MEMBER_ID를 변수에 담아 FK로 재사용하기 위해 PL/SQL 블록 사용
--    PK는 전부 각 시퀀스.NEXTVAL로 직접 채번
DECLARE
  v_citizen_id SF_MEMBER.MEMBER_ID%TYPE;   -- 시민 계정 ID 담을 변수
  v_staff_id   SF_MEMBER.MEMBER_ID%TYPE;   -- 담당자 계정 ID 담을 변수
  v_inc1       SF_INCIDENT.INCIDENT_ID%TYPE;  -- 사건1 ID
  v_inc2       SF_INCIDENT.INCIDENT_ID%TYPE;  -- 사건2 ID
  v_inc3       SF_INCIDENT.INCIDENT_ID%TYPE;  -- 사건3 ID
  v_inc4       SF_INCIDENT.INCIDENT_ID%TYPE;  -- 사건4 ID
BEGIN
  -- 위에서 만든 회원 2명의 ID 조회
  SELECT MEMBER_ID INTO v_citizen_id FROM SF_MEMBER WHERE LOGIN_ID = 'citizen01';
  SELECT MEMBER_ID INTO v_staff_id FROM SF_MEMBER WHERE LOGIN_ID = 'test123';

  -- [사건 1] 대응중(RESPONDING) 상태, 담당자 배정됨, 침수 - 상태 3단계 변경 이력 포함
  INSERT INTO SF_INCIDENT (INCIDENT_ID, TITLE, DISASTER_TYPE, SEVERITY, STATUS, REGION, LATITUDE, LONGITUDE, ASSIGNED_STAFF_ID)
  VALUES (SEQ_SF_INCIDENT.NEXTVAL, '유성구 궁동 도로 침수', '침수', 'HIGH', 'RESPONDING', '대전 유성구', 36.3745, 127.3453, v_staff_id)
  RETURNING INCIDENT_ID INTO v_inc1;

  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc1, NULL, 'RECEIVED', 'Incident 최초 생성', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc1, 'RECEIVED', 'CONFIRMING', '현장 확인 중', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc1, 'CONFIRMING', 'RESPONDING', '도로 통제 및 배수 작업 시작', v_staff_id);

  -- [사건 2] 확인중(CONFIRMING) 상태, 담당자 미배정, 화재
  INSERT INTO SF_INCIDENT (INCIDENT_ID, TITLE, DISASTER_TYPE, SEVERITY, STATUS, REGION, LATITUDE, LONGITUDE)
  VALUES (SEQ_SF_INCIDENT.NEXTVAL, '서구 갈마동 화재', '화재', 'HIGH', 'CONFIRMING', '대전 서구', 36.3290, 127.3825)
  RETURNING INCIDENT_ID INTO v_inc2;

  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc2, NULL, 'RECEIVED', 'Incident 최초 생성', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc2, 'RECEIVED', 'CONFIRMING', '현장 확인 중', v_staff_id);

  -- [사건 3] 접수(RECEIVED) 상태, 담당자 미배정, 산사태 (담당자 배정 테스트용으로 남겨둠)
  INSERT INTO SF_INCIDENT (INCIDENT_ID, TITLE, DISASTER_TYPE, SEVERITY, STATUS, REGION, LATITUDE, LONGITUDE)
  VALUES (SEQ_SF_INCIDENT.NEXTVAL, '유성구 산성동 산사태 우려', '산사태', 'MEDIUM', 'RECEIVED', '대전 유성구', 36.3050, 127.3200)
  RETURNING INCIDENT_ID INTO v_inc3;

  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc3, NULL, 'RECEIVED', 'Incident 최초 생성', v_staff_id);

  -- [사건 4] 종료(CLOSED) 상태, 전체 상태 흐름(접수→확인→대응→수습→종료)을 다 거친 예시
  INSERT INTO SF_INCIDENT (INCIDENT_ID, TITLE, DISASTER_TYPE, SEVERITY, STATUS, REGION, LATITUDE, LONGITUDE, ASSIGNED_STAFF_ID, CLOSE_REASON)
  VALUES (SEQ_SF_INCIDENT.NEXTVAL, '유성대로 배수로 정비', '침수', 'LOW', 'CLOSED', '대전 유성구', 36.3620, 127.3650, v_staff_id, '배수로 정비 완료, 침수 해소 확인')
  RETURNING INCIDENT_ID INTO v_inc4;

  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc4, NULL, 'RECEIVED', 'Incident 최초 생성', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc4, 'RECEIVED', 'CONFIRMING', '현장 확인', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc4, 'CONFIRMING', 'RESPONDING', '배수로 정비 작업 착수', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc4, 'RESPONDING', 'RECOVERING', '정비 완료, 배수 확인 중', v_staff_id);
  INSERT INTO SF_INCIDENT_LOG (LOG_ID, INCIDENT_ID, PREV_STATUS, NEW_STATUS, MEMO, CHANGED_BY) VALUES (SEQ_SF_INCIDENT_LOG.NEXTVAL, v_inc4, 'RECOVERING', 'CLOSED', '배수로 정비 완료, 침수 해소 확인', v_staff_id);

  -- [제보 데이터] 아직 사건에 연결되지 않은 것들 - 제보 관리 탭에서 "병합" 테스트용
  --   사건1(궁동 침수)과 위치가 가까운 제보 2건 → 기존 사건에 병합하는 시나리오 테스트
  INSERT INTO SF_REPORT (REPORT_ID, MEMBER_ID, DISASTER_TYPE, CONTENT, LATITUDE, LONGITUDE)
  VALUES (SEQ_SF_REPORT.NEXTVAL, v_citizen_id, '침수', '궁동 도로에 물이 차서 차량 통행이 어렵습니다', 36.3752, 127.3459);

  INSERT INTO SF_REPORT (REPORT_ID, MEMBER_ID, DISASTER_TYPE, CONTENT, LATITUDE, LONGITUDE)
  VALUES (SEQ_SF_REPORT.NEXTVAL, v_citizen_id, '침수', '궁동 사거리 인근 침수, 우회 필요', 36.3748, 127.3448);

  -- 주변에 관련 사건이 없는 제보 → "새 사건으로 등록" 시나리오 테스트용
  INSERT INTO SF_REPORT (REPORT_ID, MEMBER_ID, DISASTER_TYPE, CONTENT, LATITUDE, LONGITUDE)
  VALUES (SEQ_SF_REPORT.NEXTVAL, v_citizen_id, '산사태', '유성구 산성동 뒷산에서 토사가 흘러내립니다', 36.3050, 127.3200);

  -- 이미 사건2(갈마동 화재)에 연결된 제보 예시 (STATUS='LINKED')
  INSERT INTO SF_REPORT (REPORT_ID, MEMBER_ID, DISASTER_TYPE, CONTENT, LATITUDE, LONGITUDE, INCIDENT_ID, STATUS)
  VALUES (SEQ_SF_REPORT.NEXTVAL, v_citizen_id, '화재', '갈마동에서 연기가 보입니다', 36.3290, 127.3825, v_inc2, 'LINKED');

  -- [가족 관계 테스트 데이터] test123(곽지윤)과 citizen01(김민준)을 가족으로 연결(수락 완료 상태)
  --   행은 하나만 저장 - 양방향 조회는 FamilyRelationMapper.findAcceptedFamilies의 UNION으로 처리
  INSERT INTO SF_FAMILY_RELATION (RELATION_ID, MEMBER_ID, FAMILY_MEMBER_ID, RELATION_TYPE, STATUS)
  VALUES (SEQ_SF_FAMILY_RELATION.NEXTVAL, v_staff_id, v_citizen_id, '가족', 'ACCEPTED');

  -- [관심지역 테스트 데이터] 각 계정에 관심지역 1~2개씩 등록
  INSERT INTO SF_MEMBER_REGION (MEMBER_REGION_ID, MEMBER_ID, REGION_NAME, IS_PRIMARY)
  VALUES (SEQ_SF_MEMBER_REGION.NEXTVAL, v_citizen_id, '대전 유성구', 'Y');

  INSERT INTO SF_MEMBER_REGION (MEMBER_REGION_ID, MEMBER_ID, REGION_NAME, IS_PRIMARY)
  VALUES (SEQ_SF_MEMBER_REGION.NEXTVAL, v_citizen_id, '세종시', 'N');

  INSERT INTO SF_MEMBER_REGION (MEMBER_REGION_ID, MEMBER_ID, REGION_NAME, IS_PRIMARY)
  VALUES (SEQ_SF_MEMBER_REGION.NEXTVAL, v_staff_id, '대전 서구', 'Y');

  COMMIT;
END;
/