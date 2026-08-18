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
  const { isAuthenticated, page } = useAdmin();

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
