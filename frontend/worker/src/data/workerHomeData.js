// TODO: Replace this fallback weather/location data when the Worker Home API is connected.
// Keep demo-only values here so production rendering components do not invent domain data.
export const WORKER_HOME_WEATHER_FALLBACK = Object.freeze({
  temperature: 31.8,
  humidity: 68,
  feelsLikeTemperature: 33,
  heatStatus: '위험',
  guidance: '기온이 높습니다. 충분한 수분 섭취와 정기적인 휴식을 권장합니다.',
});

const TEMPORARY_SITE_LOCATION_BY_NAME = Object.freeze({
  a1: '서울특별시 강남구 역삼동',
});

export function formatWorkArea(workArea) {
  const normalized = workArea?.trim();
  if (!normalized) return '작업 구역 미지정';
  if (normalized.endsWith('구역')) return normalized;
  if (/^[a-z]\d+$/i.test(normalized)) return `${normalized.toUpperCase()} 구역`;
  return normalized;
}

function siteLocationKey(workArea) {
  return workArea.trim().toLowerCase().replace(/\s*구역$/, '');
}

export function getWorkerLocationPresentation(user) {
  const workArea = user?.workplace?.trim() || '';
  const geographicLocation =
    user?.siteLegalDong ||
    user?.siteDistrict ||
    user?.siteAddress ||
    TEMPORARY_SITE_LOCATION_BY_NAME[siteLocationKey(workArea)] ||
    '행정구역 정보 미등록';

  return {
    geographicLocation,
    workArea: formatWorkArea(workArea),
  };
}
