const dashboardFixture = {
  site: {
    id: 'mvp-site-1',
    name: '강남 건설현장',
    feelsLikeTemperature: 36.7,
    heatStatus: '위험',
    measuredAt: '14:30 기준',
  },
  workers: [
    {
      id: 'worker-1',
      name: '김민수',
      state: 'WORKING',
      continuousWorkMinutes: 105,
      complianceStatus: 'IMMEDIATE_REST_REQUIRED',
      aiRisk: 'HIGH',
      predictedCoreTemperature: 38.2,
    },
    {
      id: 'worker-2',
      name: '이서준',
      state: 'WORKING',
      continuousWorkMinutes: 92,
      complianceStatus: 'DEADLINE_IMMINENT',
      aiRisk: 'CAUTION',
      predictedCoreTemperature: 37.8,
    },
    {
      id: 'worker-3',
      name: '박민수',
      state: 'RESTING',
      continuousWorkMinutes: 0,
      complianceStatus: 'NORMAL',
      aiRisk: 'LOW',
      predictedCoreTemperature: 37.1,
    },
    {
      id: 'worker-4',
      name: '최지훈',
      state: 'WORKING',
      continuousWorkMinutes: 68,
      complianceStatus: 'NORMAL',
      aiRisk: 'HIGH',
      predictedCoreTemperature: 38.1,
    },
    {
      id: 'worker-5',
      name: '정하윤',
      state: 'IDLE',
      continuousWorkMinutes: 0,
      complianceStatus: 'NORMAL',
      aiRisk: 'CAUTION',
      predictedCoreTemperature: 37.5,
    },
  ],
};

const PRIORITY_RANK = {
  IMMEDIATE_REST_REQUIRED: 0,
  DEADLINE_IMMINENT: 1,
  HIGH: 2,
  CAUTION: 3,
  NORMAL: 4,
};

function priorityFor(worker) {
  if (worker.complianceStatus === 'IMMEDIATE_REST_REQUIRED') return PRIORITY_RANK.IMMEDIATE_REST_REQUIRED;
  if (worker.complianceStatus === 'DEADLINE_IMMINENT') return PRIORITY_RANK.DEADLINE_IMMINENT;
  return PRIORITY_RANK[worker.aiRisk] ?? PRIORITY_RANK.NORMAL;
}

function buildDashboard(data) {
  const workers = [...data.workers].sort((a, b) => priorityFor(a) - priorityFor(b));
  return {
    ...data,
    workers,
    priorityWorkers: workers.filter((worker) => priorityFor(worker) < PRIORITY_RANK.NORMAL).slice(0, 3),
    summary: {
      totalWorkers: workers.length,
      workingWorkers: workers.filter((worker) => worker.state === 'WORKING').length,
      restingWorkers: workers.filter((worker) => worker.state === 'RESTING').length,
      legalRestRequiredWorkers: workers.filter(
        (worker) => worker.complianceStatus === 'IMMEDIATE_REST_REQUIRED',
      ).length,
      aiHighRiskWorkers: workers.filter((worker) => worker.aiRisk === 'HIGH').length,
    },
  };
}

// TODO: Replace only this adapter with GET /api/v1/admin/sites/{siteId}/dashboard.
export async function loadAdminDashboard() {
  return buildDashboard(dashboardFixture);
}
