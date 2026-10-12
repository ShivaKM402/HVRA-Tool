/**
 * Persistent Navigation Shell (HVRA §4)
 * Contains Topbar with District Switcher, Role Badge, Notification Bell,
 * Command Palette (Ctrl+K), Sidebar with all modules, and Clickable Breadcrumb bar.
 */
import { Outlet, NavLink, useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDistrict } from '../../context/DistrictContext';
import { useToast } from '../../context/ToastContext';
import CommandPalette from '../CommandPalette/CommandPalette';
import OnboardingTour from '../OnboardingTour/OnboardingTour';
import ToastStack from '../Toast/ToastStack';
import AIPanel from '../AI/AIPanel';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { districts, activeDistrictId, setActiveDistrictId } = useDistrict();
  const { unreadCount } = useToast();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState(false);


  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Build clickable breadcrumbs based on route
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/dashboard') return null;

    const crumbs: { label: string; to: string }[] = [
      { label: 'Dashboard', to: '/dashboard' },
    ];

    if (path.startsWith('/new-assessment')) {
      const m = searchParams.get('module') || 'HAZARD';
      crumbs.push({ label: `${m} Assessment (Query Builder)`, to: `${path}?module=${m}` });
    } else if (path.startsWith('/assessments') || path.startsWith('/risk-assessments')) {
      crumbs.push({ label: 'Assessments', to: '/reports' });
      if (path.includes('/results')) {
        const tab = searchParams.get('tab') || 'map';
        crumbs.push({ label: `Results (${tab.toUpperCase()})`, to: `${path}?tab=${tab}` });
      } else if (path.includes('/report')) {
        crumbs.push({ label: 'Dossier Report View', to: path });
      } else if (path.includes('/processing')) {
        crumbs.push({ label: 'Processing State', to: path });
      }
    } else if (path === '/review-queue') {
      crumbs.push({ label: 'Task Force Review Queue', to: '/review-queue' });
    } else if (path === '/saved-queries') {
      crumbs.push({ label: 'Saved Queries & Templates', to: '/saved-queries' });
    } else if (path === '/risk-builder') {
      crumbs.push({ label: 'Composite Risk Builder', to: '/risk-builder' });
    } else if (path === '/data-library') {
      crumbs.push({ label: 'Data Library & Catalog', to: '/data-library' });
    } else if (path === '/reports') {
      crumbs.push({ label: 'Reports Gallery', to: '/reports' });
    } else if (path === '/dashboard/compare') {
      crumbs.push({ label: 'Compare Dashboards', to: '/dashboard/compare' });
    } else if (path === '/admin-units') {
      crumbs.push({ label: 'Administrative Unit Explorer', to: '/admin-units' });
    } else if (path === '/settings') {
      crumbs.push({ label: 'Admin & System Settings', to: '/settings' });
    } else if (path === '/profile') {
      crumbs.push({ label: 'User Profile', to: '/profile' });
    } else if (path === '/notifications') {
      crumbs.push({ label: 'Notification Center', to: '/notifications' });
    } else if (path === '/help') {
      crumbs.push({ label: 'Help & Compliance', to: '/help' });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="app-layout">
      {/* Google-Style Two-Tier Clean Console Header */}
      <header className="google-header-container">
        {/* Tier 1: System Bar (Brand, District Context, Global Search, Actions, Profile) */}
        <div className="google-top-bar">
          <div className="google-top-left">
            <Link to="/dashboard" className="google-brand">
              <div className="google-brand-icon">🌊</div>
              <span className="google-brand-title">HVRA Flood Portal</span>
            </Link>

            {/* Context Switcher for District */}
            <div className="district-switcher">
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📍</span>
              <select
                className="district-select"
                value={activeDistrictId || ''}
                onChange={(e) => setActiveDistrictId(e.target.value ? parseInt(e.target.value, 10) : null)}
                title="Switch territory"
              >
                <option value="">All Kerala Districts</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} District</option>
                ))}
              </select>
            </div>
          </div>

          <div className="google-top-center">
            {/* Quick Search Trigger */}
            <button
              className="cmd-trigger-btn"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Global search (Ctrl+K)"
            >
              <span>🔍 Search assessments, taluks, indicators...</span>
              <kbd className="cmd-kbd">Ctrl+K</kbd>
            </button>
          </div>

          <div className="google-top-right">
            {/* AI Assistant */}
            <AIPanel />

            {/* Notification Center */}
            <Link to="/notifications" className="topbar-icon-btn" title="Notification Center">
              🔔
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </Link>

            {/* Primary Action Button */}
            <NavLink to="/new-assessment?module=HAZARD" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
              + New Assessment
            </NavLink>

            {/* Profile / Auth Menu */}
            {isAuthenticated && user ? (
              <div style={{ position: 'relative' }}>
                <button
                  className="user-profile-btn"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                >
                  <span className="user-avatar">
                    {(user.first_name?.[0] || user.username[0] || 'U').toUpperCase()}
                  </span>
                  <span className="user-name">
                    {user.first_name || user.username}
                  </span>
                  <span style={{ fontSize: '0.7rem' }}>▾</span>
                </button>

                {profileMenuOpen && (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-header">
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {user.first_name || user.username} {user.last_name || ''}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        @{user.username}
                      </div>
                      <div className="badge badge-info" style={{ fontSize: '0.68rem', marginTop: '0.4rem' }}>
                        {user.profile?.role_label || user.profile?.role || (isAdmin ? 'Platform Admin' : 'Officer')}
                      </div>
                    </div>
                    <div style={{ padding: '0.35rem' }}>
                      <Link
                        to="/profile"
                        className="dropdown-item"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        👤 View Profile & Jurisdiction
                      </Link>
                      <Link
                        to="/review-queue"
                        className="dropdown-item"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        🏛️ Task Force Review Queue
                      </Link>
                      <button
                        className="dropdown-item"
                        style={{ color: '#dc2626', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onClick={handleLogout}
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    fontWeight: 600,
                  }}
                  title="Operating in local prototype demo mode"
                >
                  ⚡ Prototype
                </span>
                <NavLink to="/login" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                  🔐 Sign In
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Navigation Bar (Module Tabs & Inline Breadcrumbs) */}
        <div className="google-nav-bar">
          <nav className="google-nav-links">
            <NavLink to="/dashboard" className={({ isActive }) => `google-nav-item${isActive ? ' active' : ''}`}>
              Dashboard
            </NavLink>

            <NavLink
              to="/new-assessment?module=HAZARD"
              className={({ isActive }) =>
                `google-nav-item${isActive && location.pathname === '/new-assessment' ? ' active' : ''}`
              }
            >
              Flood Assessments
            </NavLink>

            <NavLink
              to="/assessments/86/results?tab=coordination"
              className={({ isActive }) =>
                `google-nav-item${isActive || (location.pathname.includes('/assessments') && location.search.includes('tab=coordination')) ? ' active' : ''}`
              }
              title="Department Data Coordination (Water Resources, LSGD, PWD, Health, Economics & Statistics)"
            >
              🏛️ Dept Coordination
            </NavLink>

            <NavLink to="/risk-builder" className={({ isActive }) => `google-nav-item${isActive ? ' active' : ''}`}>
              Risk Builder
            </NavLink>

            <NavLink to="/data-library" className={({ isActive }) => `google-nav-item${isActive ? ' active' : ''}`}>
              Data Library
            </NavLink>
            
            <NavLink to="/reports" className={({ isActive }) => `google-nav-item${isActive ? ' active' : ''}`}>
              Reports
            </NavLink>
            
            {isAdmin && (
              <NavLink to="/settings" className={({ isActive }) => `google-nav-item${isActive ? ' active' : ''}`}>
                Settings
              </NavLink>
            )}
          </nav>

          {/* Inline Breadcrumb Trail */}
          {breadcrumbs && (
            <div className="google-nav-breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => (
                <span key={crumb.to} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  {idx > 0 && <span className="breadcrumb-separator">/</span>}
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="breadcrumb-current">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.to} className="breadcrumb-link">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {/* Global Modals & Toast Stack */}
      <ToastStack />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <OnboardingTour
        isOpen={isOnboardingTourOpen}
        onClose={() => setIsOnboardingTourOpen(false)}
      />
    </div>
  );
}
