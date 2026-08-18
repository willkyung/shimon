"""
risk_service.py
----------------
회원정보(연령·작업강도·PPE) + 기상청 API(체감온도, 캐싱됨) + 실시간 연속작업시간을
모아서 AI 모델을 돌리고, 위험 등급을 반환한다.

이 함수 하나가 "AI 모델을 실제로 돌리는" 지점이다.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from xgboost import XGBRegressor
import pandas as pd

from backend.app.services.weather_service import get_current_weather
from backend.app.services.heat_features import (
    feels_like,
    compute_continuous_work_minutes,
    get_last_rest_ended_at,
    score_to_risk_level,
    CLOTHING_TO_CODE,
    WORK_INTENSITY_TO_GRADIENT,
)

FEATURE_ORDER = ["feels_like_temp", "age", "clothing", "gradient", "continuous_work_min"]

# backend/app/services/risk_service.py 기준으로 repo 루트를 거쳐 ai/models/를 찾는다.
REPO_ROOT = Path(__file__).resolve().parents[3]
MODEL_PATH = REPO_ROOT / "ai" / "models" / "xgb_core_temp_model.json"
METADATA_PATH = REPO_ROOT / "ai" / "models" / "model_metadata.json"

# 서버 시작 시 딱 1번만 모델 로드 (요청마다 다시 로드하면 느려짐)
_model = XGBRegressor()
_model.load_model(str(MODEL_PATH))

with open(METADATA_PATH, encoding="utf-8") as f:
    _metadata = json.load(f)

MODEL_NAME = "xgb_core_temp_model"
# 학습 시점(created_at)을 버전 식별자로 쓴다 — 재학습해서 model_metadata.json이
# 갱신될 때마다 이 값도 자동으로 바뀌므로, DB에 저장된 평가 결과가 어떤 학습
# 버전으로 계산됐는지 나중에 추적할 수 있다.
MODEL_VERSION = _metadata["created_at"]


def assess_worker_risk(worker, site, work_session) -> dict:
    """
    worker      : 회원정보 (age 등을 가진 객체/딕셔너리)
    site        : 현장 정보 (lat, lon을 가진 객체/딕셔너리)
    work_session: 진행 중인 작업 세션 (started_at, clothing_level, work_intensity,
                  rest_records를 가진 객체/딕셔너리). clothing_level/work_intensity는
                  WorkerProfile이 아니라 WorkSession 소속 필드다 — 작업복/작업강도는
                  사람이 아니라 "이번 세션"마다 선택하는 값이기 때문.

    반환값: {"predicted_core_temp": ..., "risk_level": ..., "inputs": {...}}
    """
    now = datetime.now(timezone.utc)

    # ① 기온·습도 — 기상청 API (내부적으로 1시간 단위 캐싱됨, 매번 호출 안 됨)
    weather = get_current_weather(site["lat"], site["lon"])
    feels_like_temp = feels_like(weather["temp"], weather["humidity"])

    # ② 연령 — 회원정보(WorkerProfile)에서
    age = worker["age"]

    # ③ 작업복/작업강도 — 이번 작업 세션(WorkSession)에서 선택한 값
    #    DB엔 "BREATHABLE"/"NON_BREATHABLE" 같은 문자열로 저장되므로, 학습 데이터의
    #    숫자 코드(1/2)로 변환해야 모델에 넣을 수 있다.
    clothing = CLOTHING_TO_CODE[work_session["clothing_level"]]
    gradient = WORK_INTENSITY_TO_GRADIENT[work_session["work_intensity"]]  # "LOW"/"MEDIUM"/"HIGH"

    # ④ 연속작업시간 — WorkSession에는 last_rest_ended_at 컬럼이 없으므로
    #    rest_records 관계에서 "가장 최근에 끝난 휴식"을 매번 파생시킨다.
    last_rest_ended_at = get_last_rest_ended_at(work_session.get("rest_records", []))
    continuous_work_min = compute_continuous_work_minutes(
        now, work_session["started_at"], last_rest_ended_at
    )

    # ⑤ 5개 입력값을 학습 때와 동일한 순서로 모델에 전달
    X = pd.DataFrame([{
        "feels_like_temp": feels_like_temp,
        "age": age,
        "clothing": clothing,
        "gradient": gradient,
        "continuous_work_min": continuous_work_min,
    }])[FEATURE_ORDER]

    predicted_core_temp = float(_model.predict(X)[0])
    risk_level = score_to_risk_level(predicted_core_temp)

    return {
        "predicted_core_temp": round(predicted_core_temp, 2),
        "risk_level": risk_level,
        "inputs": {
            "feels_like_temp": round(feels_like_temp, 2),
            "age": age,
            "clothing": clothing,
            "gradient": gradient,
            "continuous_work_min": continuous_work_min,
        },
        "weather": {
            "temp": weather["temp"],
            "humidity": weather["humidity"],
            "source": weather["source"],  # "cache" or "api"
        },
        "assessed_at": now,
    }
