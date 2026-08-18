const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{9,30}$/;

export function validateLoginForm({ email, password }) {
  const errors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) errors.email = '이메일을 입력해주세요.';
  else if (!EMAIL_PATTERN.test(normalizedEmail)) errors.email = '올바른 이메일 형식을 입력해주세요.';
  if (!password) errors.password = '비밀번호를 입력해주세요.';

  return errors;
}

export function validateSignupForm(form) {
  const errors = {};
  const isAdmin = form.accountType === 'ADMIN';
  const age = Number(form.age);

  if (form.companyName.trim().length < 2) errors.companyName = '회사명을 2자 이상 입력해주세요.';
  if (!isAdmin && form.workArea.trim().length < 2) errors.workArea = '작업 구역을 2자 이상 입력해주세요.';
  if (!isAdmin && !form.workType) errors.workType = '작업 유형을 선택해주세요.';
  if (form.name.trim().length < 2) errors.name = '이름을 2자 이상 입력해주세요.';

  if (!form.email.trim()) errors.email = '이메일을 입력해주세요.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = '올바른 이메일 형식을 입력해주세요.';

  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = '올바른 전화번호 형식을 입력해주세요.';
  }
  if (!isAdmin && !form.age) errors.age = '나이를 입력해주세요.';
  else if (!isAdmin && (!Number.isInteger(age) || age < 18 || age > 100)) errors.age = '나이는 18세에서 100세 사이로 입력해주세요.';

  if (isAdmin && !form.adminSignupCode.trim()) {
    errors.adminSignupCode = '관리자 가입 코드를 입력해주세요.';
  }

  if (form.password.length < 8) errors.password = '비밀번호는 8자 이상이어야 합니다.';
  else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = '비밀번호에 영문과 숫자를 모두 포함해주세요.';
  }
  if (!form.passwordConfirm) errors.passwordConfirm = '비밀번호 확인을 입력해주세요.';
  else if (form.password !== form.passwordConfirm) errors.passwordConfirm = '비밀번호가 일치하지 않습니다.';

  return errors;
}

export function validateProfileUpdateForm(form) {
  const errors = {};

  if (!form.jobType) errors.jobType = '작업 유형을 선택해주세요.';
  if (form.workplace.trim().length < 2) errors.workplace = '작업 장소를 2자 이상 입력해주세요.';
  if (!form.email.trim()) errors.email = '이메일을 입력해주세요.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = '올바른 이메일 형식을 입력해주세요.';
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = '올바른 전화번호 형식을 입력해주세요.';
  }

  return errors;
}

export function apiFieldErrors(error) {
  const errors = {};
  const knownMessages = {
    COMPANY_NOT_FOUND: '등록되지 않은 회사명입니다.',
    SITE_NOT_FOUND: '해당 회사에 등록되지 않은 작업 구역입니다.',
    EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
    INVALID_ADMIN_SIGNUP_CODE: '관리자 가입 코드가 올바르지 않습니다.',
    ADMIN_SIGNUP_DISABLED: '현재 관리자 회원가입이 비활성화되어 있습니다.',
  };
  if (error?.field) errors[error.field] = knownMessages[error.code] || '입력값을 다시 확인해주세요.';
  for (const detail of error?.details || []) {
    const field = detail.field?.split('.').at(-1);
    if (field && !errors[field]) errors[field] = '입력값을 다시 확인해주세요.';
  }
  return errors;
}
