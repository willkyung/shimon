import { useWorker } from '../context/WorkerContext';

export default function RestAlertPage({ active }) {
  const { currentEvaluation, startRest, snoozeRestAlert } = useWorker();
  const compliance = currentEvaluation?.compliance;
  const feelsLike = compliance?.feelsLikeTemperature;
  const minutes = compliance?.continuousWorkMinutes;
  const requiredRest = compliance?.requiredRestMinutes;

  return (
    <section id="screen-rest-alert" className={`screen alert-screen ${active ? 'active' : ''}`}>
      <div className="alert-wrap">
        <div className="danger-symbol">!</div>
        <p className="eyebrow danger-eyebrow">REST ALERT</p>
        <h1>지금<br />휴식이 필요합니다!</h1>
        <p>백엔드 안전 기준 평가에서 즉시 휴식이 필요하다고 판단했습니다.</p>

        <article className="danger-temperature-card">
          <span>현재 체감온도</span><strong>{feelsLike != null ? `${feelsLike}℃` : '-'}</strong><span className="status-pill alert-risk">휴식 필요</span>
        </article>

        <div className="rest-alert-facts">
          <span><small>연속 작업시간</small><strong>{minutes != null ? `${minutes}분` : '-'}</strong></span>
          <span><small>권장 휴식</small><strong>{requiredRest != null ? `${requiredRest}분` : '-'}</strong></span>
        </div>

        <button className="btn btn-light" type="button" onClick={startRest}>휴식 시작</button>
        <button className="alert-text-button" type="button" onClick={snoozeRestAlert}>작업 화면으로 돌아가기</button>
      </div>
    </section>
  );
}
