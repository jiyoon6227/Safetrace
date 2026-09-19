-- ============================================
-- SafeTrace DB 전체 초기화 + 계정 + 테스트 데이터
-- 이 파일 전체를 통째로 선택해서 한 번에 실행(F5)하면 끝.
-- Postman 필요 없음 - 비밀번호는 미리 암호화해서 넣어놨음.
-- PK는 IDENTITY가 아닌 SEQUENCE 방식으로 채번함.
-- ============================================

-- 1. 기존 테이블/시퀀스/인덱스 전부 삭제 (재실행 시 충돌 방지, FK 있는 테이블부터 역순으로 삭제)
DROP TABLE SF_NOTICE CASCADE CONSTRAINTS;
DROP TABLE SF_NOTIFICATION CASCADE CONSTRAINTS;
DROP TABLE SF_SAFETY_CHECK CASCADE CONSTRAINTS;
DROP TABLE SF_FAMILY_RELATION CASCADE CONSTRAINTS;
DROP TABLE SF_MEMBER_REGION CASCADE CONSTRAINTS;
DROP TABLE SF_REPORT_PHOTO CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT_PHOTO CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT_LOG CASCADE CONSTRAINTS;
DROP TABLE SF_REPORT CASCADE CONSTRAINTS;
DROP TABLE SF_INCIDENT CASCADE CONSTRAINTS;
DROP TABLE SF_MEMBER CASCADE CONSTRAINTS;
DROP TABLE SF_DEPARTMENT CASCADE CONSTRAINTS;

DROP SEQUENCE SEQ_SF_MEMBER;
DROP SEQUENCE SEQ_SF_DEPARTMENT;
DROP SEQUENCE SEQ_SF_MEMBER_REGION;
DROP SEQUENCE SEQ_SF_INCIDENT;
DROP SEQUENCE SEQ_SF_INCIDENT_LOG;
DROP SEQUENCE SEQ_SF_INCIDENT_PHOTO;
DROP SEQUENCE SEQ_SF_REPORT;
DROP SEQUENCE SEQ_SF_REPORT_PHOTO;
DROP SEQUENCE SEQ_SF_FAMILY_RELATION;
DROP SEQUENCE SEQ_SF_SAFETY_CHECK;
DROP SEQUENCE SEQ_SF_NOTIFICATION;
DROP SEQUENCE SEQ_SF_NOTICE;

-- 1-1. 부서 테이블============================================
--      STAFF 소속 부서. 화면 표시/필터용이며 자동배정 로직에는 쓰지 않음
--      회원가입으로 만들어지지 않고 DB에 직접 시딩 (STAFF 계정 자체가 direct insert이므로)
CREATE TABLE SF_DEPARTMENT (
    DEPARTMENT_ID   NUMBER          PRIMARY KEY,   -- 부서 PK (SEQ_SF_DEPARTMENT로 채번)
    NAME            VARCHAR2(50)    NOT NULL        -- 부서명 (예: 재난안전과, 소방본부)
);

COMMENT ON TABLE SF_DEPARTMENT IS '부서 - STAFF 소속 표시/필터용, DB에 직접 시딩';
COMMENT ON COLUMN SF_DEPARTMENT.DEPARTMENT_ID IS '부서 PK (SEQ_SF_DEPARTMENT로 채번)';
COMMENT ON COLUMN SF_DEPARTMENT.NAME IS '부서명 (예: 재난안전과, 소방본부)';

-- 2. 회원 테이블============================================
--    시민(USER)과 담당 직원(STAFF)을 같은 테이블에서 ROLE로 구분
--    마이페이지(내 정보관리/알림설정/탈퇴)용 컬럼까지 포함
--    LOGIN_ID는 UNIQUE 제약을 걸지 않는다 - 탈퇴(소프트 삭제)해도 행이 안 지워지는데,
--    UNIQUE를 걸면 탈퇴한 아이디를 영영 재사용할 수 없게 되기 때문.
--    대신 테이블 생성 뒤 "미탈퇴 회원 사이에서만" 유일하게 강제하는 함수기반 유니크 인덱스를 별도로 만든다
--    (아래 UX_SF_MEMBER_LOGIN_ID_ACTIVE 참고).
CREATE TABLE SF_MEMBER (
    MEMBER_ID                 NUMBER          PRIMARY KEY,        -- 회원 PK (SEQ_SF_MEMBER로 채번)
    LOGIN_ID                  VARCHAR2(50)    NOT NULL,           -- 로그인 아이디 (유일성은 함수기반 인덱스로 보장 - 미탈퇴 회원끼리만 중복 불가)
    PASSWORD                  VARCHAR2(200)   NOT NULL,           -- BCrypt 등으로 암호화된 비밀번호
    NAME                      VARCHAR2(50)    NOT NULL,           -- 회원 이름
    EMAIL                     VARCHAR2(100),                      -- 안전확인 메일 발송용 이메일
    PHONE                     VARCHAR2(20),                       -- 전화번호
    PROFILE_IMAGE_URL         VARCHAR2(500),                      -- 프로필 이미지 경로
    ADDRESS                   VARCHAR2(200),                      -- 주소 (시/군/구 수준, 배송 등 실사용 목적 아님)
    ADDRESS_DETAIL            VARCHAR2(200),                      -- 상세주소
    ROLE                      VARCHAR2(20)    DEFAULT 'USER' NOT NULL,  -- 권한 구분: USER(시민) / STAFF(담당 직원)
    DEPARTMENT_ID              NUMBER          REFERENCES SF_DEPARTMENT(DEPARTMENT_ID),  -- 소속 부서 FK (STAFF만 사용, 시민은 NULL)
    EMAIL_NOTIFY_ENABLED      CHAR(1)         DEFAULT 'Y' NOT NULL,  -- 가족 안전확인 이메일 알림 수신 여부 (Y/N)
    DISASTER_NOTIFY_ENABLED   CHAR(1)         DEFAULT 'Y' NOT NULL,  -- 관심지역 재난 알림 수신 여부 (Y/N)
    REPORT_NOTIFY_ENABLED     CHAR(1)         DEFAULT 'Y' NOT NULL,  -- 내 제보 상태변경 알림 수신 여부 (Y/N)
    IS_WITHDRAWN              CHAR(1)         DEFAULT 'N' NOT NULL,  -- 탈퇴 여부 (Y/N) - 소프트 삭제, 실제 행은 안 지움
    WITHDRAWN_AT               TIMESTAMP,                          -- 탈퇴 처리 일시 (미탈퇴 시 NULL)
    CREATED_AT                TIMESTAMP       DEFAULT SYSTIMESTAMP, -- 가입일시
    CONSTRAINT CK_SF_MEMBER_ROLE CHECK (ROLE IN ('USER', 'STAFF'))
);

COMMENT ON TABLE SF_MEMBER IS '회원 (시민 USER / 담당직원 STAFF 통합 테이블)';
COMMENT ON COLUMN SF_MEMBER.MEMBER_ID IS '회원 PK (SEQ_SF_MEMBER로 채번)';
COMMENT ON COLUMN SF_MEMBER.LOGIN_ID IS '로그인 아이디 - 미탈퇴 회원 사이에서만 유일(함수기반 인덱스로 보장), 탈퇴한 아이디는 재사용 가능';
COMMENT ON COLUMN SF_MEMBER.PASSWORD IS 'BCrypt 등으로 암호화된 비밀번호';
COMMENT ON COLUMN SF_MEMBER.NAME IS '회원 이름';
COMMENT ON COLUMN SF_MEMBER.EMAIL IS '안전확인 메일 발송용 이메일';
COMMENT ON COLUMN SF_MEMBER.PHONE IS '전화번호';
COMMENT ON COLUMN SF_MEMBER.PROFILE_IMAGE_URL IS '프로필 이미지 경로';
COMMENT ON COLUMN SF_MEMBER.ADDRESS IS '주소 (시/군/구 수준, 배송 등 실사용 목적 아님)';
COMMENT ON COLUMN SF_MEMBER.ADDRESS_DETAIL IS '상세주소';
COMMENT ON COLUMN SF_MEMBER.ROLE IS '권한 구분: USER(시민) / STAFF(담당 직원)';
COMMENT ON COLUMN SF_MEMBER.DEPARTMENT_ID IS '소속 부서 FK (STAFF만 사용, 시민은 NULL)';
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
    ASSIGNED_STAFF_ID  NUMBER          REFERENCES SF_MEMBER(MEMBER_ID),  -- 담당 직원 FK (미배정 시 NULL)
    SOURCE_REPORT_ID  NUMBER,                    -- 이 사건을 처음 만든 제보 FK (제보 없이 직접 등록한 사건이면 NULL)
                                                  -- SF_REPORT가 이 테이블을 참조(INCIDENT_ID)하는 구조라 순환참조라서,
                                                  -- FK 제약조건은 SF_REPORT 생성 뒤에 ALTER TABLE로 따로 건다 (아래 3-2 참고)
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
COMMENT ON COLUMN SF_INCIDENT.SOURCE_REPORT_ID IS '이 사건을 처음 만든 제보 FK (직접 등록한 사건이면 NULL)';
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

-- 3-2. 사건 현장 확인 사진============================================
--      대표(0번째)~5번째까지 전부 여기 한 테이블에서만 관리. 목록/지도마커용 "대표 사진"이
--      필요한 곳은 SF_INCIDENT 조회 시 SORT_ORDER=0인 행을 상관서브쿼리로 PHOTO_URL 별칭으로 가져다 씀
--      (기존에 SF_INCIDENT.PHOTO_URL 컬럼 하나만 읽던 지도마커/목록 코드를 그대로 두기 위한 설계)
CREATE TABLE SF_INCIDENT_PHOTO (
    INCIDENT_PHOTO_ID  NUMBER          PRIMARY KEY,  -- PK (SEQ_SF_INCIDENT_PHOTO로 채번)
    INCIDENT_ID        NUMBER          NOT NULL REFERENCES SF_INCIDENT(INCIDENT_ID),  -- 대상 사건 FK
    PHOTO_URL          VARCHAR2(500)   NOT NULL,   -- 사진 URL
    SORT_ORDER         NUMBER          DEFAULT 0 NOT NULL,  -- 표시 순서 (0번째 = 대표 사진)
    CREATED_AT         TIMESTAMP       DEFAULT SYSTIMESTAMP  -- 등록일시
);

COMMENT ON TABLE SF_INCIDENT_PHOTO IS '사건 현장 확인 사진 전체(대표 포함 최대 5장) - 사진은 이 테이블에서만 관리';
COMMENT ON COLUMN SF_INCIDENT_PHOTO.INCIDENT_PHOTO_ID IS 'PK (SEQ_SF_INCIDENT_PHOTO로 채번)';
COMMENT ON COLUMN SF_INCIDENT_PHOTO.INCIDENT_ID IS '대상 사건 FK';
COMMENT ON COLUMN SF_INCIDENT_PHOTO.PHOTO_URL IS '사진 URL';
COMMENT ON COLUMN SF_INCIDENT_PHOTO.SORT_ORDER IS '표시 순서 (0번째 = 대표 사진)';
COMMENT ON COLUMN SF_INCIDENT_PHOTO.CREATED_AT IS '등록일시';

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
    ADDRESS       VARCHAR2(300),           -- 제보 등록 시 확정된 주소 문자열(시민이 검색/자동확인한 값 그대로 저장)
    INCIDENT_ID   NUMBER      REFERENCES SF_INCIDENT(INCIDENT_ID),  -- 연결된 사건 FK (병합 전엔 NULL)
    STATUS        VARCHAR2(20) DEFAULT 'RECEIVED',  -- 제보 처리 상태 (RECEIVED / REVIEWING / LINKED / REJECTED)
    REJECT_REASON VARCHAR2(500),           -- 반려 사유 (STATUS='REJECTED'일 때 기록)
    REPORTER_PHONE VARCHAR2(30),           -- 이 제보 접수 시 남긴 연락처 (회원 프로필과 별개로, 현장에서 바로 받을 연락처)
    CREATED_AT    TIMESTAMP   DEFAULT SYSTIMESTAMP  -- 제보 등록일시
);

COMMENT ON TABLE SF_REPORT IS '시민 제보 - 담당자 검토 후 기존 사건 병합 또는 신규 사건 등록';
COMMENT ON COLUMN SF_REPORT.REPORT_ID IS '제보 PK (SEQ_SF_REPORT로 채번)';
COMMENT ON COLUMN SF_REPORT.MEMBER_ID IS '제보한 시민 FK';
COMMENT ON COLUMN SF_REPORT.DISASTER_TYPE IS '시민이 선택한 재난 유형';
COMMENT ON COLUMN SF_REPORT.CONTENT IS '제보 내용(설명)';
COMMENT ON COLUMN SF_REPORT.LATITUDE IS '제보 위치 위도';
COMMENT ON COLUMN SF_REPORT.LONGITUDE IS '제보 위치 경도';
COMMENT ON COLUMN SF_REPORT.ADDRESS IS '제보 등록 시 확정된 주소 문자열';
COMMENT ON COLUMN SF_REPORT.INCIDENT_ID IS '연결된 사건 FK (병합 전엔 NULL)';
COMMENT ON COLUMN SF_REPORT.STATUS IS '제보 처리 상태 (RECEIVED / REVIEWING / LINKED / REJECTED)';
COMMENT ON COLUMN SF_REPORT.REJECT_REASON IS '반려 사유 (STATUS=REJECTED일 때 기록)';
COMMENT ON COLUMN SF_REPORT.REPORTER_PHONE IS '이 제보 접수 시 남긴 연락처';
COMMENT ON COLUMN SF_REPORT.CREATED_AT IS '제보 등록일시';

-- 4-1. 제보 첨부 사진============================================
--      대표(0번째)~5번째까지 전부 여기 한 테이블에서만 관리. 목록/마이페이지용 "대표 사진"이
--      필요한 곳은 SF_REPORT 조회 시 SORT_ORDER=0인 행을 상관서브쿼리로 PHOTO_URL 별칭으로 가져다 씀
CREATE TABLE SF_REPORT_PHOTO (
    REPORT_PHOTO_ID  NUMBER          PRIMARY KEY,  -- PK (SEQ_SF_REPORT_PHOTO로 채번)
    REPORT_ID        NUMBER          NOT NULL REFERENCES SF_REPORT(REPORT_ID),  -- 대상 제보 FK
    PHOTO_URL        VARCHAR2(500)   NOT NULL,   -- 사진 URL
    SORT_ORDER       NUMBER          DEFAULT 0 NOT NULL,  -- 표시 순서 (0번째 = 대표 사진)
    CREATED_AT       TIMESTAMP       DEFAULT SYSTIMESTAMP  -- 등록일시
);

COMMENT ON TABLE SF_REPORT_PHOTO IS '제보 첨부 사진 전체(대표 포함 최대 5장) - 사진은 이 테이블에서만 관리';
COMMENT ON COLUMN SF_REPORT_PHOTO.REPORT_PHOTO_ID IS 'PK (SEQ_SF_REPORT_PHOTO로 채번)';
COMMENT ON COLUMN SF_REPORT_PHOTO.REPORT_ID IS '대상 제보 FK';
COMMENT ON COLUMN SF_REPORT_PHOTO.PHOTO_URL IS '사진 URL';
COMMENT ON COLUMN SF_REPORT_PHOTO.SORT_ORDER IS '표시 순서 (0번째 = 대표 사진)';
COMMENT ON COLUMN SF_REPORT_PHOTO.CREATED_AT IS '등록일시';

-- 3-2. SF_INCIDENT.SOURCE_REPORT_ID의 FK 제약조건은 여기서 건다 -----------------
--      (SF_INCIDENT가 먼저 만들어지는데 SF_REPORT를 참조해야 해서, SF_REPORT 생성 이후로 미뤄둠)
ALTER TABLE SF_INCIDENT
    ADD CONSTRAINT FK_INCIDENT_SOURCE_REPORT FOREIGN KEY (SOURCE_REPORT_ID) REFERENCES SF_REPORT(REPORT_ID);

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


-- 6-2. 공지사항 테이블============================================
--      메인 헤더 "공지사항"에서 비로그인 사용자도 조회 가능.
--      작성/수정/삭제는 STAFF만 가능하고, 상세 진입 시 VIEW_COUNT를 +1 한다.
CREATE TABLE SF_NOTICE (
    NOTICE_ID         NUMBER          PRIMARY KEY,  -- 공지 PK (SEQ_SF_NOTICE로 채번)
    TITLE             VARCHAR2(200)   NOT NULL,     -- 공지 제목
    CONTENT           VARCHAR2(2000)  NOT NULL,     -- 공지 내용
    NOTICE_TYPE       VARCHAR2(20)    DEFAULT 'NORMAL' NOT NULL,  -- NORMAL(안내) / URGENT(긴급) / MAINTENANCE(점검)
    IS_PINNED         CHAR(1)         DEFAULT 'N' NOT NULL,       -- 상단 고정 여부 (Y/N)
    VIEW_COUNT        NUMBER          DEFAULT 0 NOT NULL,         -- 상세 조회수
    NOTICE_IMAGE_URL  VARCHAR2(500),                              -- 공지 이미지 URL (없으면 NULL)
    WRITER_ID         NUMBER          NOT NULL REFERENCES SF_MEMBER(MEMBER_ID),  -- 작성 STAFF FK
    CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP,       -- 작성일시
    UPDATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP,       -- 최종 수정일시
    CONSTRAINT CK_SF_NOTICE_TYPE CHECK (NOTICE_TYPE IN ('NORMAL', 'URGENT', 'MAINTENANCE')),
    CONSTRAINT CK_SF_NOTICE_PINNED CHECK (IS_PINNED IN ('Y', 'N')),
    CONSTRAINT CK_SF_NOTICE_VIEW_COUNT CHECK (VIEW_COUNT >= 0)
);

COMMENT ON TABLE SF_NOTICE IS '공지사항 - 비로그인 포함 전체 공개, STAFF 작성/수정/삭제';
COMMENT ON COLUMN SF_NOTICE.NOTICE_ID IS '공지 PK (SEQ_SF_NOTICE로 채번)';
COMMENT ON COLUMN SF_NOTICE.TITLE IS '공지 제목';
COMMENT ON COLUMN SF_NOTICE.CONTENT IS '공지 내용';
COMMENT ON COLUMN SF_NOTICE.NOTICE_TYPE IS '공지 유형: NORMAL(안내) / URGENT(긴급) / MAINTENANCE(점검)';
COMMENT ON COLUMN SF_NOTICE.IS_PINNED IS '상단 고정 여부 (Y/N)';
COMMENT ON COLUMN SF_NOTICE.VIEW_COUNT IS '조회수 - 상세 조회 시마다 +1';
COMMENT ON COLUMN SF_NOTICE.NOTICE_IMAGE_URL IS '첨부 이미지 URL (/uploads/파일명, 없으면 NULL)';
COMMENT ON COLUMN SF_NOTICE.WRITER_ID IS '공지 작성 STAFF 회원 FK';
COMMENT ON COLUMN SF_NOTICE.CREATED_AT IS '작성일시';
COMMENT ON COLUMN SF_NOTICE.UPDATED_AT IS '최종 수정일시';

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
-- 회원당 대표 관심지역은 최대 1개만 허용
CREATE UNIQUE INDEX UX_SF_MEMBER_PRIMARY_REGION ON SF_MEMBER_REGION (CASE WHEN IS_PRIMARY = 'Y' THEN MEMBER_ID END);
-- 특정 회원의 최근 알림을 시간순으로 조회할 때 자주 쓰이므로 복합 인덱스 생성
CREATE INDEX IDX_SF_NOTIFICATION_MEMBER_TIME ON SF_NOTIFICATION(MEMBER_ID, CREATED_AT);
-- 공지 목록: 고정 여부 우선 + 최신순 조회
CREATE INDEX IDX_SF_NOTICE_PINNED_TIME ON SF_NOTICE(IS_PINNED, CREATED_AT);
-- 공지 유형 필터용
CREATE INDEX IDX_SF_NOTICE_TYPE_TIME ON SF_NOTICE(NOTICE_TYPE, CREATED_AT);

-- ★ 신규: LOGIN_ID를 "미탈퇴 회원 사이에서만" 유일하게 강제하는 함수기반 유니크 인덱스=========
--   Oracle은 인덱스 표현식이 NULL이면 그 행을 유니크 검사 대상에서 아예 빼준다.
--   그래서 IS_WITHDRAWN='Y'인 행은 표현식이 NULL이 되어 검사 대상에서 빠지고,
--   IS_WITHDRAWN='N'인 행끼리만 LOGIN_ID 중복이 막힌다.
--   → 탈퇴한 아이디를 다른 사람(또는 본인)이 즉시 재사용해서 재가입할 수 있음.
--   → 탈퇴 계정의 LOGIN_ID 원본 값도 그대로 보존되어 감사/문의 대응 시 조회 가능.
CREATE UNIQUE INDEX UX_SF_MEMBER_LOGIN_ID_ACTIVE
    ON SF_MEMBER (CASE WHEN IS_WITHDRAWN = 'N' THEN LOGIN_ID END);

-- 7. 시퀀스 생성 (각 테이블 PK 채번용)============================================
CREATE SEQUENCE SEQ_SF_MEMBER START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_DEPARTMENT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_MEMBER_REGION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT_LOG START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_INCIDENT_PHOTO START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_REPORT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_REPORT_PHOTO START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_FAMILY_RELATION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_SAFETY_CHECK START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_NOTIFICATION START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SF_NOTICE START WITH 1 INCREMENT BY 1 NOCACHE;

-- 더미 데이터 --
-- 부서 시딩 (회원가입으로 안 만들어지므로 여기서 직접 넣음)
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '재난안전과');
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '소방본부');
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '상하수도사업본부');
INSERT INTO SF_DEPARTMENT (DEPARTMENT_ID, NAME) VALUES (SEQ_SF_DEPARTMENT.NEXTVAL, '도로교통과');

-- STAFF 계정만 (부서: 재난안전과 = 1번으로 배정)
INSERT INTO SF_MEMBER (MEMBER_ID, LOGIN_ID, PASSWORD, NAME, EMAIL, ROLE, DEPARTMENT_ID)
VALUES (SEQ_SF_MEMBER.NEXTVAL, 's', '$2a$10$3G6nByOWnMaAmupkwHj5felIP08YE9eT8lN7Wf2z1wgTgR4sBarfq', '곽지윤', 'test123@example.com', 'STAFF', 1);
COMMIT;

-- 공지사항 더미 데이터 (작성자: 위 STAFF 계정 = MEMBER_ID 1)
INSERT INTO SF_NOTICE (NOTICE_ID, TITLE, CONTENT, NOTICE_TYPE, IS_PINNED, WRITER_ID)
VALUES (SEQ_SF_NOTICE.NEXTVAL, '세이프트레이스 서비스 오픈 안내',
        '세이프트레이스 재난 상황관리 서비스가 오픈되었습니다. 주요 기능과 이용 방법을 확인해 주세요.',
        'NORMAL', 'Y', 1);

INSERT INTO SF_NOTICE (NOTICE_ID, TITLE, CONTENT, NOTICE_TYPE, IS_PINNED, WRITER_ID)
VALUES (SEQ_SF_NOTICE.NEXTVAL, '호우 시 하천변 및 지하차도 접근 자제 안내',
        '집중호우 시 하천변, 지하차도, 저지대 등 침수 위험 지역 접근을 자제하고 현장 안내와 재난문자를 우선 확인해 주세요.',
        'URGENT', 'Y', 1);

INSERT INTO SF_NOTICE (NOTICE_ID, TITLE, CONTENT, NOTICE_TYPE, IS_PINNED, WRITER_ID)
VALUES (SEQ_SF_NOTICE.NEXTVAL, '시스템 정기 점검 안내',
        '보다 안정적인 서비스 제공을 위해 정기 점검을 진행합니다. 점검 시간 동안 일부 기능 이용이 제한될 수 있습니다.',
        'MAINTENANCE', 'N', 1);

INSERT INTO SF_NOTICE (NOTICE_ID, TITLE, CONTENT, NOTICE_TYPE, IS_PINNED, WRITER_ID)
VALUES (SEQ_SF_NOTICE.NEXTVAL, '재난 행동요령 메뉴 이용 안내',
        '메인 메뉴의 행동요령에서 재난 유형별 사전 대비 및 발생 시 행동수칙을 확인할 수 있습니다.',
        'NORMAL', 'N', 1);
COMMIT;