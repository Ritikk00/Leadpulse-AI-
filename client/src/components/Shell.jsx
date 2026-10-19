import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, BookOpenText, ChevronDown, CircleHelp, Command, LayoutDashboard, LogOut, Menu, Settings as SettingsIcon, UsersRound, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/useAuth';

const navItems = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/leads', label: 'Leads', icon: UsersRound },
  { to: '/app/team', label: 'Team', icon: UsersRound, adminOnly: true },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/app/api-docs', label: 'API & webhooks', icon: BookOpenText }
];

export function Shell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const visibleNavItems = navItems.filter((item) => (!item.adminOnly || user?.role === 'admin') && (user?.role === 'admin' || item.to === '/app/leads'));
  const current = visibleNavItems.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)) || (location.pathname === '/app/profile' ? { label: 'Profile' } : null);

  async function handleLogout() {
    await logout();
    navigate('/portal/login');
  }

  return <div className="workspace">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand animate-brand-reveal"><span className="brand-mark"><Activity size={19} strokeWidth={2.4} /></span><span>LeadPulse <span className="brand-light">AI</span></span><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">{user?.name?.[0]?.toUpperCase() || 'W'}</span><span><strong>{user?.name?.split(' ')[0]}'s workspace</strong><small>Starter plan</small></span><ChevronDown size={15} /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav className="side-nav" aria-label="Workspace navigation">
        {visibleNavItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Leads' && user?.role === 'admin' && <span className="nav-accelerator"><Command size={11} /> L</span>}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="note-icon"><CircleHelp size={16} /></span><span><strong>Need a hand?</strong><small>Explore the starter docs</small></span><ArrowUpRight size={14} /></div>
        <div className="sidebar-user"><span className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</span><span className="user-meta"><strong>{user?.name}</strong><small>{user?.email}</small></span><div className="user-menu-wrap"><button className="icon-button" aria-label="Account menu" onClick={() => setMenuOpen(!menuOpen)}><ChevronDown size={16} /></button>{menuOpen && <div className="user-menu"><NavLink to="/app/profile" onClick={() => setMenuOpen(false)}>Your profile</NavLink><button onClick={handleLogout}><LogOut size={14} /> Sign out</button></div>}</div></div>
      </div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{current?.label || 'Lead details'}</strong></div><div className="topbar-right"><span className="live-indicator"><i /> All systems normal</span><button className="topbar-avatar" onClick={() => navigate('/app/profile')} aria-label="Open profile">{user?.name?.[0]?.toUpperCase()}</button></div></header>
      <main className="page-content"><Outlet /></main>
    </div>
  </div>;
}