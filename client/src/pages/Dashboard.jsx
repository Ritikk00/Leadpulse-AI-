import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CircleHelp, Clock3, Download, Flame, MessageCircle, RefreshCw, Sparkles, UsersRound } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/useAuth';
import { EmptyState, PageHeader, PriorityBadge, StatusBadge } from '../components/ui';
import { useToast } from '../components/useToast';
import { formatWhatsAppPhone, openLeadWhatsApp } from '../utils/whatsapp';

const money = new Intl.NumberFormat('en-US');
function Metric({ label, value, icon: Icon, tone, detail }) {
  return <article className="metric"><div className="metric-top"><span className={`metric-icon metric-${tone}`}><Icon size={17} /></span><span className="metric-detail">{detail}</span></div><p className="metric-label">{label}</p><div className="metric-bottom"><strong>{money.format(value ?? 0)}{label === 'Conversion' ? '%' : ''}</strong></div></article>;
}

export function Dashboard() {
  const { user } = useAuth();
  const notifications = useToast();
  const [data, setData] = useState(null);
  const [activityLeads, setActivityLeads] = useState(null);
  const [tableLeads, setTableLeads] = useState([]);
  const [tablePagination, setTablePagination] = useState({ page: 1, pages: 1, total: 0 });
  const [leadFilter, setLeadFilter] = useState('all');
  const [leadPage, setLeadPage] = useState(1);
  const [leadListLoading, setLeadListLoading] = useState(true);
  const [leadListError, setLeadListError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [leadReload, setLeadReload] = useState(0);
  const [updatedLeadIds, setUpdatedLeadIds] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    try { const response = await api.get('/dashboard'); setData(response.data.data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Dashboard could not be loaded.'); }
    finally { setLoading(false); }
  }
  function refresh() { setError(''); setLoading(true); setLeadListLoading(true); setLeadListError(''); setLeadReload((current) => current + 1); load(); }
  useEffect(() => {
    api.get('/dashboard')
      .then(({ data: response }) => setData(response.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Dashboard could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/leads', { params: { page: leadPage, limit: 20, ...(leadFilter === 'due' ? { followUpDue: 'true' } : {}) } })
      .then(({ data: response }) => {
        if (!active) return;
        setTableLeads(response.data.leads);
        setTablePagination(response.data.pagination);
      })
      .catch((requestError) => { if (active) setLeadListError(requestError.response?.data?.message || 'Leads could not be loaded.'); })
      .finally(() => { if (active) setLeadListLoading(false); });
    return () => { active = false; };
  }, [leadFilter, leadPage, leadReload]);

  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    let active = true;
    let polling = false;
    let since = new Date().toISOString();
    const seenUpdateIds = new Set();
    const pollStatusUpdates = async () => {
      if (polling) return;
      polling = true;
      const checkedAt = new Date().toISOString();
      try {
        const { data: response } = await api.get('/leads/status-updates', { params: { since } });
        if (!active) return;
        since = checkedAt;
        const updates = response.data.updates.filter((update) => !seenUpdateIds.has(update.id));
        for (const update of updates) {
          seenUpdateIds.add(update.id);
          if (seenUpdateIds.size > 500) seenUpdateIds.delete(seenUpdateIds.values().next().value);
        }
        if (!updates.length) return;
        const updatedIds = new Set(updates.map((update) => update.leadId));
        setTableLeads((current) => current.map((lead) => updatedIds.has(lead._id) ? { ...lead, status: 'CONTACTED' } : lead));
        setActivityLeads((current) => current?.map((lead) => updatedIds.has(lead._id) ? { ...lead, status: 'CONTACTED' } : lead));
        notifications.info(updates.map((update) => `${update.leadName} was marked Contacted by ${update.actorName}.`).join(' '));
        setLeadReload((current) => current + 1);
        try {
          const { data: dashboardResponse } = await api.get('/dashboard');
          if (active) setData(dashboardResponse.data);
        } catch (requestError) {
          if (active) setError(requestError.response?.data?.message || 'Dashboard could not be refreshed.');
        }
      } catch (requestError) {
        if (active) setLeadListError(requestError.response?.data?.message || 'Lead status updates could not be refreshed.');
      } finally {
        polling = false;
      }
    };
    pollStatusUpdates();
    const interval = window.setInterval(pollStatusUpdates, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [notifications, user?.role]);

  useEffect(() => {
    let active = true;
    const previousUpdates = new Map();
    const recentlyUpdated = new Map();
    const refreshActivity = async () => {
      try {
        const { data: response } = await api.get('/leads', { params: { page: 1, limit: 100 } });
        if (!active) return;
        const leads = response.data.leads;
        for (const lead of leads) {
          const currentUpdatedAt = new Date(lead.updatedAt).getTime();
          if (previousUpdates.has(lead._id) && previousUpdates.get(lead._id) !== currentUpdatedAt) recentlyUpdated.set(lead._id, Date.now());
          previousUpdates.set(lead._id, currentUpdatedAt);
        }
        for (const [id, changedAt] of recentlyUpdated) if (Date.now() - changedAt > 30 * 60 * 1000) recentlyUpdated.delete(id);
        setUpdatedLeadIds([...recentlyUpdated.keys()]);
        setActivityLeads([...leads].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)).slice(0, 6));
      } catch (requestError) {
        if (active) setLeadListError(requestError.response?.data?.message || 'Recent lead activity could not be refreshed.');
      }
    };
    refreshActivity();
    const interval = window.setInterval(refreshActivity, 20000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const metrics = data?.metrics;
  const maxStatus = Math.max(1, ...(data?.byStatus || []).map((item) => item.count));
  const maxSource = Math.max(1, ...(data?.sources || []).map((item) => item.count));
  const maxDaily = Math.max(1, ...(data?.dailyLeads || []).map((item) => item.count));
  const recentLeads = activityLeads ?? data?.recentLeads ?? [];

  async function exportLeads() {
    const columns = [
      ['Name', (lead) => lead.name],
      ['Phone', (lead) => lead.phone],
      ['Email', (lead) => lead.email],
      ['Requirement', (lead) => lead.requirement],
      ['Timeline', (lead) => lead.timeline],
      ['Status', (lead) => lead.status],
      ['Priority', (lead) => lead.priority],
      ['AI Score', (lead) => lead.aiScore],
      ['Detected Budget', (lead) => lead.detectedBudget],
      ['AI Summary', (lead) => lead.aiSummary],
      ['Follow-up Count', (lead) => lead.followUpCount],
      ['Last Contacted At', (lead) => lead.lastContactedAt]
    ];
    const escapeCell = (value) => {
      let text = value == null ? '' : String(value);
      if (/^[\t\r\n =+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    setExporting(true);
    setLeadListError('');
    try {
      const exportedLeads = [];
      let page = 1;
      let pages = 1;
      do {
        const { data: response } = await api.get('/leads', {
          params: { page, limit: 100, ...(leadFilter === 'due' ? { followUpDue: 'true' } : {}) }
        });
        exportedLeads.push(...response.data.leads);
        pages = response.data.pagination.pages;
        page += 1;
      } while (page <= pages);
      const csv = [columns.map(([title]) => escapeCell(title)).join(','), ...exportedLeads.map((lead) => columns.map(([, value]) => escapeCell(value(lead))).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `leadpulse-${leadFilter === 'due' ? 'follow-ups-due' : 'leads'}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setLeadListError(requestError.response?.data?.message || 'The CSV export could not be completed.');
    } finally {
      setExporting(false);
    }
  }

  function openFollowUpWhatsApp(lead) {
    if (!openLeadWhatsApp(lead)) return;
    api.post(`/leads/${lead._id}/whatsapp`, { followUp: true })
      .then(() => {
        setLeadListLoading(true);
        setData((current) => current ? { ...current, metrics: { ...current.metrics, followUpsDue: Math.max(0, current.metrics.followUpsDue - 1) } } : current);
        const nextPage = Math.max(1, Math.ceil(Math.max(0, tablePagination.total - 1) / 20));
        if (nextPage !== leadPage) setLeadPage(nextPage);
        else setLeadReload((current) => current + 1);
      })
      .catch((requestError) => setLeadListError(requestError.response?.data?.message || 'WhatsApp opened, but the follow-up could not be recorded.'));
  }

  function changeLeadFilter(filter) {
    if (filter === leadFilter) return;
    setLeadListLoading(true);
    setLeadListError('');
    setLeadPage(1);
    setLeadFilter(filter);
  }

  function changeLeadPage(page) {
    setLeadListLoading(true);
    setLeadListError('');
    setLeadPage(page);
  }

  return <>
    <PageHeader eyebrow="YOUR PIPELINE AT A GLANCE" title="Overview" description="A clear view of every conversation in motion." action={<button className="button button-secondary" onClick={refresh}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>} />
    {error && <div className="inline-error"><CircleHelp size={16} />{error}<button onClick={refresh}>Try again</button></div>}
    {loading && !data ? <div className="loading-panel"><span className="spinner" /> Loading your pipeline…</div> : <>
      <section className="metric-grid" aria-label="Lead metrics">
        <Metric label="Total leads" value={metrics?.total} icon={UsersRound} tone="mint" detail="All time" />
        <Metric label="Hot leads" value={metrics?.highPriority} icon={Flame} tone="coral" detail="AI score 75+" />
        <Metric label="Average AI score" value={metrics?.averageAiScore} icon={Sparkles} tone="blue" detail="Across all leads" />
        <Metric label="Follow-ups due" value={metrics?.followUpsDue} icon={Clock3} tone="yellow" detail="Contacted 48+ hours ago" />
      </section>
      <section className="metric-grid metric-grid-secondary">
        <Metric label="High priority" value={metrics?.highPriority} icon={ArrowUpRight} tone="coral" detail="Act with urgency" />
        <Metric label="This week" value={metrics?.thisWeek} icon={Clock3} tone="blue" detail="Last 7 days" />
        <Metric label="Lost" value={metrics?.lost} icon={ArrowDownRight} tone="neutral" detail="Closed lost" />
        <Metric label="Qualification" value={metrics?.conversion} icon={ArrowUpRight} tone="mint" detail="Qualified / all leads" />
      </section>
      <div className="dashboard-columns">
        <section className="panel pipeline-panel"><div className="panel-heading"><div><p className="eyebrow">PIPELINE</p><h2>Lead status</h2></div><Link to="/app/leads">View leads <ArrowRight size={14} /></Link></div>
          {(data?.byStatus || []).every((item) => item.count === 0) ? <EmptyState title="The pipeline starts here" description="New inquiries will show up here as soon as they arrive." action={<Link className="text-link" to="/app/leads">Open lead inbox <ArrowRight size={14} /></Link>} /> : <div className="pipeline-bars">{(data?.byStatus || []).map((item, index) => <div className="pipeline-row" key={item.status}><span className="pipeline-name">{item.status}</span><div className="bar-track"><span className={`bar-fill bar-color-${index}`} style={{ width: `${Math.max(item.count ? 8 : 0, (item.count / maxStatus) * 100)}%` }} /></div><strong>{item.count}</strong></div>)}</div>}
          <div className="week-strip"><span>LAST 7 DAYS</span><div>{(data?.dailyLeads || []).map((day) => <div className="week-day" key={day.date} title={`${day.count} leads`}><i style={{ height: `${Math.max(day.count ? 8 : 0, (day.count / maxDaily) * 100)}%` }} /><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>)}</div><strong>{metrics?.thisWeek || 0}</strong></div>
        </section>
        <section className="panel source-panel"><div className="panel-heading"><div><p className="eyebrow">ORIGIN</p><h2>Lead sources</h2></div><span className="muted-icon"><UsersRound size={17} /></span></div>
          {!(data?.sources?.length) ? <div className="small-empty">Sources appear as leads come in.</div> : <div className="source-list">{data.sources.map((source, index) => <div className="source-row" key={source._id}><span className={`source-dot source-dot-${index}`} /><span>{source._id}</span><strong>{source.count}</strong><div className="source-track"><i style={{ width: `${(source.count / maxSource) * 100}%` }} /></div></div>)}</div>}
          <div className="source-note"><span><Clock3 size={14} /> Updated just now</span><span>All sources <ArrowUpRight size={13} /></span></div>
        </section>
      </div>
      <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent leads</h2></div><Link to="/app/leads">Open inbox <ArrowRight size={14} /></Link></div>
        {recentLeads.length ? <div className="table-scroll"><table><thead><tr><th>Contact</th><th>Assignment</th><th>Status</th><th>Activity</th><th>Priority</th><th>Score</th><th>Received</th><th>WhatsApp</th><th /></tr></thead><tbody>{recentLeads.map((lead) => <tr key={lead._id}><td><Link className="contact-cell" to={`/app/leads/${lead._id}`}><span className="contact-avatar">{lead.name?.[0]}</span><span><strong>{lead.name}</strong><small>{lead.phone || lead.email}</small></span></Link></td><td>{lead.assignedTo?.name ? `Assigned to ${lead.assignedTo.name}` : 'Unassigned (Pool)'}</td><td><StatusBadge value={lead.status} /></td><td>{updatedLeadIds.includes(lead._id) ? <span className="activity-updated-chip">Activity Updated</span> : <span className="activity-quiet">No recent change</span>}</td><td><PriorityBadge value={lead.priority} /></td><td>{lead.aiScore == null ? '—' : lead.aiScore}</td><td>{new Date(lead.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td><td><button className="row-link" type="button" aria-label={`Chat with ${lead.name} on WhatsApp`} title={!formatWhatsAppPhone(lead.phone) ? 'No valid phone number' : 'Open WhatsApp'} disabled={!formatWhatsAppPhone(lead.phone)} onClick={() => openLeadWhatsApp(lead)}><MessageCircle size={15} /></button></td><td><Link className="row-link" to={`/app/leads/${lead._id}`} aria-label={`View ${lead.name}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="No leads yet" description="Once a visitor submits your form, their inquiry appears in this inbox." action={<Link to="/" className="text-link">View public form <ArrowRight size={14} /></Link>} />}
      </section>
      <section className="panel recent-panel dashboard-lead-list">
        <div className="panel-heading"><div><p className="eyebrow">LEAD WORKSPACE</p><h2>{leadFilter === 'due' ? 'Follow-up due' : 'Current leads'}</h2></div><button className="button button-secondary" type="button" onClick={exportLeads} disabled={!tablePagination.total || exporting}>{exporting ? <><span className="spinner" /> Exporting…</> : <><Download size={15} /> Export CSV</>}</button></div>
        <div className="dashboard-leads-toolbar">
          <div className="dashboard-lead-tabs" role="group" aria-label="Filter dashboard leads">
            <button className={leadFilter === 'all' ? 'dashboard-lead-tab is-active' : 'dashboard-lead-tab'} type="button" onClick={() => changeLeadFilter('all')}>All leads</button>
            <button className={leadFilter === 'due' ? 'dashboard-lead-tab is-active' : 'dashboard-lead-tab'} type="button" onClick={() => changeLeadFilter('due')}>Follow-Up Due ({metrics?.followUpsDue || 0})</button>
          </div>
          <span className="dashboard-lead-count">{tablePagination.total} leads</span>
        </div>
        {leadListError && <div className="inline-error">{leadListError}</div>}
        {leadListLoading ? <div className="loading-panel"><span className="spinner" /> Loading leads…</div> : tableLeads.length ? <><div className="table-scroll"><table><thead><tr><th>Contact</th><th>Requirement</th><th>Status</th><th>Priority</th><th>AI score</th><th>Follow-ups</th><th>Last contacted</th><th>WhatsApp</th></tr></thead><tbody>{tableLeads.map((lead) => <tr key={lead._id}><td><Link className="contact-cell" to={`/app/leads/${lead._id}`}><span className="contact-avatar">{lead.name?.[0]}</span><span><strong>{lead.name}</strong><small>{lead.phone}</small></span></Link></td><td title={lead.requirement}>{lead.requirement?.slice(0, 55)}{lead.requirement?.length > 55 ? '…' : ''}</td><td><StatusBadge value={lead.status} /></td><td><PriorityBadge value={lead.priority} /></td><td>{lead.aiScore ?? '—'}</td><td>{lead.followUpCount || 0}</td><td>{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : '—'}</td><td><button className="row-link" type="button" aria-label={`Chat with ${lead.name} on WhatsApp`} title={!formatWhatsAppPhone(lead.phone) ? 'No valid phone number' : 'Open WhatsApp'} disabled={!formatWhatsAppPhone(lead.phone)} onClick={() => leadFilter === 'due' ? openFollowUpWhatsApp(lead) : openLeadWhatsApp(lead)}><MessageCircle size={15} /></button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing {(tablePagination.page - 1) * 20 + 1}–{Math.min(tablePagination.page * 20, tablePagination.total)} of {tablePagination.total}</span><div><button className="row-link" type="button" aria-label="Previous leads page" disabled={tablePagination.page <= 1} onClick={() => changeLeadPage(tablePagination.page - 1)}><ArrowLeft size={15} /></button><span>Page {tablePagination.page} of {tablePagination.pages}</span><button className="row-link" type="button" aria-label="Next leads page" disabled={tablePagination.page >= tablePagination.pages} onClick={() => changeLeadPage(tablePagination.page + 1)}><ArrowRight size={15} /></button></div></div></> : <EmptyState title={leadFilter === 'due' ? 'No follow-ups are due' : 'No leads yet'} description={leadFilter === 'due' ? 'Contacted leads become due again after 48 hours.' : 'New inquiries will appear here as they arrive.'} />}
      </section>
      <div className="dashboard-footnote"><span><Sparkles size={15} /> AI qualification can add a score and next-step suggestion to each lead.</span><Link to="/app/api-docs">Connect an automation <ArrowRight size={14} /></Link></div>
    </>}
  </>;
}