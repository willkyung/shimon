# SHIMON Project Context

## Product purpose

SHIMON helps outdoor construction workers and site safety managers respond to heat risk before it becomes an incident. It combines operational heat conditions, work/rest records, deterministic compliance checks, and an AI estimate of individual heat burden in one auditable workflow.

The service is a safety-support proof of concept. It is not a medical diagnostic system, and its calculated heat-condition value is not presented as an authoritative legal measurement.

## Problem definition

Workers at the same site can face different heat burdens because their personal and work conditions differ. A manager cannot continuously track every worker's current activity, continuous work time, last rest, compliance deadline, individual risk, and actual rest execution. Existing alert-only approaches also fail to prove whether a recommendation led to a real rest.

SHIMON connects:

```text
risk detection -> rest decision -> worker action -> RestRecord -> admin visibility
```

## Target users

### Worker

- Starts and ends work.
- Starts and ends rest.
- Sees current site heat context and current work/rest state.
- Sees compliance status separately from AI risk.
- Receives a clear legal-rest or proactive-rest recommendation.

### Administrator / safety manager

- Monitors multiple workers at one construction site.
- Identifies legally urgent workers before AI-only high-risk workers.
- Confirms whether a worker actually started and completed a rest.
- Reviews per-worker state, continuous work time, compliance result, AI risk, and priority.

## Service differentiation

SHIMON does more than display weather:

- The Rule Engine tracks deterministic compliance state and rest deadlines.
- The AI Engine estimates individual heat burden without making legal decisions.
- The service records actual rest execution, not merely notification delivery.
- The admin view prioritizes legally urgent workers while retaining proactive AI insight.

## P0 scope

- Minimal authentication with `WORKER` and `ADMIN` roles
- Company, user, and worker profile
- Work site and weather context
- Calculated `feelsLikeTemperature`
- WorkSession and RestRecord lifecycle
- Compliance Rule Engine and append-only ComplianceCheck
- AI inference contract and append-only HeatRiskAssessment
- Evaluation Orchestrator
- Worker Home REST API
- Admin Dashboard REST API
- KMA normal path and DEMO fallback
- Complete worker rest flow

## P1 / later

- Notification persistence
- Geofencing and rest-area verification
- Complex compliance analytics or account management
- Future weather prediction
- Rest scheduling optimization and capacity planning
- Vision AI, CCTV, and fall detection

## Demo success path

1. Worker logs in.
2. Worker starts work.
3. Weather context becomes available and is stored.
4. Rule Engine evaluates compliance.
5. AI predicts individual heat burden.
6. The service produces a high-risk or legal-rest recommendation.
7. Worker starts rest and a RestRecord is saved.
8. Derived worker state changes from `WORKING` to `RESTING`.
9. Admin Dashboard shows the state change.
10. Worker ends rest and state returns to `WORKING`.
11. Evaluation runs again after rest ends.

## Domain terminology

| Term | Meaning |
|---|---|
| Operational heat-condition input | Calculated `feelsLikeTemperature` used by P0; not described as an authoritative legal measurement |
| WorkSession | A worker's bounded period of work; at most one active session per worker |
| RestRecord | A rest interval belonging to a WorkSession |
| ComplianceCheck | Immutable evaluation of deterministic rest rules at a point in time |
| HeatRiskAssessment | Immutable AI inference record, including model identity and input snapshot |
| Evaluation | One orchestration run that creates independent Rule and AI results, then combines them into a recommendation |
| Worker state | Derived state: `IDLE`, `WORKING`, or `RESTING` |
| Rest type | `LEGAL_REQUIRED`, `AI_RECOMMENDED`, or `SELF_INITIATED` |
| Compliance status | `NORMAL`, `REST_SCHEDULED`, `DEADLINE_IMMINENT`, or `IMMEDIATE_REST_REQUIRED` |
| AI risk level | `LOW`, `CAUTION`, or `HIGH` |

## Items not frozen

- **TODO / NOT FROZEN:** final trained-model feature schema and domain-to-model mapping.
- **TODO / NOT FROZEN:** AI risk thresholds and whether `riskScore` is exposed by the first model.
- **TODO / NOT FROZEN:** formula and reporting window for `restComplianceRate`; it is not P0-blocking.
- **TODO / NOT FROZEN:** frontend framework.
