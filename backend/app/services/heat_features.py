"""
heat_features.py
-----------------
preprocess.py에서 학습 때 썼던 feels_like() 공식을 그대로 가져온 것.
백엔드가 이제 Python(FastAPI)이라, 예전처럼 JS로 이식하며 값이 같은지
검증하는 과정 자체가 필요 없어졌다 — 같은 함수를 그냥 import해서 쓰면 된다.
"""

from datetime import datetime


def feels_like(Ta: float, RH: float) -> float:
    """기온(Ta, ℃)과 상대습도(RH, %)로 여름철 체감온도(℃)를 계산한다."""
    import numpy as np

    Tw = (
        Ta * np.arctan(0.151977 * (RH + 8.313659) ** 0.5)
        + np.arctan(Ta + RH)
        - np.arctan(RH - 1.67633)
        + 0.00391838 * RH ** 1.5 * np.arctan(0.023101 * RH)
        - 4.686035
    )
    return float(
        -0.2442 + 0.55399 * Tw + 0.45535 * Ta - 0.0022 * Tw ** 2 + 0.00278 * Tw * Ta + 3.0
    )


def get_last_rest_ended_at(rest_records: list[dict]) -> datetime | None:
    """
    work_session에 딸린 rest_records(휴식 기록 목록) 중, 이미 종료된 것들의
    ended_at 중 가장 최근 값을 반환한다. WorkSession에는 last_rest_ended_at
    컬럼이 따로 없고 rest_records 관계에서 매번 파생시켜야 한다.
    """
    ended_at_values = [r["ended_at"] for r in rest_records if r.get("ended_at")]
    return max(ended_at_values, default=None)


def compute_continuous_work_minutes(
    now: datetime,
    session_started_at: datetime,
    last_rest_ended_at: datetime | None,
) -> int:
    """
    연속작업시간(분)을 계산한다.

    학습 데이터(PROSPIE)에서는 1분 간격 시계열 전체를 훑어서 "작업 상태가
    몇 분째 이어지는지"를 계산했지만, 실시간 서빙에서는 "가장 최근에 작업을
    재개한 시점"만 알면 동일한 값을 즉시 계산할 수 있다 (외부 호출 불필요).
    """
    reference_time = session_started_at
    if last_rest_ended_at and last_rest_ended_at > session_started_at:
        reference_time = last_rest_ended_at

    minutes = int((now - reference_time).total_seconds() // 60)
    return max(0, minutes)


def score_to_risk_level(predicted_core_temp: float) -> str:
    """예측 심부체온을 안전/주의/위험 등급으로 변환한다.

    경계값(37.6 / 38.4)의 근거는 heat_risk_model_documentation.md 참고:
    WHO/OSHA 기준(38.0℃)에서 모델의 5-fold 검증 오차(MAE 0.372℃)만큼
    보수적으로 낮춰 잡은 값이다.
    """
    if predicted_core_temp < 37.6:
        return "SAFE"
    elif predicted_core_temp < 38.4:
        return "CAUTION"
    else:
        return "DANGER"


# 작업강도(낮음/중간/높음) 선택값 -> 학습 데이터 gradient 대표값 매핑
# (학습 데이터 gradient를 3등분한 중앙값: 3 / 5 / 7)
WORK_INTENSITY_TO_GRADIENT = {
    "LOW": 3,
    "MEDIUM": 5,
    "HIGH": 7,
}

# 작업복 선택값 -> 학습 데이터(PROSPIE) clothing 코드 매핑.
# 데이터셋에 "미착용(0)" 케이스는 없고, 통기성/비통기성 두 종류만 존재한다
# (전원이 항상 둘 중 하나를 착용한 상태로 측정됨). 따라서 UI도 "착용 여부"가
# 아니라 "통기성 vs 비통기성" 중 선택하도록 해야 학습 데이터 범위 안에서 예측된다.
CLOTHING_TO_CODE = {
    "BREATHABLE": 1,      # 통기성 작업복
    "NON_BREATHABLE": 2,  # 비통기성 작업복
}
