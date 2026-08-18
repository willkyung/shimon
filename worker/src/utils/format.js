export function normalizeEmployeeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function roleLabel(role) {
  return role === 'admin' ? '관리자' : '노동자';
}

export function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function formatTargetClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatMinutesForUI(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function formatMinutesForAdmin(minutes) {
  const value = Number(minutes) || 0;
  if (value > 0 && value % 60 === 0) return `${value / 60}시간`;
  return `${value}분`;
}

export function totalRecordMinutes(records) {
  return records.reduce((sum, item) => sum + (parseInt(item.duration, 10) || 0), 0);
}

export function getEstimatedCoreTempLevel(value) {
  if (Number(value) >= 38.0) return { level: 'high', label: '고위험' };
  if (Number(value) >= 37.5) return { level: 'caution', label: '주의' };
  return { level: 'normal', label: '정상' };
}

export function getRecordRisk(apparentTemp, coreTemp) {
  const temp = Number(apparentTemp);
  const core = Number(coreTemp);
  if (core >= 38.0 || temp >= 35) return { level: 'warning', label: '경고' };
  if (core >= 37.5 || temp >= 33) return { level: 'caution', label: '주의' };
  return { level: 'normal', label: '정상' };
}
