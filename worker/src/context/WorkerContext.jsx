import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DEFAULT_ADMIN_SETTINGS,
  demoUsers,
  employeeDirectory,
  initialRestRecords,
  initialWorkRecords,
} from '../data/demoData';

import {
  formatDuration,
  formatMinutesForAdmin,
  formatTime,
  getEstimatedCoreTempLevel,
  normalizeEmployeeCode,
} from '../utils/format';

const WorkerContext = createContext(null);

const MAIN_SCREENS = ['home', 'work-progress', 'rest-progress', 'record', 'mypage'];

function readSavedAdminSettings() {
  try {
    const raw = localStorage.getItem('shimonAdminSettings');
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...parsed,
      channels: {
        ...DEFAULT_ADMIN_SETTINGS.channels,
        ...(parsed.channels || {}),
      },
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function WorkerProvider({ children }) {
  const [screen, setScreen] = useState('welcome');
  const [lastMainScreen, setLastMainScreen] = useState('home');
  const [currentUser, setCurrentUser] = useState(demoUsers.김철수);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);

  const [estimatedCoreTemp, setEstimatedCoreTemp] = useState(37.6);
  const [adminSettings, setAdminSettings] = useState(readSavedAdminSettings);

  const [workSeconds, setWorkSeconds] = useState(0);
  const [workState, setWorkState] = useState('idle');
  const [workSessionStartedAt, setWorkSessionStartedAt] = useState(null);
  const workLimitAlertShownRef = useRef(false);

  const workTargetSeconds = Math.max(60, Number(adminSettings.maxWorkMinutes || 120) * 60);
  const restTargetSeconds = Math.max(60, Number(adminSettings.restMinutes || 20) * 60);

  const [restSeconds, setRestSeconds] = useState(restTargetSeconds);
  const [restRunning, setRestRunning] = useState(false);
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [resumeWorkAfterRest, setResumeWorkAfterRest] = useState(false);

  const [workRecords, setWorkRecords] = useState(initialWorkRecords);
  const [restRecords, setRestRecords] = useState(initialRestRecords);
  const [recordTab, setRecordTab] = useState('work');

  const showToast = useCallback((message) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2200);
  }, []);

  const navigate = useCallback((nextScreen) => {
    setScreen(nextScreen);
    if (MAIN_SCREENS.includes(nextScreen)) setLastMainScreen(nextScreen);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'shimonAdminSettings') {
        const next = readSavedAdminSettings();
        setAdminSettings(next);
        setRestSeconds((current) => (restRunning ? current : Math.max(60, Number(next.restMinutes || 20) * 60)));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [restRunning]);

  useEffect(() => {
    if (workState !== 'running') return undefined;
    const id = window.setInterval(() => setWorkSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [workState]);

  useEffect(() => {
    if (
      workState === 'running' &&
      workSeconds >= workTargetSeconds &&
      !workLimitAlertShownRef.current
    ) {
      workLimitAlertShownRef.current = true;
      showToast(`연속 작업 ${formatMinutesForAdmin(adminSettings.maxWorkMinutes)}이 되었습니다. 휴식을 권장합니다.`);
    }
  }, [workSeconds, workState, workTargetSeconds, adminSettings.maxWorkMinutes, showToast]);

  useEffect(() => {
    if (!restRunning) return undefined;
    const id = window.setInterval(() => {
      setRestSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(id);
          setRestRunning(false);
          showToast('권장 휴식 시간이 완료되었습니다.');
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRunning, showToast]);

  useEffect(() => {
    if (screen === 'rest-progress') {
      requestAnimationFrame(() => {
        const el = document.getElementById('screen-rest-progress');
        if (el) el.scrollTop = 0;
      });
    }
  }, [screen]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const startWork = useCallback(() => {
    if (workState === 'idle') {
      setWorkSeconds(0);
      setWorkSessionStartedAt(new Date());
      workLimitAlertShownRef.current = false;
    }
    setWorkState('running');
    navigate('work-progress');
    showToast(workState === 'idle' ? '작업 기록을 시작했습니다.' : '작업을 재개했습니다.');
  }, [navigate, showToast, workState]);

  const resetWorkSession = useCallback(() => {
    setWorkSeconds(0);
    setWorkState('idle');
    setWorkSessionStartedAt(null);
    workLimitAlertShownRef.current = false;
    setResumeWorkAfterRest(false);
  }, []);

  const endWork = useCallback(() => {
    if (workState === 'idle' || !workSessionStartedAt) {
      navigate('home');
      return;
    }

    const now = new Date();
    const durationMinutes = Math.max(1, Math.round(workSeconds / 60));
    setWorkRecords((records) => [
      {
        time: `${formatTime(workSessionStartedAt)} - ${formatTime(now)}`,
        duration: `${durationMinutes}분`,
        temp: 33,
        coreTemp: estimatedCoreTemp,
      },
      ...records,
    ]);
    resetWorkSession();
    navigate('home');
    showToast('작업 기록이 저장되었습니다.');
  }, [
    workState,
    workSessionStartedAt,
    workSeconds,
    estimatedCoreTemp,
    resetWorkSession,
    navigate,
    showToast,
  ]);

  const startRest = useCallback(() => {
    const shouldResume = workState === 'running';
    if (shouldResume) setWorkState('paused');
    setResumeWorkAfterRest(shouldResume);
    setRestSeconds(restTargetSeconds);
    setRestStartedAt(new Date());
    setRestRunning(true);
    navigate('rest-progress');
  }, [workState, restTargetSeconds, navigate]);

  const endRest = useCallback(() => {
    const now = new Date();
    const elapsedSeconds = restTargetSeconds - restSeconds;
    const actualSeconds = elapsedSeconds > 0 ? elapsedSeconds : restTargetSeconds;
    const start = restStartedAt || new Date(now.getTime() - actualSeconds * 1000);
    const durationMinutes = Math.max(1, Math.round(actualSeconds / 60));

    setRestRecords((records) => [
      {
        time: `${formatTime(start)} - ${formatTime(now)}`,
        duration: `${durationMinutes}분`,
        temp: 34,
        coreTemp: estimatedCoreTemp,
      },
      ...records,
    ]);

    const shouldResume = resumeWorkAfterRest && workState === 'paused';

    setRestRunning(false);
    setRestSeconds(restTargetSeconds);
    setRestStartedAt(null);
    setResumeWorkAfterRest(false);

    if (shouldResume) {
      setWorkState('running');
      navigate('work-progress');
      showToast('휴식이 저장되고 작업이 재개되었습니다.');
    } else {
      navigate('home');
      showToast('휴식 기록이 저장되었습니다.');
    }
  }, [
    restTargetSeconds,
    restSeconds,
    restStartedAt,
    estimatedCoreTemp,
    resumeWorkAfterRest,
    workState,
    navigate,
    showToast,
  ]);

  const snoozeRestAlert = useCallback(() => {
    navigate('home');
    showToast('5분 후 다시 휴식 알림을 표시합니다.');
    window.setTimeout(() => {
      if (notificationEnabled) showToast('휴식 권장 알림이 도착했습니다.');
    }, 5000);
  }, [navigate, showToast, notificationEnabled]);

  const toggleNotifications = useCallback(() => {
    setNotificationEnabled((value) => {
      const next = !value;
      showToast(next ? '알림을 켰습니다.' : '알림을 껐습니다.');
      return next;
    });
  }, [showToast]);

  const login = useCallback(({ name, password }) => {
    let savedUser = null;
    try {
      const raw = localStorage.getItem('shimonUser');
      savedUser = raw ? JSON.parse(raw) : null;
    } catch {
      savedUser = null;
    }

    const user = savedUser?.name === name ? savedUser : demoUsers[name];
    if (!user || user.password !== password) {
      showToast('이름 또는 비밀번호를 확인해주세요.');
      return false;
    }

    setCurrentUser(user);

    if (user.role === 'admin') {
      try {
        sessionStorage.setItem('shimonCurrentUser', JSON.stringify(user));
      } catch {
        // Session storage is optional in the prototype.
      }
      window.location.href = '../admin/index.html';
      return true;
    }

    navigate('home');
    return true;
  }, [navigate, showToast]);

  const signup = useCallback((user) => {
    localStorage.setItem('shimonUser', JSON.stringify(user));
    showToast('사원 인증 및 회원가입이 완료되었습니다. 로그인해주세요.');
    navigate('login');
  }, [navigate, showToast]);

  const saveProfile = useCallback((updates) => {
    setCurrentUser((user) => {
      const next = { ...user, ...updates };
      localStorage.setItem('shimonUser', JSON.stringify(next));
      return next;
    });
    navigate('mypage');
    showToast('작업 정보가 변경되었습니다.');
  }, [navigate, showToast]);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem('shimonCurrentUser');
    } catch {
      // Ignore.
    }
    setCurrentUser(demoUsers.김철수);
    setWorkState('idle');
    setWorkSeconds(0);
    setWorkSessionStartedAt(null);
    setRestRunning(false);
    setRestSeconds(restTargetSeconds);
    setResumeWorkAfterRest(false);
    navigate('welcome');
    showToast('로그아웃되었습니다.');
  }, [navigate, restTargetSeconds, showToast]);

  const coreTempState = useMemo(
    () => getEstimatedCoreTempLevel(estimatedCoreTemp),
    [estimatedCoreTemp],
  );

  const value = useMemo(() => ({
    screen,
    lastMainScreen,
    navigate,
    currentUser,
    setCurrentUser,
    notificationEnabled,
    toggleNotifications,
    toastMessage,
    showToast,
    estimatedCoreTemp,
    setEstimatedCoreTemp,
    coreTempState,
    adminSettings,
    workTargetSeconds,
    restTargetSeconds,
    workSeconds,
    workState,
    workSessionStartedAt,
    workProgress: Math.min((workSeconds / workTargetSeconds) * 100, 100),
    restSeconds,
    restProgress: Math.max(0, Math.min((restSeconds / restTargetSeconds) * 100, 100)),
    workRecords,
    restRecords,
    recordTab,
    setRecordTab,
    startWork,
    endWork,
    startRest,
    endRest,
    snoozeRestAlert,
    login,
    signup,
    saveProfile,
    logout,
    employeeDirectory,
    normalizeEmployeeCode,
    formatDuration,
  }), [
    screen,
    lastMainScreen,
    navigate,
    currentUser,
    notificationEnabled,
    toggleNotifications,
    toastMessage,
    showToast,
    estimatedCoreTemp,
    coreTempState,
    adminSettings,
    workTargetSeconds,
    restTargetSeconds,
    workSeconds,
    workState,
    workSessionStartedAt,
    restSeconds,
    workRecords,
    restRecords,
    recordTab,
    startWork,
    endWork,
    startRest,
    endRest,
    snoozeRestAlert,
    login,
    signup,
    saveProfile,
    logout,
  ]);

  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}

export function useWorker() {
  const value = useContext(WorkerContext);
  if (!value) throw new Error('useWorker must be used inside WorkerProvider');
  return value;
}
