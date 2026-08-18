const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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

async function request(path, { token, ...options } = {}) {
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
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  me(token) {
    return request('/me', { token });
  },
  updateMe(token, payload) {
    return request('/me', {
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
    FORBIDDEN: '허용되지 않은 계정 유형입니다.',
    VALIDATION_ERROR: '입력값을 다시 확인해주세요.',
    NETWORK_ERROR: '백엔드 서버에 연결할 수 없습니다.',
  };
  return messages[error?.code] || error?.message || '요청 중 오류가 발생했습니다.';
}
