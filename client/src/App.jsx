import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { SplashScreen } from './components/SplashScreen';
import { Shell } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { Login, ForgotPassword, SetupAdmin, ResetPassword } from './pages/AuthPages';
import { Leads } from './pages/Leads';
import { LeadDetail } from './pages/LeadDetail';
import { Settings, Profile } from './pages/Settings';
import { ApiDocs } from './pages/ApiDocs';
import { Team } from './pages/Team';
import { Button } from './components/ui';

function ProtectedApp() {
  const { user, loading, authCheckError, retrySessionCheck } = useAuth();
  const location = useLocation();
  if (loading) return <div className="screen-loading"><span className="spinner" /> Preparing your workspace</div>;
  if (authCheckError) return <div className="screen-loading"><div><p>Could not verify your session. Check your connection and try again.</p><Button onClick={retrySessionCheck}>Try again</Button></div></div>;
  if (!user) return <Navigate to="/portal/login" replace />;
  if (user.role === 'employee' && location.pathname === '/app') return <Navigate to="/app/leads" replace />;
  if (user.role !== 'admin' && ['/app/settings', '/app/api-docs', '/app/team'].includes(location.pathname)) return <Navigate to="/app/leads" replace />;
  return <Shell />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try { return !window.sessionStorage.getItem('splash_shown'); }
    catch { return true; }
  });
  const completeSplash = useCallback(() => {
    setShowSplash(false);
    try { window.sessionStorage.removeItem('splash_shown'); }
    catch { /* Session storage can be unavailable in restricted browser contexts. */ }
  }, []);

  useEffect(() => {
    if (!showSplash) return;
    try { window.sessionStorage.setItem('splash_shown', 'true'); }
    catch { /* The splash still works when session storage is unavailable. */ }
  }, [showSplash]);

  return <>
    <AuthProvider><Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/portal/login" element={<Login />} />
      <Route path="/portal/setup" element={<SetupAdmin />} />
      <Route path="/setup" element={<SetupAdmin />} />
      <Route path="/portal/register" element={<Navigate to="/portal/login" replace />} />
      <Route path="/login" element={<Navigate to="/portal/login" replace />} />
      <Route path="/register" element={<Navigate to="/portal/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/app" element={<ProtectedApp />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="api-docs" element={<ApiDocs />} />
        <Route path="team" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></AuthProvider>
    {showSplash && <SplashScreen onComplete={completeSplash} />}
  </>;
}
