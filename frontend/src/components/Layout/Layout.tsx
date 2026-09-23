/**
 * Layout — Sidebar + Topbar + Main content
 */
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import './Layout.css';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/flood-data', icon: '🌊', label: 'Flood Data' },
  { path: '/new-assessment', icon: '➕', label: 'New Assessment' },
  { path: '/assessments', icon: '📋', label: 'Assessments' },
  { path: '/data-library', icon: '🗃️', label: 'Data Library' },
  { path: '/reports', icon: '📄', label: 'Reports' },
];

const settingsItems = [
  { path: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/flood-data') return 'Flood Data';
    if (path === '/new-assessment') return 'New Assessment';
    if (path.startsWith('/assessments')) return 'Assessments';
    if (path === '/data-library') return 'Data Library';
    if (path === '/reports') return 'Reports';
    if (path === '/settings') return 'Settings';
    return 'HVRA Digital Tool';
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <div className="sidebar-brand-icon">🌊</div>
            <div>
              <div className="sidebar-brand-name">HVRA Tool</div>
            </div>
          </div>
          <div className="sidebar-brand-sub">Hazard Assessment Platform</div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item${isActive ? ' active' : ''}`
              }
            >
              <span className="sidebar-nav-item-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: '1rem' }}>System</div>
          {settingsItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item${isActive ? ' active' : ''}`
              }
            >
              <span className="sidebar-nav-item-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="prototype-badge">Prototype v1.0</span>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.5rem' }}>
            Phase 1 — Project Setup
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-title">{getPageTitle()}</div>
          <div className="topbar-actions">
            <div className="demo-notice" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
              <span>⚠️ DEMO DATA — Not official government data</span>
            </div>
            <NavLink to="/new-assessment" className="btn btn-primary btn-sm">
              + New Assessment
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
