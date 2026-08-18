import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import WorkersPage from './pages/WorkersPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import { useAdmin } from './context/AdminContext';

export default function App() {
  const { isAuthenticated, authRestoring, page } = useAdmin();

  if (authRestoring) {
    return <section className="auth-shell"><div className="auth-brand-panel" /><div className="auth-form-panel"><div className="auth-form-inner"><p className="auth-kicker">SHIMON</p><h2>로그인 상태를 확인하고 있습니다.</h2></div></div></section>;
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        <Toast />
      </>
    );
  }

  return (
    <>
      <div className="admin-app">
        <Sidebar />

        <main className="admin-main">
          <Topbar />

          <div className="admin-content">
            {page === 'dashboard' && <DashboardPage />}
            {page === 'workers' && <WorkersPage />}
            {page === 'alerts' && <AlertsPage />}
            {page === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      <Toast />
    </>
  );
}
