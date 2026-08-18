import Icon from './Icon';
import { SITE_OPTIONS } from '../data/adminData';
import { useAdmin } from '../context/AdminContext';

export default function Topbar() {
  const { pageMeta, siteFilter, setActiveSite, goToPage } = useAdmin();

  return (
    <header className="admin-topbar">
      <div>
        <p>{pageMeta.eyebrow}</p>
        <h1>{pageMeta.title}</h1>
      </div>

      <div className="topbar-actions">
        <label className="site-selector" aria-label="현장 선택">
          <i />
          <select value={siteFilter} onChange={(event) => setActiveSite(event.target.value)}>
            {SITE_OPTIONS.map((site) => (
              <option key={site.value} value={site.value}>{site.label}</option>
            ))}
          </select>
          <strong>LIVE</strong>
        </label>

        <button className="topbar-icon-button" type="button" onClick={() => goToPage('alerts')} aria-label="위험 알림">
          <Icon name="bell" />
          <span />
        </button>
      </div>
    </header>
  );
}
