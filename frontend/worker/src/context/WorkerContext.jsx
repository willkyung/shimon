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
  initialRestRecords,
  initialWorkRecords,
} from '../data/demoData';

import { authApi, authErrorMessage } from '../api/authApi';

import {
  formatDuration,
  formatMinutesForAdmin,
  formatTime,
  getEstimatedCoreTempLevel,
} from '../utils/format';

const WorkerContext = createContext(null);

const MAIN_SCREENS = ['home', 'work-progress', 'rest-progress', 'record', 'mypage'];
const AUTH_TOKEN_KEY = 'shimonAccessToken';
const LEGACY_TOKEN_KEYS = ['shimonWorkerAccessToken', 'shimonAdminAccessToken'];

function readWorkerToken() {
  const keys = [AUTH_TOKEN_KEY, ...LEGACY_TOKEN_KEYS];
  for (const key of keys) {
    const token = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (token) return token;
  }
  return null;
}

function clearWorkerToken() {
  [AUTH_TOKEN_KEY, ...LEGACY_TOKEN_KEYS].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function toWorkerViewModel(user) {
  const profile = user.workerProfile;
  return {
    id: user.id,
    name: user.name,
    role: 'worker',
    employeeCode: user.employeeCode,
    company: user.companyName || user.companyCode,
    email: user.email,
    phone: user.phone || '',
    age: profile?.age ?? null,
    workplace: profile?.assignedSite?.name || '',
    assignedSiteId: profile?.assignedSite?.id || null,
    hasCoolingDevice: profile?.hasCoolingDevice ?? false,
    jobType: profile?.workType || '',
    workIntensity: profile?.workIntensity || '',
    uniform: profile ? (profile.hasWorkwear ? 'O' : 'X') : '',
    gender: profile?.gender || '',
  };
}

function toAdminViewModel(user) {
  return {
    id: user.id,
    name: user.name,
    role: 'admin',
    company: user.companyName || user.companyCode,
    email: user.email,
    phone: user.phone || '',
  };
}

function toAuthenticatedViewModel(user) {
  return user.role === 'ADMIN' ? toAdminViewModel(user) : toWorkerViewModel(user);
}

function screenForRole(role) {
  return role === 'ADMIN' ? 'admin-dashboard' : 'home';
}

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
  const [currentUser, setCurrentUser] = useState(null);
  const [authRestoring, setAuthRestoring] = useState(Boolean(readWorkerToken()));
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

  useEffect(() => {
    const token = readWorkerToken();
    if (!token) {
      setAuthRestoring(false);
      return undefined;
    }

    let active = true;
    authApi.me(token)
      .then((user) => {
        if (!active) return;
        if (!['WORKER', 'ADMIN'].includes(user.role)) throw new Error('Unsupported role');
        setCurrentUser(toAuthenticatedViewModel(user));
        setScreen(screenForRole(user.role));
      })
      .catch(() => {
        if (!active) return;
        clearWorkerToken();
        setCurrentUser(null);
      })
      .finally(() => {
        if (active) setAuthRestoring(false);
      });

    return () => {
      active = false;
    };
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

  const login = useCallback(async ({ email, password, remember }) => {
    try {
      const result = await authApi.login({ email, password });
      if (!['WORKER', 'ADMIN'].includes(result.user.role)) {
        showToast('지원하지 않는 계정 유형입니다.');
        return { ok: false, error: { code: 'FORBIDDEN' } };
      }

      clearWorkerToken();
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem(AUTH_TOKEN_KEY, result.accessToken);
      const user = await authApi.me(result.accessToken);
      setCurrentUser(toAuthenticatedViewModel(user));
      navigate(screenForRole(user.role));
      showToast(user.role === 'ADMIN' ? '관리자 대시보드로 이동합니다.' : '로그인되었습니다.');
      return { ok: true };
    } catch (error) {
      clearWorkerToken();
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [navigate, showToast]);

  const signup = useCallback(async (payload) => {
    try {
      const result = await authApi.signup(payload);
      showToast('회원가입이 완료되었습니다. 로그인해주세요.');
      navigate('welcome');
      return { ok: true, data: result };
    } catch (error) {
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [navigate, showToast]);

  const saveProfile = useCallback(async (updates) => {
    const token = readWorkerToken();
    if (!token) {
      showToast('로그인이 필요합니다.');
      navigate('welcome');
      return { ok: false, error: { code: 'INVALID_CREDENTIALS' } };
    }

    try {
      const user = await authApi.updateMe(token, {
        email: updates.email.trim().toLowerCase(),
        phone: updates.phone.trim() || null,
        gender: updates.gender,
        workArea: updates.workplace.trim(),
        workType: updates.jobType,
        hasWorkwear: updates.uniform === 'O',
      });
      setCurrentUser(toWorkerViewModel(user));
      navigate('mypage');
      showToast('정보가 변경되었습니다.');
      return { ok: true };
    } catch (error) {
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [navigate, showToast]);

  const logout = useCallback(() => {
    clearWorkerToken();
    setCurrentUser(null);
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
    authRestoring,
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
    formatDuration,
  }), [
    screen,
    lastMainScreen,
    navigate,
    currentUser,
    authRestoring,
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
