"""
predict.py
----------
학습된 모델(xgb_core_temp_model.json)이 제대로 동작하는지 확인하는 테스트 스크립트.

1) processed 데이터에서 몇 개 행을 뽑아 실제값 vs 예측값 비교
2) 임의로 정한 입력값(가상의 작업자 상황)으로 예측 실행
"""

from pathlib import Path

import pandas as pd
from xgboost import XGBRegressor

SCRIPT_DIR = Path(__file__).resolve().parent
AI_ROOT = SCRIPT_DIR.parent
MODEL_PATH = AI_ROOT / "models" / "xgb_core_temp_model.json"
PROCESSED_PATH = AI_ROOT / "data" / "processed" / "prospie_processed.csv"

FEATURE_COLS = ["feels_like_temp", "age", "clothing", "gradient", "continuous_work_min"]
TARGET_COL = "core_temp"


def load_model() -> XGBRegressor:
    model = XGBRegressor()
    model.load_model(str(MODEL_PATH))
    return model


def test_on_sample_rows(model: XGBRegressor, n: int = 10) -> None:
    df = pd.read_csv(PROCESSED_PATH).sample(n=n, random_state=1)
    X = df[FEATURE_COLS]
    y_true = df[TARGET_COL].values
    y_pred = model.predict(X)

    print(f"[실제 데이터 {n}개 샘플 비교]")
    for i in range(n):
        diff = y_pred[i] - y_true[i]
        print(
            f"  실제={y_true[i]:.2f}C  예측={y_pred[i]:.2f}C  "
            f"오차={diff:+.2f}C"
        )


def test_on_custom_input(model: XGBRegressor) -> None:
    # 임의로 정한 가상의 작업자 상황 (필요시 값 바꿔서 테스트)
    custom = pd.DataFrame([{
        "feels_like_temp": 34.0,   # 체감온도 34C
        "age": 30,                  # 나이 30
        "clothing": 1,               # 작업복 코드
        "gradient": 0,                # 경사 0%
        "continuous_work_min": 120,    # 연속작업 60분
    }])[FEATURE_COLS]

    pred = model.predict(custom)[0]
    print("\n[임의 입력 테스트]")
    print(f"  입력: {custom.iloc[0].to_dict()}")
    print(f"  예측 심부체온: {pred:.2f}C")


def main() -> None:
    model = load_model()
    test_on_sample_rows(model)
    test_on_custom_input(model)


if __name__ == "__main__":
    main()
