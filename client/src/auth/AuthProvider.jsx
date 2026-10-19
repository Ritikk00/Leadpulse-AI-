import { useEffect, useState } from 'react';
import { api, refreshAccessToken, setAccessToken } from '../api';
import { AuthContext } from './authContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  useEffect(() => {
    refreshAccessToken()
      .then(({ user }) => setUser(user))
      .catch((error) => {
        setAccessToken(null);
        setUser(null);
        const message = error.response?.data?.message || '';
        if (error.response?.status === 401 && /expired|no longer valid/i.test(message)) setSessionExpiredNotice(true);
      })
      .finally(() => setLoading(false));
    const handleExpired = () => {
      setUser(null);
      setSessionExpiredNotice(true);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  async function authenticate(endpoint, values) {
    const { data } = await api.post(`/auth/${endpoint}`, values);
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    setSessionExpiredNotice(false);
    return data.data.user;
  }

  async function logout() {
    try { await api.post('/auth/logout'); } finally { setAccessToken(null); setUser(null); setSessionExpiredNotice(false); }
  }

  return <AuthContext.Provider value={{ user, loading, sessionExpiredNotice, clearSessionExpiredNotice: () => setSessionExpiredNotice(false), login: (values) => authenticate('login', values), setup: (values) => authenticate('setup', values), logout, setUser }}>{children}</AuthContext.Provider>;
}