import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, CalendarDays, Check, Clock3, LoaderCircle, Mail, MessageCircle, MessageSquareText, Pencil, Phone, Sparkles, Trash2, UserRound } from 'lucide-react';
import { api } from '../api';
import { Button, ErrorMessage, PageHeader, PriorityBadge, StatusBadge } from '../components/ui';
import { useToast } from '../components/useToast';
import { formatWhatsAppPhone, openLeadWhatsApp } from '../utils/whatsapp';

const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'LOST'];
const timelines = ['Immediate (Ready now)', 'Within 15 - 30 Days', 'Exploring / General Inquiry'];

export function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notifications = useToast();
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showContactedSuggestion, setShowContactedSuggestion] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/leads/${id}`);
      setLead(data.data.lead);
      setActivities(data.data.activities);
      setForm(data.data.lead);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => {
    let active = true;
    api.get(`/leads/${id}`)
      .then(({ data }) => {
        if (!active) return;
        setLead(data.data.lead);
        setActivities(data.data.activities);
        setForm(data.data.lead);
      })
      .catch((requestError) => { if (active) setError(requestError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setError(null);
    try {
      const { data } = await api.patch(`/leads/${id}`, { name: form.name, email: form.email || '', phone: form.phone, source: form.source, requirement: form.requirement, timeline: form.timeline, status: form.status, priority: form.priority });
      setLead(data.data.lead);
      setEditing(false);
      setNotice('Lead changes saved.');
      await load();
    } catch (requestError) { setError(requestError); }
    finally { setBusy(false); }
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setError(null);
    try {
      const { data } = await api.post(`/leads/${id}/analyze`);
      setLead(data.data.lead);
      setNotice('AI qualification completed.');
      notifications.success('AI qualification completed. Score and insights are updated.');
      await load();
    }
    catch (requestError) {
      setError(requestError);
      const status = requestError.response?.status;
      const message = requestError.response?.data?.details?.actionableMessage
        || requestError.response?.data?.message
        || requestError.response?.data?.message
        || '';
      notifications.error(status === 502 || status === 503 || /AI Provider Error|GROQ_API_KEY/i.test(message)
        ? 'AI Provider Error: Check your API Key and credits.'
        : message || 'AI qualification failed. Try again.');
    }
    finally { setBusy(false); }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try { await api.post(`/leads/${id}/activities`, { message: note }); setNote(''); await load(); }
    catch (requestError) { setError(requestError); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`Delete ${lead.name}'s lead record and activity history?`)) return;
    setBusy(true);
    try { await api.delete(`/leads/${id}`); navigate('/app/leads'); }
    catch (requestError) { setError(requestError); setBusy(false); }
  }

  if (loading) return <div className="loading-panel"><span className="spinner" /> Loading lead…</div>;
  if (error && !lead) return <div className="empty-state"><h3>Lead unavailable</h3><ErrorMessage error={error} /><Link className="text-link" to="/app/leads"><ArrowLeft size={15} /> Back to leads</Link></div>;
  if (!lead) return null;

  const whatsappPhone = formatWhatsAppPhone(lead.phone);
  async function startWhatsAppChat() {
    if (!whatsappPhone || whatsappBusy) return;
    openLeadWhatsApp(lead);
    setWhatsappBusy(true);
    setShowContactedSuggestion(lead.status === 'NEW');
    try {
      const { data } = await api.post(`/leads/${id}/whatsapp`);
      const entry = data.data.activity;
      setActivities((current) => [entry, ...current.filter((item) => item._id !== entry._id)].slice(0, 100));
      notifications.success('WhatsApp chat initiated and added to the activity timeline.');
    } catch (requestError) {
      notifications.error(requestError.response?.data?.message || 'WhatsApp opened, but the activity could not be recorded.');
    } finally { setWhatsappBusy(false); }
  }

  async function markContacted() {
    setStatusUpdating(true);
    try {
      const { data } = await api.patch(`/leads/${id}`, { status: 'CONTACTED' });
      setLead(data.data.lead);
      setShowContactedSuggestion(false);
      await load();
      notifications.success('Lead status changed to Contacted.');
    } catch (requestError) {
      notifications.error(requestError.response?.data?.message || 'Lead status could not be changed.');
    } finally { setStatusUpdating(false); }
  }

  const initial = (value) => setForm((current) => ({ ...current, ...value }));
  return <>
    <Link className="back-link" to="/app/leads"><ArrowLeft size={15} /> All leads</Link>
    <PageHeader eyebrow={`RECEIVED ${new Date(lead.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`} title={lead.name} description={lead.phone || lead.email || 'Inquiry'} action={<div className="header-actions"><Button variant="secondary" onClick={() => { setEditing(!editing); setForm(lead); }}><Pencil size={15} /> {editing ? 'Cancel edit' : 'Edit lead'}</Button><Button variant="danger-ghost" onClick={remove} disabled={busy} aria-label="Delete lead"><Trash2 size={16} /></Button></div>} />
    {notice && <div className="inline-success"><Check size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    <ErrorMessage error={error} />
    <div className="detail-layout">
      <div className="detail-main">
        {editing ? <form className="panel edit-panel" onSubmit={save}><div className="panel-heading"><div><p className="eyebrow">LEAD RECORD</p><h2>Edit details</h2></div></div><div className="edit-grid">
          <div><label htmlFor="lead-name">Name</label><input id="lead-name" value={form.name || ''} onChange={(event) => initial({ name: event.target.value })} required /></div><div><label htmlFor="lead-email">Email</label><input id="lead-email" type="email" value={form.email || ''} onChange={(event) => initial({ email: event.target.value })} /></div><div><label htmlFor="lead-phone">Phone</label><input id="lead-phone" inputMode="numeric" maxLength="10" value={form.phone || ''} onChange={(event) => initial({ phone: event.target.value })} required /></div><div><label htmlFor="lead-source">Source</label><input id="lead-source" value={form.source || ''} onChange={(event) => initial({ source: event.target.value })} /></div><div><label htmlFor="lead-status">Status</label><select id="lead-status" value={form.status} onChange={(event) => initial({ status: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div><label htmlFor="lead-priority">Priority</label><select id="lead-priority" value={form.priority} onChange={(event) => initial({ priority: event.target.value })}>{['HOT', 'WARM', 'COLD'].map((priority) => <option key={priority}>{priority}</option>)}</select></div><div><label htmlFor="lead-timeline">Timeline</label><select id="lead-timeline" value={form.timeline} onChange={(event) => initial({ timeline: event.target.value })}>{timelines.map((timeline) => <option key={timeline}>{timeline}</option>)}</select></div><div className="edit-wide"><label htmlFor="lead-requirement">Requirement</label><textarea id="lead-requirement" rows="4" value={form.requirement || ''} onChange={(event) => initial({ requirement: event.target.value })} required /></div></div><div className="edit-actions"><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={15} /></Button></div></form> : <>
          <section className="panel detail-card"><div className="panel-heading"><div><p className="eyebrow">THE REQUEST</p><h2>Requirement details</h2></div><span className="detail-date"><CalendarDays size={14} />{new Date(lead.createdAt).toLocaleDateString()}</span></div><p className="requirement-text">{lead.requirement}</p><div className="context-grid"><div><span className="context-icon"><Sparkles size={15} /></span><span><small>Timeline</small><strong>{lead.timeline}</strong></span></div><div><span className="context-icon"><UserRound size={15} /></span><span><small>Detected budget</small><strong>{lead.detectedBudget || 'Not Specified'}</strong></span></div><div><span className="context-icon"><CalendarDays size={15} /></span><span><small>Source</small><strong>{lead.source || 'Website'}</strong></span></div></div></section>
          <section className="panel ai-panel"><div className="panel-heading"><div><p className="eyebrow">AI QUALIFICATION</p><h2>Signal, not a verdict</h2></div><Button variant="secondary" onClick={analyze} disabled={busy}>{busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}{busy ? 'Analyzing…' : lead.aiSummary ? 'Re-analyze' : 'Analyze lead'}</Button></div>{!lead.aiSummary ? <div className="ai-empty"><span><Bot size={20} /></span><p>Analyze the requirement to get a qualification score and a context-aware WhatsApp follow-up.</p></div> : <div className="ai-result"><div className="ai-score"><strong>{lead.aiScore}</strong><small>FIT SCORE <span>/ 100</span></small></div><div className="ai-summary"><div className="ai-intent"><span>Priority</span><strong>{lead.priority}</strong><PriorityBadge value={lead.priority} /></div><p>{lead.aiSummary}</p><div className="recommendation"><span><Sparkles size={14} /> WHATSAPP FOLLOW-UP</span><strong>{lead.suggestedWhatsAppMessage}</strong></div></div></div>}<p className="ai-disclaimer">AI output is a decision-support signal. Review before acting.</p></section>
          </>}
        <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">THE PAPER TRAIL</p><h2>Activity</h2></div><span className="activity-count">{activities.length} events</span></div><form className="note-form" onSubmit={addNote}><MessageSquareText size={16} /><input aria-label="Add activity note" placeholder="Add a note to this timeline…" value={note} onChange={(event) => setNote(event.target.value)} /><Button disabled={busy || !note.trim()}>Add note <ArrowRight size={14} /></Button></form>{activities.length ? <div className="timeline">{activities.map((entry) => <div className="timeline-item" key={entry._id}><span className={`timeline-dot timeline-${entry.type}`} /> <div><p>{entry.message}</p><small>{entry.actor?.name || (entry.type === 'webhook' ? 'Automation' : 'System')} <span>·</span> {new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div></div>)}</div> : <div className="small-empty">No activity recorded yet.</div>}</section>
      </div>
      <aside className="detail-side"><section className="panel contact-panel"><p className="eyebrow">CONTACT</p><div className="contact-summary"><span className="contact-avatar contact-avatar-large">{lead.name[0]}</span><div><strong>{lead.name}</strong><small>Inquiry</small></div></div>{lead.email && <a href={`mailto:${lead.email}`}><Mail size={15} /><span>{lead.email}</span></a>}{lead.phone && <a href={`tel:${lead.phone}`}><Phone size={15} /><span>{lead.phone}</span></a>}<span className="whatsapp-action-wrap" title={!whatsappPhone ? 'No phone number available' : undefined}><button className="whatsapp-action" onClick={startWhatsAppChat} disabled={!whatsappPhone || whatsappBusy}><MessageCircle size={17} />{whatsappBusy ? 'Opening WhatsApp…' : 'Chat on WhatsApp'}</button></span>{lead.status === 'NEW' && showContactedSuggestion && <div className="contacted-suggestion"><span>Move this lead to Contacted?</span><div><button onClick={markContacted} disabled={statusUpdating}>{statusUpdating ? 'Updating…' : 'Mark Contacted'}</button><button onClick={() => setShowContactedSuggestion(false)}>Not now</button></div></div>}<div className="contact-separator" /><div className="side-status"><span>Pipeline status</span><StatusBadge value={lead.status} /></div><div className="side-status"><span>Priority</span><PriorityBadge value={lead.priority} /></div><div className="side-score"><span>AI score</span><strong>{lead.aiScore}/100</strong></div></section><section className="next-step-note"><Clock3 size={17} /><p><strong>Keep the conversation moving.</strong><span>A quick, personal response is usually the best next step.</span></p></section></aside>
    </div>
  </>;
}