-- =========================================================
-- SHIMON Seed Data
-- 개발 / 데모 환경에서만 사용
-- =========================================================

-- ---------------------------------------------------------
-- 회사
-- ---------------------------------------------------------
INSERT INTO companies (name)
VALUES
    ('한빛건설'),
    ('대성건설')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------
-- 한빛건설 노동자
-- ---------------------------------------------------------
INSERT INTO employees (
    company_id,
    employee_code,
    name,
    role,
    job_type,
    workplace
)
SELECT
    id,
    'HB-W001',
    '김철수',
    'worker',
    '토목 작업',
    '부산 북항 현장'
FROM companies
WHERE name = '한빛건설'
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO employees (
    company_id,
    employee_code,
    name,
    role,
    job_type,
    workplace
)
SELECT
    id,
    'HB-W002',
    '김민준',
    'worker',
    '건설 작업',
    '강남 현장 A구역'
FROM companies
WHERE name = '한빛건설'
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO employees (
    company_id,
    employee_code,
    name,
    role,
    job_type,
    workplace
)
SELECT
    id,
    'HB-W003',
    '이서준',
    'worker',
    '건설 작업',
    '강남 현장 B구역'
FROM companies
WHERE name = '한빛건설'
ON CONFLICT (employee_code) DO NOTHING;

-- ---------------------------------------------------------
-- 한빛건설 관리자
-- ---------------------------------------------------------
INSERT INTO employees (
    company_id,
    employee_code,
    name,
    role,
    job_type,
    workplace
)
SELECT
    id,
    'HB-A001',
    '관리자',
    'admin',
    NULL,
    '통합 관제 센터'
FROM companies
WHERE name = '한빛건설'
ON CONFLICT (employee_code) DO NOTHING;

-- ---------------------------------------------------------
-- 대성건설 노동자
-- ---------------------------------------------------------
INSERT INTO employees (
    company_id,
    employee_code,
    name,
    role,
    job_type,
    workplace
)
SELECT
    id,
    'DS-W001',
    '박민수',
    'worker',
    '도로 작업',
    '대전 도로 현장'
FROM companies
WHERE name = '대성건설'
ON CONFLICT (employee_code) DO NOTHING;
