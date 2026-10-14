/**
 * Persistent Navigation Shell (HVRA §4)
 * Contains Topbar with District Switcher, Role Badge, Notification Bell,
 * Command Palette (Ctrl+K), Sidebar with all modules, and Clickable Breadcrumb bar.
 */
import { Outlet, NavLink, useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDistrict } from '../../context/DistrictContext';
import { useHazard } from '../../context/HazardContext';
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
  const { activeHazard, activeHazardMeta, clearHazard } = useHazard();
  const { unreadCount } = useToast();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState(false);
  const [openNavDropdown, setOpenNavDropdown] = useState<'hazard' | 'dept' | 'data' | null>(null);

  // Close nav dropdown on route change
  useEffect(() => {
    setOpenNavDropdown(null);
  }, [location.pathname, location.search]);

  // Close nav dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.google-nav-dropdown-wrap')) {
        setOpenNavDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // If no hazard is selected and the user attempts to view an inner module directly, route them to /dashboard (the 4-column selection first page)
  useEffect(() => {
    if (
      !activeHazard &&
      location.pathname !== '/dashboard' &&
      !location.pathname.startsWith('/login') &&
      !location.pathname.startsWith('/register')
    ) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeHazard, location.pathname, navigate]);

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

    const prefix = activeHazardMeta ? `${activeHazardMeta.shortName} Portal` : 'Dashboard';
    const crumbs: { label: string; to: string }[] = [
      { label: prefix, to: activeHazard ? `/dashboard?hazard=${activeHazard}` : '/dashboard' },
    ];

    if (path.startsWith('/new-assessment')) {
      const m = searchParams.get('module') || 'HAZARD';
      crumbs.push({ label: `${m} Assessment (Query Builder)`, to: `${path}?module=${m}${activeHazard ? `&hazard=${activeHazard}` : ''}` });
    } else if (path.startsWith('/assessments') || path.startsWith('/risk-assessments')) {
      crumbs.push({ label: 'Assessments', to: `/reports${activeHazard ? `?hazard=${activeHazard}` : ''}` });
      if (path.includes('/results')) {
        const tab = searchParams.get('tab') || 'map';
        crumbs.push({ label: `Results (${tab.toUpperCase()})`, to: `${path}?tab=${tab}` });
      } else if (path.includes('/report')) {
        crumbs.push({ label: 'Dossier Report View', to: path });
      } else if (path.includes('/processing')) {
        crumbs.push({ label: 'Processing State', to: path });
      }
    } else if (path.startsWith('/issues')) {
      crumbs.push({ label: 'Field Incidents & 3-Tier Workflow', to: '/issues' });
    } else if (path === '/department-coordination' || path.includes('/coordination')) {
      crumbs.push({ label: `${activeHazardMeta ? activeHazardMeta.shortName : ''} Dept Tasks`, to: `/department-coordination${activeHazard ? `?hazard=${activeHazard}` : ''}` });
    } else if (path === '/review-queue') {
      crumbs.push({ label: 'Task Force Review Queue', to: '/review-queue' });
    } else if (path === '/saved-queries') {
      crumbs.push({ label: 'Saved Queries & Templates', to: '/saved-queries' });
    } else if (path === '/risk-builder') {
      crumbs.push({ label: 'Composite Risk Builder', to: `/risk-builder${activeHazard ? `?hazard=${activeHazard}` : ''}` });
    } else if (path === '/data-library') {
      crumbs.push({ label: 'Data Library & Catalog', to: `/data-library${activeHazard ? `?hazard=${activeHazard}` : ''}` });
    } else if (path === '/reports') {
      crumbs.push({ label: 'Reports Gallery', to: `/reports${activeHazard ? `?hazard=${activeHazard}` : ''}` });
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
    } else if (path === '/libraries') {
      crumbs.push({ label: `${activeHazardMeta ? activeHazardMeta.shortName : ''} Indicators`, to: `/libraries${activeHazard ? `?hazard=${activeHazard}` : ''}` });
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
        {/* Tier 1: System Bar */}
        <div className="google-top-bar">
          <div className="google-top-left">
            <Link to={activeHazard ? `/dashboard?hazard=${activeHazard}` : '/dashboard'} className="google-brand">
              <div
                className="google-brand-icon"
                style={{
                  background: activeHazardMeta ? activeHazardMeta.color : undefined,
                }}
              >
                {activeHazardMeta ? activeHazardMeta.icon : '🏛️'}
              </div>
              <span className="google-brand-title">
                {activeHazardMeta ? `HVRA ${activeHazardMeta.shortName} Portal` : 'Kerala Multi-Hazard HVRA'}
              </span>
            </Link>

            {/* When a hazard is selected, show prominent [⬅ Change Hazard (4 Columns)] button */}
            {activeHazard && (
              <button
                onClick={() => {
                  clearHazard();
                  navigate('/dashboard');
                }}
                className="btn-hazard-firstpage-switch"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '0.28rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#1d4ed8',
                  cursor: 'pointer',
                  marginLeft: '0.5rem',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.1)',
                  transition: 'all 0.15s ease',
                }}
                title="Return to the 4-column hazard selection first page"
              >
                <span>⬅</span> Change Hazard (4 Columns)
              </button>
            )}

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
            {activeHazard ? (
              /* Quick Search Trigger */
              <button
                className="cmd-trigger-btn"
                onClick={() => setIsCommandPaletteOpen(true)}
                title="Global search (Ctrl+K)"
              >
                <span>🔍 Search {activeHazardMeta?.shortName} assessments, taluks, indicators...</span>
                <kbd className="cmd-kbd">Ctrl+K</kbd>
              </button>
            ) : (
              /* Informative Banner Pill on First Page */
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#1e3a8a',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '0.35rem 1.1rem',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 1px 2px rgba(37,99,235,0.06)',
                }}
              >
                <span>✨</span> First Page: Select 1 of the 4 Hazard Boxes Below
              </div>
            )}
          </div>

          <div className="google-top-right">
            {activeHazard && (
              <>
                {/* AI Assistant */}
                <AIPanel />

                {/* Notification Center */}
                <Link to="/notifications" className="topbar-icon-btn" title="Notification Center">
                  🔔
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </Link>

                {/* Primary Action Button for active hazard */}
                <NavLink
                  to={`/new-assessment?module=HAZARD&hazard=${activeHazard}`}
                  className="btn btn-primary btn-sm"
                  style={{
                    whiteSpace: 'nowrap',
                    background: activeHazardMeta?.color,
                    borderColor: activeHazardMeta?.color,
                  }}
                >
                  + New {activeHazardMeta?.shortName} Assessment
                </NavLink>
              </>
            )}

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
                        👤 View Profile &amp; Jurisdiction
                      </Link>
                      {/* Task Force Review Queue — only visible to reviewing authorities (Managers, District/State Admins) */}
                      {(isAdmin || user.profile?.role_code === 'MANAGER' || user.profile?.role_code === 'DISTRICT_OFFICIAL') && (
                        <Link
                          to="/review-queue"
                          className="dropdown-item"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          🏛️ Task Force Review Queue
                        </Link>
                      )}
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
                <NavLink to="/login" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                  🔐 Sign In
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Navigation Bar (ONLY shown when a hazard is active!) */}
        {/* Tier 2: Navigation Bar (Grouped into 3 Clean Dropdowns when a hazard is active!) */}
        {activeHazard && (
          <div className="google-nav-bar">
            <nav className="google-nav-links">
              {/* Dropdown 1: Hazard Operations (Flood / Landslide / Coastal / Drought) */}
              <div className="google-nav-dropdown-wrap">
                <button
                  type="button"
                  className={`google-nav-dropdown-btn ${
                    (location.pathname === '/dashboard' && Boolean(activeHazard)) ||
                    location.pathname.startsWith('/new-assessment') ||
                    location.pathname.startsWith('/assessments') ||
                    location.pathname.startsWith('/risk-builder') ||
                    location.pathname.startsWith('/risk-assessments') ||
                    location.pathname.startsWith('/reports')
                      ? 'active'
                      : ''
                  } ${openNavDropdown === 'hazard' ? 'open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenNavDropdown((prev) => (prev === 'hazard' ? null : 'hazard'));
                  }}
                  title={`${activeHazardMeta?.shortName || 'Hazard'} Operations & Assessments`}
                >
                  <span className="google-nav-dropdown-icon">{activeHazardMeta?.icon || '🌊'}</span>
                  <span>{activeHazardMeta?.shortName || 'Hazard'} Hub</span>
                  <span className="google-nav-arrow">▾</span>
                </button>

                {openNavDropdown === 'hazard' && (
                  <div className="google-nav-menu">
                    <NavLink
                      to={`/dashboard?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/dashboard' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">{activeHazardMeta?.icon || '🌊'}</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">{activeHazardMeta?.shortName} Dashboard</span>
                        <span className="google-nav-menu-desc">District situation summary &amp; hazard intelligence</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to={`/new-assessment?module=HAZARD&hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/new-assessment' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">📋</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">{activeHazardMeta?.shortName} Assessments</span>
                        <span className="google-nav-menu-desc">Run Module 1-3 baseline assessments &amp; maps</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to={`/risk-builder?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/risk-builder' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">🎛️</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Composite Risk Builder</span>
                        <span className="google-nav-menu-desc">Module 4 Multi-criteria weighted risk (R = H × V × E)</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to={`/reports?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/reports' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">📑</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Reports &amp; Dossiers</span>
                        <span className="google-nav-menu-desc">Official 10-chapter dossiers, maps &amp; exports</span>
                      </div>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Dropdown 2: Department Operations */}
              <div className="google-nav-dropdown-wrap">
                <button
                  type="button"
                  className={`google-nav-dropdown-btn ${
                    location.pathname.startsWith('/issues') ||
                    location.pathname.includes('/department-coordination') ||
                    location.pathname.includes('/coordination') ||
                    location.pathname.startsWith('/review-queue')
                      ? 'active'
                      : ''
                  } ${openNavDropdown === 'dept' ? 'open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenNavDropdown((prev) => (prev === 'dept' ? null : 'dept'));
                  }}
                  title="Department Tasks, Field Incidents & Approvals"
                >
                  <span className="google-nav-dropdown-icon">🏛️</span>
                  <span>Department &amp; Field</span>
                  <span className="google-nav-arrow">▾</span>
                </button>

                {openNavDropdown === 'dept' && (
                  <div className="google-nav-menu">
                    <NavLink
                      to={`/issues?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive || location.pathname.startsWith('/issues') ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">🚨</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Field Incidents &amp; Workflow</span>
                        <span className="google-nav-menu-desc">Ground incident logs &amp; 3-tier departmental approvals</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to={`/department-coordination?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive || location.pathname.includes('/department-coordination') || location.pathname.includes('/coordination') ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">🏛️</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Department Data Tasks</span>
                        <span className="google-nav-menu-desc">Line agency indicators, telemetry &amp; task tracking</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/review-queue"
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/review-queue' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">📋</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Task Force Review Queue</span>
                        <span className="google-nav-menu-desc">Inter-departmental endorsements &amp; official sign-offs</span>
                      </div>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Dropdown 3: Data & Libraries */}
              <div className="google-nav-dropdown-wrap">
                <button
                  type="button"
                  className={`google-nav-dropdown-btn ${
                    location.pathname.startsWith('/data-library') ||
                    location.pathname.startsWith('/flood-data') ||
                    location.pathname.startsWith('/libraries') ||
                    location.pathname.startsWith('/saved-queries')
                      ? 'active'
                      : ''
                  } ${openNavDropdown === 'data' ? 'open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenNavDropdown((prev) => (prev === 'data' ? null : 'data'));
                  }}
                  title="Spatial Layers, Indicators, Datasets & Saved Queries"
                >
                  <span className="google-nav-dropdown-icon">📁</span>
                  <span>Data &amp; Libraries</span>
                  <span className="google-nav-arrow">▾</span>
                </button>

                {openNavDropdown === 'data' && (
                  <div className="google-nav-menu">
                    <NavLink
                      to={`/data-library?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/data-library' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">📁</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Spatial Data Library</span>
                        <span className="google-nav-menu-desc">GIS shapefiles, GeoJSON catalogues &amp; layer inspector</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to={`/libraries?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/libraries' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">📊</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Approved Indicators &amp; Mapping</span>
                        <span className="google-nav-menu-desc">Multi-hazard thresholds, formulas &amp; agency weights</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/saved-queries"
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/saved-queries' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">🔖</span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Saved Queries &amp; Templates</span>
                        <span className="google-nav-menu-desc">Reusable spatial query templates &amp; shareable links</span>
                      </div>
                    </NavLink>
                  </div>
                )}
              </div>

              {isAdmin && (
                <NavLink to="/settings" className={({ isActive }) => `google-nav-item ${isActive ? 'active' : ''}`}>
                  ⚙️ Settings
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
        )}
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
