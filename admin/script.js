/* =========================================================
   SHIMON Admin prototype
   - 관리자 전용 회원가입 / 로그인
   - 노동자 상태 색상 구분 + 검색 / 정렬
   - CSV 내보내기
   - 실제 DB/API 연결 전 단계의 localStorage prototype
========================================================= */

const ADMIN_EMPLOYEE_DIRECTORY = {
    'HB-A001': {
        employeeCode: 'HB-A001',
        name: '관리자',
        company: '한빛건설',
        role: 'admin'
    },
    'HB-A002': {
        employeeCode: 'HB-A002',
        name: '박지연',
        company: '한빛건설',
        role: 'admin'
    }
};

const DEMO_ADMIN = {
    employeeCode: 'HB-A001',
    name: '관리자',
    company: '한빛건설',
    email: 'admin@shimon.com',
    phone: '010-0000-0000',
    password: '1234',
    role: 'admin'
};


/*
  기존 관리자 화면에 있던 노동자 명단을 기반으로,
  사용자가 요청한 "엑셀 형식" 필드를 프로토타입 데이터로 확장했습니다.
  백엔드 연결 시 이 배열을 API 응답으로 교체하면 됩니다.
*/
const WORKERS = [
    {
        id: 'W001',
        name: '김민준',
        jobType: '건설 작업',
        phone: '010-2451-1184',
        uniform: '착용',
        apparentTemp: 43,
        coreTemp: 38.5,
        lastStart: '11:06',
        lastStop: '-',
        dailyMinutes: 312,
        status: 'rest-needed',
        risk: 'critical',
        site: '강남 현장 A구역'
    },
    {
        id: 'W002',
        name: '이서준',
        jobType: '건설 작업',
        phone: '010-4438-9021',
        uniform: '착용',
        apparentTemp: 40,
        coreTemp: 36.8,
        lastStart: '10:25',
        lastStop: '14:03',
        dailyMinutes: 290,
        status: 'resting',
        risk: 'caution',
        site: '강남 현장 B구역'
    },
    {
        id: 'W003',
        name: '박도윤',
        jobType: '배관 작업',
        phone: '010-7190-3312',
        uniform: '착용',
        apparentTemp: 37,
        coreTemp: 35.1,
        lastStart: '13:12',
        lastStop: '-',
        dailyMinutes: 245,
        status: 'working',
        risk: 'safe',
        site: '강남 현장 A구역'
    },
    {
        id: 'W004',
        name: '최지훈',
        jobType: '철근 작업',
        phone: '010-8621-4405',
        uniform: '착용',
        apparentTemp: 41,
        coreTemp: 37.4,
        lastStart: '12:48',
        lastStop: '-',
        dailyMinutes: 270,
        status: 'working',
        risk: 'caution',
        site: '강남 현장 C구역'
    },
    {
        id: 'W005',
        name: '정하윤',
        jobType: '토목 작업',
        phone: '010-5510-7419',
        uniform: '미착용',
        apparentTemp: 38,
        coreTemp: 36.2,
        lastStart: '09:35',
        lastStop: '-',
        dailyMinutes: 320,
        status: 'rest-needed',
        risk: 'caution',
        site: '서초 현장 A구역'
    },
    {
        id: 'W006',
        name: '강서연',
        jobType: '장비 관리',
        phone: '010-9932-6140',
        uniform: '착용',
        apparentTemp: 36,
        coreTemp: 35.8,
        lastStart: '13:42',
        lastStop: '-',
        dailyMinutes: 224,
        status: 'working',
        risk: 'safe',
        site: '서초 현장 B구역'
    },
    {
        id: 'W007',
        name: '윤지호',
        jobType: '건설 작업',
        phone: '010-1307-8244',
        uniform: '착용',
        apparentTemp: 44,
        coreTemp: 38.9,
        lastStart: '12:03',
        lastStop: '-',
        dailyMinutes: 255,
        status: 'rest-needed',
        risk: 'critical',
        site: '미포 현장 A구역'
    },
    {
        id: 'W008',
        name: '임채원',
        jobType: '자재 운반',
        phone: '010-3810-1257',
        uniform: '착용',
        apparentTemp: 39,
        coreTemp: 36.0,
        lastStart: '10:10',
        lastStop: '13:55',
        dailyMinutes: 240,
        status: 'resting',
        risk: 'watch',
        site: '미포 현장 B구역'
    }
];

const ALERTS = [
    {
        type: 'danger',
        name: '윤지호',
        title: '매우 위험 · 즉시 휴식 필요',
        detail: '체감온도 44°C · 예측 심부체온 38.9°C · 연속 작업시간 초과',
        time: '14:42'
    },
    {
        type: 'danger',
        name: '김민준',
        title: '매우 위험 · 휴식 미이행',
        detail: '체감온도 43°C · 예측 심부체온 38.5°C · 휴식 권고 후 미이행',
        time: '14:28'
    },
    {
        type: 'caution',
        name: '정하윤',
        title: '휴식 권장 시점 도달',
        detail: '체감온도 38°C · 오늘 누적 작업시간 5시간 20분',
        time: '13:47'
    },
    {
        type: 'caution',
        name: '최지훈',
        title: '주의 구간 진입',
        detail: '체감온도 41°C · 작업 상태 모니터링 필요',
        time: '12:20'
    }
];

let currentAdmin = null;
let verifiedAdmin = null;
let currentStatusFilter = 'all';
let currentSiteFilter = 'all';
let toastTimer = null;


/* =========================================================
   helpers
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return [...document.querySelectorAll(selector)];
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function showToast(message) {
    const toast = $('#toast');

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
        () => toast.classList.remove('show'),
        2200
    );
}

function normalizeEmployeeCode(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
}

function minutesToDisplay(minutes) {
    const hours = Math.floor(minutes / 60);
    const remain = minutes % 60;

    if (!hours) {
        return `${remain}분`;
    }

    if (!remain) {
        return `${hours}시간`;
    }

    return `${hours}시간 ${String(remain).padStart(2, '0')}분`;
}

function statusLabel(status) {
    return {
        'working': '작업중',
        'resting': '휴식중',
        'rest-needed': '휴식필요'
    }[status] || '-';
}

function statusPriority(status) {
    return {
        'rest-needed': 0,
        'working': 1,
        'resting': 2
    }[status] ?? 9;
}

function riskLabel(risk) {
    return {
        'safe': '정상',
        'watch': '관심',
        'caution': '주의',
        'critical': '매우 위험'
    }[risk] || '-';
}

function tempClass(temp) {
    if (temp >= 43) return 'danger';
    if (temp >= 38) return 'caution';
    return 'normal';
}


function getStoredAdminSettings() {
    try {
        const raw = localStorage.getItem('shimonAdminSettings');
        return raw ? JSON.parse(raw) : {};
    }
    catch (error) {
        return {};
    }
}

function getCoreTempThresholds() {
    const settings = getStoredAdminSettings();

    return {
        caution: Number(settings.coreCautionTemp) || 37.5,
        danger: Number(settings.coreDangerTemp) || 38.0
    };
}

function coreTempClass(temp) {
    const thresholds = getCoreTempThresholds();

    if (temp >= thresholds.danger) return 'high';
    if (temp >= thresholds.caution) return 'caution';
    return 'normal';
}

function coreTempLabel(temp) {
    return {
        normal: '정상',
        caution: '주의',
        high: '고위험'
    }[coreTempClass(temp)];
}

function siteMatches(worker) {
    return (
        currentSiteFilter === 'all'
        ||
        String(worker.site || '').startsWith(currentSiteFilter)
    );
}

function getSiteWorkers() {
    return WORKERS.filter(siteMatches);
}

function setActiveSite(siteValue, silent = false) {
    currentSiteFilter = siteValue || 'all';

    const siteSelect = $('#siteSelect');
    if (siteSelect && siteSelect.value !== currentSiteFilter) {
        siteSelect.value = currentSiteFilter;
    }

    renderDashboard();
    renderWorkerManagement();
    renderAlerts();

    if (!silent) {
        const label =
            currentSiteFilter === 'all'
                ? '전체 현장'
                : `${currentSiteFilter} 현장`;

        showToast(`${label} 데이터로 전환했습니다.`);
    }
}


/* =========================================================
   AUTH view
========================================================= */

function showAuthView(viewName) {
    const map = {
        'welcome': 'authWelcome',
        'login': 'authLogin',
        'signup-code': 'authSignupCode',
        'signup-profile': 'authSignupProfile'
    };

    Object.values(map).forEach((id) => {
        document.getElementById(id)?.classList.remove('active');
    });

    document.getElementById(map[viewName])?.classList.add('active');
}


/* =========================================================
   Admin signup
========================================================= */

function fillAdminDemoSignup() {
    setValue('signupEmployeeCode', 'HB-A001');
    setValue('signupVerifyName', '관리자');
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

function verifyAdminEmployee(event) {
    event.preventDefault();

    const employeeCode = normalizeEmployeeCode(
        $('#signupEmployeeCode')?.value
    );

    const name = $('#signupVerifyName')?.value.trim() || '';

    const employee = ADMIN_EMPLOYEE_DIRECTORY[employeeCode];

    if (!employee) {
        showToast('등록되지 않은 관리자 사원코드입니다.');
        return;
    }

    if (employee.role !== 'admin') {
        showToast('관리자 권한이 없는 사원코드입니다.');
        return;
    }

    if (employee.name !== name) {
        showToast('사원코드와 등록된 이름이 일치하지 않습니다.');
        return;
    }

    verifiedAdmin = { ...employee };

    setValue('signupName', employee.name);
    setValue('signupCompany', employee.company);

    setText(
        'verifiedAdminText',
        `${employee.company} 관리자 권한 확인됨`
    );

    setText(
        'verifiedAdminCode',
        employee.employeeCode
    );

    showAuthView('signup-profile');
    showToast('관리자 사원 확인이 완료되었습니다.');
}

function handleAdminSignup(event) {
    event.preventDefault();

    if (!verifiedAdmin) {
        showToast('먼저 관리자 사원 확인을 완료해주세요.');
        showAuthView('signup-code');
        return;
    }

    const password = $('#signupPassword')?.value || '';
    const passwordConfirm = $('#signupPasswordConfirm')?.value || '';

    if (password !== passwordConfirm) {
        showToast('비밀번호 확인이 일치하지 않습니다.');
        return;
    }

    const account = {
        employeeCode: verifiedAdmin.employeeCode,
        role: 'admin',
        name: $('#signupName')?.value.trim() || verifiedAdmin.name,
        company: $('#signupCompany')?.value.trim() || verifiedAdmin.company,
        email: $('#signupEmail')?.value.trim() || '',
        phone: $('#signupPhone')?.value.trim() || '',
        password
    };

    localStorage.setItem(
        'shimonAdminAccount',
        JSON.stringify(account)
    );

    verifiedAdmin = null;

    showAuthView('login');

    setValue(
        'loginIdentifier',
        account.email || account.employeeCode
    );

    showToast('관리자 회원가입이 완료되었습니다.');
}


/* =========================================================
   Admin login
========================================================= */

function fillAdminDemoLogin() {
    setValue('loginIdentifier', 'HB-A001');
    setValue('loginPassword', '1234');
}

function handleAdminLogin(event) {
    event.preventDefault();

    const identifier =
        $('#loginIdentifier')?.value.trim() || '';

    const password =
        $('#loginPassword')?.value || '';

    let savedAccount = null;

    try {
        const raw = localStorage.getItem('shimonAdminAccount');
        savedAccount = raw ? JSON.parse(raw) : null;
    }
    catch (error) {
        savedAccount = null;
    }

    const candidates = [
        savedAccount,
        DEMO_ADMIN
    ].filter(Boolean);

    const account = candidates.find(
        (item) =>
            (
                item.employeeCode ===
                normalizeEmployeeCode(identifier)
                ||
                String(item.email || '').toLowerCase() ===
                identifier.toLowerCase()
                ||
                item.name === identifier
            )
            &&
            item.password === password
    );

    if (!account) {
        showToast('관리자 계정 또는 비밀번호를 확인해주세요.');
        return;
    }

    currentAdmin = { ...account };

    sessionStorage.setItem(
        'shimonAdminSession',
        JSON.stringify(currentAdmin)
    );

    enterAdmin();
}

function enterAdmin() {
    $('#authShell')?.classList.add('hidden');
    $('#adminApp')?.classList.remove('hidden');

    syncAdminProfile();
    renderDashboard();
    renderWorkerManagement();
    renderAlerts();
    showAdminPage('dashboard');

    window.scrollTo(0, 0);
}

function logoutAdmin() {
    sessionStorage.removeItem('shimonAdminSession');
    currentAdmin = null;

    $('#adminApp')?.classList.add('hidden');
    $('#authShell')?.classList.remove('hidden');

    setValue('loginPassword', '');
    showAuthView('welcome');
    window.scrollTo(0, 0);
    showToast('로그아웃되었습니다.');
}

function syncAdminProfile() {
    const admin = currentAdmin || DEMO_ADMIN;

    setText('adminName', admin.name || '관리자');
    setText('adminCompany', admin.company || '-');
    setText('adminAvatar', (admin.name || '관').slice(0, 1));

    setText('settingsAdminName', admin.name || '-');
    setText('settingsCompany', admin.company || '-');
    setText('settingsEmail', admin.email || '-');
    setText('settingsPhone', admin.phone || '-');
}


/* =========================================================
   Page navigation
========================================================= */

function showAdminPage(pageName) {
    const pageMeta = {
        dashboard: {
            title: '대시보드',
            eyebrow: 'FIELD SAFETY OVERVIEW'
        },
        workers: {
            title: '노동자 현황',
            eyebrow: 'WORKER MANAGEMENT'
        },
        alerts: {
            title: '위험 알림',
            eyebrow: 'SAFETY ALERTS'
        },
        settings: {
            title: '설정',
            eyebrow: 'ADMIN SETTINGS'
        }
    };

    $$('.admin-page').forEach((page) => {
        page.classList.toggle(
            'active',
            page.dataset.page === pageName
        );
    });

    $$('[data-page-button]').forEach((button) => {
        button.classList.toggle(
            'active',
            button.dataset.pageButton === pageName
        );
    });

    setText(
        'adminPageTitle',
        pageMeta[pageName]?.title || '대시보드'
    );

    setText(
        'adminPageEyebrow',
        pageMeta[pageName]?.eyebrow || 'SHIMON ADMIN'
    );

    if (pageName === 'workers') {
        renderWorkerManagement();
    }

    if (pageName === 'alerts') {
        renderAlerts();
    }
}


/* =========================================================
   Worker sorting / filtering
========================================================= */

function getSortedWorkers(
    workers,
    sortValue
) {
    const result = [...workers];

    if (sortValue === 'temp-desc') {
        result.sort(
            (a, b) =>
                b.apparentTemp -
                a.apparentTemp
        );
    }
    else if (sortValue === 'core-desc') {
        result.sort(
            (a, b) =>
                b.coreTemp -
                a.coreTemp
        );
    }
    else if (sortValue === 'work-desc') {
        result.sort(
            (a, b) =>
                b.dailyMinutes -
                a.dailyMinutes
        );
    }
    else if (sortValue === 'name') {
        result.sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name,
                    'ko'
                )
        );
    }
    else {
        result.sort(
            (a, b) => {
                const statusDiff =
                    statusPriority(a.status) -
                    statusPriority(b.status);

                if (statusDiff !== 0) {
                    return statusDiff;
                }

                return (
                    b.apparentTemp -
                    a.apparentTemp
                );
            }
        );
    }

    return result;
}

function workerRowMarkup(
    worker,
    showAction = false
) {
    return `
        <tr class="risk-row risk-${worker.risk}" data-risk="${worker.risk}">
            <td>
                <div class="worker-person">
                    <span class="worker-person-avatar">
                        ${worker.name.slice(0, 1)}
                    </span>
                    <div class="worker-person-copy">
                        <strong>${worker.name}</strong>
                        <small>${worker.site}</small>
                    </div>
                </div>
            </td>
            <td>${worker.jobType}</td>
            <td>${worker.phone}</td>
            <td>
                <span class="ppe-value ${worker.uniform === '미착용' ? 'missing' : ''}">
                    ${worker.uniform}
                </span>
            </td>
            <td>
                <span class="temp-value ${tempClass(worker.apparentTemp)}">
                    ${worker.apparentTemp}°C
                </span>
            </td>
            <td>
                <div class="core-temp-cell ${coreTempClass(worker.coreTemp)}">
                    <strong>${worker.coreTemp.toFixed(1)}°C</strong>
                    <span>${coreTempLabel(worker.coreTemp)}</span>
                    <small>AI 추정</small>
                </div>
            </td>
            <td>${worker.lastStart}</td>
            <td>${worker.lastStop}</td>
            <td>${minutesToDisplay(worker.dailyMinutes)}</td>
            <td>
                <span class="worker-status-chip ${worker.status}">
                    ${statusLabel(worker.status)}
                </span>
            </td>
            ${
                showAction
                    ? `
                    <td>
                        <button
                            class="row-action ${
                                worker.status ===
                                'rest-needed'
                                    ? 'danger'
                                    : ''
                            }"
                            type="button"
                            onclick="sendWorkerRestAlert('${worker.name}')"
                        >
                            ${
                                worker.status ===
                                'rest-needed'
                                    ? '즉시 휴식'
                                    : '알림'
                            }
                        </button>
                    </td>
                    `
                    : ''
            }
        </tr>
    `;
}

function renderDashboardTable() {
    const query =
        ($('#dashboardSearch')?.value || '')
            .trim()
            .toLowerCase();

    const sort =
        $('#dashboardSort')?.value ||
        'priority';

    const filtered =
        WORKERS.filter(
            (worker) =>
                !query ||
                worker.name
                    .toLowerCase()
                    .includes(query)
        );

    const sorted =
        getSortedWorkers(
            filtered,
            sort
        );

    $('#dashboardWorkerRows').innerHTML =
        sorted
            .map(
                (worker) =>
                    workerRowMarkup(
                        worker,
                        false
                    )
            )
            .join('');
}

function renderWorkerManagement() {
    const query =
        ($('#workerSearch')?.value || '')
            .trim()
            .toLowerCase();

    const sort =
        $('#workerSort')?.value ||
        'priority';

    let filtered =
        WORKERS.filter(
            (worker) => {
                const searchable =
                    [
                        worker.name,
                        worker.jobType,
                        worker.phone,
                        worker.site
                    ]
                        .join(' ')
                        .toLowerCase();

                const queryMatches =
                    !query ||
                    searchable.includes(query);

                const statusMatches =
                    currentStatusFilter ===
                        'all'
                    ||
                    worker.status ===
                        currentStatusFilter;

                const siteMatchesCurrent =
                    siteMatches(worker);

                return (
                    queryMatches &&
                    statusMatches &&
                    siteMatchesCurrent
                );
            }
        );

    filtered =
        getSortedWorkers(
            filtered,
            sort
        );

    $('#managementWorkerRows').innerHTML =
        filtered
            .map(
                (worker) =>
                    workerRowMarkup(
                        worker,
                        true
                    )
            )
            .join('');

    $('#workerEmptyState')?.classList.toggle(
        'hidden',
        filtered.length > 0
    );
}

function setWorkerStatusFilter(
    status,
    button
) {
    currentStatusFilter = status;

    $$('[data-status-filter]').forEach(
        (item) =>
            item.classList.toggle(
                'active',
                item === button
            )
    );

    renderWorkerManagement();
}

function quickFilterFromDashboard(
    status
) {
    currentStatusFilter = status;
    showAdminPage('workers');

    $$('[data-status-filter]').forEach(
        (item) =>
            item.classList.toggle(
                'active',
                item.dataset.statusFilter ===
                status
            )
    );

    renderWorkerManagement();
}


/* =========================================================
   Dashboard summary / priority
========================================================= */

function renderDashboard() {
    const visibleWorkers =
        getSiteWorkers();

    const counts =
        visibleWorkers.reduce(
            (acc, worker) => {
                acc[worker.status] =
                    (acc[worker.status] || 0) +
                    1;

                return acc;
            },
            {}
        );

    setText(
        'countWorking',
        counts.working || 0
    );

    setText(
        'countResting',
        counts.resting || 0
    );

    setText(
        'countRestNeeded',
        counts['rest-needed'] || 0
    );

    renderDashboardInsights(visibleWorkers);
    renderPriorityList();
}

function renderDashboardInsights(workers = getSiteWorkers()) {
    const coreDangerCount =
        workers.filter(
            (worker) =>
                coreTempClass(worker.coreTemp) === 'high'
        ).length;

    const coreAverage =
        workers.length
            ? workers.reduce(
                (sum, worker) =>
                    sum + Number(worker.coreTemp || 0),
                0
            ) / workers.length
            : 0;

    const criticalCount =
        workers.filter(
            (worker) =>
                worker.risk === 'critical'
        ).length;

    const ppeMissingCount =
        workers.filter(
            (worker) =>
                worker.uniform === '미착용'
        ).length;

    setText(
        'metricCoreDanger',
        `${coreDangerCount}명`
    );

    setText(
        'metricCoreAverage',
        coreAverage
            ? `${coreAverage.toFixed(1)}°C`
            : '-'
    );

    setText(
        'metricCriticalWorkers',
        `${criticalCount}명`
    );

    setText(
        'metricPpeMissing',
        `${ppeMissingCount}명`
    );
}

function renderPriorityList() {
    const priorityWorkers =
        [...getSiteWorkers()]
            .sort(
                (a, b) => {
                    const riskRank = {
                        critical: 0,
                        caution: 1,
                        watch: 2,
                        safe: 3
                    };

                    const riskDiff =
                        riskRank[a.risk] -
                        riskRank[b.risk];

                    if (riskDiff !== 0) {
                        return riskDiff;
                    }

                    return (
                        b.apparentTemp -
                        a.apparentTemp
                    );
                }
            )
            .slice(0, 4);

    $('#priorityList').innerHTML =
        priorityWorkers
            .map(
                (worker, index) => `
                    <div class="priority-item ${
                        worker.risk ===
                        'critical'
                            ? 'high'
                            : worker.risk ===
                                'caution'
                                ? 'medium'
                                : ''
                    }">
                        <span class="priority-rank">
                            ${String(index + 1).padStart(2, '0')}
                        </span>

                        <div class="priority-copy">
                            <strong>${worker.name}</strong>
                            <span>
                                ${worker.site} · ${statusLabel(worker.status)}
                            </span>
                        </div>

                        <div class="priority-value">
                            <strong>${worker.apparentTemp}°C</strong>
                            <small class="priority-core ${coreTempClass(worker.coreTemp)}">
                                AI ${worker.coreTemp.toFixed(1)}°C
                            </small>
                            <span class="${
                                worker.risk ===
                                'critical'
                                    ? 'danger'
                                    : 'caution'
                            }">
                                ${riskLabel(worker.risk)}
                            </span>
                        </div>
                    </div>
                `
            )
            .join('');
}


/* =========================================================
   Alerts
========================================================= */

function renderAlerts() {
    const visibleAlerts =
        ALERTS.filter(
            (alert) => {
                const worker =
                    WORKERS.find(
                        (item) =>
                            item.name === alert.name
                    );

                return (
                    !worker ||
                    siteMatches(worker)
                );
            }
        );

    $('#alertTimeline').innerHTML =
        visibleAlerts.length
            ? visibleAlerts
                .map(
                    (alert) => {
                        const worker =
                            WORKERS.find(
                                (item) =>
                                    item.name === alert.name
                            );

                        const reason =
                            String(alert.detail || '')
                                .split('·')
                                .map((item) => item.trim())
                                .filter(
                                    (item) =>
                                        !item.includes('체감온도')
                                        &&
                                        !item.includes('심부체온')
                                )
                                .join(' · ');

                        return `
                            <article class="alert-item ${alert.type}">
                                <div class="alert-icon">
                                    <svg>
                                        <use href="${
                                            alert.type ===
                                            'danger'
                                                ? '#i-alert'
                                                : '#i-pulse'
                                        }"></use>
                                    </svg>
                                </div>

                                <div class="alert-copy">
                                    <div class="alert-title-line">
                                        <strong>${alert.name} · ${alert.title}</strong>
                                        ${
                                            worker
                                                ? `
                                                <span class="risk-badge ${worker.risk}">
                                                    ${riskLabel(worker.risk)}
                                                </span>
                                                `
                                                : ''
                                        }
                                    </div>

                                    ${
                                        worker
                                            ? `
                                            <div class="alert-metrics">
                                                <span class="alert-metric apparent">
                                                    체감 ${worker.apparentTemp}°C
                                                </span>
                                                <span class="alert-metric core ${coreTempClass(worker.coreTemp)}">
                                                    <b>AI 추정</b>
                                                    심부 ${worker.coreTemp.toFixed(1)}°C
                                                </span>
                                            </div>
                                            `
                                            : ''
                                    }

                                    <p>${reason || alert.detail}</p>
                                </div>

                                <div class="alert-meta">
                                    <time>${alert.time}</time>
                                    <button
                                        type="button"
                                        onclick="sendWorkerRestAlert('${alert.name}')"
                                    >
                                        ${
                                            alert.type ===
                                            'danger'
                                                ? '즉시 휴식 알림'
                                                : '휴식 권고'
                                        }
                                    </button>
                                </div>
                            </article>
                        `;
                    }
                )
                .join('')
            : `
                <div class="alert-empty">
                    선택한 현장에 표시할 위험 알림이 없습니다.
                </div>
            `;
}

function sendWorkerRestAlert(
    workerName
) {
    showToast(
        `${workerName} 노동자에게 휴식 알림을 발송했습니다.`
    );
}


/* =========================================================
   CSV export
========================================================= */

function exportWorkerCSV() {
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
        '현재 상태'
    ];

    const rows =
        getSiteWorkers().map(
            (worker) => [
                worker.name,
                worker.jobType,
                worker.phone,
                worker.uniform,
                `${worker.apparentTemp}°C`,
                `${worker.coreTemp.toFixed(1)}°C (${coreTempLabel(worker.coreTemp)}, AI 추정)`,
                worker.lastStart,
                worker.lastStop,
                minutesToDisplay(
                    worker.dailyMinutes
                ),
                statusLabel(
                    worker.status
                )
            ]
        );

    const csv =
        '\uFEFF' +
        [header, ...rows]
            .map(
                (row) =>
                    row
                        .map(
                            (cell) =>
                                `"${String(cell).replace(/"/g, '""')}"`
                        )
                        .join(',')
            )
            .join('\n');

    const blob =
        new Blob(
            [csv],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement('a');

    link.href = url;
    link.download =
        'SHIMON_worker_status.csv';

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast(
        '노동자 현황 CSV를 생성했습니다.'
    );
}


/* =========================================================
   Settings
========================================================= */

function toggleSettingsChannel(button) {
    if (!button) return;

    const nextState =
        !button.classList.contains('on');

    button.classList.toggle(
        'on',
        nextState
    );

    button.setAttribute(
        'aria-pressed',
        String(nextState)
    );
}

function collectSettingsChannels() {
    const channels = {};

    $$('.settings-toggle[data-channel]')
        .forEach(
            (button) => {
                channels[button.dataset.channel] =
                    button.classList.contains('on');
            }
        );

    return channels;
}

function saveAdminSettings() {
    const settings = {
        dangerTemp:
            Number(
                $('#dangerTemp')?.value
            ) || 43,
        cautionTemp:
            Number(
                $('#cautionTemp')?.value
            ) || 38,
        maxWorkMinutes:
            Number(
                $('#maxWorkMinutes')?.value
            ) || 120,
        restMinutes:
            Number(
                $('#restMinutes')?.value
            ) || 20,
        coreCautionTemp:
            Number(
                $('#coreCautionTemp')?.value
            ) || 37.5,
        coreDangerTemp:
            Number(
                $('#coreDangerTemp')?.value
            ) || 38.0,
        defaultSite:
            $('#defaultSite')?.value ||
            'all',
        channels:
            collectSettingsChannels()
    };

    if (
        settings.coreDangerTemp <=
        settings.coreCautionTemp
    ) {
        showToast(
            '고위험 심부체온 기준은 주의 기준보다 높게 설정해주세요.'
        );
        return;
    }

    localStorage.setItem(
        'shimonAdminSettings',
        JSON.stringify(settings)
    );

    renderWorkerManagement();
    renderDashboard();
    renderAlerts();

    showToast(
        '관리자 설정을 저장했습니다.'
    );
}

function loadAdminSettings() {
    const defaults = {
        dangerTemp: 43,
        cautionTemp: 38,
        maxWorkMinutes: 120,
        restMinutes: 20,
        coreCautionTemp: 37.5,
        coreDangerTemp: 38.0,
        defaultSite: 'all',
        channels: {
            push: true,
            sms: true,
            email: false,
            emergency: true
        }
    };

    try {
        const raw =
            localStorage.getItem(
                'shimonAdminSettings'
            );

        const saved =
            raw
                ? JSON.parse(raw)
                : {};

        const settings = {
            ...defaults,
            ...saved,
            channels: {
                ...defaults.channels,
                ...(saved.channels || {})
            }
        };

        setValue(
            'dangerTemp',
            settings.dangerTemp
        );

        setValue(
            'cautionTemp',
            settings.cautionTemp
        );

        setValue(
            'maxWorkMinutes',
            settings.maxWorkMinutes
        );

        setValue(
            'restMinutes',
            settings.restMinutes
        );

        setValue(
            'coreCautionTemp',
            settings.coreCautionTemp
        );

        setValue(
            'coreDangerTemp',
            settings.coreDangerTemp
        );

        setValue(
            'defaultSite',
            settings.defaultSite
        );

        $$('.settings-toggle[data-channel]')
            .forEach(
                (button) => {
                    const isOn =
                        Boolean(
                            settings.channels[
                                button.dataset.channel
                            ]
                        );

                    button.classList.toggle(
                        'on',
                        isOn
                    );

                    button.setAttribute(
                        'aria-pressed',
                        String(isOn)
                    );
                }
            );

        setActiveSite(
            settings.defaultSite,
            true
        );
    }
    catch (error) {
        setActiveSite(
            'all',
            true
        );
    }
}


/* =========================================================
   Initial load
========================================================= */

window.addEventListener(
    'DOMContentLoaded',
    () => {

        loadAdminSettings();

        try {
            const savedSession =
                sessionStorage.getItem(
                    'shimonAdminSession'
                );

            currentAdmin =
                savedSession
                    ? JSON.parse(
                        savedSession
                    )
                    : null;
        }
        catch (error) {
            currentAdmin = null;
        }

        if (
            currentAdmin &&
            currentAdmin.role ===
            'admin'
        ) {
            enterAdmin();
        }
        else {
            $('#authShell')?.classList.remove(
                'hidden'
            );

            $('#adminApp')?.classList.add(
                'hidden'
            );

            showAuthView(
                'welcome'
            );
        }
    }
);


/* =========================================================
   Single screen auth
   로그인 + 회원가입 동시 노출 버전
========================================================= */

function fillAdminDemoSignupSingle() {

    setValue(
        'signupEmployeeCode',
        'HB-A001'
    );

    setValue(
        'signupName',
        '관리자'
    );

    verifyAdminEmployeeSingle();

}


function verifyAdminEmployeeSingle() {

    const employeeCode =
        normalizeEmployeeCode(
            $('#signupEmployeeCode')?.value
        );

    const name =
        $('#signupName')?.value.trim() ||
        '';

    const employee =
        ADMIN_EMPLOYEE_DIRECTORY[
            employeeCode
        ];


    if (!employee) {

        verifiedAdmin =
            null;

        $('#signupVerifiedBadge')
            ?.classList.add(
                'hidden'
            );

        showToast(
            '등록되지 않은 관리자 사원코드입니다.'
        );

        return false;

    }


    if (
        employee.role !==
        'admin'
    ) {

        verifiedAdmin =
            null;

        showToast(
            '관리자 권한이 없는 사원코드입니다.'
        );

        return false;

    }


    if (
        employee.name !==
        name
    ) {

        verifiedAdmin =
            null;

        $('#signupVerifiedBadge')
            ?.classList.add(
                'hidden'
            );

        showToast(
            '사원코드와 등록된 이름이 일치하지 않습니다.'
        );

        return false;

    }


    verifiedAdmin = {
        ...employee
    };


    setValue(
        'signupCompany',
        employee.company
    );


    setText(
        'signupVerifiedText',
        `${employee.company} · ${employee.employeeCode} 관리자 권한 확인됨`
    );


    $('#signupVerifiedBadge')
        ?.classList.remove(
            'hidden'
        );


    showToast(
        '관리자 사원 확인이 완료되었습니다.'
    );


    return true;

}


function handleAdminSignupSingle(
    event
) {

    event.preventDefault();


    if (
        !verifiedAdmin
        ||
        verifiedAdmin.employeeCode !==
        normalizeEmployeeCode(
            $('#signupEmployeeCode')?.value
        )
        ||
        verifiedAdmin.name !==
        ($('#signupName')?.value.trim() || '')
    ) {

        const verified =
            verifyAdminEmployeeSingle();

        if (!verified) {
            return;
        }

    }


    const password =
        $('#signupPassword')?.value ||
        '';

    const passwordConfirm =
        $('#signupPasswordConfirm')?.value ||
        '';


    if (
        password !==
        passwordConfirm
    ) {

        showToast(
            '비밀번호 확인이 일치하지 않습니다.'
        );

        return;

    }


    const account = {

        employeeCode:
            verifiedAdmin.employeeCode,

        role:
            'admin',

        name:
            $('#signupName')?.value.trim()
            ||
            verifiedAdmin.name,

        company:
            $('#signupCompany')?.value.trim()
            ||
            verifiedAdmin.company,

        email:
            $('#signupEmail')?.value.trim()
            ||
            '',

        phone:
            $('#signupPhone')?.value.trim()
            ||
            '',

        password

    };


    localStorage.setItem(

        'shimonAdminAccount',

        JSON.stringify(
            account
        )

    );


    setValue(
        'loginIdentifier',
        account.email ||
        account.employeeCode
    );


    setValue(
        'loginPassword',
        ''
    );


    $('#signupVerifiedBadge')
        ?.classList.add(
            'hidden'
        );


    verifiedAdmin =
        null;


    showToast(
        '회원가입 완료. 왼쪽 로그인에서 접속해주세요.'
    );

}
