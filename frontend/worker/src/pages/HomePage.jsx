import { useWorker } from '../context/WorkerContext';
import {
  getWorkerLocationPresentation,
  WORKER_HOME_WEATHER_FALLBACK,
} from '../data/workerHomeData';
import { getEstimatedCoreTempLevel } from '../utils/format';

export default function HomePage({ active }) {
  const {
    currentUser,
    workState,
    currentEvaluation,
    estimatedCoreTemp,
    startWork,
    startRest,
    showToast,
  } = useWorker();

  const workActionLabel = workState === 'running'
    ? '작업 화면 보기'
    : workState === 'paused'
      ? '작업 재개'
      : '작업 시작';

  // 작업 중이면 실제 AI/기상 평가값을 쓰고, 아직 작업을 시작 전(idle)이면 이 화면에서
  // 참고할 실측값이 없어서 데모 안내값을 보여준다 (evaluate API가 진행 중인 세션에서만 동작함).
  const liveAi = currentEvaluation?.ai;
  const liveWeather = currentEvaluation?.weather;

  // 체감온도 배지는 AI 종합 위험도(riskLevel)가 아니라 체감온도 수치 자체로 판정한다.
  function heatStatusFromApparentTemp(feelsLikeTemperature) {
    if (feelsLikeTemperature >= 33) return '위험';
    if (feelsLikeTemperature >= 31) return '주의';
    return '관심';
  }

  const weather = liveWeather
    ? {
        temperature: liveWeather.temperature,
        humidity: liveWeather.humidity,
        feelsLikeTemperature: liveWeather.feelsLikeTemperature,
        heatStatus: heatStatusFromApparentTemp(liveWeather.feelsLikeTemperature),
        guidance: '체감온도·연속작업시간을 반영한 실시간 값입니다.',
      }
    : WORKER_HOME_WEATHER_FALLBACK;
  const displayedCoreTemp = liveAi?.estimatedCoreTempC ?? estimatedCoreTemp;
  const coreTempState = getEstimatedCoreTempLevel(displayedCoreTemp);
  const location = getWorkerLocationPresentation(currentUser);

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
              <span className="location-geography">{location.geographicLocation}</span>
              <span className="location-separator" aria-hidden="true">·</span>
              <strong className="location-work-area">{location.workArea}</strong>
            </p>
          </div>
        </div>

        <article className="card hero-card">
          <div className="hero-top">
            <div className="hero-main">
              <span className="card-label">현재 체감온도</span>
              <div className="temperature-line">
                <strong className="current-temperature">{weather.feelsLikeTemperature.toFixed(1)}°C</strong>
                <span className="status-pill home-risk">{weather.heatStatus}</span>
              </div>
              <p className="hero-description">{weather.guidance}</p>
            </div>

            <div className="hero-weather-art" aria-hidden="true">
              <span className="hero-sun" />
              <span className="hero-cloud hero-cloud-one" />
              <span className="hero-cloud hero-cloud-two" />
              <span className="hero-skyline" />
            </div>
          </div>

          <p className="home-weather-context">
            <span>기온 <strong>{weather.temperature.toFixed(1)}°C</strong></span>
            <i aria-hidden="true" />
            <span>습도 <strong>{weather.humidity}%</strong></span>
          </p>

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
              <small>실측 체온이 아닌 위험도 산정용 예측값</small>
            </span>

            <span className="estimated-core-temp-reading">
              <strong>{displayedCoreTemp.toFixed(1)}°C</strong>
              <span>{coreTempState.label}</span>
            </span>
          </div>
        </article>

        <div className="action-stack home-actions">
          <button className="btn btn-work" type="button" onClick={startWork}>{workActionLabel}</button>
          <button className="btn btn-rest home-rest-button" type="button" onClick={startRest}>휴식 시작</button>
        </div>
      </div>
    </section>
  );
}
