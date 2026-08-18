import { useWorker } from '../context/WorkerContext';
import { formatTargetClock } from '../utils/format';

export default function RestProgressPage({ active }) {
  const { restSeconds, restProgress, restTargetSeconds, endRest } = useWorker();

  return (
    <section id="screen-rest-progress" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap rest-progress-wrap">
        <div className="section-heading compact rest-progress-heading">
          <p className="eyebrow">REST SESSION</p>
          <h1>휴식 진행 중</h1>
          <p>권장 휴식 시간 동안 안전하게 회복해주세요.</p>
        </div>

        <article className="card progress-card rest-progress-card">
          <div id="restRing" className="progress-ring rest-ring" style={{ '--progress': `${restProgress}%` }}>
            <svg className="ring-ekg" viewBox="0 0 64 18" aria-hidden="true"><path d="M2 10h12l5-7 7 13 7-12 7 10 5-6h17" /></svg>
            <span>남은 시간</span>
            <strong>{formatTargetClock(restSeconds)}</strong>
            <small>/ {formatTargetClock(restTargetSeconds)}</small>
          </div>

        </article>

        <button className="btn btn-primary" type="button" onClick={endRest}>휴식 종료</button>
      </div>
    </section>
  );
}
