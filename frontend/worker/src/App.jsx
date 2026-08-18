import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import { useWorker } from './context/WorkerContext';

import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import WorkProgressPage from './pages/WorkProgressPage';
import RestAlertPage from './pages/RestAlertPage';
import RestProgressPage from './pages/RestProgressPage';
import RecordPage from './pages/RecordPage';
import MyPage from './pages/MyPage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';

const AUTH_SCREENS = ['welcome', 'login', 'signup'];

export default function App() {
  const { screen } = useWorker();

  const showHeader = !AUTH_SCREENS.includes(screen) && screen !== 'rest-alert';
  const showBottomNav =
    !AUTH_SCREENS.includes(screen) &&
    !['rest-alert', 'notifications', 'settings'].includes(screen);

  return (
    <>
      <div id="workerApp" className="worker-app">
        <div className="phone-shell">
          {showHeader && <Header />}

          <main className="worker-main">
            <WelcomePage active={screen === 'welcome'} />
            <LoginPage active={screen === 'login'} />
            <SignupPage active={screen === 'signup'} />
            <HomePage active={screen === 'home'} />
            <WorkProgressPage active={screen === 'work-progress'} />
            <RestAlertPage active={screen === 'rest-alert'} />
            <RestProgressPage active={screen === 'rest-progress'} />
            <RecordPage active={screen === 'record'} />
            <MyPage active={screen === 'mypage'} />
            <SettingsPage active={screen === 'settings'} />
            <NotificationsPage active={screen === 'notifications'} />
          </main>

          {showBottomNav && <BottomNav />}
        </div>
      </div>

      <Toast />
    </>
  );
}
