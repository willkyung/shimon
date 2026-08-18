export const WORK_TYPE_OPTIONS = [
  { value: '순찰·점검', intensity: '낮음' },
  { value: '토목 작업', intensity: '보통' },
  { value: '건설 작업', intensity: '보통' },
  { value: '도로 작업', intensity: '높음' },
  { value: '중량물 운반', intensity: '높음' },
];

export function workIntensityFor(workType) {
  return WORK_TYPE_OPTIONS.find((option) => option.value === workType)?.intensity || '';
}
