import Icon from './Icon';
import { useAdmin } from '../context/AdminContext';

const items = [
  ['dashboard', 'grid', '대시보드'],
  ['workers', 'users', '노동자 현황'],
  ['alerts', 'bell', '위험 알림'],
  ['settings', 'settings', '설정'],
];

export default function Sidebar() {
  const { currentAdmin, page, goToPage, logout, alerts } = useAdmin();
  const admin = currentAdmin || {};

  return (
    <aside className="admin-sidebar">
      <div>
        <button className="admin-brand" type="button" onClick={() => goToPage('dashboard')}>
          <img src="/shimon-logo.png" alt="SHIMON 로고" />
          <span className="admin-brand-copy">
            <strong>SHIMON</strong>
            <small>ADMIN CONSOLE</small>
          </span>
        </button>

        <nav className="admin-nav" aria-label="관리자 메뉴">
          {items.map(([key, icon, label]) => (
            <button
              key={key}
              className={`admin-nav-item ${page === key ? 'active' : ''}`}
              type="button"
              onClick={() => goToPage(key)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {key === 'alerts' ? <span className="nav-count">{alerts.length}</span> : null}
            </button>
          ))}
        </nav>
      </div>

      <div className="admin-sidebar-bottom">
        <div className="admin-profile">
          <span className="admin-avatar">{(admin.name || '관').slice(0, 1)}</span>
          <div>
            <strong>{admin.name || '관리자'}</strong>
            <span>{admin.company || '-'}</span>
          </div>
        </div>

        <button className="admin-logout" type="button" onClick={logout}>
          <Icon name="logout" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
