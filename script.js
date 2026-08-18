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

    'HB-A002': {
        employeeCode: 'HB-A002',
        name: '관리자2',
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

let accountDeletionInProgress =
    false;

let deleteAccountTrigger =
    null;


const authStorageKeys = {

    users: 'shimonUsers',

    legacyUser: 'shimonUser',

    persistentSession: 'shimonCurrentUser',

    temporarySession: 'shimonSessionUser'

};


const authDatabase = {
    name: 'shimonDatabase',
    version: 1,
    userStore: 'users'
};


const remoteDatabaseConfig = window.SHIMON_CONFIG || {};
const initialAuthLinkParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const initialAuthQueryParams = new URLSearchParams(window.location.search);
const initialAuthLinkType =
    initialAuthLinkParams.get('type') ||
    initialAuthQueryParams.get('type');
let passwordRecoveryMode =
    initialAuthLinkType === 'recovery';
let emailConfirmationMode =
    initialAuthLinkType === 'signup' ||
    initialAuthLinkType === 'email';
const remoteDatabaseEnabled = Boolean(
    remoteDatabaseConfig.supabaseUrl &&
    remoteDatabaseConfig.supabasePublishableKey &&
    window.supabase?.createClient
);


const remoteDatabase = remoteDatabaseEnabled
    ? window.supabase.createClient(
        remoteDatabaseConfig.supabaseUrl,
        remoteDatabaseConfig.supabasePublishableKey
    )
    : null;


if (remoteDatabaseEnabled) {

    remoteDatabase.auth.onAuthStateChange((event) => {

        if (event === 'PASSWORD_RECOVERY') {
            passwordRecoveryMode = true;
            window.setTimeout(showPasswordUpdatePanel, 0);
        }

        if (event === 'SIGNED_IN' && emailConfirmationMode) {
            window.setTimeout(showEmailConfirmationComplete, 0);
        }

    });

}


function profileToAppUser(profile) {

    if (!profile) {

        return null;

    }


    return {
        id: profile.id,
        employeeCode: profile.employee_code,
        name: profile.name,
        role: profile.role,
        company: profile.company,
        gender: profile.gender,
        phone: profile.phone,
        email: profile.email,
        age: profile.age,
        jobType: profile.job_type,
        workplace: profile.workplace,
        workIntensity: profile.work_intensity,
        uniform: profile.uniform,
        healthCondition: profile.health_condition
    };

}


async function getRemoteCurrentUser() {

    const { data: sessionData, error: sessionError } =
        await remoteDatabase.auth.getSession();


    if (sessionError) {

        throw sessionError;

    }


    const authUser = sessionData.session?.user;


    if (!authUser) {

        return null;

    }


    const { data: profile, error } = await remoteDatabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();


    if (error) {

        throw error;

    }


    if (!profile) {

        const profileError = new Error('로그인 계정에 연결된 회원 프로필이 없습니다.');
        profileError.code = 'profile_not_found';

        throw profileError;

    }


    return profileToAppUser(profile);

}


let authDatabasePromise = null;
let legacyUserMigrationPromise = null;


function requestToPromise(request) {

    return new Promise((resolve, reject) => {

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });

}


function openAuthDatabase() {

    if (!('indexedDB' in window)) {

        return Promise.reject(
            new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.')
        );

    }


    if (!authDatabasePromise) {

        authDatabasePromise = new Promise((resolve, reject) => {

            const request = indexedDB.open(
                authDatabase.name,
                authDatabase.version
            );


            request.onupgradeneeded = () => {

                const database = request.result;


                if (!database.objectStoreNames.contains(authDatabase.userStore)) {

                    const store = database.createObjectStore(
                        authDatabase.userStore,
                        { keyPath: 'employeeCode' }
                    );

                    store.createIndex('name', 'name', { unique: true });
                    store.createIndex('email', 'email', { unique: true });

                }

            };


            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);

        });

    }


    return authDatabasePromise;

}


function bytesToBase64(bytes) {

    return btoa(
        Array.from(bytes, byte => String.fromCharCode(byte)).join('')
    );

}


function base64ToBytes(value) {

    return Uint8Array.from(
        atob(value),
        character => character.charCodeAt(0)
    );

}


async function createPasswordRecord(password, savedSalt = null) {

    const salt = savedSalt
        ? base64ToBytes(savedSalt)
        : crypto.getRandomValues(new Uint8Array(16));

    const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const passwordHash = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: 120000,
            hash: 'SHA-256'
        },
        passwordKey,
        256
    );


    return {
        passwordHash: bytesToBase64(new Uint8Array(passwordHash)),
        passwordSalt: bytesToBase64(salt)
    };

}


async function verifyPassword(user, password) {

    if (user?.passwordHash && user?.passwordSalt) {

        const candidate = await createPasswordRecord(
            password,
            user.passwordSalt
        );

        return candidate.passwordHash === user.passwordHash;

    }


    return user?.password === password;

}


async function prepareUserForDatabase(user) {

    const databaseUser = { ...user };


    if (databaseUser.password) {

        Object.assign(
            databaseUser,
            await createPasswordRecord(databaseUser.password)
        );

        delete databaseUser.password;

    }


    return databaseUser;

}


async function migrateLegacyUsers() {

    if (legacyUserMigrationPromise) {

        return legacyUserMigrationPromise;

    }


    legacyUserMigrationPromise = (async () => {

        let legacyUsers = [];


        try {

            const savedUsers = JSON.parse(
                localStorage.getItem(authStorageKeys.users) || '[]'
            );

            const legacyUser = JSON.parse(
                localStorage.getItem(authStorageKeys.legacyUser) || 'null'
            );


            if (Array.isArray(savedUsers)) {

                legacyUsers = savedUsers;

            }


            if (
                legacyUser?.employeeCode &&
                !legacyUsers.some(user => user.employeeCode === legacyUser.employeeCode)
            ) {

                legacyUsers.push(legacyUser);

            }

        }

        catch (error) {

            console.warn('기존 회원 정보를 읽지 못했습니다.', error);

        }


        for (const legacyUser of legacyUsers) {

            if (!legacyUser?.employeeCode) {

                continue;

            }


            const existingUser = await findDatabaseUserByEmployeeCode(
                legacyUser.employeeCode,
                false
            );


            if (!existingUser) {

                await saveUserAccount(legacyUser, false);

            }

        }


        localStorage.removeItem(authStorageKeys.users);
        localStorage.removeItem(authStorageKeys.legacyUser);

    })();


    return legacyUserMigrationPromise;

}


async function getStoredUsers(runMigration = true) {

    if (runMigration) {

        await migrateLegacyUsers();

    }


    const database = await openAuthDatabase();
    const transaction = database.transaction(authDatabase.userStore, 'readonly');

    return requestToPromise(
        transaction.objectStore(authDatabase.userStore).getAll()
    );

}


async function saveUserAccount(user, runMigration = true) {

    if (runMigration) {

        await migrateLegacyUsers();

    }


    const database = await openAuthDatabase();
    const databaseUser = await prepareUserForDatabase(user);
    const transaction = database.transaction(authDatabase.userStore, 'readwrite');

    await requestToPromise(
        transaction.objectStore(authDatabase.userStore).put(databaseUser)
    );


    return databaseUser;

}


async function findDatabaseUserByEmployeeCode(employeeCode, runMigration = true) {

    if (runMigration) {

        await migrateLegacyUsers();

    }


    const database = await openAuthDatabase();
    const transaction = database.transaction(authDatabase.userStore, 'readonly');

    return (
        await requestToPromise(
            transaction.objectStore(authDatabase.userStore).get(employeeCode)
        ) || null
    );

}


async function findUserByName(name) {

    await migrateLegacyUsers();

    const database = await openAuthDatabase();
    const transaction = database.transaction(authDatabase.userStore, 'readonly');
    const savedUser = await requestToPromise(
        transaction.objectStore(authDatabase.userStore).index('name').get(name)
    );

    return savedUser || demoUsers[name] || null;

}


async function findUserByEmployeeCode(employeeCode) {

    return (
        await findDatabaseUserByEmployeeCode(employeeCode) ||
        Object.values(demoUsers).find(user => user.employeeCode === employeeCode) ||
        null
    );

}


async function deleteLocalUserAccount(employeeCode) {

    await migrateLegacyUsers();

    const database = await openAuthDatabase();
    const transaction = database.transaction(authDatabase.userStore, 'readwrite');

    await requestToPromise(
        transaction.objectStore(authDatabase.userStore).delete(employeeCode)
    );

}


function saveLoginSession(user, rememberLogin) {

    const employeeCode = user.employeeCode;

    localStorage.removeItem(authStorageKeys.persistentSession);

    sessionStorage.removeItem(authStorageKeys.temporarySession);


    if (rememberLogin) {

        localStorage.setItem(
            authStorageKeys.persistentSession,
            employeeCode
        );

    }

    else {

        sessionStorage.setItem(
            authStorageKeys.temporarySession,
            employeeCode
        );

    }

}


async function restoreLoginSession() {

    const employeeCode =
        sessionStorage.getItem(authStorageKeys.temporarySession) ||
        localStorage.getItem(authStorageKeys.persistentSession);


    if (!employeeCode) {

        return null;

    }


    const user = await findUserByEmployeeCode(employeeCode);


    if (!user) {

        localStorage.removeItem(authStorageKeys.persistentSession);

        sessionStorage.removeItem(authStorageKeys.temporarySession);

    }


    return user;

}


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
    'recovery',
    'email-confirmed',
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
            'recovery',
            'email-confirmed',
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

async function handleSignup(event) {

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


    let registeredUsers;


    try {

        registeredUsers = remoteDatabaseEnabled
            ? []
            : await getStoredUsers();

    }

    catch (error) {

        console.error(error);
        showToast('데이터베이스를 열 수 없습니다. 브라우저 설정을 확인해주세요.');

        return;

    }

    const duplicateEmployee =
        registeredUsers.some(user => user.employeeCode === employeeCode) ||
        Object.values(demoUsers).some(user => user.employeeCode === employeeCode);


    if (duplicateEmployee) {

        showToast(
            '이미 가입된 사원코드입니다. 로그인해주세요.'
        );


        return;

    }


    if (registeredUsers.some(user => user.name === name)) {

        showToast(
            '이미 사용 중인 이름입니다.'
        );


        return;

    }


    if (registeredUsers.some(user => user.email === email)) {

        showToast(
            '이미 가입된 이메일입니다.'
        );


        return;

    }


    if (password.length < 6) {

        showToast(
            '비밀번호는 6자 이상 입력해주세요.'
        );


        return;

    }


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


    let signupNeedsEmailConfirmation = false;


    try {

        if (remoteDatabaseEnabled) {

            const { data, error } = await remoteDatabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        employeeCode: user.employeeCode,
                        name: user.name,
                        role: user.role,
                        company: user.company,
                        gender: user.gender,
                        phone: user.phone,
                        age: user.age,
                        jobType: user.jobType,
                        workplace: user.workplace,
                        workIntensity: user.workIntensity,
                        uniform: user.uniform,
                        healthCondition: user.healthCondition
                    }
                }
            });


            if (error) {

                throw error;

            }


            if (
                data.user &&
                Array.isArray(data.user.identities) &&
                data.user.identities.length === 0
            ) {

                const duplicateError = new Error('User already registered');
                duplicateError.code = 'duplicate_email';

                throw duplicateError;

            }


            signupNeedsEmailConfirmation = !data.session;


            if (data.session) {

                await remoteDatabase.auth.signOut();

            }

        }

        else {

            await saveUserAccount(user);

        }

    }

    catch (error) {

        if (
            remoteDatabaseEnabled &&
            (
                error?.code === 'over_email_send_rate_limit' ||
                error?.code === 'over_request_rate_limit' ||
                error?.status === 429
            )
        ) {

            showToast('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');

        }

        else if (remoteDatabaseEnabled && isDuplicateSignupError(error)) {

            showToast('이미 사용 중인 이메일입니다.');

        }

        else {

            console.error(error);
            showToast('회원 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');

        }

        return;

    }


    const loginName =
        document.getElementById(
            'loginName'
        );


    if (loginName) {

        loginName.value =
            remoteDatabaseEnabled ? email : name;

    }


    showToast(
        remoteDatabaseEnabled
            ? signupNeedsEmailConfirmation
                ? '회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.'
                : '회원가입이 완료되었습니다. 로그인해주세요.'
            : '사원 인증 및 회원가입이 완료되었습니다. 로그인해주세요.'
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

function openAccountRecovery(tabName = 'account') {

    showWorkerScreen('recovery');
    showRecoveryTab(tabName);

}


function showRecoveryTab(tabName) {

    const showAccount = tabName === 'account';

    document.getElementById('recoveryTabs')?.classList.remove('hidden');
    document.getElementById('accountRecoveryPanel')?.classList.toggle('hidden', !showAccount);
    document.getElementById('passwordRecoveryPanel')?.classList.toggle('hidden', showAccount);
    document.getElementById('passwordUpdatePanel')?.classList.add('hidden');

    const accountTab = document.getElementById('accountRecoveryTab');
    const passwordTab = document.getElementById('passwordRecoveryTab');

    accountTab?.classList.toggle('active', showAccount);
    passwordTab?.classList.toggle('active', !showAccount);
    accountTab?.setAttribute('aria-selected', String(showAccount));
    passwordTab?.setAttribute('aria-selected', String(!showAccount));

}


function setRecoveryButtonBusy(buttonId, busy, busyText, normalText) {

    const button = document.getElementById(buttonId);

    if (!button) {
        return;
    }

    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;

}


async function handleAccountRecovery(event) {

    event.preventDefault();

    if (!remoteDatabaseEnabled) {
        showToast('Supabase 연결 후 사용할 수 있는 기능입니다.');
        return;
    }

    const employeeCode = document.getElementById('recoveryEmployeeCode')?.value.trim() || '';
    const name = document.getElementById('recoveryName')?.value.trim() || '';
    const phone = document.getElementById('recoveryPhone')?.value.trim() || '';
    const result = document.getElementById('accountRecoveryResult');

    setRecoveryButtonBusy('accountRecoveryButton', true, '확인 중...', '가입 이메일 확인');

    try {
        const { data, error } = await remoteDatabase.rpc('find_shimon_account', {
            p_employee_code: employeeCode,
            p_name: name,
            p_phone: phone
        });

        if (error) {
            throw error;
        }

        if (result) {
            result.textContent = data
                ? `가입한 이메일은 ${data} 입니다.`
                : '입력한 정보와 일치하는 계정을 찾지 못했습니다.';
            result.classList.remove('hidden');
        }
    }
    catch (error) {
        console.error('계정 찾기 오류', error);
        showToast(
            error?.code === 'PGRST202'
                ? '계정 찾기 설정이 필요합니다. schema.sql을 다시 실행해주세요.'
                : '계정을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'
        );
    }
    finally {
        setRecoveryButtonBusy('accountRecoveryButton', false, '확인 중...', '가입 이메일 확인');
    }

}


function getPasswordRecoveryRedirectUrl() {

    const configuredUrl = remoteDatabaseConfig.passwordResetRedirectUrl?.trim();

    if (configuredUrl) {
        return configuredUrl;
    }

    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return `${window.location.origin}${window.location.pathname}`;
    }

    return null;

}


async function handlePasswordRecoveryRequest(event) {

    event.preventDefault();

    if (!remoteDatabaseEnabled) {
        showToast('Supabase 연결 후 사용할 수 있는 기능입니다.');
        return;
    }

    const email = document.getElementById('recoveryEmail')?.value.trim() || '';
    const redirectTo = getPasswordRecoveryRedirectUrl();
    const options = redirectTo ? { redirectTo } : undefined;

    if (!redirectTo) {
        showToast('비밀번호 복구는 Live Server로 앱을 실행한 뒤 사용할 수 있습니다.');
        return;
    }

    setRecoveryButtonBusy('passwordRecoveryButton', true, '메일 보내는 중...', '재설정 메일 받기');

    try {
        const { error } = await remoteDatabase.auth.resetPasswordForEmail(email, options);

        if (error) {
            throw error;
        }

        showToast('가입된 이메일이라면 재설정 메일이 전송됩니다.');
    }
    catch (error) {
        console.error('비밀번호 재설정 메일 오류', error);

        if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') {
            showToast('이메일 발송 한도를 초과했습니다. 한 시간 후 다시 시도해주세요.');
        }
        else {
            showToast('재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
    }
    finally {
        setRecoveryButtonBusy('passwordRecoveryButton', false, '메일 보내는 중...', '재설정 메일 받기');
    }

}


function showPasswordUpdatePanel() {

    showWorkerScreen('recovery');
    document.getElementById('recoveryTabs')?.classList.add('hidden');
    document.getElementById('accountRecoveryPanel')?.classList.add('hidden');
    document.getElementById('passwordRecoveryPanel')?.classList.add('hidden');
    document.getElementById('passwordUpdatePanel')?.classList.remove('hidden');

}


function showEmailConfirmationComplete() {

    showWorkerScreen('email-confirmed');

}


async function finishEmailConfirmation() {

    const button = document.getElementById('emailConfirmedLoginButton');

    if (button) {
        button.disabled = true;
        button.textContent = '이동 중...';
    }

    try {
        if (remoteDatabaseEnabled) {
            await remoteDatabase.auth.signOut();
        }
    }
    catch (error) {
        console.error('이메일 인증 세션을 정리하지 못했습니다.', error);
    }

    emailConfirmationMode = false;
    window.history.replaceState({}, document.title, window.location.pathname);
    currentUser = null;

    if (button) {
        button.disabled = false;
        button.textContent = '로그인 화면으로 이동';
    }

    showWorkerScreen('login');
    showToast('인증이 완료되었습니다. 로그인해주세요.');

}


async function handlePasswordUpdate(event) {

    event.preventDefault();

    const password = document.getElementById('newRecoveryPassword')?.value || '';
    const passwordConfirm = document.getElementById('newRecoveryPasswordConfirm')?.value || '';

    if (password.length < 6) {
        showToast('새 비밀번호는 6자 이상 입력해주세요.');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('새 비밀번호가 서로 일치하지 않습니다.');
        return;
    }

    setRecoveryButtonBusy('passwordUpdateButton', true, '변경 중...', '비밀번호 변경');

    try {
        const { error } = await remoteDatabase.auth.updateUser({ password });

        if (error) {
            throw error;
        }

        await remoteDatabase.auth.signOut();
        passwordRecoveryMode = false;
        window.history.replaceState({}, document.title, window.location.pathname);
        document.getElementById('passwordUpdateForm')?.reset();
        showWorkerScreen('login');
        showToast('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
    }
    catch (error) {
        console.error('비밀번호 변경 오류', error);
        showToast('비밀번호를 변경하지 못했습니다. 재설정 링크를 다시 받아주세요.');
    }
    finally {
        setRecoveryButtonBusy('passwordUpdateButton', false, '변경 중...', '비밀번호 변경');
    }

}

async function handleLogin(event) {

    event.preventDefault();


    const loginId =
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


    let user;


    try {

        if (remoteDatabaseEnabled) {

            const { error } = await remoteDatabase.auth.signInWithPassword({
                email: loginId,
                password
            });


            if (error) {

                throw error;

            }


            user = await getRemoteCurrentUser();

        }

        else {

            user = await findUserByName(loginId);

        }

    }

    catch (error) {

        if (remoteDatabaseEnabled && error?.code === 'email_not_confirmed') {

            showToast('이메일 인증이 완료되지 않은 계정입니다.');

        }

        else if (remoteDatabaseEnabled && error?.code === 'invalid_credentials') {

            showToast('이메일 또는 비밀번호가 올바르지 않습니다.');

        }

        else {

            console.error(error);
            showToast(
                remoteDatabaseEnabled
                    ? '로그인 처리 중 오류가 발생했습니다.'
                    : '데이터베이스를 열 수 없습니다. 브라우저 설정을 확인해주세요.'
            );

        }

        return;

    }


    if (
        !user ||
        (!remoteDatabaseEnabled && !(await verifyPassword(user, password)))
    ) {

        showToast(
            remoteDatabaseEnabled
                ? '이메일 또는 비밀번호를 확인해주세요.'
                : '이름 또는 비밀번호를 확인해주세요.'
        );


        return;

    }


    currentUser =
        user;


    const rememberLogin =
        document.getElementById('rememberMe')?.checked ||
        false;


    if (!remoteDatabaseEnabled) {

        saveLoginSession(
            user,
            rememberLogin
        );

    }


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

async function logout() {

    stopAllTimers();

    resetWorkSession();

    resetRestSession();


    if (remoteDatabaseEnabled) {

        try {

            await remoteDatabase.auth.signOut();

        }

        catch (error) {

            console.error('원격 로그아웃에 실패했습니다.', error);

        }

    }


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


    localStorage.removeItem(
        authStorageKeys.persistentSession
    );

    sessionStorage.removeItem(
        authStorageKeys.temporarySession
    );


    currentUser =
        null;


    showWorkerScreen(
        'welcome'
    );


    showToast(
        '로그아웃되었습니다.'
    );

}


function isDuplicateSignupError(error) {

    const duplicateCodes = [
        'duplicate_email',
        'email_exists',
        'user_already_exists',
        'identity_already_exists'
    ];

    const message = String(error?.message || '').toLowerCase();


    return (
        duplicateCodes.includes(error?.code) ||
        message.includes('already registered') ||
        message.includes('already exists') ||
        message.includes('email exists')
    );

}


/* =========================================
   계정 탈퇴
========================================= */

function openDeleteAccountModal() {

    if (!currentUser) {

        showToast('로그인된 계정이 없습니다.');

        return;

    }


    const isDemoAccount = Object.values(demoUsers).some(
        user => user.employeeCode === currentUser.employeeCode
    );


    if (!remoteDatabaseEnabled && isDemoAccount) {

        showToast('체험용 계정은 탈퇴할 수 없습니다.');

        return;

    }


    const modal = document.getElementById('deleteAccountModal');
    const description = document.getElementById('deleteAccountModalDescription');


    if (!modal) {

        return;

    }


    deleteAccountTrigger = document.activeElement;


    if (description) {

        description.textContent =
            `${currentUser.name}님의 저장된 회원정보가 모두 삭제되며 복구할 수 없습니다.`;

    }


    modal.classList.remove('hidden');


    requestAnimationFrame(() => {

        document.getElementById('cancelDeleteAccountButton')?.focus();

    });

}


function closeDeleteAccountModal(force = false) {

    if (accountDeletionInProgress && !force) {

        return;

    }


    document.getElementById('deleteAccountModal')?.classList.add('hidden');
    deleteAccountTrigger?.focus?.();
    deleteAccountTrigger = null;

}


function handleDeleteModalBackdrop(event) {

    if (event.target === event.currentTarget) {

        closeDeleteAccountModal();

    }

}

async function deleteAccount() {

    if (!currentUser) {

        showToast('로그인된 계정이 없습니다.');

        return;

    }


    if (accountDeletionInProgress) {

        return;

    }


    const deleteButton = document.getElementById('deleteAccountButton');
    const adminDeleteButton = document.getElementById('adminDeleteAccountButton');
    const confirmButton = document.getElementById('confirmDeleteAccountButton');
    const cancelButton = document.getElementById('cancelDeleteAccountButton');


    accountDeletionInProgress = true;


    if (deleteButton) {

        deleteButton.disabled = true;
        deleteButton.textContent = '탈퇴 처리 중...';

    }


    if (adminDeleteButton) {

        adminDeleteButton.disabled = true;
        adminDeleteButton.textContent = '처리 중...';

    }


    if (confirmButton) {

        confirmButton.disabled = true;
        confirmButton.textContent = '처리 중...';

    }


    if (cancelButton) {

        cancelButton.disabled = true;

    }


    try {

        if (remoteDatabaseEnabled) {

            const { error } = await remoteDatabase.rpc('delete_own_account');


            if (error) {

                throw error;

            }

        }

        else {

            await deleteLocalUserAccount(currentUser.employeeCode);

        }


        closeDeleteAccountModal(true);
        await logout();
        showToast('계정이 탈퇴 처리되었습니다.');

    }

    catch (error) {

        console.error('계정 탈퇴에 실패했습니다.', error);
        showToast('계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');

    }

    finally {

        accountDeletionInProgress = false;

        if (deleteButton) {

            deleteButton.disabled = false;
            deleteButton.textContent = '계정 탈퇴';

        }


        if (adminDeleteButton) {

            adminDeleteButton.disabled = false;
            adminDeleteButton.textContent = '계정 탈퇴';

        }


        if (confirmButton) {

            confirmButton.disabled = false;
            confirmButton.textContent = '탈퇴하기';

        }


        if (cancelButton) {

            cancelButton.disabled = false;

        }

    }

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

async function saveProfileEdit() {

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


    try {

        if (remoteDatabaseEnabled) {

            const { data: profile, error } = await remoteDatabase
                .from('profiles')
                .update({
                    job_type: currentUser.jobType,
                    workplace: currentUser.workplace,
                    work_intensity: currentUser.workIntensity,
                    uniform: currentUser.uniform,
                    gender: currentUser.gender,
                    phone: currentUser.phone,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id)
                .select()
                .single();


            if (error) {

                throw error;

            }


            currentUser = profileToAppUser(profile);

        }

        else {

            currentUser = await saveUserAccount(currentUser);

        }

    }

    catch (error) {

        console.error(error);
        showToast('변경 사항을 데이터베이스에 저장하지 못했습니다.');

        return;

    }


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

document.addEventListener('keydown', (event) => {

    if (
        event.key === 'Escape' &&
        !document.getElementById('deleteAccountModal')?.classList.contains('hidden')
    ) {

        closeDeleteAccountModal();

    }

});

window.addEventListener(

    'DOMContentLoaded',

    async () => {

        if (remoteDatabaseEnabled) {

            const loginInput = document.getElementById('loginName');
            const loginLabel = loginInput?.closest('.field')?.querySelector('span');
            const rememberRow = document.getElementById('rememberMe')?.closest('.check-row');
            const demoBox = document.querySelector('#screen-login .demo-box');


            if (loginInput) {

                loginInput.type = 'email';
                loginInput.placeholder = '이메일 입력';
                loginInput.autocomplete = 'email';

            }


            if (loginLabel) {

                loginLabel.textContent = '이메일';

            }


            rememberRow?.classList.add('hidden');
            demoBox?.classList.add('hidden');

        }

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
           작업 상태 초기화
        */

        resetWorkSession();


        /*
           휴식 상태 초기화
        */

        resetRestSession();


        let restoredUser = null;


        try {

            restoredUser = remoteDatabaseEnabled
                ? await getRemoteCurrentUser()
                : await restoreLoginSession();

        }

        catch (error) {

            if (
                error?.code === 'profile_not_found' &&
                !passwordRecoveryMode &&
                !emailConfirmationMode
            ) {

                await remoteDatabase.auth.signOut();
                showToast('회원 프로필 연결이 필요합니다. 다시 로그인해주세요.');

            }

            else if (!passwordRecoveryMode && !emailConfirmationMode) {

                console.error('로그인 세션을 복원하지 못했습니다.', error);

            }

        }


        if (passwordRecoveryMode) {

            currentUser = null;
            showPasswordUpdatePanel();

        }

        else if (emailConfirmationMode) {

            currentUser = null;
            showEmailConfirmationComplete();

        }

        else if (restoredUser) {

            currentUser =
                restoredUser;


            syncUserUI();


            if (restoredUser.role === 'admin') {

                enterAdmin();

            }

            else {

                enterWorker();

            }

        }

        else {

            currentUser =
                null;


            showWorkerScreen(
                'welcome'
            );

        }

    }

);
