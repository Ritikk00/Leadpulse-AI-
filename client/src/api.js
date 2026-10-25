import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

function readStoredToken() {
  try { return window.localStorage.getItem('token'); }
  catch { return null; }
}

let accessToken = readStoredToken();
export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    try { window.localStorage.setItem('token', token); } catch {}
  }
};

export function clearStoredSession() {
  setAccessToken(null);
  try {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user');
  } catch {}
}

let refreshRequest;
export function refreshAccessToken() {
  refreshRequest ||= api.post('/auth/refresh')
    .then(({ data }) => {
      setAccessToken(data.data.accessToken);
      return data.data;
    })
    .finally(() => { refreshRequest = null; });
  return refreshRequest;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  const isSessionRequest = /\/auth\/(?:login|setup|register|refresh|logout|forgot-password|reset-password)(?:\?|$)/.test(original?.url || '');
  if (error.response?.status !== 401 || original?._retry || isSessionRequest) throw error;
  original._retry = true;
  try {
    const session = await refreshAccessToken();
    original.headers.Authorization = `Bearer ${session.accessToken}`;
    return api(original);
  } catch (refreshError) {
    if (refreshError.response?.status === 401) {
      setAccessToken(null);
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw refreshError;
  }
});