-- ============================================
-- 테스트 전용 Oracle 계정(스키마) 만들기 - 개발 DB(SYSTEM)와 분리된 곳에서 테스트하기 위함
-- 한 번만 실행한다.
--   1) SQL Developer에서 SYSTEM(관리자)으로 접속해 이 파일을 스크립트 실행(F5)
--      비밀번호를 물으면 테스트 계정에 쓸 비밀번호를 입력한다 (파일에 적지 않는다)
--   2) 새 접속을 만든다: 사용자 safetrace_test, 위에서 정한 비밀번호, 같은 호스트·SID(xe)
--   3) 그 접속(safetrace_test)으로 backend/schema.sql 전체를 스크립트 실행한다
--      (맨 위 DROP 블록은 그 계정의 객체만 지운다. 개발 DB에는 영향 없다)
--   4) 같은 접속으로 backend/verify-resource.sql도 실행해 PASS·실패 0건을 확인한다
--   5) 테스트를 돌릴 터미널에서 환경변수를 지정한 뒤 mvn test
--        PowerShell:  $env:SAFETRACE_TEST_DB_PASSWORD = "위에서 정한 비밀번호"
-- 계정 이름은 반드시 _TEST로 끝나야 한다 (Oracle 통합 테스트의 안전장치가 확인한다)
-- [참고] CREATE USER에서 ORA-65096 오류가 나면 Oracle 18c 이상의 CDB 접속이라는 뜻이다.
--        그때는 이름을 c##safetrace_test로 바꿔 만들고(아래 두 곳 + 접속 사용자 + SAFETRACE_TEST_DB_USERNAME),
--        QUOTA·GRANT 문장은 그대로 쓴다. (c##...TEST도 _TEST로 끝나므로 안전장치를 통과한다)
-- [참고] DEFAULT TABLESPACE USERS가 없다는 오류가 나면 그 줄을 지우고 다시 실행한다.
-- ============================================

ACCEPT TEST_PW CHAR PROMPT '테스트 계정 비밀번호: ' HIDE

CREATE USER safetrace_test IDENTIFIED BY "&TEST_PW"
    DEFAULT TABLESPACE USERS
    QUOTA UNLIMITED ON USERS;

GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW, CREATE PROCEDURE, CREATE TRIGGER TO safetrace_test;

-- 되돌리기(테스트 계정과 그 안의 모든 객체 삭제):
-- DROP USER safetrace_test CASCADE;
