import { useWorker } from '../context/WorkerContext';
import { BellIcon } from '../components/Icons';

export default function MyPage({ active }) {
  const { currentUser, notificationEnabled, toggleNotifications, navigate, logout } = useWorker();
  const user = currentUser || {};

  return (
    <section id="screen-mypage" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap">
        <div className="profile-heading">
          <div className="profile-avatar">{(user.name || '사').slice(0, 1)}</div>
          <div>
            <div className="profile-name-line">
              <h1>{user.name || '-'}</h1>
              <span className="gender-badge">{user.gender || '-'}</span>
            </div>
            <p><span>{user.role === 'admin' ? '관리자' : '노동자'}</span> · SHIMON 이용자</p>
          </div>
        </div>

        <article className="card info-list-card">
          <div className="info-row"><span>사원코드</span><strong>{user.employeeCode || '-'}</strong></div>
          <div className="info-row"><span>회사명</span><strong>{user.company || '-'}</strong></div>
          <div className="info-row"><span>작업 유형</span><strong>{user.jobType || '-'}</strong></div>
          <div className="info-row"><span>작업 장소</span><strong>{user.workplace || '-'}</strong></div>
          <div className="info-row"><span>작업 강도</span><strong>{user.workIntensity || '보통'}</strong></div>
          <div className="info-row"><span>작업복</span><strong>{user.uniform || '-'}</strong></div>
          <div className="info-row"><span>연령</span><strong>{user.age ? `${user.age}세` : '-'}</strong></div>
        </article>

        <article className="card settings-card">
          <button type="button" onClick={toggleNotifications}>
            <span className="settings-label">
              <span className="settings-line-icon" aria-hidden="true"><BellIcon /></span>
              알림 설정
            </span>
            <span>{notificationEnabled ? '켜짐 ›' : '꺼짐 ›'}</span>
          </button>

          <button type="button" onClick={() => navigate('settings')}>
            <span className="settings-label">
              <span className="settings-line-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19 13.5 21 15l-2 3.5-2.4-1a8 8 0 0 1-2.4 1.4L14 21.5h-4l-.3-2.6a8 8 0 0 1-2.4-1.4l-2.4 1-2-3.5L4.8 13.5a8 8 0 0 1 0-3L3 9l2-3.5 2.4 1a8 8 0 0 1 2.4-1.4L10 2.5h4l.3 2.6a8 8 0 0 1 2.4 1.4l2.4-1 2 3.5-1.9 1.5a8 8 0 0 1 0 3Z" />
                </svg>
              </span>
              작업 정보 수정
            </span>
            <span>›</span>
          </button>
        </article>

        <button className="btn btn-outline" type="button" onClick={logout}>로그아웃</button>
      </div>
    </section>
  );
}
