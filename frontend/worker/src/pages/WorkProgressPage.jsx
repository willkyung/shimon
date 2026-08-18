import { useWorker } from '../context/WorkerContext';
import { EkgIcon, ShieldIcon, ThermometerIcon } from '../components/Icons';

const COMPLIANCE_LABELS = {
  NORMAL: '정상',
  REST_SCHEDULED: '휴식 예정',
  DEADLINE_IMMINENT: '휴식 임박',
  IMMEDIATE_REST_REQUIRED: '휴식 필요',
};

export default function WorkProgressPage({ active }) {
  const {
    workSeconds,
    workProgress,
    formatDuration,
    currentEvaluation,
    startRest,
    endWork,
  } = useWorker();
  const compliance = currentEvaluation?.compliance;
  const weather = currentEvaluation?.weather;
  const ai = currentEvaluation?.ai;
  const complianceLabel = COMPLIANCE_LABELS[compliance?.status] || '-';

  return (
    <section id="screen-work-progress" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap work-progress-wrap">
        <div className="section-heading compact">
          <p className="eyebrow">WORK SESSION</p>
          <h1>작업 진행 중</h1>
          <p>현재 작업 시간이 기록되고 있습니다.</p>
        </div>

        <article className="card progress-card work-session-card">
          <div id="workRing" className="progress-ring work-ring" style={{ '--progress': `${workProgress}%` }}>
            <svg className="ring-ekg" viewBox="0 0 64 18" aria-hidden="true"><path d="M2 10h12l5-7 7 13 7-12 7 10 5-6h17" /></svg>
            <span>작업 시간</span>
            <strong>{formatDuration(workSeconds)}</strong>
            <small>마지막 휴식 이후 연속 작업</small>
          </div>

          <div className="work-metric-grid" aria-label="현재 작업 안전 지표">
            <div className="work-metric-card apparent">
              <span className="work-metric-icon" aria-hidden="true"><ThermometerIcon /></span>
              <span className="work-metric-label">체감온도</span>
              <strong>{weather ? `${weather.feelsLikeTemperature.toFixed(1).replace('.0', '')}℃` : '-'}</strong>
            </div>

            <div className="work-metric-card risk">
              <span className="work-metric-icon" aria-hidden="true"><ShieldIcon /></span>
              <span className="work-metric-label">준수 상태</span>
              <strong className="risk-text">{complianceLabel}</strong>
            </div>

            <div id="workCoreTempCard" className="work-metric-card core-temp" data-level={ai?.riskLevel?.toLowerCase() || 'unavailable'}>
              <span className="work-metric-icon" aria-hidden="true"><EkgIcon /></span>
              <span className="work-metric-label">AI 추정<br />심부체온</span>
              <strong>{ai?.predictedCoreTemperature ? `${ai.predictedCoreTemperature.toFixed(1)}℃` : '-'}</strong>
              <small>{ai?.riskLevel || '미연동'}</small>
            </div>
          </div>

          <div className="work-core-temp-note">
            <span>AI 추정 심부체온은 실측 체온이 아닙니다.</span><strong>i</strong>
          </div>
        </article>

        {compliance?.isRestRequired && (
          <div className="work-rest-required-banner" role="alert">
            <strong>휴식이 필요합니다.</strong>
            <span>현재 작업을 멈추고 권장 휴식을 시작해주세요.</span>
          </div>
        )}

        <div className="action-stack work-session-actions">
          <button className="btn work-rest-gradient-button" type="button" onClick={startRest}>
            <span className="work-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>
            </span>
            <span>휴식 시작</span>
          </button>

          <button className="btn work-end-button" type="button" onClick={endWork}>
            <span className="work-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" /></svg></span>
            <span>작업 종료</span>
          </button>
        </div>
      </div>
    </section>
  );
}
