-- =========================================================
-- SHIMON Database Schema
-- PostgreSQL-compatible
-- Team shared schema for GitHub
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------
-- 1. companies
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2. employees
-- 회사가 미리 등록한 사원 명부.
-- 회원가입 시 employee_code + name 으로 검증한다.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    employee_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('worker', 'admin')),

    job_type VARCHAR(100),
    workplace VARCHAR(150),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 3. users
-- 실제 회원가입을 완료한 계정.
--
-- IMPORTANT:
-- password_hash에는 평문 비밀번호를 저장하지 않는다.
-- 백엔드에서 bcrypt/argon2 등의 방식으로 해시한 값만 저장한다.
-- Supabase Auth / Firebase Auth 등을 사용하면 이 테이블의 인증 관련
-- 컬럼은 해당 서비스 구조에 맞춰 변경한다.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employee_id UUID NOT NULL UNIQUE
        REFERENCES employees(id)
        ON DELETE RESTRICT,

    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),

    password_hash TEXT NOT NULL,

    gender VARCHAR(20)
        CHECK (
            gender IS NULL
            OR gender IN ('남성', '여성', '기타')
        ),

    account_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (
            account_status IN ('active', 'inactive', 'suspended')
        ),

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 4. worker_profiles
-- 노동자(worker) 전용 상세 정보.
-- 관리자(admin)는 이 테이블에 레코드를 만들지 않는다.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    age INTEGER
        CHECK (age BETWEEN 18 AND 80),

    work_intensity VARCHAR(20) NOT NULL DEFAULT '보통'
        CHECK (work_intensity IN ('낮음', '보통', '높음')),

    uniform BOOLEAN NOT NULL DEFAULT TRUE,

    -- 건강정보는 민감정보이므로 관리자 노출 범위를 최소화할 것.
    health_condition VARCHAR(100) NOT NULL DEFAULT '없음',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 5. work_sessions
-- 작업 기록
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,

    duration_seconds INTEGER
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        ),

    apparent_temperature NUMERIC(5, 2),

    risk_level VARCHAR(20)
        CHECK (
            risk_level IS NULL
            OR risk_level IN ('normal', 'caution', 'warning', 'danger')
        ),

    workplace VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 6. rest_sessions
-- 휴식 기록
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS rest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    work_session_id UUID
        REFERENCES work_sessions(id)
        ON DELETE SET NULL,

    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,

    duration_seconds INTEGER
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        ),

    apparent_temperature NUMERIC(5, 2),

    recommended_duration_seconds INTEGER NOT NULL DEFAULT 1200,

    completed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 7. alerts
-- 위험 / 휴식 권장 알림
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    work_session_id UUID
        REFERENCES work_sessions(id)
        ON DELETE SET NULL,

    type VARCHAR(30) NOT NULL
        CHECK (
            type IN (
                'rest_recommendation',
                'heat_warning',
                'danger',
                'work_limit',
                'system'
            )
        ),

    risk_level VARCHAR(20)
        CHECK (
            risk_level IS NULL
            OR risk_level IN ('normal', 'caution', 'warning', 'danger')
        ),

    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,

    apparent_temperature NUMERIC(5, 2),

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- ---------------------------------------------------------
-- 8. notification_settings
-- 사용자별 알림 설정
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rest_alert BOOLEAN NOT NULL DEFAULT TRUE,
    danger_alert BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_employees_company
    ON employees(company_id);

CREATE INDEX IF NOT EXISTS idx_employees_code_name
    ON employees(employee_code, name);

CREATE INDEX IF NOT EXISTS idx_work_sessions_user_started
    ON work_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_rest_sessions_user_started
    ON rest_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_user_created
    ON alerts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_unread
    ON alerts(user_id, is_read);
