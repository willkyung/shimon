export const demoUsers = {
  김철수: {
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
  },
  관리자: {
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
  },
};

export const employeeDirectory = {
  'HB-W001': {
    employeeCode: 'HB-W001',
    name: '김철수',
    company: '한빛건설',
    role: 'worker',
    jobType: '토목 작업',
    workplace: '부산 북항 현장',
  },
  'HB-W002': {
    employeeCode: 'HB-W002',
    name: '김민준',
    company: '한빛건설',
    role: 'worker',
    jobType: '건설 작업',
    workplace: '강남 현장 A구역',
  },
  'HB-W003': {
    employeeCode: 'HB-W003',
    name: '이서준',
    company: '한빛건설',
    role: 'worker',
    jobType: '건설 작업',
    workplace: '강남 현장 B구역',
  },
  'HB-A001': {
    employeeCode: 'HB-A001',
    name: '관리자',
    company: '한빛건설',
    role: 'admin',
    jobType: '-',
    workplace: '통합 관제 센터',
  },
  'DS-W001': {
    employeeCode: 'DS-W001',
    name: '박민수',
    company: '대성건설',
    role: 'worker',
    jobType: '도로 작업',
    workplace: '대전 도로 현장',
  },
};

export const initialWorkRecords = [
  { time: '13:10 - 14:05', duration: '55분', temp: 33, coreTemp: 37.6 },
  { time: '10:20 - 11:30', duration: '70분', temp: 31, coreTemp: 37.3 },
  { time: '08:00 - 09:00', duration: '60분', temp: 29, coreTemp: 37.0 },
];

export const initialRestRecords = [
  { time: '14:05 - 14:25', duration: '20분', temp: 35, coreTemp: 37.8 },
  { time: '11:30 - 11:50', duration: '20분', temp: 32, coreTemp: 37.4 },
  { time: '09:00 - 09:20', duration: '20분', temp: 31, coreTemp: 37.2 },
];

export const DEFAULT_ADMIN_SETTINGS = {
  dangerTemperature: 43,
  cautionTemperature: 38,
  maxWorkMinutes: 120,
  restMinutes: 20,
  channels: {
    push: true,
    sms: true,
    email: false,
    emergencyCall: true,
  },
};
