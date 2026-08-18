import Icon from '../components/Icon';
import { useAdmin } from '../context/AdminContext';
import { coreTempClass, riskLabel, statusLabel } from '../utils/adminUtils';

export default function DashboardPage() {
  const {
    dashboardMetrics,
    priorityWorkers,
    settings,
    quickFilterFromDashboard,
    goToPage,
  } = useAdmin();

  const {
    working,
    resting,
    restNeeded,
    coreDangerCount,
    coreAverage,
    criticalCount,
    ppeMissingCount,
    maxApparent,
  } = dashboardMetrics;

  return (
    <section className="admin-page active">
      <section className="dashboard-status-rail">
        <div className="status-rail-title"><span>NOW</span><strong>현장 작업 상태</strong></div>

        <button className="status-summary working" type="button" onClick={() => quickFilterFromDashboard('working')}>
          <span className="status-dot" /><div><small>작업중</small><strong>{working}</strong></div>
        </button>

        <button className="status-summary resting" type="button" onClick={() => quickFilterFromDashboard('resting')}>
          <span className="status-dot" /><div><small>휴식중</small><strong>{resting}</strong></div>
        </button>

        <button className="status-summary rest-needed" type="button" onClick={() => quickFilterFromDashboard('rest-needed')}>
          <span className="status-dot" /><div><small>휴식필요</small><strong>{restNeeded}</strong></div>
        </button>

        <div className="status-temperature">
          <span>현장 체감온도</span>
          <strong>{maxApparent ? `${maxApparent}°C` : '-'}</strong>
          <small>{maxApparent >= settings.dangerTemp ? '위험 구간' : '모니터링 중'}</small>
        </div>
      </section>

      <div className="dashboard-primary-grid">
        <article className="safety-pulse-panel">
          <div className="panel-heading">
            <div><p>SHIMON SAFETY PULSE</p><h2>체감온도 · 휴식 필요도</h2></div>
            <div className="chart-legend">
              <span><i className="temperature" />체감온도</span>
              <span><i className="threshold" />위험 기준</span>
            </div>
          </div>

          <div className="pulse-chart-wrap">
            <div className="chart-y-axis"><span>44°</span><span>42°</span><span>40°</span><span>38°</span><span>36°</span></div>

            <svg className="pulse-chart" viewBox="0 0 780 280" preserveAspectRatio="none" aria-label="오늘 시간대별 체감온도 추이">
              <defs>
                <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4B7FD1" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#51B786" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="pulseStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#51B786" />
                  <stop offset="58%" stopColor="#4B7FD1" />
                  <stop offset="100%" stopColor="#C7555B" />
                </linearGradient>
              </defs>

              <g className="chart-grid">
                <line x1="0" y1="36" x2="780" y2="36" />
                <line x1="0" y1="88" x2="780" y2="88" />
                <line x1="0" y1="140" x2="780" y2="140" />
                <line x1="0" y1="192" x2="780" y2="192" />
                <line x1="0" y1="244" x2="780" y2="244" />
              </g>

              <line className="chart-danger-line" x1="0" y1="62" x2="780" y2="62" />
              <path className="chart-area" d="M0 215 C70 210,110 197,156 184 C210 170,260 147,312 128 C350 114,390 80,432 68 C465 59,500 68,536 83 C580 101,622 126,664 142 C704 157,742 170,780 182 L780 280 L0 280 Z" />
              <path className="chart-main-line" d="M0 215 C70 210,110 197,156 184 C210 170,260 147,312 128 C350 114,390 80,432 68 C465 59,500 68,536 83 C580 101,622 126,664 142 C704 157,742 170,780 182" />
              <path className="chart-ekg-signature" d="M395 82 L410 82 L421 61 L435 105 L449 43 L463 93 L478 72 L495 72" />
              <circle className="chart-current-dot" cx="432" cy="68" r="7" />
            </svg>

            <div className="chart-x-axis"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span></div>
          </div>

          <div className="pulse-stats">
            <div><span>현재</span><strong>{maxApparent ? `${maxApparent}°C` : '-'}</strong></div>
            <div><span>오늘 최고</span><strong>{maxApparent ? `${maxApparent}°C` : '-'}</strong></div>
            <div><span>휴식 필요</span><strong className="danger-text">{restNeeded}명</strong></div>
            <div><span>휴식 이행률</span><strong className="gradient-text">88%</strong></div>
          </div>
        </article>

        <aside className="priority-panel">
          <div className="panel-heading compact">
            <div><p>PRIORITY</p><h2>휴식 우선순위</h2></div>
            <span className="priority-ai">RULE + AI</span>
          </div>

          <div className="priority-list">
            {priorityWorkers.map((worker, index) => (
              <div
                key={worker.id}
                className={`priority-item ${worker.risk === 'critical' ? 'high' : worker.risk === 'caution' ? 'medium' : ''}`}
              >
                <span className="priority-rank">{String(index + 1).padStart(2, '0')}</span>

                <div className="priority-copy">
                  <strong>{worker.name}</strong>
                  <span>{worker.site} · {statusLabel(worker.status)}</span>
                </div>

                <div className="priority-value">
                  <strong>{worker.apparentTemp}°C</strong>
                  <small className={`priority-core ${coreTempClass(worker.coreTemp, settings)}`}>AI {worker.coreTemp.toFixed(1)}°C</small>
                  <span className={worker.risk === 'critical' ? 'danger' : 'caution'}>{riskLabel(worker.risk)}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="priority-more" type="button" onClick={() => quickFilterFromDashboard('rest-needed')}>
            휴식 필요 노동자 전체 보기
            <Icon name="chevron" />
          </button>
        </aside>
      </div>

      <section className="dashboard-insight-grid">
        <article className="dashboard-insight-card core">
          <div className="insight-icon"><Icon name="pulse" /></div>
          <div><span>AI 추정 심부체온 38°C+</span><strong>{coreDangerCount}명</strong><small>실측 체온이 아닌 모델 추정치</small></div>
        </article>

        <article className="dashboard-insight-card average">
          <div className="insight-icon"><Icon name="pulse" /></div>
          <div><span>평균 추정 심부체온</span><strong>{coreAverage ? `${coreAverage.toFixed(1)}°C` : '-'}</strong><small>현재 선택 현장 기준</small></div>
        </article>

        <article className="dashboard-insight-card danger">
          <div className="insight-icon"><Icon name="alert" /></div>
          <div><span>고위험 노동자</span><strong>{criticalCount}명</strong><small>즉시 확인이 필요한 인원</small></div>
        </article>

        <article className="dashboard-insight-card ppe">
          <div className="insight-icon"><Icon name="shield" /></div>
          <div><span>PPE / 작업복 미착용</span><strong>{ppeMissingCount}명</strong><small>보호구 상태 확인 필요</small></div>
        </article>

        <button className="dashboard-workers-link" type="button" onClick={() => goToPage('workers')}>
          전체 노동자 상세 현황은 노동자 현황에서 확인
          <Icon name="chevron" />
        </button>
      </section>
    </section>
  );
}
