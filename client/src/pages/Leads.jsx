import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, MessageCircle, Search, SlidersHorizontal, UsersRound } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/useAuth';
import { EmptyState, PageHeader, PriorityBadge } from '../components/ui';
import { useToast } from '../components/useToast';
import { formatWhatsAppPhone, openLeadWhatsApp } from '../utils/whatsapp';

const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'LOST'];

export function Leads() {
  const { user } = useAuth();
  const notifications = useToast();
  const [result, setResult] = useState({ leads: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', source: '' });
  const [sources, setSources] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [assignmentIds, setAssignmentIds] = useState([]);
  const [awaitingActionCount, setAwaitingActionCount] = useState(0);

  useEffect(() => {
    api.get('/leads/meta').then(({ data }) => setSources(data.data.sources)).catch((requestError) => {
      const message = requestError.response?.data?.message || 'Lead options could not be loaded.';
      setError(message);
      notifications.error(message);
    });
  }, [notifications]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/users/employees')
      .then(({ data }) => setEmployees(data.data.employees))
      .catch((requestError) => {
        const message = requestError.response?.data?.message || 'Employees could not be loaded.';
        setError(message);
        notifications.error(message);
      });
  }, [notifications, user?.role]);

  useEffect(() => {
    let active = true;
    api.get('/leads', { params: { ...filters, page, limit: 10 } })
      .then(({ data }) => {
        if (!active) return;
        setResult(data.data);
        setSources((previous) => [...new Set([...previous, ...data.data.leads.map((lead) => lead.source).filter(Boolean)])]);
        setError('');
      })
      .catch((requestError) => {
        if (active) {
          const message = requestError.response?.data?.message || 'Leads could not be loaded.';
          setError(message);
          notifications.error(message);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, notifications, page]);

  useEffect(() => {
    if (user?.role !== 'employee') return undefined;
    let active = true;
    let initialized = false;
    let previousIds = new Set();
    const storageKey = `signaldesk-seen-assignments-${user.id}`;
    const pollAssignments = async () => {
      try {
        const { data } = await api.get('/leads', { params: { page: 1, limit: 100 } });
        if (!active) return;
        const openLeads = data.data.leads.filter((lead) => !['CLOSED', 'LOST'].includes(lead.status));
        const currentIds = new Set(openLeads.map((lead) => lead._id));
        setAwaitingActionCount(openLeads.length);
        let storedIds = [];
        try { storedIds = JSON.parse(window.localStorage.getItem(storageKey) || '[]'); } catch {}
        const newIds = [...currentIds].filter((id) => initialized ? !previousIds.has(id) : !storedIds.includes(id));
        if (newIds.length) {
          setAssignmentIds((current) => [...new Set([...current.filter((id) => currentIds.has(id)), ...newIds])]);
          notifications.info(`${newIds.length} new ${newIds.length === 1 ? 'lead has' : 'leads have'} been assigned to you.`);
        }
        previousIds = currentIds;
        initialized = true;
        window.localStorage.setItem(storageKey, JSON.stringify([...currentIds]));
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'Assigned leads could not be refreshed.');
      }
    };
    pollAssignments();
    const interval = window.setInterval(pollAssignments, 20000);
    return () => { active = false; window.clearInterval(interval); };
  }, [notifications, user?.id, user?.role]);

  function changeFilter(key, value) {
    setLoading(true);
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function changeStatus(lead, status) {
    setUpdatingId(lead._id);
    setError('');
    setResult((current) => ({ ...current, leads: current.leads.map((item) => item._id === lead._id ? { ...item, status } : item) }));
    try {
      const { data } = await api.patch(`/leads/${lead._id}`, { status });
      if (filters.status && filters.status !== status) {
        setResult((current) => ({ ...current, leads: current.leads.filter((item) => item._id !== lead._id), pagination: { ...current.pagination, total: Math.max(0, current.pagination.total - 1) } }));
      } else {
        setResult((current) => ({ ...current, leads: current.leads.map((item) => item._id === lead._id ? data.data.lead : item) }));
      }
    } catch (requestError) {
      setResult((current) => ({ ...current, leads: current.leads.map((item) => item._id === lead._id ? { ...item, status: lead.status } : item) }));
      const message = requestError.response?.data?.message || 'Status could not be changed.';
      setError(message);
      notifications.error(message);
    }
    finally { setUpdatingId(''); }
  }

  async function assignLead(lead, employeeId) {
    setUpdatingId(lead._id);
    setError('');
    try {
      const { data } = await api.patch(`/leads/${lead._id}/assign`, { employeeId: employeeId || null });
      setResult((current) => ({ ...current, leads: current.leads.map((item) => item._id === lead._id ? { ...item, assignedTo: data.data.lead.assignedTo } : item) }));
      const employee = employees.find((item) => item.id === employeeId);
      notifications.success(employee ? `Lead successfully assigned to ${employee.name}!` : 'Lead returned to the unassigned pool.');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Lead assignment could not be changed.';
      setError(message);
      notifications.error(message);
    }
    finally { setUpdatingId(''); }
  }

  function openWhatsApp(lead) {
    if (!openLeadWhatsApp(lead)) notifications.error('This lead does not have a valid phone number for WhatsApp.');
  }

  return <>
    <PageHeader eyebrow="THE INQUIRY INBOX" title="Leads" description={`${result.pagination.total} conversations, newest first.`} action={<Link className="button button-secondary" to="/">View public form <ArrowUpRight size={15} /></Link>} />
    {user?.role === 'employee' && <div className="assignment-summary"><span className="assignment-ping" /><span><strong>Newly Assigned</strong> ({awaitingActionCount} {awaitingActionCount === 1 ? 'lead' : 'leads'} awaiting action)</span></div>}
    <section className="panel leads-panel">
      <div className="filter-bar"><label className="search-field"><Search size={16} /><input aria-label="Search leads" placeholder="Search name, phone, or email" value={filters.search} onChange={(event) => changeFilter('search', event.target.value)} /><kbd>⌘ K</kbd></label><span className="filter-divider" /><SlidersHorizontal size={15} className="filter-icon" /><select aria-label="Filter by status" value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><select aria-label="Filter by priority" value={filters.priority} onChange={(event) => changeFilter('priority', event.target.value)}><option value="">All priorities</option>{['HOT', 'WARM', 'COLD'].map((priority) => <option key={priority}>{priority}</option>)}</select><select aria-label="Filter by source" value={filters.source} onChange={(event) => changeFilter('source', event.target.value)}><option value="">All sources</option>{sources.map((source) => <option key={source}>{source}</option>)}</select></div>
      {error && <div className="inline-error">{error}</div>}
      {loading ? <div className="loading-panel"><span className="spinner" /> Loading leads…</div> : result.leads.length ? <>
        <div className="table-scroll"><table><thead><tr><th>Contact</th>{user?.role === 'admin' && <th>Assignment</th>}<th>Source</th><th>Status</th><th>Priority</th><th>AI score</th><th>Received</th><th>WhatsApp</th><th /></tr></thead><tbody>{result.leads.map((lead) => <tr className={assignmentIds.includes(lead._id) ? 'assignment-row-new' : ''} key={lead._id}><td><Link className="contact-cell" to={`/app/leads/${lead._id}`}><span className="contact-avatar">{lead.name[0]}</span><span><strong>{lead.name}</strong><small>{lead.phone || lead.email}</small>{assignmentIds.includes(lead._id) && <span className="new-assignment-label"><i /> NEW ASSIGNMENT</span>}</span></Link></td>{user?.role === 'admin' && <td><div className="assignment-cell"><span className={`assignment-chip ${lead.assignedTo ? '' : 'assignment-chip-open'}`}>{lead.assignedTo ? `Assigned to ${lead.assignedTo.name}` : 'Unassigned (Pool)'}</span><select className="table-status assignment-select" aria-label={`Assign ${lead.name}`} value={lead.assignedTo?.id || lead.assignedTo?._id || ''} disabled={updatingId === lead._id} onChange={(event) => assignLead(lead, event.target.value)}><option value="">Unassigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div></td>}<td>{lead.source || '—'}</td><td><select className="table-status" aria-label={`Change ${lead.name} status`} value={lead.status} disabled={updatingId === lead._id} onChange={(event) => changeStatus(lead, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td><PriorityBadge value={lead.priority} /></td><td><span className={lead.aiScore >= 75 ? 'score score-high' : 'score'}>{lead.aiScore ?? '—'}{lead.aiScore != null && <small>/100</small>}</span></td><td>{new Date(lead.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><button className="row-link" type="button" aria-label={`Chat with ${lead.name} on WhatsApp`} title={!formatWhatsAppPhone(lead.phone) ? 'No valid phone number' : 'Open WhatsApp'} disabled={!formatWhatsAppPhone(lead.phone)} onClick={() => openWhatsApp(lead)}><MessageCircle size={15} /></button></td><td><Link className="row-link" to={`/app/leads/${lead._id}`} aria-label={`Open ${lead.name}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table></div>
        <div className="table-footer"><span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, result.pagination.total)} of {result.pagination.total} leads</span><div><button className="pagination-button" disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }} aria-label="Previous page"><ArrowLeft size={15} /></button><span>Page {page} of {Math.max(result.pagination.pages, 1)}</span><button className="pagination-button" disabled={page >= result.pagination.pages} onClick={() => { setLoading(true); setPage(page + 1); }} aria-label="Next page"><ArrowRight size={15} /></button></div></div>
      </> : <EmptyState title={filters.search || filters.status || filters.priority || filters.source ? 'No leads match these filters' : 'The inbox is ready'} description={filters.search || filters.status || filters.priority || filters.source ? 'Try adjusting your search or filters.' : 'New inquiries will arrive here from your public form or connected integrations.'} action={<Link to="/" className="text-link"><UsersRound size={15} /> Open the public inquiry form</Link>} />}
    </section>
  </>;
}