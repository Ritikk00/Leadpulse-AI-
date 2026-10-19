import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
    {action}
  </div>;
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function StatusBadge({ value }) {
  return <span className={`badge badge-${String(value).toLowerCase()}`}>{value}</span>;
}

export function PriorityBadge({ value }) {
  return <span className={`priority priority-${String(value).toLowerCase()}`}><i />{value || 'Unscored'}</span>;
}

export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><span className="empty-mark">+</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function LeadLink({ lead, children }) {
  return <Link to={`/app/leads/${lead._id}`} className="lead-link">{children}<ArrowUpRight size={14} /></Link>;
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  return <div className="form-error" role="alert">{error.response?.data?.message || error.message || 'Something went wrong. Please try again.'}</div>;
}