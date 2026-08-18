const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(code, message, status, metadata = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.field = metadata.field || null;
    this.details = metadata.details || [];
    this.cause = metadata.cause;
  }
}

export async function apiRequest(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', '백엔드 서버에 연결할 수 없습니다.', 0, { cause: error });
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new ApiError(
      body?.error?.code || 'REQUEST_FAILED',
      body?.error?.message || '요청을 처리하지 못했습니다.',
      response.status,
      {
        field: body?.error?.field,
        details: body?.error?.details,
      },
    );
  }
  return body.data;
}

export const authApi = {
  signup(payload) {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  me(token) {
    return apiRequest('/me', { token });
  },
  updateMe(token, payload) {
    return apiRequest('/me', {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    });
  },
};

export function authErrorMessage(error) {
  const messages = {
    COMPANY_NOT_FOUND: '등록되지 않은 회사명입니다.',
    SITE_NOT_FOUND: '회사에 등록된 작업 구역을 찾을 수 없습니다.',
    EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
    INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해주세요.',
    EMPLOYEE_CODE_GENERATION_FAILED: '사번 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    INVALID_ADMIN_SIGNUP_CODE: '관리자 가입 코드가 올바르지 않습니다.',
    ADMIN_SIGNUP_DISABLED: '현재 관리자 회원가입이 비활성화되어 있습니다.',
    ACTIVE_WORK_SESSION_EXISTS: '이미 진행 중인 작업이 있습니다. 화면을 새로고침해주세요.',
    ACTIVE_WORK_SESSION_NOT_FOUND: '진행 중인 작업을 찾을 수 없습니다.',
    ACTIVE_REST_ALREADY_EXISTS: '이미 휴식이 진행 중입니다.',
    ACTIVE_REST_NOT_FOUND: '진행 중인 휴식을 찾을 수 없습니다.',
    FORBIDDEN: '허용되지 않은 계정 유형입니다.',
    VALIDATION_ERROR: '입력값을 다시 확인해주세요.',
    NETWORK_ERROR: '백엔드 서버에 연결할 수 없습니다.',
  };
  return messages[error?.code] || error?.message || '요청 중 오류가 발생했습니다.';
}
