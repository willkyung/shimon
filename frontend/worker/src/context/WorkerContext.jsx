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
} from '../data/demoData';

import { authApi, authErrorMessage } from '../api/authApi';
import { workApi } from '../api/workApi';

import {
  formatDuration,
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
  const assignedSite = profile?.assignedSite;
  return {
    id: user.id,
    name: user.name,
    role: 'worker',
    employeeCode: user.employeeCode,
    company: user.companyName || user.companyCode,
    email: user.email,
    phone: user.phone || '',
    age: profile?.age ?? null,
    workplace: assignedSite?.name || '',
    assignedSiteId: assignedSite?.id || null,
    siteAddress: assignedSite?.address || '',
    siteDistrict: assignedSite?.district || '',
    siteLegalDong: assignedSite?.legalDong || '',
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

function elapsedSecondsFrom(startedAt) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
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
  const [continuousWorkStartedAt, setContinuousWorkStartedAt] = useState(null);
  const [activeWorkSessionId, setActiveWorkSessionId] = useState(null);
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const restAlertedSessionRef = useRef(null);
  const [restRequiredMinutes, setRestRequiredMinutes] = useState(
    Number(adminSettings.restMinutes || 20),
  );
  const restTargetSeconds = Math.max(60, restRequiredMinutes * 60);

  const [restSeconds, setRestSeconds] = useState(restTargetSeconds);
  const [restRunning, setRestRunning] = useState(false);
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [activeRestId, setActiveRestId] = useState(null);

  const [workRecords, setWorkRecords] = useState([]);
  const [restRecords, setRestRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');
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
      .then(async (user) => {
        if (!active) return;
        if (!['WORKER', 'ADMIN'].includes(user.role)) throw new Error('Unsupported role');
        setCurrentUser(toAuthenticatedViewModel(user));
        if (user.role === 'ADMIN') {
          setScreen('admin-dashboard');
          return;
        }

        const [session, workHistory, restHistory] = await Promise.all([
          workApi.current(token),
          workApi.history(token),
          workApi.restHistory(token),
        ]);
        setWorkRecords(workHistory);
        setRestRecords(restHistory);
        if (!active || !session) {
          setScreen('home');
          return;
        }
        setActiveWorkSessionId(session.id);
        const continuousStartedAt = session.continuousWorkStartedAt || session.startedAt;
        setContinuousWorkStartedAt(new Date(continuousStartedAt));
        setWorkSeconds(elapsedSecondsFrom(continuousStartedAt));
        setCurrentEvaluation(session.latestEvaluation);
        if (session.activeRest) {
          setWorkState('paused');
          setActiveRestId(session.activeRest.restId);
          setRestStartedAt(new Date(session.activeRest.startedAt));
          setRestRunning(true);
          const target = Math.max(60, session.activeRest.requiredRestMinutes * 60);
          setRestRequiredMinutes(session.activeRest.requiredRestMinutes);
          setRestSeconds(Math.max(0, target - elapsedSecondsFrom(session.activeRest.startedAt)));
          setScreen('rest-progress');
          return;
        }

        setWorkState('running');
        const evaluation = await workApi.evaluate(token, session.id);
        if (!active) return;
        setCurrentEvaluation(evaluation);
        if (evaluation.compliance.isRestRequired) {
          restAlertedSessionRef.current = session.id;
          setScreen('rest-alert');
        } else {
          setScreen('work-progress');
        }
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

  const refreshRecords = useCallback(async ({ silent = false } = {}) => {
    const token = readWorkerToken();
    if (!token) return { ok: false };
    if (!silent) setRecordsLoading(true);
    setRecordsError('');
    try {
      const [workHistory, restHistory] = await Promise.all([
        workApi.history(token),
        workApi.restHistory(token),
      ]);
      setWorkRecords(workHistory);
      setRestRecords(restHistory);
      return { ok: true };
    } catch (error) {
      const message = authErrorMessage(error);
      setRecordsError(message);
      if (!silent) showToast(message);
      return { ok: false, error };
    } finally {
      if (!silent) setRecordsLoading(false);
    }
  }, [showToast]);

  const applyEvaluation = useCallback((evaluation, sessionId, { interrupt = true } = {}) => {
    setCurrentEvaluation(evaluation);
    if (
      interrupt &&
      evaluation?.compliance?.isRestRequired &&
      restAlertedSessionRef.current !== sessionId
    ) {
      restAlertedSessionRef.current = sessionId;
      navigate('rest-alert');
    }
  }, [navigate]);

  useEffect(() => {
    if (screen === 'record' && currentUser?.role === 'worker') {
      refreshRecords();
      const intervalId = window.setInterval(
        () => refreshRecords({ silent: true }),
        60_000,
      );
      return () => window.clearInterval(intervalId);
    }
    return undefined;
  }, [screen, currentUser?.role, refreshRecords]);

  useEffect(() => {
    if (workState !== 'running' || !activeWorkSessionId) return undefined;
    const token = readWorkerToken();
    if (!token) return undefined;

    const pollEvaluation = async () => {
      try {
        const evaluation = await workApi.evaluate(token, activeWorkSessionId);
        applyEvaluation(evaluation, activeWorkSessionId);
      } catch (error) {
        showToast(authErrorMessage(error));
      }
    };
    const intervalId = window.setInterval(pollEvaluation, 60_000);
    return () => window.clearInterval(intervalId);
  }, [workState, activeWorkSessionId, applyEvaluation, showToast]);

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
    if (workState !== 'running' || !continuousWorkStartedAt) return undefined;
    const id = window.setInterval(
      () => setWorkSeconds(elapsedSecondsFrom(continuousWorkStartedAt)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [workState, continuousWorkStartedAt]);

  useEffect(() => {
    if (!restRunning) return undefined;
    const id = window.setInterval(() => {
      const remaining = Math.max(
        0,
        restTargetSeconds - elapsedSecondsFrom(restStartedAt),
      );
      setRestSeconds(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        setRestRunning(false);
        showToast('권장 휴식 시간이 완료되었습니다.');
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRunning, restStartedAt, restTargetSeconds, showToast]);

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

  const startWork = useCallback(async () => {
    if (workState === 'running' && activeWorkSessionId) {
      navigate('work-progress');
      return { ok: true };
    }
    if (workState === 'paused' && activeRestId) {
      navigate('rest-progress');
      showToast('진행 중인 휴식을 먼저 종료해 주세요.');
      return { ok: false };
    }
    const token = readWorkerToken();
    if (!token || !currentUser?.assignedSiteId) {
      showToast('로그인 또는 배정 현장을 확인해주세요.');
      return { ok: false };
    }
    try {
      const session = await workApi.start(token, {
        siteId: currentUser.assignedSiteId,
        workType: currentUser.jobType,
        workIntensity: currentUser.workIntensity,
        clothingLevel: currentUser.uniform === 'O' ? 'WORKWEAR' : 'STANDARD',
        environment: 'OUTDOOR',
      });
      setActiveWorkSessionId(session.id);
      const continuousStartedAt = session.continuousWorkStartedAt || session.startedAt;
      setContinuousWorkStartedAt(new Date(continuousStartedAt));
      setWorkSeconds(elapsedSecondsFrom(continuousStartedAt));
      setWorkState('running');
      setCurrentEvaluation(session.latestEvaluation);
      restAlertedSessionRef.current = null;
      await refreshRecords({ silent: true });
      navigate('work-progress');
      showToast('작업 기록을 시작했습니다.');
      return { ok: true };
    } catch (error) {
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [workState, activeWorkSessionId, activeRestId, currentUser, navigate, refreshRecords, showToast]);

  const resetWorkSession = useCallback(() => {
    setWorkSeconds(0);
    setWorkState('idle');
    setActiveWorkSessionId(null);
    setContinuousWorkStartedAt(null);
    setCurrentEvaluation(null);
    restAlertedSessionRef.current = null;
  }, []);

  const endWork = useCallback(async () => {
    if (workState === 'idle' || !activeWorkSessionId) {
      navigate('home');
      return { ok: true };
    }
    const token = readWorkerToken();
    try {
      await workApi.end(token, activeWorkSessionId);
      await refreshRecords({ silent: true });
      resetWorkSession();
      navigate('home');
      showToast('작업 기록이 저장되었습니다.');
      return { ok: true };
    } catch (error) {
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [
    workState,
    activeWorkSessionId,
    resetWorkSession,
    navigate,
    refreshRecords,
    showToast,
  ]);

  const startRest = useCallback(async () => {
    if (!activeWorkSessionId) {
      showToast('먼저 작업을 시작해주세요.');
      return { ok: false };
    }
    const token = readWorkerToken();
    try {
      const rest = await workApi.startRest(token, activeWorkSessionId);
      setWorkState('paused');
      setActiveRestId(rest.restId);
      setRestRequiredMinutes(rest.requiredRestMinutes);
      setRestSeconds(Math.max(60, rest.requiredRestMinutes * 60));
      setRestStartedAt(new Date(rest.startedAt));
      setRestRunning(true);
      await refreshRecords({ silent: true });
      navigate('rest-progress');
      return { ok: true };
    } catch (error) {
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [activeWorkSessionId, navigate, refreshRecords, showToast]);

  const endRest = useCallback(async () => {
    if (!activeRestId) return { ok: false };
    const token = readWorkerToken();
    try {
      const result = await workApi.endRest(token, activeRestId);
      setRestRunning(false);
      setRestSeconds(restTargetSeconds);
      setRestStartedAt(null);
      setActiveRestId(null);
      setWorkState('running');
      setActiveWorkSessionId(result.workSessionId);
      setContinuousWorkStartedAt(new Date(result.continuousWorkStartedAt));
      setWorkSeconds(0);
      applyEvaluation(result.evaluation, activeWorkSessionId, { interrupt: false });
      restAlertedSessionRef.current = null;
      await refreshRecords({ silent: true });
      navigate('work-progress');
      showToast('휴식이 저장되고 작업이 재개되었습니다.');
      return { ok: true };
    } catch (error) {
      showToast(authErrorMessage(error));
      return { ok: false, error };
    }
  }, [
    activeRestId,
    activeWorkSessionId,
    restTargetSeconds,
    applyEvaluation,
    navigate,
    refreshRecords,
    showToast,
  ]);

  const snoozeRestAlert = useCallback(() => {
    navigate('work-progress');
    showToast('휴식 필요 상태가 유지됩니다.');
  }, [navigate, showToast]);

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
      if (user.role === 'WORKER') {
        const [session, workHistory, restHistory] = await Promise.all([
          workApi.current(result.accessToken),
          workApi.history(result.accessToken),
          workApi.restHistory(result.accessToken),
        ]);
        setWorkRecords(workHistory);
        setRestRecords(restHistory);
        if (session) {
          setActiveWorkSessionId(session.id);
          const continuousStartedAt = session.continuousWorkStartedAt || session.startedAt;
          setContinuousWorkStartedAt(new Date(continuousStartedAt));
          setWorkSeconds(elapsedSecondsFrom(continuousStartedAt));
          setCurrentEvaluation(session.latestEvaluation);
          if (session.activeRest) {
            setWorkState('paused');
            setActiveRestId(session.activeRest.restId);
            setRestRequiredMinutes(session.activeRest.requiredRestMinutes);
            setRestStartedAt(new Date(session.activeRest.startedAt));
            setRestSeconds(Math.max(
              0,
              session.activeRest.requiredRestMinutes * 60
                - elapsedSecondsFrom(session.activeRest.startedAt),
            ));
            setRestRunning(true);
            navigate('rest-progress');
          } else {
            setWorkState('running');
            const evaluation = await workApi.evaluate(result.accessToken, session.id);
            setCurrentEvaluation(evaluation);
            if (evaluation.compliance.isRestRequired) {
              restAlertedSessionRef.current = session.id;
              navigate('rest-alert');
            } else {
              navigate('work-progress');
            }
          }
        } else {
          navigate('home');
        }
      } else {
        navigate('admin-dashboard');
      }
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
    setContinuousWorkStartedAt(null);
    setActiveWorkSessionId(null);
    setCurrentEvaluation(null);
    setRestRunning(false);
    setActiveRestId(null);
    setRestSeconds(restTargetSeconds);
    setWorkRecords([]);
    setRestRecords([]);
    setRecordsError('');
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
    activeWorkSessionId,
    currentEvaluation,
    activeRestId,
    restTargetSeconds,
    workSeconds,
    workState,
    continuousWorkStartedAt,
    workProgress: currentEvaluation?.compliance?.isRestRequired ? 100 : 0,
    restSeconds,
    restProgress: Math.max(0, Math.min((restSeconds / restTargetSeconds) * 100, 100)),
    workRecords,
    restRecords,
    recordsLoading,
    recordsError,
    refreshRecords,
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
    activeWorkSessionId,
    currentEvaluation,
    activeRestId,
    restTargetSeconds,
    workSeconds,
    workState,
    continuousWorkStartedAt,
    restSeconds,
    workRecords,
    restRecords,
    recordsLoading,
    recordsError,
    refreshRecords,
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
