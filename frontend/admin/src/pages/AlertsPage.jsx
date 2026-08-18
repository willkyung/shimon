import Icon from '../components/Icon';
import { useAdmin } from '../context/AdminContext';
import {
  coreTempClass,
  riskLabel,
  tempClass,
} from '../utils/adminUtils';

export default function AlertsPage() {
  const {
    alerts,
    workers,
    settings,
    sendWorkerRestAlert,
  } = useAdmin();

  return (
    <section className="admin-page active">
      <div className="page-intro-row">
        <div>
          <p>SAFETY ALERTS</p>
          <h2>위험 알림</h2>
          <span>고위험 상태와 휴식 미이행 상황을 우선적으로 확인합니다.</span>
        </div>
      </div>

      <div className="alert-ai-note">
        <Icon name="pulse" />
        <span><strong>추정 심부체온</strong>은 체감온도·작업조건 등을 기반으로 한 AI 추정치이며 실측 체온이 아닙니다.</span>
      </div>

      <div className="alert-timeline">
        {alerts.length ? alerts.map((alert) => {
          const worker = workers.find((item) => item.name === alert.name);

          const reason = String(alert.detail || '')
            .split('·')
            .map((item) => item.trim())
            .filter((item) => !item.includes('체감온도') && !item.includes('심부체온'))
            .join(' · ');

          const statusText = String(alert.title || '').replace(/^매우 위험\s*·\s*/, '').trim();
          const riskClass = worker?.risk || (alert.type === 'danger' ? 'critical' : 'caution');
          const riskText = worker ? riskLabel(worker.risk) : alert.type === 'danger' ? '매우 위험' : '주의';

          return (
            <article key={`${alert.name}-${alert.time}`} className={`alert-item ${alert.type} risk-${riskClass}`}>
              <div className="alert-main">
                <div className="alert-card-head">
                  <div className="alert-identity">
                    <strong className="alert-worker-name">{alert.name}</strong>
                    <span className="alert-status-text">{statusText}</span>
                  </div>
                  <span className={`alert-risk-badge ${riskClass}`}>{riskText}</span>
                </div>

                {worker && (
                  <div className="alert-vitals" aria-label="핵심 위험 수치">
                    <div className={`alert-vital apparent ${tempClass(worker.apparentTemp)}`}>
                      <span>체감온도</span><strong>{worker.apparentTemp}°C</strong>
                    </div>

                    <div className={`alert-vital core ${coreTempClass(worker.coreTemp, settings)}`}>
                      <span><b>AI 추정</b> 심부체온</span><strong>{worker.coreTemp.toFixed(1)}°C</strong>
                    </div>
                  </div>
                )}

                <div className="alert-reason-row">
                  <span>사유</span>
                  <p>{reason || alert.detail}</p>
                </div>
              </div>

              <aside className="alert-side">
                <div className="alert-time-block"><span>발생 시각</span><time>{alert.time}</time></div>

                <button type="button" onClick={() => sendWorkerRestAlert(alert.name)}>
                  {alert.type === 'danger' ? '즉시 휴식 알림' : '휴식 권고'}
                  <Icon name="chevron" />
                </button>
              </aside>
            </article>
          );
        }) : (
          <div className="alert-empty">선택한 현장에 표시할 위험 알림이 없습니다.</div>
        )}
      </div>
    </section>
  );
}
