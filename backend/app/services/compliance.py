from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from backend.app.models.enums import ComplianceStatus


MVP_RULE_CODE = "HEAT_REST_33"
MVP_RULE_VERSION = "mvp-v1"
MVP_FEELS_LIKE_THRESHOLD = Decimal("33.0")
MVP_CONTINUOUS_WORK_MINUTES = 120
MVP_REQUIRED_REST_MINUTES = 20


@dataclass(frozen=True)
class ComplianceResult:
    status: ComplianceStatus
    is_rest_required: bool
    required_rest_minutes: int | None


def evaluate_mvp_heat_rest_rule(
    feels_like_temperature: Decimal, continuous_work_minutes: int
) -> ComplianceResult:
    rest_required = (
        feels_like_temperature >= MVP_FEELS_LIKE_THRESHOLD
        and continuous_work_minutes >= MVP_CONTINUOUS_WORK_MINUTES
    )
    return ComplianceResult(
        status=(
            ComplianceStatus.IMMEDIATE_REST_REQUIRED
            if rest_required
            else ComplianceStatus.NORMAL
        ),
        is_rest_required=rest_required,
        required_rest_minutes=MVP_REQUIRED_REST_MINUTES if rest_required else None,
    )


def utc_now() -> datetime:
    return datetime.now(UTC)
