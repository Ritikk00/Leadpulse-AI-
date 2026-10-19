import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Check, ChevronRight, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api';
import { useAuth } from '../auth/useAuth';
import { AutoAssignToggle } from '../components/AutoAssignToggle';
import { Button, ErrorMessage, PageHeader } from '../components/ui';

export function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ adminNotifications: true, acknowledgementEnabled: false, autoAssign: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setSettings(data.data.settings)).catch(setError).finally(() => setLoading(false));
  }, []);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try { const { data } = await api.patch('/settings', settings); setSettings((current) => ({ ...current, ...data.data.settings })); setSaved(true); }
    catch (requestError) { setError(requestError); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow="YOUR PREFERENCES" title="Settings" description="Choose how your team hears about incoming work." />
    <ErrorMessage error={error} />
    <form className="settings-layout" onSubmit={saveSettings}>
      <section className="panel settings-panel"><div className="settings-heading"><span className="settings-icon settings-icon-mint"><Bell size={17} /></span><div><h2>Notifications</h2><p>These preferences apply to this workspace owner.</p></div></div>
        {user?.role === 'admin' && <AutoAssignToggle enabled={settings.autoAssign} onChange={(autoAssign) => setSettings((current) => ({ ...current, autoAssign }))} disabled={loading} />}
        <label className="toggle-row"><span><strong>New lead email alerts</strong><small>Notify the configured admin inbox when a new lead arrives. SMTP and an admin email must be configured on the server.</small></span><input type="checkbox" checked={settings.adminNotifications} disabled={loading} onChange={(event) => setSettings({ ...settings, adminNotifications: event.target.checked })} /></label>
        <label className="toggle-row"><span><strong>Lead acknowledgement email</strong><small>Send an acknowledgement to the lead after form submission. Configure SMTP before enabling.</small></span><input type="checkbox" checked={settings.acknowledgementEnabled} disabled={loading} onChange={(event) => setSettings({ ...settings, acknowledgementEnabled: event.target.checked })} /></label>
        <div className="settings-security"><ShieldCheck size={15} /><span>SMTP credentials are read only from the server environment and never shown here.</span></div>
        <div className="settings-actions"><span>{saved && <><Check size={14} /> Preferences saved</>}</span><Button disabled={saving || loading}>{saving ? 'Saving…' : 'Save preferences'} <ArrowRight size={15} /></Button></div>
      </section>
      <aside className="settings-aside"><div><span className="aside-icon"><Mail size={17} /></span><h3>Email delivery</h3><p>SMTP is optional. Add the host, credentials, sender address, and admin inbox to your backend environment.</p><Link to="/app/api-docs">View setup notes <ChevronRight size={14} /></Link></div><div><span className="aside-icon"><KeyRound size={17} /></span><h3>Access & privacy</h3><p>Refresh sessions use a secure httpOnly cookie. Lead APIs require a signed access token.</p></div></aside>
    </form>
  </>;
}

export function Profile() {
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState(null);
  const schema = z.object({ name: z.string().min(2, 'Enter your name'), currentPassword: z.string().optional(), newPassword: z.string().optional() }).refine((value) => !value.newPassword || value.newPassword.length >= 8, { path: ['newPassword'], message: 'Use at least 8 characters' }).refine((value) => !value.newPassword || value.currentPassword, { path: ['currentPassword'], message: 'Enter your current password' });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { name: user?.name || '' } });

  async function submit(values) {
    setSaved(false);
    setServerError(null);
    const payload = { name: values.name };
    if (values.newPassword) { payload.currentPassword = values.currentPassword; payload.newPassword = values.newPassword; }
    try { const { data } = await api.patch('/profile', payload); setUser(data.data.user); setSaved(true); }
    catch (error) { setServerError(error); }
  }

  return <>
    <PageHeader eyebrow="YOUR ACCOUNT" title="Profile" description="Update your name and sign-in credentials." />
    <form className="panel profile-panel" onSubmit={handleSubmit(submit)}><div className="settings-heading"><span className="settings-icon settings-icon-blue"><UserRound size={17} /></span><div><h2>Personal details</h2><p>Your email is your account identifier.</p></div></div>
      <div className="profile-grid"><div><label htmlFor="profile-name">Full name</label><input id="profile-name" {...register('name')} />{errors.name && <small className="field-error">{errors.name.message}</small>}</div><div><label htmlFor="profile-email">Email address</label><input id="profile-email" value={user?.email || ''} disabled /></div></div>
      <div className="profile-divider"><span><KeyRound size={14} /> Change password</span><small>Leave both password fields blank to keep the current password.</small></div>
      <div className="profile-grid"><div><label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" {...register('currentPassword')} />{errors.currentPassword && <small className="field-error">{errors.currentPassword.message}</small>}</div><div><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} />{errors.newPassword && <small className="field-error">{errors.newPassword.message}</small>}</div></div>
      <ErrorMessage error={serverError} /><div className="settings-actions"><span>{saved && <><Check size={14} /> Profile updated</>}</span><Button disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save profile'} <ArrowRight size={15} /></Button></div>
    </form>
  </>;
}