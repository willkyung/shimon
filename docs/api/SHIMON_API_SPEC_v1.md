# SHIMON API 명세서 v1.0

**목적**: React로 전환된 `frontend/worker`, `frontend/admin`과 공통 FastAPI 백엔드를 연결하기 위한 계약서  
**Base URL**: `http://localhost:8000/api/v1`  
**인증**: JWT Bearer Token  
**응답**: JSON / camelCase  
**시간**: ISO 8601  
**온도**: 섭씨 숫자값

---

## 1. 공통 규칙

### Authorization
```http
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### Role
- `WORKER`
- `ADMIN`

### 위험 단계
- `NORMAL`
- `CAUTION`
- `HIGH`

### 작업 상태
- `IDLE`
- `WORKING`
- `RESTING`
- `REST_NEEDED`

### AI 추정 심부체온
실측 체온과 혼동하지 않도록 다음 필드명을 사용한다.

```json
{
  "estimatedCoreTempC": 37.6,
  "coreTempLevel": "CAUTION",
  "measurementType": "AI_ESTIMATE",
  "isMeasured": false
}
```

### 공통 오류
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "사원코드 또는 비밀번호가 올바르지 않습니다."
  }
}
```

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
  "verificationToken": "temp-token",
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

---

## POST `/auth/signup`

### Worker Request
```json
{
  "verificationToken": "temp-token",
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
  "verificationToken": "temp-token",
  "phone": "010-0000-0000",
  "email": "admin@shimon.com",
  "password": "1234"
}
```

> 신체 질환 필드는 받지 않는다.

---

## POST `/auth/login`

```json
{
  "identifier": "HB-W001",
  "password": "1234"
}
```

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

---

## POST `/auth/refresh`
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

## POST `/auth/logout`

---

# 3. User

## GET `/users/me`
현재 로그인 사용자 조회.

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
  "evaluatedAt": "2026-08-18T14:10:00+09:00"
}
```

MVP는 30~60초 polling 권장.

---

# 5. Work Session

## POST `/worker/work-sessions`
작업 시작.

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

## GET `/worker/work-sessions/current`
새로고침 후 타이머 복구에 사용.

## POST `/worker/work-sessions/{id}/end`

### Response
```json
{
  "id": 101,
  "status": "COMPLETED",
  "durationMinutes": 55,
  "averageApparentTempC": 33.0,
  "maxEstimatedCoreTempC": 37.6,
  "maxRiskLevel": "CAUTION"
}
```

---

# 6. Rest Session

## POST `/worker/rest-sessions`

```json
{
  "workSessionId": 101,
  "reason": "USER_STARTED"
}
```

reason:
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

## GET `/worker/rest-sessions/current`

## POST `/worker/rest-sessions/{id}/end`

```json
{
  "id": 202,
  "status": "COMPLETED",
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
  "total": 3
}
```

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

## PATCH `/worker/notifications/{id}/read`

## GET `/worker/notification-settings`

## PATCH `/worker/notification-settings`
```json
{
  "enabled": true
}
```

---

# 9. Admin Dashboard

## GET `/admin/dashboard?site=all`

```json
{
  "metrics": {
    "workingCount": 3,
    "restingCount": 2,
    "restNeededCount": 3,
    "highCoreTempCount": 2,
    "averageEstimatedCoreTempC": 36.8,
    "highRiskCount": 2,
    "ppeMissingCount": 1,
    "maxApparentTempC": 44.0
  },
  "priorityWorkers": [
    {
      "workerId": 7,
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

### Item
```json
{
  "id": 1,
  "employeeCode": "HB-W001",
  "name": "김민준",
  "jobType": "건설 작업",
  "phone": "010-2451-1184",
  "ppeWorn": true,
  "apparentTempC": 43.0,
  "estimatedCoreTempC": 38.5,
  "coreTempLevel": "HIGH",
  "dailyWorkMinutes": 312,
  "status": "REST_NEEDED",
  "riskLevel": "HIGH",
  "site": "강남 현장 A구역"
}
```

## GET `/admin/workers/{workerId}`

---

# 11. Admin Alerts

## GET `/admin/alerts`

Query:
```text
site=all
level=all|CAUTION|HIGH
status=OPEN|ACKNOWLEDGED|RESOLVED
```

### Item
```json
{
  "id": 7001,
  "workerId": 7,
  "workerName": "윤지호",
  "riskLevel": "HIGH",
  "statusText": "즉시 휴식 필요",
  "apparentTempC": 44.0,
  "estimatedCoreTempC": 38.9,
  "reason": "연속 작업시간 초과",
  "occurredAt": "2026-08-18T14:42:00+09:00",
  "alertStatus": "OPEN"
}
```

## POST `/admin/workers/{workerId}/rest-alert`

```json
{
  "message": "현재 위험도가 높습니다. 즉시 휴식을 시작해주세요.",
  "reason": "HIGH_RISK"
}
```

## PATCH `/admin/alerts/{alertId}`
```json
{
  "status": "ACKNOWLEDGED"
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

Validation:
```text
coreTempDangerC > coreTempCautionC
restMinutes > 0
maxWorkMinutes > 0
```

Worker는 이 설정을 서버에서 읽어 사용한다. `localStorage` 공유 방식은 제거한다.

---

# 13. Sites / Environment

## GET `/sites`

## GET `/environment/current?siteId=1`

```json
{
  "siteId": 1,
  "airTempC": 31.2,
  "humidityPercent": 68,
  "apparentTempC": 33.0,
  "observedAt": "2026-08-18T14:10:00+09:00",
  "source": "WEATHER_API"
}
```

---

# 14. AI / Rule Engine 내부 데이터 계약

입력:
```json
{
  "apparentTempC": 33.0,
  "age": 42,
  "workIntensity": "MEDIUM",
  "ppeWorn": true,
  "continuousWorkMinutes": 60
}
```

출력:
```json
{
  "estimatedCoreTempC": 37.6,
  "coreTempLevel": "CAUTION",
  "riskLevel": "CAUTION",
  "modelVersion": "xgb-1.0.0",
  "evaluatedAt": "2026-08-18T14:10:00+09:00"
}
```

프론트는 모델을 직접 호출하지 않고 `/worker/safety/current`를 사용한다.

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

## Admin

| React 기능 | API |
|---|---|
| 로그인 | `POST /auth/login` |
| 사원 확인 | `POST /auth/verify-employee` |
| 회원가입 | `POST /auth/signup` |
| 관리자 정보 | `GET /users/me` |
| Dashboard | `GET /admin/dashboard` |
| 노동자 현황 | `GET /admin/workers` |
| 위험 알림 | `GET /admin/alerts` |
| 휴식 알림 발송 | `POST /admin/workers/{id}/rest-alert` |
| 설정 조회 | `GET /admin/settings` |
| 설정 저장 | `PUT /admin/settings` |
| 현장 | `GET /sites` |

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

---

# 17. 구현 순서

### Phase 1
```text
POST /auth/verify-employee
POST /auth/signup
POST /auth/login
GET  /users/me
```

### Phase 2
```text
GET  /worker/home
GET  /worker/safety/current
POST /worker/work-sessions
POST /worker/work-sessions/{id}/end
POST /worker/rest-sessions
POST /worker/rest-sessions/{id}/end
GET  /worker/records
```

### Phase 3
```text
GET  /admin/dashboard
GET  /admin/workers
GET  /admin/alerts
POST /admin/workers/{id}/rest-alert
GET  /admin/settings
PUT  /admin/settings
```

### Phase 4
```text
Weather API → XGBoost → Rule Engine → DB → Worker/Admin UI
```

---

# 18. 통합 테스트

### Worker
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

### Admin ↔ Worker
```text
Worker 작업 시작
→ HIGH 위험 발생
→ Admin Dashboard 표시
→ Admin 휴식 알림 발송
→ Worker 알림 수신
→ Worker 휴식 시작
→ Admin 상태 RESTING 반영
```

---

# 19. 현재 SHIMON 기본값

```text
API prefix             /api/v1
REST target             20분
Max continuous work     120분
Core caution            37.5℃
Core danger             38.0℃
Worker safety polling   30~60초
Admin dashboard polling 30초
```

---

## 문서 버전
`SHIMON API Contract v1.0`
