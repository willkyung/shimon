"""
preprocess.py
-------------
PROSPIE 원본 데이터(raw)를 SHIMON Heat Risk 회귀 모델 학습용 테이블(processed)로 변환한다.

[파이프라인 요약]
    raw/Prospie_dataset_open_access_V3.csv
        temp, humidity, time, activity_workrest, age, clothing, gradient, core_temp
                    │
                    │  1) 결측치(9999) 정리
                    │  2) feels_like_temp 파생  (temp + humidity → 체감온도 공식)
                    │  3) continuous_work_min 파생  (time + activity_workrest → 연속작업시간)
                    │  4) 작업(work) 중 데이터만 필터링
                    │  5) 최종 5개 입력변수 + 타겟만 선택
                    ▼
    processed/prospie_processed.csv
        feels_like_temp, age, clothing, gradient, continuous_work_min, core_temp
        (+ participant, condition — 학습 시 GroupKFold에 쓸 그룹 키라서 같이 남겨둠)

이 스크립트에서 만든 feels_like()·compute_continuous_work_min() 두 함수는
실제 서비스(백엔드) 쪽에서도 "학습 때와 완전히 동일한 계산"을 하도록 그대로 이식해야 한다.
(체감온도 공식이나 연속작업시간 계산 로직이 학습 때와 서빙 때 조금이라도 다르면,
 모델이 한 번도 본 적 없는 값을 받게 되어 예측이 어긋난다.)
"""

from pathlib import Path
import numpy as np
import pandas as pd

# ------------------------------------------------------------------
# 0. 경로 설정
#    스크립트 파일 위치(scripts/) 기준으로 상대경로를 잡아서,
#    "어느 폴더에서 실행하든" 항상 같은 파일을 찾도록 함.
# ------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent          # .../ai/scripts
AI_ROOT = SCRIPT_DIR.parent                            # .../ai
RAW_PATH = AI_ROOT / "data" / "raw" / "Prospie_dataset_open_access_V3.csv"
PROCESSED_DIR = AI_ROOT / "data" / "processed"
PROCESSED_PATH = PROCESSED_DIR / "prospie_processed.csv"

# 원본 데이터의 결측치 코드 (Key 시트에 "9999 = missing data"로 명시되어 있음)
MISSING_CODE = 9999


# ------------------------------------------------------------------
# 1. 체감온도 계산 함수
#    기상청 여름철 체감온도 공식 (Stull 습구온도 추정식 기반).
#    반드시 서비스 백엔드에서도 이 식과 동일하게 구현해야 한다.
# ------------------------------------------------------------------
def feels_like(Ta: pd.Series, RH: pd.Series) -> pd.Series:
    """
    기온(Ta, ℃)과 상대습도(RH, %)로 여름철 체감온도(℃)를 계산한다.

    1단계: 습구온도(Tw) 추정 (Stull 근사식)
    2단계: 체감온도 = -0.2442 + 0.55399*Tw + 0.45535*Ta - 0.0022*Tw^2 + 0.00278*Tw*Ta + 3.0
    """
    Tw = (
        Ta * np.arctan(0.151977 * (RH + 8.313659) ** 0.5)
        + np.arctan(Ta + RH)
        - np.arctan(RH - 1.67633)
        + 0.00391838 * RH ** 1.5 * np.arctan(0.023101 * RH)
        - 4.686035
    )
    feels_like_temp = (
        -0.2442
        + 0.55399 * Tw
        + 0.45535 * Ta
        - 0.0022 * Tw ** 2
        + 0.00278 * Tw * Ta
        + 3.0
    )
    return feels_like_temp


# ------------------------------------------------------------------
# 2. 연속작업시간 계산 함수
#    같은 참가자·같은 실험조건(condition) 안에서, 시간순으로 정렬한 뒤
#    "작업(1) 상태가 몇 분째 끊기지 않고 이어지는지"를 센다.
#    휴식(2)을 만나면 0으로 리셋된다.
#
#    실제 서비스에서는 work_sessions.started_at 을 기준으로
#    "현재시각 - started_at" 을 그대로 계산하면 동일한 값이 된다.
#    (= "최근 휴식 후 경과시간"과 수학적으로 같은 값이라 별도 컬럼을 안 둠)
# ------------------------------------------------------------------
def compute_continuous_work_min(df: pd.DataFrame) -> pd.Series:
    """
    df는 반드시 participant, condition, time_min(분 단위 정수), activity_workrest 컬럼을 가져야 한다.
    participant+condition 그룹별로 시간순 정렬 후 연속작업 스트릭을 계산해서 반환한다.
    """

    def _streak(group: pd.DataFrame) -> pd.Series:
        group = group.sort_values("time_min")
        is_work = (group["activity_workrest"] == 1).astype(int)
        # workrest 값이 바뀔 때마다(작업<->휴식 전환) 새 블록 번호를 매김
        block_id = (is_work != is_work.shift(1)).cumsum()
        # 블록 안에서 작업(1)이 몇 번째 연속인지 누적 카운트
        streak = is_work.groupby(block_id).cumsum()
        # 휴식 중(0)이면 0으로, 작업 중이면 streak 값 그대로
        streak = np.where(is_work == 1, streak, 0)
        return pd.Series(streak, index=group.index)

    return (
        df.groupby(["participant", "condition"], group_keys=False)
        .apply(_streak)
        .reindex(df.index)  # groupby 후 원래 행 순서로 복원
    )


# ------------------------------------------------------------------
# 2-1. 원본 PROSPIE 엑셀은 헤더가 2줄(상위 분류 + 세부 이름)로 되어 있다.
#      "Save As CSV"로 내보내면 병합된 셀 처리 방식에 따라
#        - 병합이 유지된 채로 저장되거나 (상위 분류가 반복됨)
#        - 병합이 깨져서 저장되거나 (빈 칸이 Unnamed: N 으로 남음)
#      두 경우가 다 생길 수 있어서, 컬럼 위치가 아니라 "세부 이름 문자열"로
#      직접 찾아내는 방식을 쓴다. 이러면 어떤 방식으로 내보낸 CSV든 안전하다.
# ------------------------------------------------------------------
def find_col(df: pd.DataFrame, keyword: str):
    """2단(MultiIndex) 컬럼 중, 어느 레벨이든 keyword와 정확히 일치하는 컬럼을 찾아 반환한다."""
    kw = keyword.strip()
    matches = [c for c in df.columns if any(str(level).strip() == kw for level in c)]
    if len(matches) != 1:
        raise ValueError(
            f"'{keyword}' 컬럼을 정확히 1개 찾지 못했습니다 (찾은 개수: {len(matches)}). "
            f"raw CSV의 헤더 구조를 확인해주세요. 매칭 결과: {matches}"
        )
    return matches[0]

# ------------------------------------------------------------------
# 2-2. participant / condition 이 정확히 뭘 뜻하는지
#      (모델 입력값은 아니고, 데이터를 제대로 나누고 디버깅하기 위한 꼬리표)
#
#      participant : 실험 참가자 고유 번호. 총 40명 (1~50 사이 값, 중간에 빈 번호 있음).
#                     "같은 사람의 시간대별 기록이 train/test에 동시에 들어가면
#                      성능이 부풀려진다"는 문제를 막기 위해, 학습 시 이 컬럼 기준으로
#                      Group 5-fold CV를 수행한다 (사람 단위로 통째로 나눔).
#
#      condition   : 실험 조건 번호. 기온·습도·작업복·직사광선 조합이 미리 세팅된
#                     시나리오 9종류 (1,2,3,6,7,8,9,10,11). 예:
#                       - Condition 1  : 40℃/35%, 통기성 작업복, 직사광선 없음 (실내 공장)
#                       - Condition 6  : 25℃/50%, 비통기성 작업복, 직사광선 없음 (실내 서늘함)
#                       - Condition 9  : 30℃/35%, 통기성 작업복, 직사광선 있음 (실외 맑은 날)
#                       - Condition 10 : 40℃/20%, 통기성 작업복, 직사광선 있음 (사막 환경)
#                     한 참가자가 여러 condition을 각각 다른 날 수행 → 그 조합이 1개 trial.
#                     학습에는 안 쓰지만, "특정 조건에서만 모델이 이상하게 동작하지 않는지"
#                     사후 검증할 때 이 컬럼으로 그룹핑해서 확인할 수 있다.
# ------------------------------------------------------------------


def main() -> None:
    print(f"[1/6] raw 데이터 로드: {RAW_PATH}")
    # header=[0,1] : 원본의 2줄짜리 헤더를 그대로 두 단계로 읽어들인다.
    raw = pd.read_csv(RAW_PATH, header=[0, 1], low_memory=False)

    # 필요한 11개 컬럼만 "세부 이름"으로 찾아서, 우리가 쓸 짧은 이름으로 새로 만든다.
    df = pd.DataFrame({
        "participant":       raw[find_col(raw, "Participant")],
        "condition":         raw[find_col(raw, "Condition")],
        "time":              raw[find_col(raw, "Time")],
        "activity_workrest": raw[find_col(raw, "workrest")],
        "age":               pd.to_numeric(raw[find_col(raw, "Age")], errors="coerce"),
        "clothing":          pd.to_numeric(raw[find_col(raw, "Clothing")], errors="coerce"),
        "temp":              pd.to_numeric(raw[find_col(raw, "Temp")], errors="coerce"),
        "humidity":          pd.to_numeric(raw[find_col(raw, "Humidity")], errors="coerce"),
        "gradient":          pd.to_numeric(raw[find_col(raw, "Gradient%")], errors="coerce"),
        "core_temp":         pd.to_numeric(raw[find_col(raw, "Corerectal")], errors="coerce"),
    })

    # time 컬럼("HH:MM:SS" 형태 문자열)을 "분 단위 정수"로 변환
    # → compute_continuous_work_min()이 숫자 비교/정렬을 할 수 있어야 하므로 필요
    time_parts = df["time"].astype(str).str.split(":", expand=True).astype(int)
    df["time_min"] = time_parts[0] * 60 + time_parts[1]

    print(f"    원본 행 수: {len(df):,}")

    # ----------------------------------------------------------
    # 2단계: 결측치(9999) 처리
    #   → 값이 없다는 뜻이므로 계산에 쓰면 안 되고 NaN으로 바꿔야 한다.
    #   → temp/humidity/core_temp가 결측이면 그 행 자체를 쓸 수 없으므로 이후 dropna에서 제거된다.
    # ----------------------------------------------------------
    print("[2/6] 결측치(9999) 처리")
    missing_cols = ["age", "clothing", "temp", "humidity", "gradient", "core_temp"]
    for col in missing_cols:
        n_missing = (df[col] == MISSING_CODE).sum()
        if n_missing > 0:
            print(f"    - {col}: 결측 {n_missing}개 ({n_missing/len(df)*100:.1f}%) → NaN 처리")
        df.loc[df[col] == MISSING_CODE, col] = np.nan

    # ----------------------------------------------------------
    # 3단계: 체감온도 파생
    # ----------------------------------------------------------
    print("[3/6] feels_like_temp 계산 (temp + humidity → 체감온도 공식)")
    df["feels_like_temp"] = feels_like(df["temp"], df["humidity"])

    # ----------------------------------------------------------
    # 4단계: 연속작업시간 파생
    # ----------------------------------------------------------
    print("[4/6] continuous_work_min 계산 (time + activity_workrest → 연속작업 스트릭)")
    df["continuous_work_min"] = compute_continuous_work_min(df)

    # ----------------------------------------------------------
    # 5단계: 작업(work) 중 시점만 남기기
    #   → 우리가 예측하려는 건 "일하는 동안의 심부체온 위험"이므로,
    #     휴식 중 데이터(activity_workrest == 2)는 학습 대상에서 제외한다.
    #   → 이 시점에서 continuous_work_min은 항상 1 이상이 된다.
    # ----------------------------------------------------------
    print("[5/6] 작업(work) 중 데이터만 필터링")
    before = len(df)
    df = df[df["activity_workrest"] == 1].copy()
    print(f"    {before:,}행 → {len(df):,}행 (휴식 구간 제외)")

    # ----------------------------------------------------------
    # 6단계: 최종 컬럼만 선택 + 결측 제거 + 저장
    #   participant, condition은 모델 입력값은 아니지만,
    #   학습 시 Group K-Fold(참가자 단위 분할)에 반드시 필요해서 같이 남겨둔다.
    # ----------------------------------------------------------
    print("[6/6] 최종 컬럼 선택 및 저장")
    final_cols = [
        "participant",         # 그룹 분할용 (모델 입력 아님)
        "condition",           # 참고용 (모델 입력 아님)
        "feels_like_temp",     # 입력 1
        "age",                 # 입력 2
        "clothing",            # 입력 3
        "gradient",             # 입력 4 (작업강도. 속도는 정보량이 거의 없어 제외)
        "continuous_work_min",  # 입력 5
        "core_temp",            # 타겟(y)
    ]
    result = df[final_cols].copy()

    before = len(result)
    result = result.dropna()  # 5개 입력값·타겟 중 하나라도 NaN이면 학습에 못 쓰므로 제거
    print(f"    결측 제거: {before:,}행 → {len(result):,}행")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    result.to_csv(PROCESSED_PATH, index=False)
    print(f"\n완료: {PROCESSED_PATH} ({len(result):,}행, {len(final_cols)}컬럼)")

    # 간단한 검증 출력 (수치가 상식적인 범위인지 눈으로 확인하기 위함)
    print("\n[검증용 요약 통계]")
    print(result.describe().round(2).to_string())


if __name__ == "__main__":
    main()