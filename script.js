const demoUsers = {
    '김철수': {
        employeeCode: 'HB-W001',
        name: '김철수',
        password: '1234',
        role: 'worker',
        company: '한빛건설',
        gender: '남성',
        phone: '010-1234-5678',
        email: 'worker@shimon.com',
        age: 42,
        jobType: '토목 작업',
        workplace: '부산 북항 현장',
        workIntensity: '보통',
        uniform: '착용',
        healthCondition: '없음'
    },

    '관리자': {
        employeeCode: 'HB-A001',
        name: '관리자',
        password: '1234',
        role: 'admin',
        company: '한빛건설',
        gender: '남성',
        phone: '010-0000-0000',
        email: 'admin@shimon.com',
        age: null,
        jobType: '-',
        workplace: '통합 관제 센터',
        workIntensity: '-',
        uniform: '-',
        healthCondition: '-'
    }
};


const employeeDirectory = {

    'HB-W001': {
        employeeCode: 'HB-W001',
        name: '김철수',
        company: '한빛건설',
        role: 'worker',
        jobType: '토목 작업',
        workplace: '부산 북항 현장'
    },

    'HB-W002': {
        employeeCode: 'HB-W002',
        name: '김민준',
        company: '한빛건설',
        role: 'worker',
        jobType: '건설 작업',
        workplace: '강남 현장 A구역'
    },

    'HB-W003': {
        employeeCode: 'HB-W003',
        name: '이서준',
        company: '한빛건설',
        role: 'worker',
        jobType: '건설 작업',
        workplace: '강남 현장 B구역'
    },

    'HB-A001': {
        employeeCode: 'HB-A001',
        name: '관리자',
        company: '한빛건설',
        role: 'admin',
        jobType: '-',
        workplace: '통합 관제 센터'
    },

    'DS-W001': {
        employeeCode: 'DS-W001',
        name: '박민수',
        company: '대성건설',
        role: 'worker',
        jobType: '도로 작업',
        workplace: '대전 도로 현장'
    }

};


/* =========================================
   기본 상태
========================================= */

let currentUser =
    demoUsers['김철수'];

let currentScreen =
    'welcome';

let lastMainScreen =
    'home';

let recordTab =
    'work';

let notificationEnabled =
    true;

let toastTimer =
    null;

let verifiedEmployee =
    null;


/* =========================================
   작업 / 휴식 설정
========================================= */

const WORK_TARGET_SECONDS =
    2 * 60 * 60;

const REST_TARGET_SECONDS =
    20 * 60;


let workSeconds =
    0;

let workTimerId =
    null;

let workSessionStartedAt =
    null;

let workState =
    'idle';

let workLimitAlertShown =
    false;

let resumeWorkAfterRest =
    false;


let restSeconds =
    REST_TARGET_SECONDS;

let restTimerId =
    null;

let restStartedAt =
    null;


/* =========================================
   기록 데이터
========================================= */

const workRecords = [

    {
        time: '13:10 - 14:05',
        duration: '55분',
        temp: 33
    },

    {
        time: '10:20 - 11:30',
        duration: '70분',
        temp: 31
    },

    {
        time: '08:00 - 09:00',
        duration: '60분',
        temp: 29
    }

];


const restRecords = [

    {
        time: '14:05 - 14:25',
        duration: '20분',
        temp: 35
    },

    {
        time: '11:30 - 11:50',
        duration: '20분',
        temp: 32
    },

    {
        time: '09:00 - 09:20',
        duration: '20분',
        temp: 31
    }

];


/* =========================================
   노동자 화면
========================================= */

const workerScreens = [

    'welcome',
    'login',
    'signup',
    'home',
    'work-progress',
    'rest-alert',
    'rest-progress',
    'record',
    'mypage',
    'settings',
    'notifications'

];


const mainScreens = [

    'home',
    'work-progress',
    'rest-progress',
    'record',
    'mypage'

];


/* =========================================
   공통 함수
========================================= */

function setText(id, value) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


function formatTime(date) {

    const hours =
        String(
            date.getHours()
        ).padStart(
            2,
            '0'
        );


    const minutes =
        String(
            date.getMinutes()
        ).padStart(
            2,
            '0'
        );


    return `${hours}:${minutes}`;

}


function formatDuration(totalSeconds) {

    const hours =
        String(

            Math.floor(
                totalSeconds /
                3600
            )

        ).padStart(
            2,
            '0'
        );


    const minutes =
        String(

            Math.floor(
                (
                    totalSeconds %
                    3600
                ) /
                60
            )

        ).padStart(
            2,
            '0'
        );


    const seconds =
        String(

            totalSeconds %
            60

        ).padStart(
            2,
            '0'
        );


    return (
        `${hours}:${minutes}:${seconds}`
    );

}


/* =========================================
   토스트
========================================= */

function showToast(message) {

    const toast =
        document.getElementById(
            'toast'
        );


    if (!toast) {

        console.log(
            message
        );

        return;

    }


    toast.textContent =
        message;


    toast.classList.add(
        'show'
    );


    if (toastTimer) {

        clearTimeout(
            toastTimer
        );

    }


    toastTimer =
        setTimeout(

            () => {

                toast.classList.remove(
                    'show'
                );

            },

            2200

        );

}


/* =========================================
   노동자 화면 전환
========================================= */

function showWorkerScreen(
    screenName
) {

    currentScreen =
        screenName;


    if (
        mainScreens.includes(
            screenName
        )
    ) {

        lastMainScreen =
            screenName;

    }


    workerScreens.forEach(

        (screen) => {

            const element =
                document.getElementById(
                    `screen-${screen}`
                );


            if (!element) {

                return;

            }


            element.classList.toggle(

                'active',

                screen ===
                screenName

            );

        }

    );


    const header =
        document.getElementById(
            'workerHeader'
        );


    const bottomNav =
        document.getElementById(
            'bottomNav'
        );


    const loggedInScreen =

        ![
            'welcome',
            'login',
            'signup'
        ].includes(
            screenName
        );


    if (header) {

        header.classList.toggle(

            'hidden',

            !loggedInScreen ||

            screenName ===
            'rest-alert'

        );

    }


    if (bottomNav) {

        bottomNav.classList.toggle(

            'hidden',

            !loggedInScreen ||

            screenName ===
            'rest-alert' ||

            screenName ===
            'notifications' ||

            screenName ===
            'settings'

        );

    }


    document
        .querySelectorAll(
            '.nav-item'
        )
        .forEach(

            (button) => {

                const target =
                    button.dataset.screen;


                const isActive =

                    target ===
                    screenName ||

                    (
                        target ===
                        'home' &&

                        [
                            'work-progress',
                            'rest-progress'
                        ].includes(
                            screenName
                        )
                    );


                button.classList.toggle(

                    'active',

                    isActive

                );

            }

        );


    if (
        screenName ===
        'record'
    ) {

        renderRecords();

    }


    if (
        screenName ===
        'mypage'
    ) {

        syncUserUI();

    }


    if (
        screenName ===
        'home'
    ) {

        updateHomeWorkStatus();

    }

}


/* =========================================
   사원코드 인증
========================================= */

function normalizeEmployeeCode(
    value
) {

    return String(
        value ||
        ''
    )
        .trim()
        .toUpperCase()
        .replace(
            /\s+/g,
            ''
        );

}


function getRoleLabel(role) {

    return (
        role ===
        'admin'

            ? '관리자'

            : '노동자'
    );

}


function setEmployeeVerifyError(
    message = ''
) {

    const error =
        document.getElementById(
            'employeeVerifyError'
        );


    if (!error) {

        return;

    }


    error.textContent =
        message;


    error.classList.toggle(

        'hidden',

        !message

    );

}


function setSignupDetailsEnabled(
    enabled
) {

    const details =
        document.getElementById(
            'signupDetails'
        );


    if (details) {

        details.classList.toggle(

            'is-locked',

            !enabled

        );

    }


    [
        'signupGender',
        'signupPhone',
        'signupEmail',
        'signupPassword',
        'signupPasswordConfirm',
        'signupSubmitButton'
    ].forEach(

        (id) => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.disabled =
                    !enabled;

            }

        }

    );


    toggleWorkerFields();

}


function toggleWorkerFields() {

    const role =
        verifiedEmployee?.role ||
        '';


    const workerOnly =
        document.getElementById(
            'workerOnlyFields'
        );


    if (!workerOnly) {

        return;

    }


    const isVerified =
        Boolean(
            verifiedEmployee
        );


    const isWorker =
        role ===
        'worker';


    workerOnly.classList.toggle(

        'hidden',

        isVerified &&
        !isWorker

    );


    [
        'signupAge',
        'signupJobType',
        'signupWorkplace',
        'signupUniform',
        'signupHealthCondition'
    ].forEach(

        (id) => {

            const field =
                document.getElementById(
                    id
                );


            if (!field) {

                return;

            }


            field.disabled =
                !(
                    isVerified &&
                    isWorker
                );


            field.required =
                isVerified &&
                isWorker;

        }

    );

}


/* =========================================
   사원 확인
========================================= */

function verifyEmployeeCode() {

    const codeInput =
        document.getElementById(
            'signupEmployeeCode'
        );


    const nameInput =
        document.getElementById(
            'signupName'
        );


    const result =
        document.getElementById(
            'employeeVerifyResult'
        );


    const employeeCode =
        normalizeEmployeeCode(
            codeInput?.value
        );


    const name =
        nameInput?.value.trim() ||
        '';


    setEmployeeVerifyError(
        ''
    );


    if (
        !employeeCode ||
        !name
    ) {

        setEmployeeVerifyError(
            '사원코드와 이름을 모두 입력해주세요.'
        );


        showToast(
            '사원코드와 이름을 입력해주세요.'
        );


        return;

    }


    const employee =
        employeeDirectory[
            employeeCode
        ];


    if (!employee) {

        verifiedEmployee =
            null;


        setSignupDetailsEnabled(
            false
        );


        result?.classList.add(
            'hidden'
        );


        setEmployeeVerifyError(
            '등록되지 않은 사원코드입니다. 현장 관리자에게 문의해주세요.'
        );


        showToast(
            '등록되지 않은 사원코드입니다.'
        );


        return;

    }


    if (
        employee.name !==
        name
    ) {

        verifiedEmployee =
            null;


        setSignupDetailsEnabled(
            false
        );


        result?.classList.add(
            'hidden'
        );


        setEmployeeVerifyError(
            '사원코드와 회사에 등록된 이름이 일치하지 않습니다.'
        );


        showToast(
            '사원코드와 이름을 확인해주세요.'
        );


        return;

    }


    verifiedEmployee = {
        ...employee
    };


    if (codeInput) {

        codeInput.value =
            employeeCode;


        codeInput.readOnly =
            true;

    }


    if (nameInput) {

        nameInput.value =
            employee.name;


        nameInput.readOnly =
            true;

    }


    const roleInput =
        document.getElementById(
            'signupRole'
        );


    const companyInput =
        document.getElementById(
            'signupCompany'
        );


    const jobTypeInput =
        document.getElementById(
            'signupJobType'
        );


    const workplaceInput =
        document.getElementById(
            'signupWorkplace'
        );


    if (roleInput) {

        roleInput.value =
            employee.role;

    }


    if (companyInput) {

        companyInput.value =
            employee.company;

    }


    if (
        jobTypeInput &&
        employee.role ===
        'worker'
    ) {

        jobTypeInput.value =
            employee.jobType ||
            '';

    }


    if (
        workplaceInput &&
        employee.role ===
        'worker'
    ) {

        workplaceInput.value =
            employee.workplace ||
            '';

    }


    setText(

        'verifiedCompanyText',

        employee.company

    );


    setText(

        'verifiedEmployeeCodeText',

        employee.employeeCode

    );


    setText(

        'verifiedRoleText',

        getRoleLabel(
            employee.role
        )

    );


    result?.classList.remove(
        'hidden'
    );


    setSignupDetailsEnabled(
        true
    );


    setEmployeeVerifyError(
        ''
    );


    showToast(

        `${employee.company} ${getRoleLabel(employee.role)}로 확인되었습니다.`

    );

}


/* =========================================
   사원 인증 초기화
========================================= */

function resetEmployeeVerification(
    clearValues = false
) {

    verifiedEmployee =
        null;


    const codeInput =
        document.getElementById(
            'signupEmployeeCode'
        );


    const nameInput =
        document.getElementById(
            'signupName'
        );


    const companyInput =
        document.getElementById(
            'signupCompany'
        );


    const roleInput =
        document.getElementById(
            'signupRole'
        );


    const result =
        document.getElementById(
            'employeeVerifyResult'
        );


    const form =
        document.getElementById(
            'signupForm'
        );


    if (codeInput) {

        codeInput.readOnly =
            false;


        if (clearValues) {

            codeInput.value =
                '';

        }

    }


    if (nameInput) {

        nameInput.readOnly =
            false;


        if (clearValues) {

            nameInput.value =
                '';

        }

    }


    if (companyInput) {

        companyInput.value =
            '';

    }


    if (roleInput) {

        roleInput.value =
            '';

    }


    if (
        clearValues &&
        form
    ) {

        [
            'signupGender',
            'signupPhone',
            'signupEmail',
            'signupAge',
            'signupJobType',
            'signupWorkplace',
            'signupPassword',
            'signupPasswordConfirm'
        ].forEach(

            (id) => {

                const field =
                    document.getElementById(
                        id
                    );


                if (field) {

                    field.value =
                        '';

                }

            }

        );


        const uniform =
            document.getElementById(
                'signupUniform'
            );


        const health =
            document.getElementById(
                'signupHealthCondition'
            );


        if (uniform) {

            uniform.value =
                '착용';

        }


        if (health) {

            health.value =
                '없음';

        }

    }


    result?.classList.add(
        'hidden'
    );


    setEmployeeVerifyError(
        ''
    );


    setSignupDetailsEnabled(
        false
    );


    if (!clearValues) {

        codeInput?.focus();

    }

}


/* =========================================
   회원가입
========================================= */

function handleSignup(event) {

    event.preventDefault();


    if (!verifiedEmployee) {

        showToast(
            '먼저 사원코드 확인을 완료해주세요.'
        );


        setEmployeeVerifyError(
            '회원가입 전에 사원 확인이 필요합니다.'
        );


        return;

    }


    const employeeCode =
        normalizeEmployeeCode(

            document
                .getElementById(
                    'signupEmployeeCode'
                )
                ?.value

        );


    const name =
        document
            .getElementById(
                'signupName'
            )
            ?.value
            .trim() ||
        '';


    if (
        employeeCode !==
        verifiedEmployee.employeeCode ||

        name !==
        verifiedEmployee.name
    ) {

        resetEmployeeVerification(
            false
        );


        setEmployeeVerifyError(
            '사원 정보가 변경되었습니다. 다시 확인해주세요.'
        );


        return;

    }


    const role =
        verifiedEmployee.role;


    const company =
        verifiedEmployee.company;


    const gender =
        document
            .getElementById(
                'signupGender'
            )
            ?.value ||
        '';


    const phone =
        document
            .getElementById(
                'signupPhone'
            )
            ?.value
            .trim() ||
        '';


    const email =
        document
            .getElementById(
                'signupEmail'
            )
            ?.value
            .trim() ||
        '';


    const password =
        document
            .getElementById(
                'signupPassword'
            )
            ?.value ||
        '';


    const confirmPassword =
        document
            .getElementById(
                'signupPasswordConfirm'
            )
            ?.value ||
        '';


    if (
        password !==
        confirmPassword
    ) {

        showToast(
            '비밀번호와 비밀번호 확인이 일치하지 않습니다.'
        );


        return;

    }


    const age =

        role ===
        'worker'

            ? Number(

                document
                    .getElementById(
                        'signupAge'
                    )
                    ?.value ||
                0

            )

            : null;


    if (
        role ===
        'worker' &&

        (
            !age ||
            age < 18 ||
            age > 80
        )
    ) {

        showToast(
            '연령을 확인해주세요.'
        );


        return;

    }


    const user = {

        employeeCode,

        name,

        password,

        role,

        company,

        gender,

        phone,

        email,

        age,


        jobType:

            role ===
            'worker'

                ? document
                    .getElementById(
                        'signupJobType'
                    )
                    ?.value
                    .trim() ||

                verifiedEmployee.jobType ||

                ''

                : '-',


        workplace:

            role ===
            'worker'

                ? document
                    .getElementById(
                        'signupWorkplace'
                    )
                    ?.value
                    .trim() ||

                verifiedEmployee.workplace ||

                ''

                : '통합 관제 센터',


        workIntensity:

            role ===
            'worker'

                ? '보통'

                : '-',


        uniform:

            role ===
            'worker'

                ? document
                    .getElementById(
                        'signupUniform'
                    )
                    ?.value ||

                '착용'

                : '-',


        healthCondition:

            role ===
            'worker'

                ? document
                    .getElementById(
                        'signupHealthCondition'
                    )
                    ?.value ||

                '없음'

                : '-'

    };


    localStorage.setItem(

        'shimonUser',

        JSON.stringify(
            user
        )

    );


    const loginName =
        document.getElementById(
            'loginName'
        );


    if (loginName) {

        loginName.value =
            name;

    }


    showToast(
        '사원 인증 및 회원가입이 완료되었습니다. 로그인해주세요.'
    );


    resetEmployeeVerification(
        true
    );


    showWorkerScreen(
        'login'
    );

}


/* =========================================
   로그인
========================================= */

function handleLogin(event) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                'loginName'
            )
            ?.value
            .trim() ||
        '';


    const password =
        document
            .getElementById(
                'loginPassword'
            )
            ?.value ||
        '';


    let savedUser =
        null;


    try {

        const savedRaw =
            localStorage.getItem(
                'shimonUser'
            );


        savedUser =

            savedRaw

                ? JSON.parse(
                    savedRaw
                )

                : null;

    }

    catch (error) {

        savedUser =
            null;

    }


    const user =

        savedUser &&
        savedUser.name ===
        name

            ? savedUser

            : demoUsers[
                name
            ];


    if (
        !user ||
        user.password !==
        password
    ) {

        showToast(
            '이름 또는 비밀번호를 확인해주세요.'
        );


        return;

    }


    currentUser =
        user;


    syncUserUI();


    if (
        user.role ===
        'admin'
    ) {

        enterAdmin();

    }

    else {

        enterWorker();

    }

}


/* =========================================
   노동자 화면 진입
========================================= */

function enterWorker() {

    const workerApp =
        document.getElementById(
            'workerApp'
        );


    const adminApp =
        document.getElementById(
            'adminApp'
        );


    if (adminApp) {

        adminApp.classList.add(
            'hidden'
        );

    }


    if (workerApp) {

        workerApp.classList.remove(
            'hidden'
        );

    }


    showWorkerScreen(
        'home'
    );

}


/* =========================================
   관리자 화면 진입
========================================= */

function enterAdmin() {

    const workerApp =
        document.getElementById(
            'workerApp'
        );


    const adminApp =
        document.getElementById(
            'adminApp'
        );


    if (workerApp) {

        workerApp.classList.add(
            'hidden'
        );

    }


    if (adminApp) {

        adminApp.classList.remove(
            'hidden'
        );

    }


    setText(

        'adminName',

        currentUser?.name ||
        '관리자'

    );


    setText(

        'adminEmail',

        currentUser?.email ||
        'admin@shimon.kr'

    );


    showAdminPage(
        'dashboard'
    );


    window.scrollTo(
        0,
        0
    );

}


/* =========================================
   로그아웃
========================================= */

function logout() {

    stopAllTimers();

    resetWorkSession();

    resetRestSession();


    const workerApp =
        document.getElementById(
            'workerApp'
        );


    const adminApp =
        document.getElementById(
            'adminApp'
        );


    const loginForm =
        document.getElementById(
            'loginForm'
        );


    if (adminApp) {

        adminApp.classList.add(
            'hidden'
        );

    }


    if (workerApp) {

        workerApp.classList.remove(
            'hidden'
        );

    }


    if (loginForm) {

        loginForm.reset();

    }


    currentUser =
        demoUsers['김철수'];


    showWorkerScreen(
        'welcome'
    );


    showToast(
        '로그아웃되었습니다.'
    );

}


/* =========================================
   사용자 정보 표시
========================================= */

function syncUserUI() {

    const user =
        currentUser ||
        demoUsers['김철수'];


    setText(
        'homeUserName',
        user.name ||
        '사용자'
    );


    setText(
        'homeWorkplace',
        user.workplace ||
        '-'
    );


    setText(
        'profileName',
        user.name ||
        '-'
    );


    setText(
        'profileGender',
        user.gender ||
        '-'
    );


    setText(

        'profileRole',

        user.role ===
        'admin'

            ? '관리자'

            : '노동자'

    );


    setText(
        'profileJobType',
        user.jobType ||
        '-'
    );


    setText(
        'profileWorkplace',
        user.workplace ||
        '-'
    );


    setText(
        'profileWorkIntensity',
        user.workIntensity ||
        '보통'
    );


    setText(
        'profileUniform',
        user.uniform ||
        '-'
    );


    setText(
        'profileEmployeeCode',
        user.employeeCode ||
        '-'
    );


    setText(
        'profileCompany',
        user.company ||
        '-'
    );


    setText(

        'profileAge',

        user.age

            ? `${user.age}세`

            : '-'

    );


    setText(
        'profileHealthCondition',
        user.healthCondition ||
        '-'
    );


    setText(
        'profilePhone',
        user.phone ||
        '-'
    );


    setText(
        'profileEmail',
        user.email ||
        '-'
    );


    setText(

        'profileInitial',

        (
            user.name ||
            '사'
        ).slice(
            0,
            1
        )

    );

}


/* =========================================
   작업 시작
========================================= */

function startWork() {

    if (
        workState ===
        'idle'
    ) {

        workSeconds =
            0;


        workSessionStartedAt =
            new Date();


        workLimitAlertShown =
            false;

    }


    if (
        workState !==
        'running'
    ) {

        workState =
            'running';


        startWorkInterval();

    }


    updateWorkUI();


    showWorkerScreen(
        'work-progress'
    );


    showToast(

        workSeconds ===
        0

            ? '작업 기록을 시작했습니다.'

            : '작업을 재개했습니다.'

    );

}


function startWorkInterval() {

    if (workTimerId) {

        clearInterval(
            workTimerId
        );

    }


    workTimerId =
        setInterval(

            () => {

                workSeconds +=
                    1;


                updateWorkUI();

            },

            1000

        );

}


function pauseWorkForRest() {

    if (
        workState !==
        'running'
    ) {

        return false;

    }


    if (workTimerId) {

        clearInterval(
            workTimerId
        );

    }


    workTimerId =
        null;


    workState =
        'paused';


    updateHomeWorkStatus();


    return true;

}


function resumeWorkAfterBreak() {

    if (
        workState !==
        'paused'
    ) {

        return;

    }


    workState =
        'running';


    startWorkInterval();


    updateWorkUI();

}


/* =========================================
   작업 UI
========================================= */

function updateWorkUI() {

    setText(

        'workTimer',

        formatDuration(
            workSeconds
        )

    );


    updateHomeWorkStatus();


    const progressPercent =
        Math.min(

            (
                workSeconds /
                WORK_TARGET_SECONDS
            ) *
            100,

            100

        );


    const workRing =
        document.getElementById(
            'workRing'
        );


    if (workRing) {

        workRing.style.setProperty(

            '--progress',

            `${progressPercent}%`

        );

    }


    if (
        workSeconds >=
        WORK_TARGET_SECONDS &&

        !workLimitAlertShown
    ) {

        workLimitAlertShown =
            true;


        showToast(
            '연속 작업 2시간이 되었습니다. 휴식을 권장합니다.'
        );

    }

}


/* =========================================
   홈 작업 상태
========================================= */

function updateHomeWorkStatus() {

    /*
       홈 추가 카드도
       작업 타이머와 같이 갱신
    */

    updateHomeSummary();


    const workButton =
        document.getElementById(
            'workStartButton'
        );


    if (
        workState ===
        'running'
    ) {

        setText(
            'workStatusText',
            '작업 중'
        );


        setText(

            'workElapsedText',

            `연속 작업 ${formatDuration(workSeconds)}`

        );


        if (workButton) {

            workButton.textContent =
                '작업 화면 보기';

        }


        return;

    }


    if (
        workState ===
        'paused'
    ) {

        setText(
            'workStatusText',
            '일시정지'
        );


        setText(

            'workElapsedText',

            `작업 ${formatDuration(workSeconds)} 기록됨`

        );


        if (workButton) {

            workButton.textContent =
                '작업 재개';

        }


        return;

    }


    setText(
        'workStatusText',
        '대기 중'
    );


    setText(
        'workElapsedText',
        '작업을 시작해주세요'
    );


    if (workButton) {

        workButton.textContent =
            '작업 시작';

    }

}


/* =========================================
   작업 종료
========================================= */

function endWork() {

    if (
        workState ===
        'idle' ||

        !workSessionStartedAt
    ) {

        showWorkerScreen(
            'home'
        );


        return;

    }


    if (workTimerId) {

        clearInterval(
            workTimerId
        );

    }


    workTimerId =
        null;


    const now =
        new Date();


    const durationMinutes =
        Math.max(

            1,

            Math.round(
                workSeconds /
                60
            )

        );


    workRecords.unshift({

        time:
            `${formatTime(workSessionStartedAt)} - ${formatTime(now)}`,

        duration:
            `${durationMinutes}분`,

        temp:
            33

    });


    resetWorkSession();


    renderRecords();


    showWorkerScreen(
        'home'
    );


    showToast(
        '작업 기록이 저장되었습니다.'
    );

}


/* =========================================
   작업 초기화
========================================= */

function resetWorkSession() {

    if (workTimerId) {

        clearInterval(
            workTimerId
        );

    }


    workTimerId =
        null;


    workSeconds =
        0;


    workSessionStartedAt =
        null;


    workState =
        'idle';


    workLimitAlertShown =
        false;


    resumeWorkAfterRest =
        false;


    const workRing =
        document.getElementById(
            'workRing'
        );


    if (workRing) {

        workRing.style.setProperty(

            '--progress',

            '0%'

        );

    }


    setText(
        'workTimer',
        '00:00:00'
    );


    updateHomeWorkStatus();

}


/* =========================================
   휴식 시작
========================================= */

function startRest() {

    resumeWorkAfterRest =
        pauseWorkForRest();


    if (restTimerId) {

        clearInterval(
            restTimerId
        );

    }


    restSeconds =
        REST_TARGET_SECONDS;


    restStartedAt =
        new Date();


    updateRestTimer();


    restTimerId =
        setInterval(

            () => {

                restSeconds =
                    Math.max(

                        0,

                        restSeconds -
                        1

                    );


                updateRestTimer();


                if (
                    restSeconds <=
                    0
                ) {

                    clearInterval(
                        restTimerId
                    );


                    restTimerId =
                        null;


                    showToast(
                        '권장 휴식 시간이 완료되었습니다.'
                    );

                }

            },

            1000

        );


    showWorkerScreen(
        'rest-progress'
    );

}


/* =========================================
   휴식 타이머
========================================= */

function updateRestTimer() {

    const minutes =
        String(

            Math.floor(
                restSeconds /
                60
            )

        ).padStart(
            2,
            '0'
        );


    const seconds =
        String(

            restSeconds %
            60

        ).padStart(
            2,
            '0'
        );


    setText(

        'restTimer',

        `${minutes}:${seconds}`

    );


    const progressPercent =
        Math.max(

            0,

            Math.min(

                (
                    restSeconds /
                    REST_TARGET_SECONDS
                ) *
                100,

                100

            )

        );


    const restRing =
        document.getElementById(
            'restRing'
        );


    if (restRing) {

        restRing.style.setProperty(

            '--progress',

            `${progressPercent}%`

        );

    }

}


/* =========================================
   휴식 종료
========================================= */

function endRest() {

    if (restTimerId) {

        clearInterval(
            restTimerId
        );

    }


    restTimerId =
        null;


    const now =
        new Date();


    const elapsedSeconds =
        REST_TARGET_SECONDS -
        restSeconds;


    const actualSeconds =

        elapsedSeconds >
        0

            ? elapsedSeconds

            : REST_TARGET_SECONDS;


    const start =

        restStartedAt ||

        new Date(

            now.getTime() -

            actualSeconds *
            1000

        );


    const durationMinutes =
        Math.max(

            1,

            Math.round(

                actualSeconds /
                60

            )

        );


    restRecords.unshift({

        time:
            `${formatTime(start)} - ${formatTime(now)}`,

        duration:
            `${durationMinutes}분`,

        temp:
            34

    });


    const shouldResumeWork =
        resumeWorkAfterRest;


    resetRestSession();


    renderRecords();


    if (
        shouldResumeWork &&

        workState ===
        'paused'
    ) {

        resumeWorkAfterBreak();


        showWorkerScreen(
            'work-progress'
        );


        showToast(
            '휴식이 저장되고 작업이 재개되었습니다.'
        );

    }

    else {

        showWorkerScreen(
            'home'
        );


        showToast(
            '휴식 기록이 저장되었습니다.'
        );

    }

}


/* =========================================
   휴식 초기화
========================================= */

function resetRestSession() {

    if (restTimerId) {

        clearInterval(
            restTimerId
        );

    }


    restTimerId =
        null;


    restSeconds =
        REST_TARGET_SECONDS;


    restStartedAt =
        null;


    resumeWorkAfterRest =
        false;


    setText(
        'restTimer',
        '20:00'
    );


    const restRing =
        document.getElementById(
            'restRing'
        );


    if (restRing) {

        restRing.style.setProperty(

            '--progress',

            '100%'

        );

    }

}


/* =========================================
   알림
========================================= */

function openNotifications() {

    showWorkerScreen(
        'notifications'
    );

}


function snoozeRestAlert() {

    showWorkerScreen(
        'home'
    );


    showToast(
        '5분 후 다시 휴식 알림을 표시합니다.'
    );


    setTimeout(

        () => {

            if (
                currentUser &&

                currentUser.role ===
                'worker' &&

                notificationEnabled
            ) {

                showToast(
                    '휴식 권장 알림이 도착했습니다.'
                );

            }

        },

        5000

    );

}


function toggleNotifications() {

    notificationEnabled =
        !notificationEnabled;


    setText(

        'notificationSetting',

        notificationEnabled

            ? '켜짐 ›'

            : '꺼짐 ›'

    );


    showToast(

        notificationEnabled

            ? '알림을 켰습니다.'

            : '알림을 껐습니다.'

    );

}


/* =========================================
   기록 관련 공통 함수
========================================= */

function getRecordTotalMinutes(
    records
) {

    return records.reduce(

        (
            sum,
            item
        ) => {

            return (

                sum +

                (
                    parseInt(
                        item.duration,
                        10
                    ) ||
                    0
                )

            );

        },

        0

    );

}


/* =========================================
   분 → 시간/분 변환
========================================= */

function formatMinutesForUI(
    totalMinutes
) {

    const hours =
        Math.floor(
            totalMinutes /
            60
        );


    const minutes =
        totalMinutes %
        60;


    if (
        hours <=
        0
    ) {

        return `${minutes}분`;

    }


    if (
        minutes ===
        0
    ) {

        return `${hours}시간`;

    }


    return (
        `${hours}시간 ${minutes}분`
    );

}


/* =========================================
   홈 - 오늘 기록 / 안전 상태
========================================= */

function updateHomeSummary() {

    /*
       기존 작업 기록의 총 시간
    */

    const savedWorkMinutes =
        getRecordTotalMinutes(
            workRecords
        );


    /*
       현재 진행 중인 작업시간
    */

    const currentWorkMinutes =
        Math.floor(
            workSeconds /
            60
        );


    const totalWorkMinutes =
        savedWorkMinutes +
        currentWorkMinutes;


    const totalRestMinutes =
        getRecordTotalMinutes(
            restRecords
        );


    /*
       홈 - 오늘 작업
    */

    setText(

        'homeWorkToday',

        totalWorkMinutes >=
        60

            ? formatMinutesForUI(
                totalWorkMinutes
            )

            : `${totalWorkMinutes}분`

    );


    /*
       홈 - 오늘 휴식
    */

    setText(

        'homeRestToday',

        totalRestMinutes >=
        60

            ? formatMinutesForUI(
                totalRestMinutes
            )

            : `${totalRestMinutes}분`

    );


    /*
       프로토타입 안전 알림 횟수
    */

    setText(
        'homeAlertToday',
        '2회'
    );


    /*
       현재 작업 중
    */

    if (
        workState ===
        'running'
    ) {

        setText(
            'homeSafetyTitle',
            '주의 단계'
        );


        setText(
            'homeSafetyBadge',
            '모니터링 중'
        );


        const elapsed =
            formatDuration(
                workSeconds
            );


        setText(

            'homeSafetyDescription',

            `현재 ${elapsed} 동안 작업 중입니다. 체감온도가 높으므로 충분한 수분을 섭취하고 권장 휴식 시간을 확인해주세요.`

        );


        return;

    }


    /*
       작업 일시정지
    */

    if (
        workState ===
        'paused'
    ) {

        setText(
            'homeSafetyTitle',
            '휴식 진행 권장'
        );


        setText(
            'homeSafetyBadge',
            '휴식 필요'
        );


        setText(

            'homeSafetyDescription',

            '작업이 일시정지되어 있습니다. 충분히 휴식하고 몸 상태를 확인한 뒤 작업을 재개해주세요.'

        );


        return;

    }


    /*
       작업 시작 전
    */

    setText(
        'homeSafetyTitle',
        '안전 상태 확인'
    );


    setText(
        'homeSafetyBadge',
        '작업 대기'
    );


    setText(

        'homeSafetyDescription',

        '작업을 시작하기 전 현재 체감온도와 몸 상태를 확인해주세요. 작업 중에는 정기적인 수분 섭취를 권장합니다.'

    );

}


/* =========================================
   기록 탭 변경
========================================= */

function setRecordTab(tab) {

    recordTab =
        tab;


    const workTab =
        document.getElementById(
            'workTab'
        );


    const restTab =
        document.getElementById(
            'restTab'
        );


    if (workTab) {

        workTab.classList.toggle(

            'active',

            tab ===
            'work'

        );

    }


    if (restTab) {

        restTab.classList.toggle(

            'active',

            tab ===
            'rest'

        );

    }


    renderRecords();

}


/* =========================================
   기록 화면 렌더링
========================================= */

function renderRecords() {

    const list =

        recordTab ===
        'work'

            ? workRecords

            : restRecords;


    const typeLabel =

        recordTab ===
        'work'

            ? '작업'

            : '휴식';


    /*
       선택된 탭의 총 시간
    */

    const totalMinutes =
        getRecordTotalMinutes(
            list
        );


    /*
       전체 작업/휴식 요약
    */

    const totalWorkMinutes =
        getRecordTotalMinutes(
            workRecords
        );


    const totalRestMinutes =
        getRecordTotalMinutes(
            restRecords
        );


    /*
       작업 기록 체감온도
    */

    const temperatures =
        workRecords

            .map(

                record =>
                    Number(
                        record.temp
                    )

            )

            .filter(

                temp =>
                    Number.isFinite(
                        temp
                    )

            );


    const averageTemperature =

        temperatures.length

            ? (

                temperatures.reduce(

                    (
                        sum,
                        temp
                    ) =>
                        sum +
                        temp,

                    0

                ) /

                temperatures.length

            )

            : 0;


    const maxTemperature =

        temperatures.length

            ? Math.max(
                ...temperatures
            )

            : 0;


    const summary =
        document.getElementById(
            'recordSummary'
        );


    const recordList =
        document.getElementById(
            'recordList'
        );


    /*
       홈 HTML만 있고
       기록 HTML이 없는 상황에서도
       홈 요약은 업데이트
    */

    if (
        !summary ||
        !recordList
    ) {

        updateHomeSummary();

        return;

    }


    /*
       기록 상단 2개 카드
    */

    summary.innerHTML = `

        <article class="card summary-card">

            <span>
                오늘 ${typeLabel}
            </span>

            <strong>
                ${list.length}회
            </strong>

        </article>


        <article class="card summary-card">

            <span>
                총 ${typeLabel}시간
            </span>

            <strong>
                ${totalMinutes}분
            </strong>

        </article>

    `;


    /*
       오늘의 안전 요약
    */

    setText(

        'recordTotalWork',

        formatMinutesForUI(
            totalWorkMinutes
        )

    );


    setText(

        'recordTotalRest',

        formatMinutesForUI(
            totalRestMinutes
        )

    );


    setText(

        'recordAverageTemp',

        averageTemperature

            ? `${averageTemperature
                .toFixed(1)
                .replace(
                    '.0',
                    ''
                )}℃`

            : '-'

    );


    setText(

        'recordMaxTemp',

        maxTemperature

            ? `${maxTemperature}℃`

            : '-'

    );


    /*
       기록 목록 제목
    */

    setText(

        'recordListTitle',

        `${typeLabel} 기록`

    );


    setText(

        'recordListCount',

        `${list.length}건`

    );


    /*
       기록 카드
    */

    recordList.innerHTML =

        list
            .map(

                record => {

                    const temperature =
                        Number(
                            record.temp
                        );


                    let note =
                        '안전하게 기록이 완료되었습니다.';


                    /*
                       작업 탭 메시지
                    */

                    if (
                        recordTab ===
                        'work'
                    ) {

                        if (
                            temperature >=
                            33
                        ) {

                            note =
                                '체감온도가 높았던 시간대입니다. 충분한 수분 섭취와 휴식을 권장합니다.';

                        }

                        else {

                            note =
                                '안전한 범위에서 작업을 완료했어요.';

                        }

                    }


                    /*
                       휴식 탭 메시지
                    */

                    else {

                        note =
                            '휴식 기록이 정상적으로 저장되었습니다.';

                    }


                    return `

                        <article class="card record-item">

                            <div class="record-item-top">

                                <strong>
                                    ${record.time}
                                </strong>

                                <span class="record-type ${recordTab}">
                                    ${typeLabel}
                                </span>

                            </div>


                            <div class="record-detail-grid">

                                <div class="record-detail-item">

                                    <span>
                                        ${typeLabel}시간
                                    </span>

                                    <strong>
                                        ${record.duration}
                                    </strong>

                                </div>


                                <div class="record-detail-item">

                                    <span>
                                        당시 체감온도
                                    </span>

                                    <strong>
                                        ${record.temp}℃
                                    </strong>

                                </div>

                            </div>


                            <p class="record-item-note">
                                ${note}
                            </p>

                        </article>

                    `;

                }

            )

            .join('');


    /*
       홈 화면 요약 동기화
    */

    updateHomeSummary();

}


/* =========================================
   마이페이지 정보 수정 열기
========================================= */

function openProfileEdit() {

    const jobType =
        document.getElementById(
            'editJobType'
        );


    const workplace =
        document.getElementById(
            'editWorkplace'
        );


    const workIntensity =
        document.getElementById(
            'editWorkIntensity'
        );


    const uniform =
        document.getElementById(
            'editUniform'
        );


    const gender =
        document.getElementById(
            'editGender'
        );


    const phone =
        document.getElementById(
            'editPhone'
        );


    const email =
        document.getElementById(
            'editEmail'
        );


    if (jobType) {

        jobType.value =
            currentUser?.jobType ||
            '';

    }


    if (workplace) {

        workplace.value =
            currentUser?.workplace ||
            '';

    }


    if (workIntensity) {

        workIntensity.value =
            currentUser?.workIntensity ||
            '보통';

    }


    if (uniform) {

        uniform.value =
            currentUser?.uniform ||
            '착용';

    }


    if (gender) {

        gender.value =
            currentUser?.gender ||
            '남성';

    }


    if (phone) {

        phone.value =
            currentUser?.phone ||
            '';

    }


    if (email) {

        email.value =
            currentUser?.email ||
            '';

    }


    showWorkerScreen(
        'settings'
    );


    const settingsScreen =
        document.getElementById(
            'screen-settings'
        );


    if (settingsScreen) {

        settingsScreen.scrollTop =
            0;

    }

}


/* =========================================
   마이페이지 수정 닫기
========================================= */

function closeProfileEdit() {

    showWorkerScreen(
        'mypage'
    );

}


/* =========================================
   마이페이지 수정 저장
========================================= */

function saveProfileEdit() {

    const jobType =
        document
            .getElementById(
                'editJobType'
            )
            ?.value
            .trim() ||
        '';


    const workplace =
        document
            .getElementById(
                'editWorkplace'
            )
            ?.value
            .trim() ||
        '';


    const workIntensity =
        document
            .getElementById(
                'editWorkIntensity'
            )
            ?.value ||
        '보통';


    const uniform =
        document
            .getElementById(
                'editUniform'
            )
            ?.value ||
        '착용';


    const gender =
        document
            .getElementById(
                'editGender'
            )
            ?.value ||
        '';


    const phone =
        document
            .getElementById(
                'editPhone'
            )
            ?.value
            .trim() ||
        '';


    const email =
        document
            .getElementById(
                'editEmail'
            )
            ?.value
            .trim() ||
        '';


    if (!jobType) {

        showToast(
            '작업 유형을 입력해주세요.'
        );


        return;

    }


    if (!workplace) {

        showToast(
            '작업 장소를 입력해주세요.'
        );


        return;

    }


    currentUser.jobType =
        jobType;


    currentUser.workplace =
        workplace;


    currentUser.workIntensity =
        workIntensity;


    currentUser.uniform =
        uniform;


    currentUser.gender =
        gender;


    currentUser.phone =
        phone;


    currentUser.email =
        email;


    localStorage.setItem(

        'shimonUser',

        JSON.stringify(
            currentUser
        )

    );


    syncUserUI();


    closeProfileEdit();


    showToast(
        '작업 정보가 변경되었습니다.'
    );

}


/* =========================================
   모든 타이머 정지
========================================= */

function stopAllTimers() {

    if (workTimerId) {

        clearInterval(
            workTimerId
        );

    }


    if (restTimerId) {

        clearInterval(
            restTimerId
        );

    }


    workTimerId =
        null;


    restTimerId =
        null;

}


/* =========================================
   관리자
========================================= */

let currentAdminPage =
    'dashboard';


let currentAdminWorkerFilter =
    'all';


const adminPageTitles = {

    dashboard:
        '대시보드',

    workers:
        '작업자 현황',

    alerts:
        '위험 알림',

    'admin-settings':
        '설정'

};


/* =========================================
   관리자 페이지 전환
========================================= */

function showAdminPage(
    pageName
) {

    currentAdminPage =
        pageName;


    document
        .querySelectorAll(
            '[data-admin-page]'
        )
        .forEach(

            (page) => {

                page.classList.toggle(

                    'active',

                    page.dataset.adminPage ===
                    pageName

                );

            }

        );


    document
        .querySelectorAll(
            '[data-admin-target]'
        )
        .forEach(

            (button) => {

                button.classList.toggle(

                    'active',

                    button.dataset.adminTarget ===
                    pageName

                );

            }

        );


    setText(

        'adminPageTitle',

        adminPageTitles[
            pageName
        ] ||
        '대시보드'

    );


    window.scrollTo(
        0,
        0
    );

}


/* =========================================
   관리자 작업자 필터
========================================= */

function setAdminWorkerFilter(
    filter,
    button
) {

    currentAdminWorkerFilter =
        filter;


    document
        .querySelectorAll(
            '[data-worker-filter]'
        )
        .forEach(

            (item) => {

                item.classList.toggle(

                    'active',

                    item ===
                    button

                );

            }

        );


    applyAdminWorkerFilters();

}


/* =========================================
   관리자 작업자 검색 / 필터
========================================= */

function applyAdminWorkerFilters() {

    const input =
        document.getElementById(
            'adminWorkerSearch'
        );


    const query =
        (
            input?.value ||
            ''
        )
            .trim()
            .toLowerCase();


    const rows =
        document.querySelectorAll(
            '#adminWorkersTable tbody tr'
        );


    let visibleCount =
        0;


    rows.forEach(

        (row) => {

            const riskMatches =

                currentAdminWorkerFilter ===
                'all' ||

                row.dataset.risk ===
                currentAdminWorkerFilter;


            const text =
                (
                    row.dataset.search ||

                    row.textContent ||

                    ''
                )
                    .toLowerCase();


            const searchMatches =

                !query ||

                text.includes(
                    query
                );


            const visible =

                riskMatches &&

                searchMatches;


            row.style.display =

                visible

                    ? ''

                    : 'none';


            if (visible) {

                visibleCount +=
                    1;

            }

        }

    );


    const empty =
        document.getElementById(
            'adminWorkerEmpty'
        );


    if (empty) {

        empty.classList.toggle(

            'hidden',

            visibleCount !==
            0

        );

    }

}


/* =========================================
   관리자 알림 발송
========================================= */

function adminSendAlert(
    workerName,
    immediate = false
) {

    showToast(

        immediate

            ? `${workerName} 작업자에게 즉시 휴식 알림을 발송했습니다.`

            : `${workerName} 작업자에게 알림을 발송했습니다.`

    );

}


/* =========================================
   관리자 설정 토글
========================================= */

function toggleAdminSetting(
    button
) {

    if (!button) {

        return;

    }


    const isOn =
        !button.classList.contains(
            'on'
        );


    button.classList.toggle(

        'on',

        isOn

    );


    button.setAttribute(

        'aria-pressed',

        String(
            isOn
        )

    );


    showToast(

        isOn

            ? '알림 채널을 켰습니다.'

            : '알림 채널을 껐습니다.'

    );

}


/* =========================================
   최초 실행
========================================= */

window.addEventListener(

    'DOMContentLoaded',

    () => {

        /*
           회원가입 초기 상태
        */

        resetEmployeeVerification(
            true
        );


        /*
           기록 화면 초기화
        */

        renderRecords();


        /*
           사용자 정보 표시
        */

        syncUserUI();


        /*
           작업 상태 초기화
        */

        resetWorkSession();


        /*
           휴식 상태 초기화
        */

        resetRestSession();


        /*
           시작 화면
        */

        showWorkerScreen(
            'welcome'
        );

    }

);