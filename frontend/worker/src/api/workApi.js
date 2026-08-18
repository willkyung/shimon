import { apiRequest } from './authApi.js';

export const workApi = {
  start(token, payload) {
    return apiRequest('/work-sessions', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    });
  },
  current(token) {
    return apiRequest('/me/work-session/current', { token });
  },
  history(token) {
    return apiRequest('/me/work-sessions', { token });
  },
  restHistory(token) {
    return apiRequest('/me/rest-records', { token });
  },
  evaluate(token, workSessionId) {
    return apiRequest(`/work-sessions/${workSessionId}/evaluate`, {
      method: 'POST',
      token,
    });
  },
  end(token, workSessionId) {
    return apiRequest(`/work-sessions/${workSessionId}/end`, {
      method: 'POST',
      token,
    });
  },
  startRest(token, workSessionId) {
    return apiRequest(`/work-sessions/${workSessionId}/rests/start`, {
      method: 'POST',
      token,
    });
  },
  endRest(token, restId) {
    return apiRequest(`/rests/${restId}/end`, {
      method: 'POST',
      token,
    });
  },
};
