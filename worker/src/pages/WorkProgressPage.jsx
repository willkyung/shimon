import { useWorker } from '../context/WorkerContext';
import { EkgIcon, ShieldIcon, ThermometerIcon, WaterIcon } from '../components/Icons';
import { formatMinutesForAdmin } from '../utils/format';

export default function WorkProgressPage({ active }) {
  const {
    workSeconds,
    workProgress,
    formatDuration,
    estimatedCoreTemp,
    coreTempState,
    adminSettings,
    startRest,
    endWork,
    showToast,
  } = useWorker();

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
            <small>{formatMinutesForAdmin(adminSettings.maxWorkMinutes)} 기준</small>
          </div>

          <div className="work-metric-grid" aria-label="현재 작업 안전 지표">
            <div className="work-metric-card apparent">
              <span className="work-metric-icon" aria-hidden="true"><ThermometerIcon /></span>
              <span className="work-metric-label">체감온도</span>
              <strong>33℃</strong>
            </div>

            <div className="work-metric-card risk">
              <span className="work-metric-icon" aria-hidden="true"><ShieldIcon /></span>
              <span className="work-metric-label">현재 위험도</span>
              <strong className="risk-text">주의</strong>
            </div>

            <div id="workCoreTempCard" className="work-metric-card core-temp" data-level={coreTempState.level}>
              <span className="work-metric-icon" aria-hidden="true"><EkgIcon /></span>
              <span className="work-metric-label">AI 추정<br />심부체온</span>
              <strong>{estimatedCoreTemp.toFixed(1)}℃</strong>
              <small>{coreTempState.label}</small>
            </div>
          </div>

          <button
            className="work-core-temp-note"
            type="button"
            onClick={() => showToast('체감온도·연령·작업강도·PPE·연속작업시간을 바탕으로 계산한 AI 추정값이며, 실측 체온이 아닙니다.')}
          >
            <span>AI 추정 심부체온은 실측 체온이 아닙니다.</span><strong>i</strong>
          </button>
        </article>

        <article className="card checklist-card work-safety-card">
          <div className="work-safety-heading">
            <div><span className="work-safety-eyebrow">SAFETY CHECK</span><h2>안전 체크</h2></div>
            <span className="work-safety-mark" aria-hidden="true"><ShieldIcon check /></span>
          </div>

          <div className="work-check-list">
            <div className="work-check-item water">
              <span className="work-check-icon" aria-hidden="true"><WaterIcon /></span>
              <div><strong>수분을 가까이 두기</strong><small>작업 중 조금씩 자주 섭취하세요.</small></div>
            </div>

            <div className="work-check-item body">
              <span className="work-check-icon" aria-hidden="true"><EkgIcon /></span>
              <div><strong>몸 상태 이상 시 바로 휴식</strong><small>어지럼·두통 등 이상 증상을 무시하지 마세요.</small></div>
            </div>

            <div className="work-check-item alert">
              <span className="work-check-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 6-2.6 6.7-2.6 8.3h17.2C20.6 14.7 18 14 18 8Z" /><path d="M9.5 20h5" /></svg>
              </span>
              <div><strong>휴식 알림 확인하기</strong><small>권장 휴식 알림이 오면 작업을 멈추고 확인하세요.</small></div>
            </div>
          </div>
        </article>

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
