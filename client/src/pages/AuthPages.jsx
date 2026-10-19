import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Activity, CircleCheck, KeyRound, LockKeyhole } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api';
import { useAuth } from '../auth/useAuth';
import { Button, ErrorMessage } from '../components/ui';
import { useToast } from '../components/useToast';

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') });
const registerSchema = loginSchema.extend({ name: z.string().min(2, 'Enter your name') });
const setupRetryDelays = [700, 1500, 3000];

function authErrorMessage(error) {
  if (!error.response || error.response.status >= 500) return 'We couldn’t connect to the service. Please try again in a moment.';
  return error.response.data?.message || 'We couldn’t complete that request. Please check your details and try again.';
}

function AuthFrame({ eyebrow, title, description, children }) {
  return <div className="auth-page"><Link className="brand auth-brand animate-brand-reveal" to="/"><span className="brand-mark"><Activity size={18} /></span><span>LeadPulse <span className="brand-light">AI</span></span></Link><div className="auth-wrap"><div className="auth-aside"><span className="aside-index">FIELD NOTES / 01</span><div><p className="eyebrow"><span className="eyebrow-line" /> THE WORKSPACE</p><h2>Every conversation,<br /><em>moving forward.</em></h2><p>One quiet place to see what came in, what matters, and what happens next.</p></div><span className="aside-foot">LEAD MANAGEMENT, WITH INTENTION</span></div><div className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></div><Link className="auth-back" to="/"><ArrowLeft size={14} /> Back to inquiry page</Link></div>;
}

function AuthForm({ mode }) {
  const isSetup = mode === 'setup';
  const { user, login, setup, sessionExpiredNotice, clearSessionExpiredNotice } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [showSessionExpiredMessage, setShowSessionExpiredMessage] = useState(false);
  const [setupStatus, setSetupStatus] = useState(isSetup ? 'checking' : 'ready');
  const schema = isSetup ? registerSchema : loginSchema;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isSetup) {
      let active = true;
      let attempt = 0;
      let retryTimer;
      async function checkSetupStatus() {
        try {
          const { data } = await api.get('/auth/setup-status', { timeout: 8000 });
          if (!data.success || typeof data.isSetupComplete !== 'boolean') throw new Error('Invalid setup status response.');
          if (!active) return;
          if (data.isSetupComplete) navigate('/portal/login', { replace: true });
          else setSetupStatus('open');
        } catch {
          if (!active) return;
          if (attempt < setupRetryDelays.length) {
            retryTimer = window.setTimeout(checkSetupStatus, setupRetryDelays[attempt]);
            attempt += 1;
          } else {
            setSetupStatus('unavailable');
            retryTimer = window.setTimeout(checkSetupStatus, 5000);
          }
        }
      }
      checkSetupStatus();
      return () => { active = false; window.clearTimeout(retryTimer); };
    }
    if (sessionExpiredNotice) {
      window.setTimeout(() => setShowSessionExpiredMessage(true), 0);
      clearSessionExpiredNotice();
    }
  }, [clearSessionExpiredNotice, isSetup, navigate, sessionExpiredNotice, setupAttempt]);

  if (user) return <Navigate to={user.role === 'employee' ? '/app/leads' : '/app'} replace />;

  if (isSetup && setupStatus !== 'open') {
    return <AuthFrame eyebrow="INITIAL ADMIN SETUP" title="Set up your workspace." description="Create the administrator account for this installation.">
      {setupStatus === 'checking'
        ? <div className="loading-panel"><span className="spinner" /> Connecting to your workspace…</div>
        : <div className="setup-unavailable"><p>Workspace setup is temporarily unavailable. Please try again shortly.</p><Button type="button" variant="secondary" onClick={() => { setSetupStatus('checking'); setSetupAttempt((attempt) => attempt + 1); }}>Try again</Button></div>}
    </AuthFrame>;
  }

  async function submit(values) {
    setServerError(null);
    try {
      const authenticatedUser = isSetup ? await setup(values) : await login(values);
      navigate(authenticatedUser.role === 'employee' ? '/app/leads' : '/app');
    }
    catch (error) {
      if (isSetup && error.response?.status === 403) {
        navigate('/portal/login', { replace: true });
        return;
      }
      setServerError(authErrorMessage(error));
    }
  }

  return <AuthFrame eyebrow={isSetup ? 'INITIAL ADMIN SETUP' : 'STAFF PORTAL'} title={isSetup ? 'Set up your workspace.' : 'Pick up where you left off.'} description={isSetup ? 'Create the administrator account for this installation.' : 'Sign in to access your assigned workspace.'}>
    <form className="auth-form" onSubmit={handleSubmit(submit)}>
      {isSetup && <div><label htmlFor="name">Full name</label><input id="name" autoComplete="name" placeholder="Jordan Lee" {...register('name')} />{errors.name && <small className="field-error">{errors.name.message}</small>}</div>}
      <div><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</div>
      <div><label htmlFor="password">{isSetup ? 'Administrator password' : 'Password'}</label><input id="password" type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" {...register('password')} />{errors.password && <small className="field-error">{errors.password.message}</small>}</div>
      {!isSetup && <Link className="forgot-link" to="/forgot-password">Forgot password?</Link>}
      {showSessionExpiredMessage && <div className="form-error" role="alert">Session expired. Please log in again to continue.</div>}
      {serverError && <p className="form-error" role="alert">{serverError}</p>}
      <Button type="submit" className="auth-submit" disabled={isSubmitting || (isSetup && setupStatus !== 'open')}>{isSubmitting ? 'Please wait…' : isSetup ? 'Create administrator account' : 'Sign in'} <ArrowRight size={16} /></Button>
    </form>
  </AuthFrame>;
}

export function Login() { return <AuthForm mode="login" />; }
export function SetupAdmin() { return <AuthForm mode="setup" />; }

export function ForgotPassword() {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })) });
  async function submit(values) {
    setError(null);
    try {
      await api.post('/auth/forgot-password', values);
      setSent(true);
      toast.info('Password reset instructions have been sent to your email inbox.');
    }
    catch (requestError) { setError(requestError); }
  }
  return <AuthFrame eyebrow="ACCOUNT RECOVERY" title="A fresh start." description="We’ll send a secure reset link if an account exists for that email.">
    {sent ? <div className="sent-state"><CircleCheck size={31} /><p>Password reset instructions have been sent to your email inbox. If an account exists, the secure link expires after 30 minutes.</p></div> : <form className="auth-form" onSubmit={handleSubmit(submit)}><div><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</div><ErrorMessage error={error} /><Button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset link'} <ArrowRight size={16} /></Button></form>}
    <p className="auth-switch"><Link to="/portal/login"><ArrowLeft size={14} /> Back to sign in</Link></p>
  </AuthFrame>;
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters'), confirm: z.string() }).refine((data) => data.password === data.confirm, { path: ['confirm'], message: 'Passwords do not match' });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  async function submit(values) {
    setError(null);
    try { await api.post('/auth/reset-password', { token: params.get('token'), password: values.password }); setComplete(true); }
    catch (requestError) { setError(requestError); }
  }
  return <AuthFrame eyebrow="SECURE YOUR ACCOUNT" title="Choose a new password." description="Use at least 8 characters. Your other sessions will be signed out.">
    {complete ? <div className="sent-state"><LockKeyhole size={30} /><p>Your password has been updated.</p><Button onClick={() => navigate('/portal/login')}>Return to sign in <ArrowRight size={15} /></Button></div> : <form className="auth-form" onSubmit={handleSubmit(submit)}><div><label htmlFor="password">New password</label><input id="password" type="password" autoComplete="new-password" {...register('password')} />{errors.password && <small className="field-error">{errors.password.message}</small>}</div><div><label htmlFor="confirm">Confirm password</label><input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />{errors.confirm && <small className="field-error">{errors.confirm.message}</small>}</div><ErrorMessage error={error} /><Button className="auth-submit" disabled={isSubmitting}>Update password <KeyRound size={15} /></Button></form>}
  </AuthFrame>;
}