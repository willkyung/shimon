import { BellIcon } from './Icons';
import { useWorker } from '../context/WorkerContext';

export default function Header() {
  const { navigate } = useWorker();

  return (
    <header id="workerHeader" className="worker-header">
      <button className="brand-button" type="button" onClick={() => navigate('home')} aria-label="홈으로 이동">
        <img src="/shimon-logo.png" alt="SHIMON 로고" />
        <span>SHIMON</span>
      </button>

      <button className="icon-button notification-button" type="button" onClick={() => navigate('notifications')} aria-label="알림 열기">
        <BellIcon />
        <span className="notification-dot" />
      </button>
    </header>
  );
}
