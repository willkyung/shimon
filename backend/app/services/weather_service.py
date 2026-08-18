"""
weather_service.py
-------------------
기상청 초단기실황조회 API를 호출해서 현장의 기온·습도를 가져오고,
1시간에 1번만 실제로 API를 부르도록 캐싱한다.

[핵심 원칙]
    기온·습도는 실제로 1시간에 1번만 바뀌는 데이터이므로,
    매 요청마다 API를 호출하지 않고 "현장(site) + 시간(hour)" 단위로 캐싱한다.
    캐시가 있으면 그대로 재사용, 없으면 그때만 API를 호출한다.
"""

import math
from datetime import datetime, timedelta
from urllib.parse import unquote

import requests

from backend.app.core.config import get_settings

# ------------------------------------------------------------------
# 0. 설정값
# ------------------------------------------------------------------
KMA_ENDPOINT = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"

_kma_service_key_setting = get_settings().kma_service_key
# 공공데이터포털이 발급하는 키는 이미 URL-인코딩된 상태로 온다.
# requests가 params에 넣을 때 다시 인코딩하므로, 여기서 한 번 디코딩해둬야
# 이중 인코딩(%25 -> %2B 같은)으로 인증이 깨지는 걸 막을 수 있다.
KMA_API_KEY = (
    unquote(_kma_service_key_setting.get_secret_value())
    if _kma_service_key_setting
    else None
)

if not KMA_API_KEY:
    raise RuntimeError(
        "KMA_SERVICE_KEY 환경변수가 설정되지 않았습니다. "
        ".env 파일에 KMA_SERVICE_KEY=발급받은키 형태로 넣고 다시 실행하세요. "
        "(API 키를 코드에 직접 쓰지 말 것 — 팀 기획서 9장 체크리스트 참고)"
    )

# 캐시: {(nx, ny): {"cached_at_hour": "2026081814", "temp": 33.2, "humidity": 44.0}}
_weather_cache: dict = {}


# ------------------------------------------------------------------
# 1. 위경도 -> 기상청 격자좌표(nx, ny) 변환
#    기상청이 공식 배포한 LCC 변환 알고리즘 (여러 독립 소스에서 동일하게 확인됨)
# ------------------------------------------------------------------
def latlon_to_grid(lat: float, lon: float) -> tuple[int, int]:
    RE = 6371.00877   # 지구 반경(km)
    GRID = 5.0        # 격자 간격(km)
    SLAT1 = 30.0      # 투영 위도1
    SLAT2 = 60.0      # 투영 위도2
    OLON = 126.0      # 기준점 경도
    OLAT = 38.0       # 기준점 위도
    XO = 43           # 기준점 X좌표
    YO = 136          # 기준점 Y좌표

    DEGRAD = math.pi / 180.0
    re = RE / GRID
    slat1 = SLAT1 * DEGRAD
    slat2 = SLAT2 * DEGRAD
    olon = OLON * DEGRAD
    olat = OLAT * DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = (sf ** sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / (ro ** sn)

    ra = math.tan(math.pi * 0.25 + lat * DEGRAD * 0.5)
    ra = re * sf / (ra ** sn)
    theta = lon * DEGRAD - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    x = ra * math.sin(theta) + XO
    y = ro - ra * math.cos(theta) + YO

    return int(x + 1.5), int(y + 1.5)


# ------------------------------------------------------------------
# 2. base_date / base_time 계산
#    초단기실황은 매시 40분경 그 시각 데이터가 올라온다고 알려져 있어,
#    안전하게 "정시 기준 10분 이전이면 이전 시각 데이터를 요청"하도록 처리한다.
# ------------------------------------------------------------------
def _get_base_datetime(now: datetime | None = None) -> tuple[str, str]:
    now = now or datetime.now()
    if now.minute < 10:
        now = now - timedelta(hours=1)
    base_date = now.strftime("%Y%m%d")
    base_time = now.strftime("%H") + "00"
    return base_date, base_time


# ------------------------------------------------------------------
# 3. 실제 API 호출
# ------------------------------------------------------------------
def _fetch_from_kma(nx: int, ny: int) -> dict:
    base_date, base_time = _get_base_datetime()

    params = {
        "serviceKey": KMA_API_KEY,
        "pageNo": "1",
        "numOfRows": "10",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    response = requests.get(KMA_ENDPOINT, params=params, timeout=5)
    response.raise_for_status()
    data = response.json()

    items = data["response"]["body"]["items"]["item"]
    # 응답은 카테고리별로 여러 행이 옴 (T1H, REH 등) -> 딕�너리로 정리
    values = {item["category"]: item["obsrValue"] for item in items}

    return {
        "temp": float(values["T1H"]),      # 기온
        "humidity": float(values["REH"]),  # 습도
    }


# ------------------------------------------------------------------
# 4. 캐싱된 조회 함수 — 실제로 백엔드에서 호출할 함수는 이것 하나
# ------------------------------------------------------------------
def get_current_weather(lat: float, lon: float) -> dict:
    """
    위경도를 받아 현재 기온·습도를 반환한다.
    같은 격자·같은 시간대(hour) 안에서는 캐시된 값을 재사용해
    기상청 API를 시간당 1번만 호출한다.
    """
    nx, ny = latlon_to_grid(lat, lon)
    now = datetime.now()
    hour_key = now.strftime("%Y%m%d%H")
    cache_key = (nx, ny)

    cached = _weather_cache.get(cache_key)
    if cached and cached["cached_at_hour"] == hour_key:
        return {"temp": cached["temp"], "humidity": cached["humidity"], "source": "cache"}

    # 캐시가 없거나 시간이 지났으면 API 재호출
    weather = _fetch_from_kma(nx, ny)
    _weather_cache[cache_key] = {"cached_at_hour": hour_key, **weather}

    return {**weather, "source": "api"}
