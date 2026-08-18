import { useWorker } from '../context/WorkerContext';
import { ThermometerIcon, WaterIcon } from '../components/Icons';
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

          <div className="rest-checks rest-check-list" aria-label="휴식 중 안전 체크">
            <div className="rest-check-item shade">
              <span className="rest-check-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0H4Z" /><path d="M12 12v6a2 2 0 0 0 4 0" /><path d="M12 4V2" /></svg>
              </span>
              <div><strong>그늘 또는 시원한 장소</strong><small>직사광선을 피하고 몸의 열을 식혀주세요.</small></div>
            </div>

            <div className="rest-check-item water">
              <span className="rest-check-icon" aria-hidden="true"><WaterIcon /></span>
              <div><strong>수분 섭취</strong><small>한 번에 많이 마시기보다 조금씩 자주 섭취하세요.</small></div>
            </div>

            <div className="rest-check-item condition">
              <span className="rest-check-icon" aria-hidden="true"><ThermometerIcon /></span>
              <div><strong>몸 상태 확인</strong><small>어지럼·두통 등 이상 증상이 없는지 확인하세요.</small></div>
            </div>
          </div>
        </article>

        <button className="btn btn-primary" type="button" onClick={endRest}>휴식 종료</button>
      </div>
    </section>
  );
}
