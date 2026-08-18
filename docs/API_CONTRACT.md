# SHIMON REST API Contract

## Conventions

- Public base path: `/api/v1`
- External JSON fields: `camelCase`
- Database fields: `snake_case`
- Times: ISO 8601 timestamps with timezone
- Authentication: bearer access token after login
- IDs in examples are illustrative; the implementation may use integer or UUID IDs consistently with the frozen database model.

Success envelope:

```json
{
  "success": true,
  "data": {}
}
```

Failure envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "human readable message"
  }
}
```

## Canonical enums

```text
role: WORKER | ADMIN
workerState: IDLE | WORKING | RESTING
weatherSource: KMA_API | MANUAL | DEMO
workSessionStatus: IN_PROGRESS | COMPLETED
restType: LEGAL_REQUIRED | AI_RECOMMENDED | SELF_INITIATED
complianceStatus: NORMAL | REST_SCHEDULED | DEADLINE_IMMINENT | IMMEDIATE_REST_REQUIRED
aiRiskLevel: LOW | CAUTION | HIGH
```

## Authentication and identity

### `POST /api/v1/auth/signup`

Creates a minimal Worker or Admin account.

```json
{
  "companyCode": "EST-2026",
  "employeeCode": "W001",
  "email": "worker1@example.com",
  "password": "password123",
  "name": "Kim Worker",
  "phone": "01012345678",
  "role": "WORKER",
  "workerProfile": {
    "age": 29,
    "assignedSiteId": "site-1"
  }
}
```

```json
{
  "success": true,
  "data": {
    "userId": "user-10",
    "name": "Kim Worker",
    "role": "WORKER"
  }
}
```

`workerProfile` is required for `WORKER` and omitted for `ADMIN`. Authorization rules for who may assign the `ADMIN` role are **TODO / NOT FROZEN**.

### `POST /api/v1/auth/login`

```json
{
  "companyCode": "EST-2026",
  "employeeCode": "W001",
  "password": "password123"
}
```

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "tokenType": "bearer",
    "user": {
      "id": "user-10",
      "name": "Kim Worker",
      "role": "WORKER"
    }
  }
}
```

### `GET /api/v1/me`

Returns the authenticated user and, for a worker, their profile/site assignment.

```json
{
  "success": true,
  "data": {
    "id": "user-10",
    "name": "Kim Worker",
    "role": "WORKER",
    "workerProfile": {
      "age": 29,
      "assignedSite": {"id": "site-1", "name": "Gangnam Site"}
    }
  }
}
```

## Sites and weather

### `GET /api/v1/sites`

Returns sites visible to the authenticated user.

```json
{
  "success": true,
  "data": [
    {
      "id": "site-1",
      "name": "Gangnam Site",
      "latitude": 37.4979,
      "longitude": 127.0276
    }
  ]
}
```

### `POST /api/v1/sites/{siteId}/weather/refresh`

Fetches current KMA weather for the supplied/site coordinates or creates deterministic DEMO weather, calculates `feelsLikeTemperature`, and stores a weather log.

```json
{
  "latitude": 37.4979,
  "longitude": 127.0276,
  "mode": "KMA_API"
}
```

`mode` is `KMA_API` or `DEMO` for P0. `MANUAL` is reserved but its request contract is **TODO / NOT FROZEN**.

```json
{
  "success": true,
  "data": {
    "weatherLogId": "weather-53",
    "siteId": "site-1",
    "temperature": 34.2,
    "humidity": 68.0,
    "windSpeed": 1.8,
    "feelsLikeTemperature": 36.7,
    "source": "KMA_API",
    "measuredAt": "2026-08-18T14:30:00+09:00"
  }
}
```

The calculated value is an operational heat-condition input, not an authoritative legal measurement.

### `GET /api/v1/sites/{siteId}/weather/latest`

Returns the most recent stored weather response. It does not refresh weather implicitly.

## Work sessions

### `POST /api/v1/work-sessions`

Starts work and immediately triggers the first explicit evaluation.

```json
{
  "siteId": "site-1",
  "workType": "MATERIAL_TRANSPORT",
  "workIntensity": "HIGH",
  "clothingLevel": "PROTECTIVE",
  "environment": "OUTDOOR_SUN"
}
```

These are service/domain context fields. They are not a declaration that the trained AI consumes them.

```json
{
  "success": true,
  "data": {
    "workSessionId": "work-101",
    "status": "IN_PROGRESS",
    "startedAt": "2026-08-18T14:35:00+09:00",
    "evaluation": {}
  }
}
```

The precise embedding of `evaluation` is **TODO / NOT FROZEN**; it may use the evaluation response below or be omitted in favor of a follow-up read.

### `GET /api/v1/me/work-session/current`

Returns the current active WorkSession or `data: null`. It does not run evaluation.

```json
{
  "success": true,
  "data": {
    "id": "work-101",
    "siteId": "site-1",
    "status": "IN_PROGRESS",
    "startedAt": "2026-08-18T14:35:00+09:00",
    "continuousWorkMinutes": 95
  }
}
```

### `POST /api/v1/work-sessions/{id}/end`

Ends the authenticated worker's active session after validating that no active rest remains.

```json
{
  "success": true,
  "data": {
    "workSessionId": "work-101",
    "status": "COMPLETED",
    "endedAt": "2026-08-18T18:00:00+09:00"
  }
}
```

## Evaluation

### `POST /api/v1/work-sessions/{id}/evaluate`

The Evaluation Orchestrator loads the WorkSession, worker profile, latest weather, and latest rest; appends independent ComplianceCheck and HeatRiskAssessment records; then applies compliance-first recommendation priority.

```json
{
  "success": true,
  "data": {
    "evaluatedAt": "2026-08-18T16:10:00+09:00",
    "weather": {
      "weatherLogId": "weather-53",
      "temperature": 34.2,
      "humidity": 68.0,
      "windSpeed": 1.8,
      "feelsLikeTemperature": 36.7
    },
    "work": {
      "continuousWorkMinutes": 95,
      "minutesSinceLastRest": 120
    },
    "compliance": {
      "status": "DEADLINE_IMMINENT",
      "isRestRequired": false,
      "restDeadline": "2026-08-18T16:35:00+09:00",
      "requiredRestMinutes": 20,
      "ruleCode": "HEAT_REST_33",
      "ruleVersion": "v1"
    },
    "ai": {
      "predictedCoreTemperature": 38.12,
      "riskLevel": "HIGH",
      "riskScore": 82,
      "modelName": "XGBoostRegressor",
      "modelVersion": "xgb-prospie-v1",
      "mainFactors": []
    },
    "recommendation": {
      "type": "LEGAL_REST_SOON",
      "priority": "HIGH",
      "message": "A compliance rest deadline is approaching."
    }
  }
}
```

`riskScore` is optional. The response must not expose or claim a final feature list until the trained-model feature schema is frozen.

## Rest records

### `POST /api/v1/work-sessions/{id}/rests/start`

Starts a rest. The backend determines `restType` from the latest stored evaluation:

```text
immediate legal rest required -> LEGAL_REQUIRED
otherwise AI HIGH             -> AI_RECOMMENDED
otherwise                     -> SELF_INITIATED
```

```json
{
  "success": true,
  "data": {
    "restId": "rest-501",
    "workSessionId": "work-101",
    "restType": "AI_RECOMMENDED",
    "startedAt": "2026-08-18T16:12:00+09:00",
    "workerState": "RESTING"
  }
}
```

### `POST /api/v1/rests/{id}/end`

Ends the active rest, derives `WORKING`, and immediately triggers a new evaluation.

```json
{
  "success": true,
  "data": {
    "restId": "rest-501",
    "endedAt": "2026-08-18T16:32:00+09:00",
    "durationMinutes": 20,
    "workerState": "WORKING",
    "evaluation": {}
  }
}
```

## Composite reads

### `GET /api/v1/me/home`

Returns worker, site, latest stored weather/evaluation, derived state, current WorkSession, and recommendation. It does not evaluate implicitly.

```json
{
  "success": true,
  "data": {
    "worker": {"id": "user-10", "name": "Kim Worker"},
    "site": {"id": "site-1", "name": "Gangnam Site"},
    "weather": {"feelsLikeTemperature": 36.7, "source": "KMA_API"},
    "state": "WORKING",
    "workSession": {"id": "work-101", "continuousWorkMinutes": 95},
    "compliance": {"status": "DEADLINE_IMMINENT", "restDeadline": "2026-08-18T16:35:00+09:00"},
    "ai": {"predictedCoreTemperature": 38.12, "riskLevel": "HIGH", "mainFactors": []},
    "recommendation": {"type": "LEGAL_REST_SOON", "priority": "HIGH", "message": "A compliance rest deadline is approaching."}
  }
}
```

### `GET /api/v1/admin/sites/{siteId}/dashboard`

Requires `ADMIN`. Returns site weather, summary counts, and workers ordered as follows:

1. `IMMEDIATE_REST_REQUIRED`
2. `DEADLINE_IMMINENT`
3. AI `HIGH`
4. AI `CAUTION`
5. `NORMAL`

```json
{
  "success": true,
  "data": {
    "site": {"id": "site-1", "name": "Gangnam Site"},
    "weather": {"feelsLikeTemperature": 36.7, "source": "KMA_API"},
    "summary": {
      "totalWorkers": 8,
      "workingWorkers": 5,
      "restingWorkers": 2,
      "aiHighRiskWorkers": 2,
      "legalRestRequiredWorkers": 1,
      "restComplianceRate": null
    },
    "workers": [
      {
        "userId": "user-10",
        "name": "Kim Worker",
        "state": "WORKING",
        "continuousWorkMinutes": 95,
        "compliance": {"status": "DEADLINE_IMMINENT"},
        "ai": {"predictedCoreTemperature": 38.12, "riskLevel": "HIGH"},
        "recommendation": {"type": "LEGAL_REST_SOON", "priority": "HIGH"}
      }
    ]
  }
}
```

`restComplianceRate` is nullable and its formula is **TODO / NOT FROZEN**.

### `GET /api/v1/me/history?date=2026-08-18`

Returns the authenticated worker's work/rest records for the requested date.

```json
{
  "success": true,
  "data": {
    "workSessions": [{"startedAt": "2026-08-18T14:00:00+09:00", "endedAt": "2026-08-18T18:00:00+09:00"}],
    "rests": [{"restType": "AI_RECOMMENDED", "startedAt": "2026-08-18T16:12:00+09:00", "endedAt": "2026-08-18T16:32:00+09:00", "durationMinutes": 20}]
  }
}
```

## Internal AI interface

Conceptual boundary: `POST /internal/v1/heat-risk/predict`. This may remain an in-process adapter in P0; it is not a public client API.

The request contains identifiers plus a versioned feature payload built by the Feature Builder. The feature keys are deliberately omitted because the actual trained-model feature schema is **TODO / NOT FROZEN**.

Canonical result:

```json
{
  "predictedCoreTemperature": 38.12,
  "riskLevel": "HIGH",
  "riskScore": 82,
  "modelName": "XGBoostRegressor",
  "modelVersion": "xgb-prospie-v1",
  "mainFactors": []
}
```

- `riskScore` is optional.
- `mainFactors` contains only factors actually used by the model.
- The feature schema, model artifact, and model version must be versioned together.
- This result supports safety decisions; it is not a medical diagnosis or a legal/compliance result.

## Initial error codes

```text
INVALID_CREDENTIALS
FORBIDDEN
COMPANY_NOT_FOUND
USER_NOT_FOUND
SITE_NOT_FOUND
WEATHER_FETCH_FAILED
WEATHER_NOT_AVAILABLE
ACTIVE_WORK_SESSION_EXISTS
ACTIVE_WORK_SESSION_NOT_FOUND
ACTIVE_REST_ALREADY_EXISTS
ACTIVE_REST_NOT_FOUND
COMPLIANCE_EVALUATION_FAILED
AI_PREDICTION_FAILED
INVALID_MODEL_FEATURES
```
