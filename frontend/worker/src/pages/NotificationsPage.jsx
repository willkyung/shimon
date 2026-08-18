import { useWorker } from '../context/WorkerContext';

export default function NotificationsPage({ active }) {
  const { lastMainScreen, navigate, showToast } = useWorker();

  return (
    <section id="screen-notifications" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap">
        <div className="section-heading compact with-back">
          <button className="back-button inline" type="button" onClick={() => navigate(lastMainScreen)}>←</button>
          <div><p className="eyebrow">NOTIFICATIONS</p><h1>알림</h1></div>
        </div>

        <div className="notification-list">
          <button className="card notification-card" type="button" onClick={() => navigate('rest-alert')}>
            <span className="notification-icon danger-bg" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3 21 20H3L12 3Z" /><path d="M12 9v5" /><path d="M12 17.2v.1" /></svg>
            </span>
            <span><strong>휴식 권장 알림</strong><small>체감온도가 높아졌습니다. 지금 휴식을 권장합니다.</small></span>
            <time>방금</time>
          </button>

          <button className="card notification-card" type="button" onClick={() => showToast('작업 시작 알림을 확인했습니다.')}>
            <span className="notification-icon success-bg" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" /></svg>
            </span>
            <span><strong>작업 시작 알림</strong><small>작업 기록이 시작되었습니다.</small></span>
            <time>10분 전</time>
          </button>
        </div>
      </div>
    </section>
  );
}
