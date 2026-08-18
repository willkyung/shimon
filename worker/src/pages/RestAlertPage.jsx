import { useWorker } from '../context/WorkerContext';

export default function RestAlertPage({ active }) {
  const { startRest, snoozeRestAlert } = useWorker();

  return (
    <section id="screen-rest-alert" className={`screen alert-screen ${active ? 'active' : ''}`}>
      <div className="alert-wrap">
        <div className="danger-symbol">!</div>
        <p className="eyebrow danger-eyebrow">REST ALERT</p>
        <h1>지금<br />휴식이 필요합니다!</h1>
        <p>체감온도 상승으로 열사병 위험이 높아졌습니다.</p>

        <article className="danger-temperature-card">
          <span>현재 체감온도</span><strong>35℃</strong><span className="status-pill alert-risk">위험</span>
        </article>

        <button className="btn btn-light" type="button" onClick={startRest}>휴식 시작</button>
        <button className="alert-text-button" type="button" onClick={snoozeRestAlert}>5분 후 다시 알림</button>
      </div>
    </section>
  );
}
