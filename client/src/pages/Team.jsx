import { useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, Trash2, UsersRound, X } from 'lucide-react';
import { api } from '../api';
import { Button, ErrorMessage, PageHeader } from '../components/ui';
import { useToast } from '../components/useToast';

const passwordCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

function generatePassword() {
  const values = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(values, (value) => passwordCharacters[value % passwordCharacters.length]).join('');
}

export function Team() {
  const notifications = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [toast, setToast] = useState('');

  async function loadStaff() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/users/staff');
      setStaff(data.data.staff);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    api.get('/users/staff').then(({ data }) => {
      if (active) setStaff(data.data.staff);
    }).catch((requestError) => {
      if (active) setError(requestError);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function addEmployee(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/users/employees', { name, email, temporaryPassword });
      setCredentials(data.data.delivery.sent ? null : data.data.credentials);
      if (data.data.delivery.sent) {
        setToast(`Employee registered! Welcome email with temporary credentials has been sent to ${data.data.employee.email}.`);
        notifications.success(`Employee registered! Welcome email with temporary credentials has been sent to ${data.data.employee.email}.`);
      } else {
        setToast('Employee created. (Note: Email service inactive - share credentials manually)');
        notifications.warning('Employee created. (Note: Email service inactive - share credentials manually)');
      }
      window.setTimeout(() => setToast(''), 4500);
      setModalOpen(false);
      setName('');
      setEmail('');
      setTemporaryPassword('');
      await loadStaff();
    } catch (requestError) { setError(requestError); }
    finally { setSaving(false); }
  }

  async function removeEmployee(employee) {
    if (!window.confirm(`Remove ${employee.name} from the team? Assigned leads will return to the unassigned queue.`)) return;
    setError(null);
    try {
      await api.delete(`/users/employees/${employee.id}`);
      setToast(`${employee.name} was removed from the team.`);
      notifications.success(`${employee.name} was removed from the team.`);
      window.setTimeout(() => setToast(''), 4500);
      await loadStaff();
    } catch (requestError) { setError(requestError); }
  }

  return <>
    <PageHeader eyebrow="WORKSPACE ACCESS" title="Team" description="Manage the staff accounts that can access this workspace." action={<Button onClick={() => { setError(null); setModalOpen(true); }}><Plus size={15} /> Add employee</Button>} />
    {toast && <div className={`team-toast ${credentials ? 'team-toast-warning' : ''}`} role="status">{toast}</div>}
    <ErrorMessage error={error} />
    {credentials && <div className="team-credentials" role="status"><KeyRound size={17} /><div><strong>Share the temporary credentials securely</strong><span>{credentials.email}</span><code>{credentials.temporaryPassword}</code></div><button className="icon-button" onClick={() => setCredentials(null)} aria-label="Dismiss credentials"><X size={16} /></button></div>}
    <section className="panel team-panel">
      <div className="panel-heading"><div><p className="eyebrow">STAFF DIRECTORY</p><h2>{staff.length} {staff.length === 1 ? 'account' : 'accounts'}</h2></div><button className="icon-button" onClick={loadStaff} aria-label="Refresh team list"><RefreshCw size={15} className={loading ? 'spin' : ''} /></button></div>
      {loading ? <div className="loading-panel"><span className="spinner" /> Loading team…</div> : staff.length ? <div className="table-scroll"><table className="team-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th /></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td><span className="team-name"><span className="contact-avatar">{member.name?.[0]}</span><strong>{member.name}</strong></span></td><td>{member.email}</td><td><span className={`team-role team-role-${member.role}`}>{member.role}</span></td><td>{new Date(member.createdAt).toLocaleDateString()}</td><td>{member.role === 'employee' && <button className="icon-button team-remove" onClick={() => removeEmployee(member)} aria-label={`Remove ${member.name}`} title="Remove employee"><Trash2 size={15} /></button>}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-mark"><UsersRound size={17} /></span><h3>No staff accounts</h3><p>Add an employee to give them access to assigned leads.</p></div>}
    </section>
    {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title"><div className="modal-heading"><div><p className="eyebrow">TEAM ACCESS</p><h2 id="employee-modal-title">Add employee</h2></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close dialog"><X size={18} /></button></div><form className="auth-form" onSubmit={addEmployee}><div><label htmlFor="employee-name">Employee name</label><input id="employee-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="100" required /></div><div><label htmlFor="employee-email">Email address</label><input id="employee-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength="254" required /></div><div><label htmlFor="employee-password">Temporary password</label><div className="password-helper"><input id="employee-password" type="text" autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength="8" maxLength="128" required /><button type="button" className="button button-secondary" onClick={() => setTemporaryPassword(generatePassword())}>Generate</button></div></div><ErrorMessage error={error} /><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? 'Sending credentials…' : 'Create employee'}</Button></div></form></section></div>}
  </>;
}