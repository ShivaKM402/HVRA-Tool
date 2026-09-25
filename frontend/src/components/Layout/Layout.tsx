/**
 * Layout — Sidebar + Topbar + Main content
 */
import { Outlet, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard Home' },
  { path: '/new-assessment?module=HAZARD', icon: '🌊', label: 'Hazard Assessment', match: '/new-assessment', exactModule: 'HAZARD' },
  { path: '/new-assessment?module=VULNERABILITY', icon: '👥', label: 'Vulnerability Assessment', match: '/new-assessment', exactModule: 'VULNERABILITY' },
  { path: '/new-assessment?module=EXPOSURE', icon: '🏘️', label: 'Exposure Assessment', match: '/new-assessment', exactModule: 'EXPOSURE' },
  { path: '/new-assessment?module=COMPOSITE_RISK', icon: '⚖️', label: 'Risk Assessment (HVRA)', match: '/new-assessment', exactModule: 'COMPOSITE_RISK' },
  { path: '/flood-data', icon: '🗺️', label: 'Data Library' },
  { path: '/data-library', icon: '🗃️', label: 'Data Library (Uploads)', match: '/data-library' },
  { path: '/reports', icon: '📄', label: 'Report Generator' },
];

const settingsItems = [
  { path: '/libraries', icon: '📚', label: 'Libraries' },
  { path: '/settings', icon: '⚙️', label: 'Admin / Settings' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/new-assessment') {
      const m = searchParams.get('module') || 'HAZARD';
      const label =
        m === 'VULNERABILITY' ? 'Vulnerability'
          : m === 'EXPOSURE' ? 'Exposure'
            : m === 'COMPOSITE_RISK' ? 'Composite Risk'
              : 'Hazard';
      return `${label} Assessment – Query Builder`;
    }
    if (path === '/flood-data') return 'Flood Data';
    if (path.startsWith('/assessments')) return 'Report Generator';
    if (path === '/data-library') return 'Data Library';
    if (path === '/reports') return 'Report Generator';
    if (path === '/libraries') return 'Libraries';
    if (path === '/settings') return 'Admin / Settings';
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
          <div className="sidebar-section-label">Modules</div>
          {navItems.map((item) => {
            const isActive = item.exactModule
              ? location.pathname === item.match &&
                (searchParams.get('module') || 'HAZARD') === item.exactModule
              : location.pathname === item.path;
            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={() => `sidebar-nav-item${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-nav-item-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}

          {isAdmin && (
            <>
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
            </>
          )}
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
            {isAuthenticated && user ? (
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: isAdmin ? '#7c3aed' : '#2563eb',
                      color: '#fff', display: 'inline-flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700,
                    }}
                  >
                    {(user.first_name?.[0] || user.username[0] || 'U').toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {user.first_name || user.username}
                  </span>
                  <span style={{ fontSize: '0.7rem' }}>▾</span>
                </button>

                {menuOpen && (
                  <div
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                      background: '#fff', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                      border: '1px solid #e2e8f0', minWidth: 220, zIndex: 1200, overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {user.first_name || user.username} {user.last_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                        @{user.username} · {user.profile?.role_label || user.profile?.role || 'User'}
                      </div>
                      {isAdmin && (
                        <span className="badge badge-info" style={{ fontSize: '0.65rem', marginTop: '0.3rem' }}>
                          Platform Admin
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '0.4rem' }}>
                      {isAdmin && (
                        <NavLink
                          to="/libraries"
                          className="sidebar-nav-item"
                          style={{ borderRadius: 8, padding: '0.5rem 0.75rem' }}
                          onClick={() => setMenuOpen(false)}
                        >
                          📚 Libraries
                        </NavLink>
                      )}
                      {isAdmin && (
                        <NavLink
                          to="/settings"
                          className="sidebar-nav-item"
                          style={{ borderRadius: 8, padding: '0.5rem 0.75rem' }}
                          onClick={() => setMenuOpen(false)}
                        >
                          ⚙️ Settings
                        </NavLink>
                      )}
                      <button
                        className="sidebar-nav-item"
                        style={{
                          borderRadius: 8, padding: '0.5rem 0.75rem', width: '100%',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          textAlign: 'left', color: '#dc2626', fontWeight: 600, fontSize: '0.85rem',
                        }}
                        onClick={handleLogout}
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NavLink to="/login" className="btn btn-secondary btn-sm">
                🔐 Sign In
              </NavLink>
            )}
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
