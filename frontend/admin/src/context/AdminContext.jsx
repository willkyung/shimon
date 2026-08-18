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
  ALERTS,
  DEFAULT_SETTINGS,
  WORKERS,
} from '../data/adminData';

import { authApi, authErrorMessage } from '../api/authApi';

import {
  coreTempClass,
  getSortedWorkers,
  riskLabel,
  siteMatches,
} from '../utils/adminUtils';

const AdminContext = createContext(null);
const ADMIN_TOKEN_KEY = 'shimonAdminAccessToken';

const PAGE_META = {
  dashboard: { title: '대시보드', eyebrow: 'FIELD SAFETY OVERVIEW' },
  workers: { title: '노동자 현황', eyebrow: 'WORKER MANAGEMENT' },
  alerts: { title: '위험 알림', eyebrow: 'SAFETY ALERTS' },
  settings: { title: '설정', eyebrow: 'ADMIN SETTINGS' },
};

function readStoredSettings() {
  try {
    const raw = localStorage.getItem('shimonAdminSettings');
    const saved = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      channels: {
        ...DEFAULT_SETTINGS.channels,
        ...(saved.channels || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function toAdminViewModel(user) {
  return {
    id: user.id,
    name: user.name,
    role: 'admin',
    company: user.company,
    employeeCode: user.employeeCode,
    email: user.email,
    phone: user.phone || '-',
  };
}

export function AdminProvider({ children }) {
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [authRestoring, setAuthRestoring] = useState(
    Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY)),
  );
  const [authView, setAuthView] = useState('welcome');
  const [page, setPage] = useState('dashboard');
  const [siteFilter, setSiteFilter] = useState(() => readStoredSettings().defaultSite || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [settings, setSettings] = useState(readStoredSettings);
  const [toastMessage, setToastMessage] = useState('');
  const toastRef = useRef(null);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToastMessage(''), 2200);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      setAuthRestoring(false);
      return undefined;
    }

    let active = true;
    authApi.me(token)
      .then((user) => {
        if (!active) return;
        if (user.role !== 'ADMIN') throw new Error('ADMIN role required');
        setCurrentAdmin(toAdminViewModel(user));
      })
      .catch(() => {
        if (!active) return;
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setCurrentAdmin(null);
      })
      .finally(() => {
        if (active) setAuthRestoring(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    try {
      const result = await authApi.login({ email, password });
      if (result.user.role !== 'ADMIN') {
        showToast('관리자 권한이 없는 계정입니다.');
        return false;
      }
      sessionStorage.setItem(ADMIN_TOKEN_KEY, result.accessToken);
      const user = await authApi.me(result.accessToken);
      setCurrentAdmin(toAdminViewModel(user));
      setPage('dashboard');
      showToast('관리자 계정으로 로그인했습니다.');
      return true;
    } catch (error) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      showToast(authErrorMessage(error));
      return false;
    }
  }, [showToast]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setCurrentAdmin(null);
    setAuthView('welcome');
    setPage('dashboard');
    showToast('로그아웃되었습니다.');
    window.scrollTo(0, 0);
  }, [showToast]);

  const goToPage = useCallback((pageName) => {
    setPage(pageName);
    window.scrollTo(0, 0);
  }, []);

  const setActiveSite = useCallback((siteValue, silent = false) => {
    const next = siteValue || 'all';
    setSiteFilter(next);

    if (!silent) {
      const label = next === 'all' ? '전체 현장' : `${next} 현장`;
      showToast(`${label} 데이터로 전환했습니다.`);
    }
  }, [showToast]);

  const quickFilterFromDashboard = useCallback((status) => {
    setStatusFilter(status);
    setPage('workers');
  }, []);

  const saveSettings = useCallback((nextSettings) => {
    if (Number(nextSettings.coreDangerTemp) <= Number(nextSettings.coreCautionTemp)) {
      showToast('고위험 심부체온 기준은 주의 기준보다 높게 설정해주세요.');
      return false;
    }

    const normalized = {
      ...DEFAULT_SETTINGS,
      ...nextSettings,
      channels: {
        ...DEFAULT_SETTINGS.channels,
        ...(nextSettings.channels || {}),
      },
    };

    localStorage.setItem('shimonAdminSettings', JSON.stringify(normalized));
    setSettings(normalized);
    setSiteFilter(normalized.defaultSite || 'all');
    showToast('관리자 설정을 저장했습니다.');
    return true;
  }, [showToast]);

  const siteWorkers = useMemo(
    () => WORKERS.filter((worker) => siteMatches(worker, siteFilter)),
    [siteFilter],
  );

  const siteAlerts = useMemo(
    () => ALERTS.filter((alert) => {
      const worker = WORKERS.find((item) => item.name === alert.name);
      return !worker || siteMatches(worker, siteFilter);
    }),
    [siteFilter],
  );

  const dashboardMetrics = useMemo(() => {
    const counts = siteWorkers.reduce((acc, worker) => {
      acc[worker.status] = (acc[worker.status] || 0) + 1;
      return acc;
    }, {});

    const coreDangerCount = siteWorkers.filter(
      (worker) => coreTempClass(worker.coreTemp, settings) === 'high',
    ).length;

    const coreAverage = siteWorkers.length
      ? siteWorkers.reduce((sum, worker) => sum + Number(worker.coreTemp || 0), 0) / siteWorkers.length
      : 0;

    const criticalCount = siteWorkers.filter((worker) => worker.risk === 'critical').length;
    const ppeMissingCount = siteWorkers.filter((worker) => worker.uniform === '미착용').length;
    const maxApparent = siteWorkers.length
      ? Math.max(...siteWorkers.map((worker) => Number(worker.apparentTemp || 0)))
      : 0;

    return {
      working: counts.working || 0,
      resting: counts.resting || 0,
      restNeeded: counts['rest-needed'] || 0,
      coreDangerCount,
      coreAverage,
      criticalCount,
      ppeMissingCount,
      maxApparent,
    };
  }, [siteWorkers, settings]);

  const priorityWorkers = useMemo(() => {
    const riskRank = { critical: 0, caution: 1, watch: 2, safe: 3 };
    return [...siteWorkers]
      .sort((a, b) => {
        const riskDiff = riskRank[a.risk] - riskRank[b.risk];
        if (riskDiff !== 0) return riskDiff;
        return b.apparentTemp - a.apparentTemp;
      })
      .slice(0, 4);
  }, [siteWorkers]);

  const sendWorkerRestAlert = useCallback((workerName) => {
    showToast(`${workerName} 노동자에게 휴식 알림을 발송했습니다.`);
  }, [showToast]);

  const exportWorkerCSV = useCallback(() => {
    const header = [
      '노동자명',
      '작업 유형',
      '연락처',
      '작업복 유무',
      '체감온도',
      'AI 추정 심부체온',
      '최근 작업 시작 시간',
      '최근 작업 중단 시간',
      '하루 작업시간',
      '현재 상태',
    ];

    const rows = siteWorkers.map((worker) => [
      worker.name,
      worker.jobType,
      worker.phone,
      worker.uniform,
      `${worker.apparentTemp}°C`,
      `${worker.coreTemp.toFixed(1)}°C`,
      worker.lastStart,
      worker.lastStop,
      worker.dailyMinutes,
      worker.status,
    ]);

    const csv =
      '\uFEFF' +
      [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SHIMON_worker_status.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('노동자 현황 CSV를 생성했습니다.');
  }, [siteWorkers, showToast]);

  const value = useMemo(() => ({
    currentAdmin,
    isAuthenticated: Boolean(currentAdmin),
    authRestoring,
    authView,
    setAuthView,
    login,
    logout,
    page,
    pageMeta: PAGE_META[page] || PAGE_META.dashboard,
    goToPage,
    siteFilter,
    setActiveSite,
    statusFilter,
    setStatusFilter,
    quickFilterFromDashboard,
    settings,
    saveSettings,
    workers: WORKERS,
    siteWorkers,
    alerts: siteAlerts,
    dashboardMetrics,
    priorityWorkers,
    sendWorkerRestAlert,
    exportWorkerCSV,
    getSortedWorkers,
    toastMessage,
    showToast,
  }), [
    currentAdmin,
    authRestoring,
    authView,
    login,
    logout,
    page,
    goToPage,
    siteFilter,
    setActiveSite,
    statusFilter,
    quickFilterFromDashboard,
    settings,
    saveSettings,
    siteWorkers,
    siteAlerts,
    dashboardMetrics,
    priorityWorkers,
    sendWorkerRestAlert,
    exportWorkerCSV,
    toastMessage,
    showToast,
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside AdminProvider');
  return value;
}
