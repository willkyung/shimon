import { HomeIcon, RecordIcon, UserIcon } from './Icons';
import { useWorker } from '../context/WorkerContext';

export default function BottomNav() {
  const { screen, navigate } = useWorker();
  const homeActive = ['home', 'work-progress', 'rest-progress'].includes(screen);

  return (
    <nav id="bottomNav" className="bottom-nav" aria-label="하단 메뉴">
      <button className={`nav-item ${homeActive ? 'active' : ''}`} type="button" onClick={() => navigate('home')}>
        <span className="nav-icon" aria-hidden="true"><HomeIcon /></span>
        <small>홈</small>
      </button>

      <button className={`nav-item ${screen === 'record' ? 'active' : ''}`} type="button" onClick={() => navigate('record')}>
        <span className="nav-icon" aria-hidden="true"><RecordIcon /></span>
        <small>기록</small>
      </button>

      <button className={`nav-item ${screen === 'mypage' ? 'active' : ''}`} type="button" onClick={() => navigate('mypage')}>
        <span className="nav-icon" aria-hidden="true"><UserIcon /></span>
        <small>마이페이지</small>
      </button>
    </nav>
  );
}
