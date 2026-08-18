from enum import StrEnum


class UserRole(StrEnum):
    WORKER = "WORKER"
    ADMIN = "ADMIN"


class Gender(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class WorkIntensity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class WeatherSource(StrEnum):
    KMA_API = "KMA_API"
    MANUAL = "MANUAL"
    DEMO = "DEMO"


class WorkSessionStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class RestReason(StrEnum):
    USER_STARTED = "USER_STARTED"
    SYSTEM_RECOMMENDED = "SYSTEM_RECOMMENDED"
    ADMIN_REQUESTED = "ADMIN_REQUESTED"


class CoreTempLevel(StrEnum):
    NORMAL = "NORMAL"
    CAUTION = "CAUTION"
    HIGH = "HIGH"


class OverallRiskLevel(StrEnum):
    NORMAL = "NORMAL"
    CAUTION = "CAUTION"
    HIGH = "HIGH"


class NotificationType(StrEnum):
    REST_RECOMMENDATION = "REST_RECOMMENDATION"
    ADMIN_REST_REQUEST = "ADMIN_REST_REQUEST"
    WORK_STARTED = "WORK_STARTED"


class AlertStatus(StrEnum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class ComplianceStatus(StrEnum):
    NORMAL = "NORMAL"
    REST_SCHEDULED = "REST_SCHEDULED"
    DEADLINE_IMMINENT = "DEADLINE_IMMINENT"
    IMMEDIATE_REST_REQUIRED = "IMMEDIATE_REST_REQUIRED"


class AiRiskLevel(StrEnum):
    LOW = "LOW"
    CAUTION = "CAUTION"
    HIGH = "HIGH"
