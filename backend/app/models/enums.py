from enum import StrEnum


class UserRole(StrEnum):
    WORKER = "WORKER"
    ADMIN = "ADMIN"


class WeatherSource(StrEnum):
    KMA_API = "KMA_API"
    MANUAL = "MANUAL"
    DEMO = "DEMO"


class WorkSessionStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class RestType(StrEnum):
    LEGAL_REQUIRED = "LEGAL_REQUIRED"
    AI_RECOMMENDED = "AI_RECOMMENDED"
    SELF_INITIATED = "SELF_INITIATED"


class ComplianceStatus(StrEnum):
    NORMAL = "NORMAL"
    REST_SCHEDULED = "REST_SCHEDULED"
    DEADLINE_IMMINENT = "DEADLINE_IMMINENT"
    IMMEDIATE_REST_REQUIRED = "IMMEDIATE_REST_REQUIRED"


class AiRiskLevel(StrEnum):
    LOW = "LOW"
    CAUTION = "CAUTION"
    HIGH = "HIGH"
