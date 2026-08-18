import { useMemo } from 'react';
import { useWorker } from '../context/WorkerContext';

export default function HomePage({ active }) {
  const {
    currentUser,
    workState,
    workSeconds,
    formatDuration,
    estimatedCoreTemp,
    coreTempState,
    adminSettings,
    startWork,
    startRest,
    showToast,
  } = useWorker();

  const status = useMemo(() => {
    if (workState === 'running') {
      return {
        title: '작업 중',
        copy: `연속 작업 ${formatDuration(workSeconds)}`,
        button: '작업 화면 보기',
      };
    }
    if (workState === 'paused') {
      return {
        title: '일시정지',
        copy: `작업 ${formatDuration(workSeconds)} 기록됨`,
        button: '작업 재개',
      };
    }
    return { title: '대기 중', copy: '작업을 시작해주세요.', button: '작업 시작' };
  }, [workState, workSeconds, formatDuration]);

  return (
    <section id="screen-home" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap home-content-wrap">
        <div className="greeting-row">
          <div className="greeting-copy">
            <h1>안녕하세요, <span>{currentUser?.name || '사용자'}</span>님</h1>
            <p className="location-line">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>{currentUser?.workplace || '-'}</span>
            </p>
          </div>

          <div className="weather-mini caution" aria-label="현재 체감온도 33도, 주의">
            <span>체감온도</span><strong>33°C</strong>
          </div>
        </div>

        <article className="card hero-card">
          <div className="hero-top">
            <div className="hero-main">
              <span className="card-label">현재 체감온도</span>
              <div className="temperature-line">
                <strong className="current-temperature">33°C</strong>
                <span className="status-pill home-risk">주의</span>
              </div>
              <p className="hero-description">기온이 높습니다. 충분한 수분 섭취와<br />정기적인 휴식을 권장합니다.</p>
            </div>

            <div className="hero-weather-art" aria-hidden="true">
              <span className="hero-sun" />
              <span className="hero-cloud hero-cloud-one" />
              <span className="hero-cloud hero-cloud-two" />
              <span className="hero-skyline" />
            </div>
          </div>

          <div id="homeCoreTempCard" className="estimated-core-temp" data-level={coreTempState.level}>
            <span className="estimated-core-temp-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 12h4l1.7-3.5 3.1 7.3 2.2-5 1.3 2.6H21" /></svg>
            </span>

            <span className="estimated-core-temp-copy">
              <span className="estimated-core-temp-label">
                AI 추정 심부체온
                <button
                  className="estimated-core-temp-info"
                  type="button"
                  onClick={() => showToast('체감온도·연령·작업강도·PPE·연속작업시간을 바탕으로 계산한 AI 추정값이며, 실측 체온이 아닙니다.')}
                  aria-label="추정 심부체온 안내"
                >
                  i
                </button>
              </span>
              <small>실측 체온이 아닌 작업조건 기반 추정치</small>
            </span>

            <span className="estimated-core-temp-reading">
              <strong>{estimatedCoreTemp.toFixed(1)}°C</strong>
              <span>{coreTempState.label}</span>
            </span>
          </div>
        </article>

        <div className="two-column">
          <article className="card stat-card">
            <span className="stat-icon stat-icon-work" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="13" r="7" /><path d="M12 10v4l3 2" /><path d="M9 3h6" /><path d="M12 3v3" />
              </svg>
            </span>
            <div className="stat-copy">
              <span className="card-label">작업 상태</span>
              <strong>{status.title}</strong>
              <small>{status.copy}</small>
            </div>
          </article>

          <article className="card stat-card">
            <span className="stat-icon stat-icon-rest" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 2v6M16 2v6M4 10h16" />
                <circle cx="16.5" cy="16.5" r="3.5" /><path d="M16.5 14.5v2.2l1.4 1" />
              </svg>
            </span>
            <div className="stat-copy">
              <span className="card-label">다음 권장 휴식</span>
              <strong>{adminSettings.maxWorkMinutes}분 기준</strong>
              <small>권장 휴식 · {adminSettings.restMinutes}분</small>
            </div>
          </article>
        </div>

        <div className="action-stack home-actions">
          <button className="btn btn-work" type="button" onClick={startWork}>{status.button}</button>
          <button className="btn btn-rest home-rest-button" type="button" onClick={startRest}>휴식 시작</button>
        </div>
      </div>
    </section>
  );
}
