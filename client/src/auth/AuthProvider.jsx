import { useCallback, useEffect, useState } from 'react';
import { api, clearStoredSession, getAccessToken, refreshAccessToken, setAccessToken } from '../api';
import { AuthContext } from './authContext';

function readStoredUser() {
  try {
    const user = JSON.parse(window.localStorage.getItem('user') || 'null');
    return user && typeof user.id === 'string' && typeof user.name === 'string'
      && ['admin', 'employee'].includes(user.role) ? user : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [authCheckError, setAuthCheckError] = useState(false);

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    if (nextUser) {
      try { window.localStorage.setItem('user', JSON.stringify(nextUser)); } catch {}
    }
  }, []);

  const refreshSession = useCallback(() => refreshAccessToken()
    .then(({ user: authenticatedUser }) => {
      setUser(authenticatedUser);
      setSessionExpiredNotice(false);
    })
    .catch((error) => {
      setAccessToken(null);
      if (error.response?.status === 401) {
        setUser(null);
        const message = error.response?.data?.message || '';
        if (/expired|no longer valid/i.test(message)) setSessionExpiredNotice(true);
      } else {
        setAuthCheckError(true);
      }
    }), [setUser]);

  const retrySessionCheck = useCallback(async () => {
    setLoading(true);
    setAuthCheckError(false);
    try {
      await refreshSession();
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  useEffect(() => {
    const sessionCheck = getAccessToken()
      ? api.get('/auth/me').then(({ data }) => ({ user: data.data.user }))
      : refreshAccessToken();
    sessionCheck
      .then(({ user: authenticatedUser }) => {
        setUser(authenticatedUser);
        setSessionExpiredNotice(false);
      })
      .catch((error) => {
        setAccessToken(null);
        if (error.response?.status === 401) {
          setUser(null);
          const message = error.response?.data?.message || '';
          if (/expired|no longer valid/i.test(message)) setSessionExpiredNotice(true);
        } else {
          setAuthCheckError(true);
        }
      })
      .finally(() => setLoading(false));
    const handleExpired = () => {
      setAccessToken(null);
      setUser(null);
      setSessionExpiredNotice(true);
      setAuthCheckError(false);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [setUser]);

  async function authenticate(endpoint, values) {
    const { data } = await api.post(`/auth/${endpoint}`, values);
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    setSessionExpiredNotice(false);
    setAuthCheckError(false);
    return data.data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearStoredSession();
      setUser(null);
      setSessionExpiredNotice(false);
      setAuthCheckError(false);
    }
  }

  return <AuthContext.Provider value={{ user, loading, authCheckError, retrySessionCheck, sessionExpiredNotice, clearSessionExpiredNotice: () => setSessionExpiredNotice(false), login: (values) => authenticate('login', values), setup: (values) => authenticate('setup', values), logout, setUser }}>{children}</AuthContext.Provider>;
}