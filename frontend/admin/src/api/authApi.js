const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
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
    );
  }
  return body.data;
}

export const authApi = {
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  me(token) {
    return request('/me', { token });
  },
};

export function authErrorMessage(error) {
  if (error?.code === 'INVALID_CREDENTIALS') {
    return '이메일 또는 비밀번호를 확인해주세요.';
  }
  if (error?.code === 'FORBIDDEN') return '관리자 권한이 없는 계정입니다.';
  if (error?.code === 'NETWORK_ERROR') return '백엔드 서버에 연결할 수 없습니다.';
  return error?.message || '로그인 중 오류가 발생했습니다.';
}
