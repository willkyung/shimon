"""
train.py
--------
prospie_processed.csv 로 XGBoost Regressor를 학습시켜 SHIMON Heat Risk 예측 모델을 만든다.
 
[파이프라인 요약]
    data/processed/prospie_processed.csv
        (feels_like_temp, age, clothing, gradient, continuous_work_min, core_temp, participant, condition)
                    │
                    │  1) X(입력 5개) / y(core_temp) / groups(participant) 분리
                    │  2) Participant 기준 5-fold Group CV  → "처음 보는 사람"에 대한 정직한 성능 확인용
                    │  3) 전체 데이터로 최종 모델 재학습      → 실제 서비스에 쓸 모델
                    │  4) SHAP으로 변수별 기여도 계산         → 대시보드 "위험 요인 설명"에 쓸 재료
                    │  5) 모델 + 메타데이터 저장
                    ▼
    models/xgb_core_temp_model.json
    models/model_metadata.json
 
주의: 2단계(Group CV)에서 학습되는 5개의 모델은 "성능을 확인하기 위한 실험용"이고,
     실제로 저장/배포되는 모델은 3단계에서 전체 데이터로 다시 학습한 모델 하나뿐이다.
"""
 
from pathlib import Path
import json
from datetime import datetime, timezone
 
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor
import shap
 
# ------------------------------------------------------------------
# 0. 경로 & 설정값
#    preprocess.py와 동일하게, 스크립트 위치 기준 상대경로를 사용한다.
# ------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent            # .../ai/scripts
AI_ROOT = SCRIPT_DIR.parent                              # .../ai
PROCESSED_PATH = AI_ROOT / "data" / "processed" / "prospie_processed.csv"
MODELS_DIR = AI_ROOT / "models"
MODEL_PATH = MODELS_DIR / "xgb_core_temp_model.json"
METADATA_PATH = MODELS_DIR / "model_metadata.json"
 
# 모델이 실제로 보는 입력 5개. 이 "순서"가 매우 중요하다 —
# 서빙(백엔드) 쪽에서 예측 요청을 보낼 때도 반드시 이 순서 그대로 넣어야 한다.
FEATURE_COLS = ["feels_like_temp", "age", "clothing", "gradient", "continuous_work_min"]
TARGET_COL = "core_temp"
GROUP_COL = "participant"   # 모델 입력은 아니고, CV를 나눌 때만 쓰는 그룹 키
 
# XGBoost 하이퍼파라미터.
# 지난 실험(대화 중 직접 돌려봤던 것)과 동일한 값으로 시작점을 잡았다.
# 필요하면 이 값들만 바꿔서 재실험할 수 있다 (max_depth를 늘리면 더 복잡한 패턴을 잡지만
# 과적합 위험도 커진다 — 데이터가 12,420행 정도로 크지 않으니 3~4 정도를 권장).
XGB_PARAMS = dict(
    n_estimators=100,
    max_depth=3,
    learning_rate=0.1,
    random_state=42,
)
 
 
# ------------------------------------------------------------------
# 1. Participant 기준 5-fold Group CV
# ------------------------------------------------------------------
def evaluate_with_group_cv(X: pd.DataFrame, y: pd.Series, groups: pd.Series, n_splits: int = 5):
    """
    같은 참가자의 데이터가 train/test에 동시에 들어가지 않도록,
    참가자(40명) 단위로 n_splits개 그룹으로 나눠 교차검증한다.
 
    무작위로 행 단위 분할하면 "옆 시점끼리 거의 똑같은 데이터"가 train/test에 섞여서
    성능이 실제보다 좋게 나오는 데이터 누수(data leakage) 문제가 생긴다.
    참가자 단위로 통째로 나누면, 매 fold의 test는 "학습 때 한 번도 보지 못한 사람"이 되어
    실제 서비스 상황(처음 보는 노동자)과 훨씬 비슷한 조건에서 성능을 측정하게 된다.
    """
    gkf = GroupKFold(n_splits=n_splits)
    fold_results = []
 
    for fold_idx, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups=groups), start=1):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
 
        model = XGBRegressor(**XGB_PARAMS)
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
 
        mae = mean_absolute_error(y_test, pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
        n_test_participants = groups.iloc[test_idx].nunique()
 
        print(
            f"    Fold {fold_idx}: MAE={mae:.3f}C  RMSE={rmse:.3f}C  "
            f"(test 참가자 {n_test_participants}명, {len(test_idx):,}행)"
        )
        fold_results.append({"fold": fold_idx, "mae": round(mae, 4), "rmse": round(rmse, 4)})
 
    return fold_results
 
 
# ------------------------------------------------------------------
# 2. 메인 학습 파이프라인
# ------------------------------------------------------------------
def main() -> None:
    print(f"[1/5] 전처리 데이터 로드: {PROCESSED_PATH}")
    df = pd.read_csv(PROCESSED_PATH)
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    groups = df[GROUP_COL]
    print(f"    총 {len(df):,}행, 입력변수 {len(FEATURE_COLS)}개, 참가자 {groups.nunique()}명")
 
    # ----------------------------------------------------------
    # 2단계: 성능 검증 (실험용 모델 5개를 임시로 학습해서 점수만 뽑음)
    # ----------------------------------------------------------
    print("\n[2/5] Participant 기준 5-fold Group CV 성능 검증")
    fold_results = evaluate_with_group_cv(X, y, groups, n_splits=5)
 
    mae_list = [r["mae"] for r in fold_results]
    rmse_list = [r["rmse"] for r in fold_results]
    mae_mean, mae_std = float(np.mean(mae_list)), float(np.std(mae_list))
    rmse_mean, rmse_std = float(np.mean(rmse_list)), float(np.std(rmse_list))
 
    print(f"    5-fold 평균 MAE  = {mae_mean:.3f}C (표준편차 {mae_std:.3f})")
    print(f"    5-fold 평균 RMSE = {rmse_mean:.3f}C (표준편차 {rmse_std:.3f})")
    print("    -> 이 수치가 '한 번도 학습에 쓰이지 않은 새 노동자'에 대한 정직한 예상 오차입니다.")
    print("       (지난번 확인했던 '전체 데이터 기준 MAE 0.316'은 train==test라 참고용에 불과했음)")
 
    # ----------------------------------------------------------
    # 3단계: 실제 배포할 최종 모델 — 가진 데이터 전부로 재학습
    #   (2단계는 성능을 "재는" 실험이었을 뿐, 여기서 처음으로 진짜 모델을 만든다)
    # ----------------------------------------------------------
    print("\n[3/5] 전체 데이터로 최종 모델 재학습")
    final_model = XGBRegressor(**XGB_PARAMS)
    final_model.fit(X, y)
    print(f"    완료 (학습에 사용한 행 수: {len(df):,})")
 
    # ----------------------------------------------------------
    # 4단계: SHAP — 최종 모델 기준으로 변수별 평균 기여도 계산
    #   TreeExplainer는 XGBoost 같은 트리 모델 전용으로, 정확하고 빠르게 계산해준다.
    # ----------------------------------------------------------
    print("\n[4/5] SHAP 변수 중요도 계산")
    explainer = shap.TreeExplainer(final_model)
    shap_values = explainer.shap_values(X)
    # 각 변수가 "평균적으로 얼마나 예측값을 흔드는지"를 절대값으로 평균낸 것
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    importance = pd.Series(mean_abs_shap, index=FEATURE_COLS).sort_values(ascending=False)
 
    print("    변수별 평균 |SHAP| (예측 심부체온을 평균적으로 얼마나 흔드는지, C 단위):")
    for name, val in importance.items():
        print(f"      - {name}: {val:.4f}")
 
    # ----------------------------------------------------------
    # 5단계: 모델 + 메타데이터 저장
    #   메타데이터에 입력변수 순서를 반드시 남겨서, 서빙 코드가 잘못된 순서로
    #   값을 넣는 실수를 방지한다.
    # ----------------------------------------------------------
    print(f"\n[5/5] 모델 및 메타데이터 저장: {MODELS_DIR}")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    final_model.save_model(str(MODEL_PATH))
 
    metadata = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model_type": "XGBRegressor",
        "feature_order": FEATURE_COLS,  # 서빙 시 반드시 이 순서 그대로 입력해야 함
        "target": TARGET_COL,
        "n_training_rows": int(len(df)),
        "n_participants": int(groups.nunique()),
        "xgb_params": XGB_PARAMS,
        "cv_metrics": {
            "method": "GroupKFold (participant 기준, n_splits=5)",
            "mae_mean_celsius": round(mae_mean, 4),
            "mae_std_celsius": round(mae_std, 4),
            "rmse_mean_celsius": round(rmse_mean, 4),
            "rmse_std_celsius": round(rmse_std, 4),
            "fold_results": fold_results,
        },
        "shap_feature_importance_mean_abs": {k: round(float(v), 4) for k, v in importance.items()},
        "notes": [
            "학습 데이터: PROSPIE 공개 데이터셋 (Loughborough Univ, 실험실 환경, 참가자 40명, 19~40세)",
            "실제 서비스의 feels_like_temp / continuous_work_min 계산 로직은 preprocess.py와 반드시 동일해야 함",
            "이 모델의 출력은 확정 진단이 아니라 상대적 위험 우선순위 참고용 점수로만 사용할 것",
            "법정 휴식 기준(Rule Engine)은 이 모델과 무관하게 항상 우선 적용됨",
        ],
    }
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
 
    print(f"    모델 저장: {MODEL_PATH}")
    print(f"    메타데이터 저장: {METADATA_PATH}")
 
 
if __name__ == "__main__":
    main()