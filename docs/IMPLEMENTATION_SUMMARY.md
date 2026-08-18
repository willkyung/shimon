# SHIMON 백엔드 구현 정리 (Phase 1~4)

`SHIMON_API_SPEC_v1.2.md` 기준으로 실제 구현된 내용을 정리한 문서. 명세서가 "계약"이라면
이 문서는 "그 계약을 실제로 어떻게 지켰는지"에 대한 기록이다.

---

## 전체 구조 한눈에 보기

```
Weather API(기상청) ─┐
                     ├─▶ XGBoost 모델 ─▶ Rule Engine ─▶ DB 저장/실시간 응답 ─▶ Worker/Admin API
WorkSession/Profile ─┘
```

| 계층 | 파일 |
|---|---|
| 인증/보안 | `backend/app/core/security.py` |
| AI 모델 | `ai/models/xgb_core_temp_model.json` (학습: `ai/scripts/train.py`) |
| 날씨 조회 | `backend/app/services/weather_service.py` |
| 특징값 계산 + Rule Engine | `backend/app/services/heat_features.py` |
| 모델 실행(추론) | `backend/app/services/risk_service.py` |
| 실시간 안전도 계산(공용) | `backend/app/services/safety_service.py` |
| 백그라운드 배치(5분 주기) | `backend/app/core/risk_scheduler.py` |
| Worker API | `backend/app/api/routes/worker.py` |
| Admin API | `backend/app/api/routes/admin.py` |
| Auth/User API | `backend/app/api/routes/auth.py`, `users.py` |

---

## Phase 1 — 인증 (Auth)

### 구현한 API

| API | 설명 |
|---|---|
| `POST /auth/verify-employee` | 사원코드+이름으로 사전 등록된 직원 명단(`EmployeeRoster`) 대조 → 10분짜리 `verificationToken` 발급 |
| `POST /auth/signup` | `verificationToken`으로 가입. role/name/company는 서버(명단)가 결정, 나머지 프로필 값은 요청 바디로 |
| `POST /auth/login` | `identifier`(사원코드 또는 이메일) + 비밀번호 → access/refresh 토큰 |
| `POST /auth/refresh` | refresh 토큰으로 access/refresh 재발급 |
| `POST /auth/logout` | stateless라 형식상 성공만 반환 (아래 한계 참고) |
| `GET /users/me` | 내 정보 조회 |
| `PATCH /users/me` | Worker 프로필 수정 (전화/이메일/성별/직종/현장/작업강도/PPE) |

### 핵심 설계 결정

- **ID 타입**: 명세서가 숫자형 ID를 요구하지만 DB는 UUID 기반 → `User.display_id`(auto-increment 정수)를 별도로 추가해서, **내부 PK/FK는 UUID 그대로, API 응답에만 숫자 ID를 노출**한다.
- **직원 사전등록(`EmployeeRoster`)**: 해커톤 MVP라 관리자가 직원을 등록하는 화면/API는 아직 없고, `backend/scripts/seed_employee_roster.py`로 데모 데이터만 시드한다.
- **refresh 토큰은 stateless(JWT)**: 서버에 저장/블랙리스트하지 않는다. 즉 `logout`을 호출해도 이미 발급된 refresh 토큰 자체는 만료 전까지 여전히 유효하다 (진짜 보안이 필요해지면 블랙리스트 테이블 추가 필요).

### DB 변경

- `EmployeeRoster` 테이블 신규
- `User.display_id`, `User.employee_code`를 회사 스코프가 아닌 **전역 유일값**으로 변경
- `WorkerProfile`에 `gender`, `job_type`, `work_intensity`, `ppe_worn` 컬럼 추가

---

## Phase 2 — Worker 핵심 기능

### 구현한 API

| API | 설명 |
|---|---|
| `GET /worker/home` | 홈 화면 통합 조회 (환경/안전값/현재 세션/휴식 권고) |
| `GET /worker/safety/current` | 실시간 안전 상태 (30~60초 폴링용) |
| `POST /worker/work-sessions` | 작업 시작 |
| `GET /worker/work-sessions/current` | 진행 중 세션 조회 (없으면 204) |
| `POST /worker/work-sessions/{id}/end` | 작업 종료 + 요약 통계 |
| `POST /worker/rest-sessions` | 휴식 시작 (작업 중 휴식 또는 독립 휴식) |
| `GET /worker/rest-sessions/current` | 진행 중 휴식 조회 (없으면 204) |
| `POST /worker/rest-sessions/{id}/end` | 휴식 종료 |
| `GET /worker/records`, `/records/summary` | 작업/휴식 이력 및 일일 요약 |
| `GET /worker/notifications` 등 4개 | 알림 조회/읽음/스누즈/설정 |

### 핵심 설계 결정

- **실시간 계산 vs 배치 저장 역할 분리**: `GET /worker/home`, `/safety/current`는 **매 요청마다 AI 모델을 즉시 재계산**해서 최신값을 보여주고 DB엔 저장하지 않는다. 실제 이력(`heat_risk_assessments` 등)은 5분 주기 백그라운드 스케줄러(`risk_scheduler.py`)만 저장한다. 폴링이 잦아도(30초) DB에 부담을 주지 않기 위한 구조.
- **PPE 매핑**: 명세서의 `ppeWorn`(boolean, 착용여부)을 학습 데이터의 clothing 카테고리(통기성/비통기성)로 변환해야 함. 학습 데이터엔 "미착용" 케이스가 없어서, `ppeWorn=False`(착용 안 함)는 더 위험한 쪽인 "비통기성"으로 보수적으로 매핑한다 (`heat_features.ppe_worn_to_clothing_level`).
- **독립 휴식 지원**: 작업 세션과 무관하게 바로 휴식을 시작할 수 있어야 해서(`workSessionId: null`), `RestRecord.work_session_id`를 nullable로 바꾸고 `worker_id`를 직접 연결했다.

### DB 변경

- `WorkSession`, `RestRecord`에 `display_id` 추가
- `RestRecord`: `work_session_id` nullable화, `worker_id`/`target_minutes`/`resume_work_after_rest` 추가, `rest_type` → `reason`(USER_STARTED/SYSTEM_RECOMMENDED/ADMIN_REQUESTED)으로 개편
- `Notification` 테이블 신규
- `WorkerProfile.notifications_enabled` 추가

---

## Phase 3 — Admin 기능

### 구현한 API

| API | 설명 |
|---|---|
| `GET /admin/dashboard` | 회사 전체 집계 지표 + 시간대별 체감온도 추이 + 우선조치 작업자 목록 |
| `GET /admin/workers`, `/admin/workers/{id}` | 작업자 목록/상세 (실시간 위험도 포함) |
| `GET /admin/alerts` | 시스템이 자동 생성한 위험 알림 목록 |
| `PATCH /admin/alerts/{id}` | 알림 상태 변경 (OPEN/ACKNOWLEDGED/RESOLVED) |
| `POST /admin/workers/{id}/rest-alert` | 관리자가 특정 작업자에게 휴식 권고 발송 |
| `GET/PUT /admin/settings` | 회사별 설정 조회/저장 |
| `GET /sites` | 현장 목록 |

### 핵심 설계 결정

- **공용 로직 추출**: Worker와 Admin이 똑같은 "실시간 안전도 계산"을 각자 다시 구현하지 않도록 `safety_service.py`로 뽑아서 공유한다.
- **Alert/Notification 자동 생성**: `risk_scheduler.py`(5분 배치)가 위험 등급이 **이전보다 올라갈 때만** Worker용 `Notification`과 Admin용 `Alert`를 동시에 생성한다 (매번 알림 보내면 스팸이 되므로).
- **Admin Settings는 "저장만" 되고 판정에는 반영 안 함**: 온도/시간 임계값을 관리자가 API로 바꿀 수 있게 저장은 되지만(`AdminSettings` 테이블), 실제 위험 판정 로직(`heat_features.py`)은 여전히 고정 상수를 쓴다. **"위험 기준은 안 바꿔도 된다"는 결정에 따라 의도적으로 연결하지 않음.**

### DB 변경

- `Alert`, `AdminSettings` 테이블 신규

---

## Phase 4 — AI/Weather 파이프라인 통합 검증

Phase 4는 새 API가 아니라, Phase 1~3에서 만든 조각들이 실제로 끊김 없이 연결되는지 확인하는
단계였다. 아래 흐름을 실제 요청으로 검증 완료:

```
Worker 작업 시작
  → Weather API 실시간 호출 (기상청, 1시간 캐싱)
  → XGBoost 모델 예측 (심부체온)
  → Rule Engine 판정 (아래 참고)
  → Admin Dashboard/Workers에 실시간 반영
  → 위험 등급 상승 시 Notification + Alert 자동 생성
  → Admin이 휴식 알림 발송 → Worker 알림 수신 → Worker 휴식 시작 → Admin 화면에 RESTING 반영
```

---

## Rule Engine 최종 로직 (`heat_features.py`)

### 1) `score_to_risk_level` — 심부체온 → coreTempLevel (3단계)

| 등급 | 예측 심부체온 |
|---|---|
| NORMAL | < 37.6℃ |
| CAUTION | 37.6 ~ 38.4℃ |
| HIGH | ≥ 38.4℃ |

### 2) `compute_overall_risk_level` — coreTempLevel + 체감온도·연속작업시간 → riskLevel (3단계)

```python
if core_temp_level == "HIGH":
    return "HIGH"
if apparent_temp_c >= 35.0 and continuous_work_minutes >= 60:
    return "HIGH"
if apparent_temp_c >= 33.0 and continuous_work_minutes >= 120:
    return "HIGH"
if core_temp_level == "CAUTION":
    return "CAUTION"
return "NORMAL"
```

> 참고: 처음엔 NORMAL/WATCH/CAUTION/HIGH 4단계였으나, 최종적으로 WATCH를 제거하고 NORMAL/CAUTION/HIGH 3단계로 단순화했다 (DB enum도 마이그레이션으로 동일하게 정리).

---

## 알려진 한계 / 다음에 할 일

- **인증**: refresh 토큰이 stateless라 로그아웃해도 서버에서 강제 무효화되지 않음
- **직원 등록**: 관리자가 직접 사원을 등록하는 기능 없음 (시드 스크립트로만 채움)
- **Admin Settings**: 저장은 되지만 실제 판정 로직에 반영 안 됨 (의도된 결정)
- **기록 통계(`averageApparentTempC` 등)**: 5분 배치가 남긴 `heat_risk_assessments`에 의존 — 세션이 5분보다 짧으면 통계가 비어있을 수 있음
- **AI 모델 자체의 한계**: 학습 데이터의 연속작업시간 최댓값이 61분이라 그 이상은 예측이 고정(saturate)됨 — `ai/heat_risk_model_documentation.md` 참고
- **Admin 목록/대시보드 성능**: 작업자 전원에 대해 매번 실시간으로 AI 모델을 호출 — 작업자 수가 많아지면 느려질 수 있음 (해커톤 규모에선 문제없음)
- **`restComplianceRate`**: 실제 이행률 추적 로직 없이 100 고정값

---

## 로컬 테스트 방법

```bash
# 1. DB 실행
docker compose up -d

# 2. 마이그레이션 적용
cd backend && alembic upgrade head

# 3. 데모 데이터 시드
python -m backend.scripts.seed_employee_roster

# 4. 서버 실행
uvicorn backend.app.main:app --reload

# 5. Swagger UI에서 확인
# http://localhost:8000/docs
```

데모 계정: `HB-W001`(Worker, 김철수) / `HB-A001`(Admin, 관리자), 비밀번호는 각자 회원가입 시 설정한 값.
