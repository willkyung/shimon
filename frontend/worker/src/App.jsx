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
  const { screen, authRestoring } = useWorker();

  if (authRestoring) {
    return <div className="worker-app"><div className="phone-shell"><main className="worker-main"><section className="screen active splash-screen"><div className="splash-content"><p className="splash-eyebrow">SHIMON</p><h1>로그인 상태를 확인하고 있습니다.</h1></div></section></main></div></div>;
  }

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
