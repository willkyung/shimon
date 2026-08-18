# SHIMON API 명세서 v1.1

**목적**: React로 전환된 `frontend/worker`, `frontend/admin`과 공통 FastAPI 백엔드를 연결하기 위한 API 계약서  
**기준**: 최신 Worker React 구조 + 최신 Admin React UI/상태 구조 대조 반영  
**Base URL**: `http://localhost:8000/api/v1`  
**인증**: JWT Bearer Token  
**응답**: JSON / camelCase  
**시간**: ISO 8601  
**온도**: 섭씨 숫자값

---

# 1. 공통 규칙

## Authorization

```http
Authorization: Bearer {accessToken}
Content-Type: application/json
```

## Role

- `WORKER`
- `ADMIN`

> `role`은 프론트가 임의로 결정하지 않고 서버의 사원 정보/권한 데이터로 결정한다.

## 전체 위험 단계 `riskLevel`

- `NORMAL`
- `WATCH`
- `CAUTION`
- `HIGH`

Admin React 표시 매핑:

| API | Admin React 표시 |
|---|---|
| `NORMAL` | 정상 / `safe` |
| `WATCH` | 관심 / `watch` |
| `CAUTION` | 주의 / `caution` |
| `HIGH` | 매우 위험 / `critical` |

> `WATCH`는 전체 위험도용 단계다. AI 추정 심부체온 자체의 단계와는 구분한다.

## AI 추정 심부체온 단계 `coreTempLevel`

- `NORMAL`
- `CAUTION`
- `HIGH`

기본 기준:

- `NORMAL`: 37.5℃ 미만
- `CAUTION`: 37.5℃ 이상 38.0℃ 미만
- `HIGH`: 38.0℃ 이상

## 작업 상태

- `IDLE`
- `WORKING`
- `RESTING`
- `REST_NEEDED`

Admin React 표시 매핑:

| API | Admin React |
|---|---|
| `WORKING` | `working` |
| `RESTING` | `resting` |
| `REST_NEEDED` | `rest-needed` |
| `IDLE` | `idle` |

## AI 추정 심부체온 공통 계약

실측 체온과 혼동하지 않도록 다음 필드명을 사용한다.

```json
{
  "estimatedCoreTempC": 37.6,
  "coreTempLevel": "CAUTION",
  "measurementType": "AI_ESTIMATE",
  "isMeasured": false
}
```

## 공통 성공 응답 원칙

각 엔드포인트의 실제 데이터 객체를 바로 반환해도 되지만, 팀에서 공통 envelope를 사용할 경우 아래처럼 통일한다.

```json
{
  "success": true,
  "data": {}
}
```

## 공통 오류

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "사원코드 또는 비밀번호가 올바르지 않습니다."
  }
}
```

권장 오류 코드:

- `INVALID_CREDENTIALS`
- `INVALID_VERIFICATION_TOKEN`
- `EMPLOYEE_NOT_FOUND`
- `ROLE_NOT_ALLOWED`
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`

---

# 2. Auth

## POST `/auth/verify-employee`

회원가입 STEP 1 공통.

### Request

```json
{
  "employeeCode": "HB-W001",
  "name": "김철수"
}
```

### Response

```json
{
  "verified": true,
  "verificationToken": "temp-verification-token",
  "expiresIn": 600,
  "employee": {
    "employeeCode": "HB-W001",
    "name": "김철수",
    "company": "한빛건설",
    "role": "WORKER",
    "jobType": "토목 작업",
    "workplace": "부산 북항 현장"
  }
}
```

Admin 예시:

```json
{
  "verified": true,
  "verificationToken": "temp-verification-token",
  "expiresIn": 600,
  "employee": {
    "employeeCode": "HB-A001",
    "name": "관리자",
    "company": "한빛건설",
    "role": "ADMIN"
  }
}
```

> Admin React는 현재 확인된 employee 객체를 다음 화면으로 넘긴다. API 연동 후에는 `verificationToken`도 함께 보관해야 한다.

---

## POST `/auth/signup`

### Worker Request

```json
{
  "verificationToken": "temp-verification-token",
  "gender": "MALE",
  "phone": "010-1234-5678",
  "email": "worker@shimon.com",
  "age": 42,
  "jobType": "토목 작업",
  "workplace": "부산 북항 현장",
  "workIntensity": "MEDIUM",
  "ppeWorn": true,
  "password": "1234"
}
```

### Admin Request

```json
{
  "verificationToken": "temp-verification-token",
  "phone": "010-0000-0000",
  "email": "admin@shimon.com",
  "password": "1234"
}
```

### Response

```json
{
  "id": 21,
  "employeeCode": "HB-A001",
  "name": "관리자",
  "company": "한빛건설",
  "role": "ADMIN",
  "email": "admin@shimon.com",
  "phone": "010-0000-0000"
}
```

> Admin React 프로토타입은 `employeeCode`, `name`, `company`, `role`까지 클라이언트에서 저장하지만, API 연동 후 `role/name/company`의 기준값은 서버가 검증된 사원 정보로 결정한다.

> 신체 질환 필드는 받지 않는다.

---

## POST `/auth/login`

### Request

```json
{
  "identifier": "HB-W001",
  "password": "1234"
}
```

`identifier`는 사원코드 또는 이메일을 기본 지원한다.

### Response

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 3600,
  "user": {
    "id": 12,
    "employeeCode": "HB-W001",
    "role": "WORKER",
    "name": "김철수",
    "company": "한빛건설",
    "workplace": "부산 북항 현장"
  }
}
```

> 현재 Admin React 프로토타입은 이름 로그인도 허용하지만, 실제 API에서는 중복 가능성이 있는 이름 로그인은 사용하지 않는 것을 권장한다.

---

## POST `/auth/refresh`

### Request

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

### Response

```json
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token",
  "expiresIn": 3600
}
```

---

## POST `/auth/logout`

### Response

```json
{
  "success": true
}
```

---

# 3. User

## GET `/users/me`

현재 로그인 사용자 조회.

### Worker Response 예시

```json
{
  "id": 12,
  "employeeCode": "HB-W001",
  "role": "WORKER",
  "name": "김철수",
  "company": "한빛건설",
  "phone": "010-1234-5678",
  "email": "worker@shimon.com",
  "age": 42,
  "jobType": "토목 작업",
  "workplace": "부산 북항 현장",
  "workIntensity": "MEDIUM",
  "ppeWorn": true
}
```

### Admin Response 예시

```json
{
  "id": 21,
  "employeeCode": "HB-A001",
  "role": "ADMIN",
  "name": "관리자",
  "company": "한빛건설",
  "phone": "010-0000-0000",
  "email": "admin@shimon.com"
}
```

---

## PATCH `/users/me`

Worker 작업 정보/연락처 수정.

```json
{
  "phone": "010-9999-9999",
  "email": "worker@shimon.com",
  "jobType": "토목 작업",
  "workplace": "부산 북항 현장",
  "workIntensity": "HIGH",
  "ppeWorn": true
}
```

---

# 4. Worker Home / Safety

## GET `/worker/home`

Worker 홈에서 필요한 값을 한 번에 조회한다.

```json
{
  "worker": {
    "id": 12,
    "name": "김철수",
    "workplace": "부산 북항 현장"
  },
  "environment": {
    "airTempC": 31.2,
    "humidityPercent": 68,
    "apparentTempC": 33.0,
    "observedAt": "2026-08-18T14:10:00+09:00"
  },
  "safety": {
    "estimatedCoreTempC": 37.6,
    "coreTempLevel": "CAUTION",
    "riskLevel": "CAUTION",
    "measurementType": "AI_ESTIMATE",
    "isMeasured": false
  },
  "workSession": {
    "id": 101,
    "status": "WORKING",
    "startedAt": "2026-08-18T13:10:00+09:00",
    "elapsedSeconds": 3600
  },
  "restRecommendation": {
    "maxContinuousWorkMinutes": 120,
    "recommendedRestMinutes": 20,
    "restNeeded": false
  }
}
```

---

## GET `/worker/safety/current`

작업 진행 중 안전 상태 갱신.

```json
{
  "apparentTempC": 33.0,
  "estimatedCoreTempC": 37.6,
  "coreTempLevel": "CAUTION",
  "riskLevel": "CAUTION",
  "continuousWorkMinutes": 60,
  "measurementType": "AI_ESTIMATE",
  "isMeasured": false,
  "evaluatedAt": "2026-08-18T14:10:00+09:00"
}
```

MVP는 30~60초 polling 권장.

---

# 5. Work Session

## POST `/worker/work-sessions`

작업 시작.

### Request

```json
{
  "workplace": "부산 북항 현장"
}
```

### Response

```json
{
  "id": 101,
  "status": "WORKING",
  "startedAt": "2026-08-18T13:10:00+09:00",
  "maxContinuousWorkMinutes": 120
}
```

---

## GET `/worker/work-sessions/current`

새로고침 후 타이머 복구에 사용.

### Response

```json
{
  "id": 101,
  "status": "WORKING",
  "startedAt": "2026-08-18T13:10:00+09:00",
  "elapsedSeconds": 3600,
  "maxContinuousWorkMinutes": 120
}
```

진행 중 작업이 없으면 `204 No Content` 또는 `null` 정책 중 하나로 팀에서 통일한다.

---

## POST `/worker/work-sessions/{id}/end`

### Response

```json
{
  "id": 101,
  "status": "COMPLETED",
  "endedAt": "2026-08-18T14:05:00+09:00",
  "durationMinutes": 55,
  "averageApparentTempC": 33.0,
  "maxEstimatedCoreTempC": 37.6,
  "maxRiskLevel": "CAUTION"
}
```

---

# 6. Rest Session

## POST `/worker/rest-sessions`

### Request

```json
{
  "workSessionId": 101,
  "reason": "USER_STARTED"
}
```

`reason`:

- `USER_STARTED`
- `SYSTEM_RECOMMENDED`
- `ADMIN_REQUESTED`

### Response

```json
{
  "id": 202,
  "status": "RESTING",
  "startedAt": "2026-08-18T14:05:00+09:00",
  "targetMinutes": 20,
  "resumeWorkAfterRest": true
}
```

---

## GET `/worker/rest-sessions/current`

### Response

```json
{
  "id": 202,
  "status": "RESTING",
  "startedAt": "2026-08-18T14:05:00+09:00",
  "elapsedSeconds": 300,
  "remainingSeconds": 900,
  "targetMinutes": 20,
  "resumeWorkAfterRest": true
}
```

---

## POST `/worker/rest-sessions/{id}/end`

```json
{
  "id": 202,
  "status": "COMPLETED",
  "endedAt": "2026-08-18T14:25:00+09:00",
  "durationMinutes": 20,
  "resumeWork": true
}
```

---

# 7. Worker Records

## GET `/worker/records`

Query:

```text
type=work|rest|all
date=2026-08-18
page=1
size=20
```

### Response

```json
{
  "items": [
    {
      "id": 101,
      "type": "WORK",
      "startedAt": "2026-08-18T13:10:00+09:00",
      "endedAt": "2026-08-18T14:05:00+09:00",
      "durationMinutes": 55,
      "averageApparentTempC": 33.0,
      "maxEstimatedCoreTempC": 37.6,
      "riskLevel": "CAUTION"
    }
  ],
  "total": 3,
  "page": 1,
  "size": 20
}
```

---

## GET `/worker/records/summary?date=2026-08-18`

```json
{
  "workCount": 3,
  "totalWorkMinutes": 185,
  "totalRestMinutes": 60,
  "averageApparentTempC": 31.0,
  "maxEstimatedCoreTempC": 37.6,
  "maxRiskLevel": "CAUTION",
  "message": "오늘도 권장 휴식을 지키며 안전하게 작업하고 있어요."
}
```

---

# 8. Worker Notifications

## GET `/worker/notifications`

```json
{
  "items": [
    {
      "id": 501,
      "type": "REST_RECOMMENDATION",
      "title": "휴식 권장 알림",
      "message": "체감온도가 높아졌습니다. 지금 휴식을 권장합니다.",
      "riskLevel": "CAUTION",
      "createdAt": "2026-08-18T14:10:00+09:00",
      "read": false
    }
  ],
  "unreadCount": 1
}
```

---

## PATCH `/worker/notifications/{id}/read`

```json
{
  "id": 501,
  "read": true
}
```

---

## GET `/worker/notification-settings`

```json
{
  "enabled": true
}
```

---

## PATCH `/worker/notification-settings`

```json
{
  "enabled": true
}
```

---

# 9. Admin Dashboard

## GET `/admin/dashboard?site=all`

Admin React Dashboard에서 사용하는 상태 카운트, AI 추정 심부체온 지표, PPE 지표, 휴식 이행률, 시간대별 체감온도 추이를 한 번에 반환한다.

### Response

```json
{
  "metrics": {
    "workingCount": 3,
    "restingCount": 2,
    "restNeededCount": 3,
    "currentApparentTempC": 41.0,
    "maxApparentTempC": 44.0,
    "highCoreTempCount": 2,
    "averageEstimatedCoreTempC": 36.8,
    "highRiskCount": 2,
    "ppeMissingCount": 1,
    "restComplianceRate": 88
  },
  "apparentTempTrend": [
    {
      "time": "08:00",
      "apparentTempC": 36.0
    },
    {
      "time": "10:00",
      "apparentTempC": 37.5
    },
    {
      "time": "12:00",
      "apparentTempC": 40.0
    },
    {
      "time": "14:00",
      "apparentTempC": 44.0
    },
    {
      "time": "16:00",
      "apparentTempC": 41.5
    },
    {
      "time": "18:00",
      "apparentTempC": 39.0
    }
  ],
  "priorityWorkers": [
    {
      "workerId": "W007",
      "name": "윤지호",
      "site": "미포 현장 A구역",
      "status": "REST_NEEDED",
      "riskLevel": "HIGH",
      "apparentTempC": 44.0,
      "estimatedCoreTempC": 38.9
    }
  ]
}
```

### Admin React 연결

```text
workingCount                 → dashboardMetrics.working
restingCount                 → dashboardMetrics.resting
restNeededCount              → dashboardMetrics.restNeeded
highCoreTempCount            → dashboardMetrics.coreDangerCount
averageEstimatedCoreTempC    → dashboardMetrics.coreAverage
highRiskCount                → dashboardMetrics.criticalCount
ppeMissingCount              → dashboardMetrics.ppeMissingCount
currentApparentTempC          → 대시보드 '현재'
maxApparentTempC              → 대시보드 '오늘 최고'
restComplianceRate           → 대시보드 '휴식 이행률'
apparentTempTrend             → 시간대별 체감온도 그래프
```

> 기존 Admin React의 그래프 path와 `88%` 고정값은 API 연동 후 서버 응답값으로 교체한다.

---

# 10. Admin Workers

## GET `/admin/workers`

Query:

```text
site=all
status=all|WORKING|RESTING|REST_NEEDED
search=김민준
sort=priority|temp_desc|core_desc|work_desc|name
page=1
size=50
```

### Response

```json
{
  "items": [
    {
      "id": "W001",
      "employeeCode": "HB-W001",
      "name": "김민준",
      "jobType": "건설 작업",
      "phone": "010-2451-1184",
      "ppeWorn": true,
      "apparentTempC": 43.0,
      "estimatedCoreTempC": 38.5,
      "coreTempLevel": "HIGH",
      "lastWorkStartedAt": "2026-08-18T11:06:00+09:00",
      "lastWorkEndedAt": null,
      "dailyWorkMinutes": 312,
      "status": "REST_NEEDED",
      "riskLevel": "HIGH",
      "site": "강남 현장 A구역"
    }
  ],
  "total": 8,
  "page": 1,
  "size": 50
}
```

### Admin React 표시 매핑

```text
ppeWorn=true            → uniform='착용'
ppeWorn=false           → uniform='미착용'
apparentTempC           → apparentTemp
estimatedCoreTempC      → coreTemp
lastWorkStartedAt       → lastStart (HH:mm 포맷)
lastWorkEndedAt         → lastStop (없으면 '-')
dailyWorkMinutes        → dailyMinutes
status                  → working/resting/rest-needed 변환
riskLevel               → safe/watch/caution/critical 변환
```

---

## GET `/admin/workers/{workerId}`

### Response

```json
{
  "id": "W001",
  "employeeCode": "HB-W001",
  "name": "김민준",
  "company": "한빛건설",
  "jobType": "건설 작업",
  "phone": "010-2451-1184",
  "email": "worker@shimon.com",
  "age": 42,
  "workIntensity": "MEDIUM",
  "ppeWorn": true,
  "site": "강남 현장 A구역",
  "currentStatus": "REST_NEEDED",
  "riskLevel": "HIGH",
  "apparentTempC": 43.0,
  "estimatedCoreTempC": 38.5,
  "coreTempLevel": "HIGH",
  "continuousWorkMinutes": 95,
  "dailyWorkMinutes": 312,
  "lastWorkStartedAt": "2026-08-18T11:06:00+09:00",
  "lastWorkEndedAt": null
}
```

---

# 11. Admin Alerts

## GET `/admin/alerts`

Query:

```text
site=all
level=all|WATCH|CAUTION|HIGH
status=OPEN|ACKNOWLEDGED|RESOLVED
page=1
size=50
```

### Response

```json
{
  "items": [
    {
      "id": 7001,
      "workerId": "W007",
      "workerName": "윤지호",
      "riskLevel": "HIGH",
      "title": "매우 위험 · 즉시 휴식 필요",
      "statusText": "즉시 휴식 필요",
      "message": "체감온도 44°C · AI 추정 심부체온 38.9°C · 연속 작업시간 초과",
      "apparentTempC": 44.0,
      "estimatedCoreTempC": 38.9,
      "reason": "연속 작업시간 초과",
      "occurredAt": "2026-08-18T14:42:00+09:00",
      "alertStatus": "OPEN"
    }
  ],
  "total": 4,
  "page": 1,
  "size": 50
}
```

> Admin React는 현재 `workerName`으로 노동자 배열을 다시 찾아 온도를 표시하지만, API 연동 후에는 Alert 응답의 `workerId`, `apparentTempC`, `estimatedCoreTempC`를 직접 사용한다.

---

## POST `/admin/workers/{workerId}/rest-alert`

관리자가 특정 노동자에게 휴식 알림을 발송한다.

### Request

```json
{
  "message": "현재 위험도가 높습니다. 즉시 휴식을 시작해주세요.",
  "reason": "HIGH_RISK"
}
```

`reason` 권장값:

- `HIGH_RISK`
- `REST_NEEDED`
- `MANUAL_ADMIN_REQUEST`

### Response

```json
{
  "notificationId": 9001,
  "workerId": "W007",
  "type": "ADMIN_REST_REQUEST",
  "sentAt": "2026-08-18T14:43:00+09:00"
}
```

> Admin React의 현재 `sendWorkerRestAlert(worker.name)` 호출은 API 연동 시 `sendWorkerRestAlert(worker.id)` 형태로 변경한다.

---

## PATCH `/admin/alerts/{alertId}`

### Request

```json
{
  "status": "ACKNOWLEDGED"
}
```

### Response

```json
{
  "id": 7001,
  "alertStatus": "ACKNOWLEDGED",
  "updatedAt": "2026-08-18T14:45:00+09:00"
}
```

---

# 12. Admin Settings

## GET `/admin/settings`

```json
{
  "apparentTempDangerC": 43.0,
  "apparentTempCautionC": 38.0,
  "maxWorkMinutes": 120,
  "restMinutes": 20,
  "coreTempCautionC": 37.5,
  "coreTempDangerC": 38.0,
  "defaultSite": "all",
  "channels": {
    "push": true,
    "sms": true,
    "email": false,
    "emergency": true
  }
}
```

## PUT `/admin/settings`

Request/Response는 위 설정 객체와 동일한 구조를 사용한다.

Validation:

```text
apparentTempDangerC > apparentTempCautionC
coreTempDangerC > coreTempCautionC
restMinutes > 0
maxWorkMinutes > 0
```

### Admin React 설정 필드 매핑

| API | 현재 Admin React |
|---|---|
| `apparentTempDangerC` | `dangerTemp` |
| `apparentTempCautionC` | `cautionTemp` |
| `maxWorkMinutes` | `maxWorkMinutes` |
| `restMinutes` | `restMinutes` |
| `coreTempCautionC` | `coreCautionTemp` |
| `coreTempDangerC` | `coreDangerTemp` |
| `defaultSite` | `defaultSite` |
| `channels` | `channels` |

> Worker는 관리자 설정을 서버에서 읽어 사용한다. `localStorage`를 Worker/Admin 사이의 공유 수단으로 사용하지 않는다.

---

# 13. Sites / Environment

## GET `/sites`

### Response

```json
{
  "items": [
    {
      "siteId": "SITE001",
      "siteCode": "GANGNAM",
      "name": "강남 현장",
      "zoneCount": 3
    },
    {
      "siteId": "SITE002",
      "siteCode": "SEOCHO",
      "name": "서초 현장",
      "zoneCount": 2
    },
    {
      "siteId": "SITE003",
      "siteCode": "MIPO",
      "name": "미포 현장",
      "zoneCount": 2
    }
  ]
}
```

Admin React의 현재 하드코딩:

```text
전체 현장
강남 현장
서초 현장
미포 현장
```

은 API 연동 후 `/sites` 응답을 사용한다.

---

## GET `/environment/current?siteId=SITE001`

```json
{
  "siteId": "SITE001",
  "airTempC": 31.2,
  "humidityPercent": 68,
  "apparentTempC": 33.0,
  "observedAt": "2026-08-18T14:10:00+09:00",
  "source": "WEATHER_API"
}
```

---

# 14. AI / Rule Engine 내부 데이터 계약

프론트가 AI 모델을 직접 호출하지 않는다.

## 입력

```json
{
  "apparentTempC": 33.0,
  "age": 42,
  "workIntensity": "MEDIUM",
  "ppeWorn": true,
  "continuousWorkMinutes": 60
}
```

## 출력

```json
{
  "estimatedCoreTempC": 37.6,
  "coreTempLevel": "CAUTION",
  "riskLevel": "CAUTION",
  "modelVersion": "xgb-1.0.0",
  "evaluatedAt": "2026-08-18T14:10:00+09:00"
}
```

`riskLevel`은 Rule Engine을 거쳐 `NORMAL | WATCH | CAUTION | HIGH` 중 하나가 될 수 있다.

프론트는 모델을 직접 호출하지 않고 `/worker/safety/current`, `/worker/home`, `/admin/dashboard`, `/admin/workers`, `/admin/alerts`를 사용한다.

---

# 15. React 연결 매핑

## Worker

| React 기능 | API |
|---|---|
| `login()` | `POST /auth/login` |
| 사원 확인 | `POST /auth/verify-employee` |
| `signup()` | `POST /auth/signup` |
| `currentUser` | `GET /users/me` |
| `saveProfile()` | `PATCH /users/me` |
| Home | `GET /worker/home` |
| `estimatedCoreTemp` | `GET /worker/safety/current` |
| `startWork()` | `POST /worker/work-sessions` |
| 타이머 복구 | `GET /worker/work-sessions/current` |
| `endWork()` | `POST /worker/work-sessions/{id}/end` |
| `startRest()` | `POST /worker/rest-sessions` |
| 휴식 타이머 복구 | `GET /worker/rest-sessions/current` |
| `endRest()` | `POST /worker/rest-sessions/{id}/end` |
| 기록 | `GET /worker/records` |
| 기록 요약 | `GET /worker/records/summary` |
| 알림 | `GET /worker/notifications` |
| 알림 읽음 | `PATCH /worker/notifications/{id}/read` |
| 알림 설정 | `GET/PATCH /worker/notification-settings` |

## Admin

| React 기능 | API |
|---|---|
| 로그인 | `POST /auth/login` |
| 사원 확인 | `POST /auth/verify-employee` |
| 회원가입 | `POST /auth/signup` |
| 관리자 정보 | `GET /users/me` |
| Dashboard | `GET /admin/dashboard` |
| 노동자 현황 | `GET /admin/workers` |
| 노동자 상세 | `GET /admin/workers/{workerId}` |
| 위험 알림 | `GET /admin/alerts` |
| 위험 알림 상태 변경 | `PATCH /admin/alerts/{alertId}` |
| 휴식 알림 발송 | `POST /admin/workers/{workerId}/rest-alert` |
| 설정 조회 | `GET /admin/settings` |
| 설정 저장 | `PUT /admin/settings` |
| 현장 목록 | `GET /sites` |

## Admin React에서 API 연동 시 바꿀 부분

1. `verifyAdminEmployee()` 결과에 `verificationToken` 저장
2. `signup()` 시 `role/name/company`을 신뢰값으로 보내지 않고 `verificationToken` 사용
3. `sendWorkerRestAlert(worker.name)` → `sendWorkerRestAlert(worker.id)`
4. Alert 화면에서 `workerName` 재검색 대신 `workerId`와 Alert 응답 온도 필드 사용
5. Dashboard의 고정 `88%` → `restComplianceRate`
6. Dashboard SVG 고정 그래프 → `apparentTempTrend`
7. `SITE_OPTIONS` 하드코딩 → `GET /sites`
8. Admin local state 필드와 API DTO 차이는 `adminApi.js` adapter에서 변환

---

# 16. Frontend API 폴더

```text
frontend/
├─ worker/src/api/
│  ├─ client.js
│  ├─ authApi.js
│  ├─ workerApi.js
│  └─ notificationApi.js
└─ admin/src/api/
   ├─ client.js
   ├─ authApi.js
   └─ adminApi.js
```

`.env`

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Admin adapter 예시

```js
export function mapAdminWorker(item) {
  const statusMap = {
    WORKING: 'working',
    RESTING: 'resting',
    REST_NEEDED: 'rest-needed',
    IDLE: 'idle',
  };

  const riskMap = {
    NORMAL: 'safe',
    WATCH: 'watch',
    CAUTION: 'caution',
    HIGH: 'critical',
  };

  return {
    id: item.id,
    name: item.name,
    jobType: item.jobType,
    phone: item.phone,
    uniform: item.ppeWorn ? '착용' : '미착용',
    apparentTemp: item.apparentTempC,
    coreTemp: item.estimatedCoreTempC,
    lastStart: item.lastWorkStartedAt
      ? new Date(item.lastWorkStartedAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '-',
    lastStop: item.lastWorkEndedAt
      ? new Date(item.lastWorkEndedAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '-',
    dailyMinutes: item.dailyWorkMinutes,
    status: statusMap[item.status] ?? 'idle',
    risk: riskMap[item.riskLevel] ?? 'safe',
    site: item.site,
  };
}
```

---

# 17. CSV 내보내기

현재 Admin React는 브라우저에서 `siteWorkers`를 CSV로 생성한다.

MVP에서는 현재 방식 유지 가능.

주의:

- `/admin/workers`에 pagination을 적용하면 현재 화면에 로딩된 데이터만 CSV에 포함될 수 있다.
- 전체 노동자 CSV가 반드시 필요해지면 추후 `GET /admin/workers/export` 추가를 검토한다.
- v1.1 필수 API에는 포함하지 않는다.

---

# 18. 구현 순서

## Phase 1 — Auth

```text
POST /auth/verify-employee
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me
```

## Phase 2 — Worker

```text
GET  /worker/home
GET  /worker/safety/current
POST /worker/work-sessions
GET  /worker/work-sessions/current
POST /worker/work-sessions/{id}/end
POST /worker/rest-sessions
GET  /worker/rest-sessions/current
POST /worker/rest-sessions/{id}/end
GET  /worker/records
GET  /worker/records/summary
GET  /worker/notifications
PATCH /worker/notifications/{id}/read
GET/PATCH /worker/notification-settings
```

## Phase 3 — Admin

```text
GET   /admin/dashboard
GET   /admin/workers
GET   /admin/workers/{workerId}
GET   /admin/alerts
PATCH /admin/alerts/{alertId}
POST  /admin/workers/{workerId}/rest-alert
GET   /admin/settings
PUT   /admin/settings
GET   /sites
```

## Phase 4 — AI / Weather

```text
Weather API
→ XGBoost
→ Rule Engine
→ DB
→ Worker/Admin API
→ React UI
```

---

# 19. Polling 권장

## Worker

```text
GET /worker/safety/current
30~60초
```

## Admin

```text
GET /admin/dashboard
GET /admin/alerts
약 30초
```

MVP 이후 실시간성이 더 필요하면 SSE 또는 WebSocket으로 전환한다.

---

# 20. 통합 테스트

## Worker

```text
로그인
→ 홈 조회
→ 작업 시작
→ 안전값 갱신
→ 휴식 시작
→ 휴식 종료
→ 작업 종료
→ 기록 조회
```

## Admin ↔ Worker

```text
Worker 작업 시작
→ Rule Engine HIGH 위험 발생
→ Admin Dashboard 표시
→ Admin 휴식 알림 발송(workerId)
→ Worker 알림 수신
→ Worker 휴식 시작
→ Admin 상태 RESTING 반영
```

## Admin 설정 ↔ Worker

```text
Admin 기준값 수정
→ PUT /admin/settings
→ Worker 안전 판정/휴식 기준에 반영
→ Worker/Admin 화면에 동일 기준 표시
```

---

# 21. 현재 SHIMON 기본값

```text
API prefix              /api/v1
REST target             20분
Max continuous work     120분
Core caution            37.5℃
Core danger             38.0℃
Risk levels             NORMAL / WATCH / CAUTION / HIGH
Worker safety polling   30~60초
Admin dashboard polling 30초
```

---

# 22. v1.0 → v1.1 변경사항

1. Admin React 실제 상태값에 맞춰 `WATCH` 위험 단계 추가
2. `riskLevel`과 `coreTempLevel`을 분리해 의미 명확화
3. Admin 회원가입 `verificationToken` 흐름 명확화
4. Dashboard에 `currentApparentTempC`, `restComplianceRate`, `apparentTempTrend` 추가
5. Admin Workers에 최근 작업 시작/종료 시간 필드 추가
6. 노동자 상태/위험도/PPE의 React adapter 매핑 정의
7. 관리자 휴식 알림을 `workerName`이 아닌 `workerId` 기준으로 확정
8. Admin Alert 응답에 화면 표시용 `title`, `message`, 온도값 추가
9. Admin Settings API ↔ 현재 React 필드명 매핑 명시
10. `/sites` 응답 구조 정의
11. CSV 내보내기는 MVP 클라이언트 방식 유지, 추후 export API 검토
12. Auth refresh/logout 응답 예시 보강

---

## 문서 버전

`SHIMON API Contract v1.1`
