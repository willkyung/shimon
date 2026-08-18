# SHIMON Repository Instructions

SHIMON is an AI-assisted heat-risk and rest-management service for outdoor construction workers.

## P0 objective

Deliver the reliable demo path documented in [Project Context](docs/PROJECT_CONTEXT.md): a worker starts work, the backend records weather context, evaluates compliance and AI risk independently, records a rest, and exposes the state change to the admin dashboard.

Read these contracts before implementation:

- [Project context](docs/PROJECT_CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API contract](docs/API_CONTRACT.md)
- [Database schema](docs/DB_SCHEMA.md)

## Non-negotiable invariants

- Keep the Compliance Rule Engine and AI Engine separate.
- Only the Rule Engine makes legal/compliance decisions.
- AI may recommend earlier rest but must never override, cancel, or weaken a Rule Engine result.
- Persist `ComplianceCheck` and `HeatRiskAssessment` as separate concepts.
- Keep Rule and AI evaluation history append-only where practical.
- Use the canonical AI risk enum: `LOW | CAUTION | HIGH`. Do not use `SAFE` or `DANGER` for AI risk.
- Treat calculated `feelsLikeTemperature` as the service's operational heat-condition input, not an authoritative legal measurement.
- Derive worker state from active work/rest records: `IDLE`, `WORKING`, or `RESTING`. Do not add a duplicate status source of truth without a documented reason.
- Keep compliance thresholds and AI business rules out of the frontend.
- Use the canonical admin priority: `IMMEDIATE_REST_REQUIRED`, `DEADLINE_IMMINENT`, AI `HIGH`, AI `CAUTION`, `NORMAL`.

## P0 constraints

- Prefer one modular FastAPI application; do not create premature microservices.
- Do not add Celery, cron, Kafka, Kubernetes, event buses, or a backend scheduler.
- Do not add Redis unless a later task explicitly requires it.
- Run evaluation after work starts, after rest ends, or through the explicit evaluation endpoint.
- GET endpoints read the latest stored evaluation and should not silently create one.
- Keep `restComplianceRate` nullable or absent until its formula is frozen.
- Keep the backend independent of any specific frontend framework.
- Mark unresolved requirements `TODO / NOT FROZEN`; do not invent them.
- Keep P1 features out of P0 unless explicitly requested.

## Working method

- Before implementing any task, inspect the relevant existing files first. Do not modify unrelated code.
- Preserve working behavior unless the requested change requires otherwise.
- Follow the existing repository conventions unless they conflict with these contracts.
- Use typed Pydantic request/response schemas and stable REST contracts.
- Use camelCase for external JSON and snake_case for database fields.
- Keep abstractions proportional to the hackathon scope and optimize for demo reliability.
- When AI work begins, use only features in the versioned trained-model schema. Do not claim unsupported inputs.
- Version the AI feature schema, model artifact, and `modelVersion` together.
- After implementing a task, run the smallest relevant test or validation command and report the result.
- Add or update focused tests when changing domain rules, state transitions, or API contracts.

## Security

- Supply secrets through environment variables.
- Never commit `.env`, API keys, database passwords, JWT secrets, tokens, or model secrets.
- Do not expose the KMA service key or other backend credentials to frontend clients.
- Do not put real personal, health, or credential data in fixtures or seed files.

## Scope control

- P0 is the end-to-end worker rest flow; see the project context for the exact boundary.
- Notifications persistence, geofencing, future-weather prediction, complex optimization, Vision AI, CCTV, and fall detection are P1 or later.
- Favor the smallest complete vertical slice over many partially implemented features.
- Do not commit or push unless the user explicitly requests it.
