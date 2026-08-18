export function normalizeEmployeeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function minutesToDisplay(minutes) {
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (!hours) return `${remain}분`;
  if (!remain) return `${hours}시간`;
  return `${hours}시간 ${String(remain).padStart(2, '0')}분`;
}

export function statusLabel(status) {
  return {
    working: '작업중',
    resting: '휴식중',
    'rest-needed': '휴식필요',
  }[status] || '-';
}

export function statusPriority(status) {
  return {
    'rest-needed': 0,
    working: 1,
    resting: 2,
  }[status] ?? 9;
}

export function riskLabel(risk) {
  return {
    safe: '정상',
    watch: '관심',
    caution: '주의',
    critical: '매우 위험',
  }[risk] || '-';
}

export function tempClass(temp) {
  if (Number(temp) >= 43) return 'danger';
  if (Number(temp) >= 38) return 'caution';
  return 'normal';
}

export function coreTempClass(temp, settings) {
  const caution = Number(settings?.coreCautionTemp) || 37.5;
  const danger = Number(settings?.coreDangerTemp) || 38.0;

  if (Number(temp) >= danger) return 'high';
  if (Number(temp) >= caution) return 'caution';
  return 'normal';
}

export function coreTempLabel(temp, settings) {
  return {
    normal: '정상',
    caution: '주의',
    high: '고위험',
  }[coreTempClass(temp, settings)];
}

export function siteMatches(worker, siteFilter) {
  return siteFilter === 'all' || String(worker.site || '').startsWith(siteFilter);
}

export function getSortedWorkers(workers, sortValue) {
  const result = [...workers];

  if (sortValue === 'temp-desc') {
    result.sort((a, b) => b.apparentTemp - a.apparentTemp);
  } else if (sortValue === 'core-desc') {
    result.sort((a, b) => b.coreTemp - a.coreTemp);
  } else if (sortValue === 'work-desc') {
    result.sort((a, b) => b.dailyMinutes - a.dailyMinutes);
  } else if (sortValue === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } else {
    result.sort((a, b) => {
      const statusDiff = statusPriority(a.status) - statusPriority(b.status);
      if (statusDiff !== 0) return statusDiff;
      return b.apparentTemp - a.apparentTemp;
    });
  }

  return result;
}
