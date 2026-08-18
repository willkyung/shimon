import { useCallback, useEffect, useState } from 'react';
import { useWorker } from '../context/WorkerContext';
import { loadAdminDashboard } from '../data/adminDashboardData';

const COMPLIANCE_LABELS = {
  IMMEDIATE_REST_REQUIRED: '즉시 법정 휴식',
  DEADLINE_IMMINENT: '법정 휴식 임박',
  NORMAL: '법정 기준 정상',
};

const STATE_LABELS = {
  WORKING: '작업중',
  RESTING: '휴식중',
  IDLE: '대기',
};

function PriorityWorker({ worker }) {
  const isLegal = worker.complianceStatus !== 'NORMAL';
  return (
    <article className={`admin-priority-card ${isLegal ? 'legal' : 'ai'}`}>
      <div className="admin-priority-topline">
        <span className={`admin-priority-kind ${isLegal ? 'legal' : 'ai'}`}>
          {isLegal ? 'RULE' : 'AI'}
        </span>
        <span className={`admin-state-badge ${worker.state.toLowerCase()}`}>{STATE_LABELS[worker.state]}</span>
      </div>
      <div className="admin-priority-person">
        <div>
          <strong>{worker.name}</strong>
          <span>
            {isLegal ? COMPLIANCE_LABELS[worker.complianceStatus] : `AI ${worker.aiRisk}`}
            {' · '}{worker.continuousWorkMinutes}분 작업
          </span>
        </div>
        <div className="admin-priority-temp">
          <strong>{worker.predictedCoreTemperature.toFixed(1)}℃</strong>
          <small>AI 추정</small>
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboardPage({ active }) {
  const { currentUser, logout, showToast } = useWorker();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDashboard(await loadAdminDashboard());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  if (!active) return null;

  return (
    <section id="screen-admin-dashboard" className="screen active admin-mobile-screen">
      <header className="admin-mobile-header">
        <div className="admin-mobile-brand">
          <img src="/shimon-logo.png" alt="" />
          <span><strong>SHIMON</strong><small>관리자</small></span>
        </div>
        <button type="button" onClick={logout}>로그아웃</button>
      </header>

      {loading || !dashboard ? (
        <div className="admin-mobile-loading">현장 정보를 불러오고 있습니다.</div>
      ) : (
        <div className="admin-mobile-content">
          <div className="admin-mobile-welcome">
            <div><span>안녕하세요</span><strong>{currentUser?.name || '관리자'}님</strong></div>
            <button type="button" onClick={() => { refresh(); showToast('현장 정보를 새로고침했습니다.'); }} aria-label="현장 정보 새로고침">↻</button>
          </div>

          <article className="admin-weather-card">
            <div>
              <span className="admin-section-kicker">SITE CONDITION</span>
              <h1>{dashboard.site.name}</h1>
              <small>{dashboard.site.measuredAt}</small>
            </div>
            <div className="admin-weather-value">
              <span>체감온도</span>
              <strong>{dashboard.site.feelsLikeTemperature.toFixed(1)}℃</strong>
              <small>{dashboard.site.heatStatus}</small>
            </div>
          </article>

          <section className="admin-summary-section" aria-labelledby="admin-summary-title">
            <div className="admin-section-heading">
              <div><span className="admin-section-kicker">NOW</span><h2 id="admin-summary-title">현장 작업 상태</h2></div>
              <small>실시간 상태 요약</small>
            </div>
            <div className="admin-summary-grid">
              <article><span>전체</span><strong>{dashboard.summary.totalWorkers}</strong><small>명</small></article>
              <article><span>작업중</span><strong>{dashboard.summary.workingWorkers}</strong><small>명</small></article>
              <article className="resting"><span>휴식중</span><strong>{dashboard.summary.restingWorkers}</strong><small>명</small></article>
              <article className="legal"><span>법정휴식</span><strong>{dashboard.summary.legalRestRequiredWorkers}</strong><small>명</small></article>
              <article className="ai-high"><span>AI 고위험</span><strong>{dashboard.summary.aiHighRiskWorkers}</strong><small>명</small></article>
            </div>
          </section>

          <section className="admin-priority-section" aria-labelledby="admin-priority-title">
            <div className="admin-section-heading">
              <div><span className="admin-section-kicker">PRIORITY</span><h2 id="admin-priority-title">우선 확인 작업자</h2></div>
              <small>RULE 우선 · AI 보조</small>
            </div>
            <div className="admin-priority-list">
              {dashboard.priorityWorkers.map((worker) => <PriorityWorker key={worker.id} worker={worker} />)}
            </div>
          </section>

          <section className="admin-worker-section" aria-labelledby="admin-worker-title">
            <div className="admin-section-heading">
              <div><span className="admin-section-kicker">ALL WORKERS</span><h2 id="admin-worker-title">전체 작업자</h2></div>
              <small>{dashboard.workers.length}명</small>
            </div>
            <div className="admin-worker-list">
              {dashboard.workers.map((worker) => (
                <article key={worker.id} className="admin-worker-row">
                  <div className="admin-worker-avatar">{worker.name.slice(0, 1)}</div>
                  <div className="admin-worker-copy">
                    <strong>{worker.name}</strong>
                    <span>{worker.continuousWorkMinutes}분 연속 작업</span>
                    <small className={worker.complianceStatus === 'NORMAL' ? 'normal' : 'legal'}>
                      {COMPLIANCE_LABELS[worker.complianceStatus]}
                    </small>
                  </div>
                  <div className="admin-worker-status">
                    <span className={`admin-state-badge ${worker.state.toLowerCase()}`}>{STATE_LABELS[worker.state]}</span>
                    <strong className={`admin-ai-badge ${worker.aiRisk.toLowerCase()}`}>AI {worker.aiRisk}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
