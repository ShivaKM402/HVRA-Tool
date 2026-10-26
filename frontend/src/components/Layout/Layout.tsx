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
import { fetchDistrictWeather, type DistrictWeatherReport } from '../../services/weatherService';
import {
  Waves,
  Mountain,
  Compass,
  Zap,
  Landmark,
  Building2,
  MapPin,
  Search,
  Bell,
  ChevronDown,
  User,
  LogOut,
  LogIn,
  ArrowLeft,
  FileText,
  Sliders,
  Radio,
  ClipboardCheck,
  Bookmark,
  Database,
  Settings,
} from 'lucide-react';
import './Layout.css';

const renderHazardIcon = (code: string | null, size = 18) => {
  switch (code) {
    case 'FLOOD':
      return <Waves size={size} />;
    case 'LANDSLIDE':
      return <Mountain size={size} />;
    case 'COASTAL':
      return <Compass size={size} />;
    case 'EXTREME_WEATHER':
      return <Zap size={size} />;
    default:
      return <Landmark size={size} />;
  }
};

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
  const [quickWeather, setQuickWeather] = useState<DistrictWeatherReport | null>(null);

  // Active district display name
  const currentDistrictObj = districts.find((d) => d.id === activeDistrictId);
  const currentDistrictName = currentDistrictObj ? currentDistrictObj.name.replace(/ District/i, '') : 'Thiruvananthapuram';

  useEffect(() => {
    let mounted = true;
    fetchDistrictWeather(currentDistrictName)
      .then((data) => {
        if (mounted) setQuickWeather(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [currentDistrictName]);

  // Close nav dropdown on route change
  useEffect(() => {
    setOpenNavDropdown(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      crumbs.push({ label: 'Generated & Saved Reports', to: `/reports${activeHazard ? `?hazard=${activeHazard}` : ''}` });
    } else if (path.startsWith('/weather') || path.startsWith('/live-weather')) {
      crumbs.push({ label: 'Live Disaster Operations, News & Weather', to: '/weather' });
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

  const isLandingPage = !activeHazard && location.pathname === '/dashboard';
  const isDashboard = location.pathname === '/dashboard';
  const isWeatherPage = location.pathname.startsWith('/weather') || location.pathname.startsWith('/live-weather');

  return (
    <div className={`app-layout ${isLandingPage ? 'app-layout--landing' : ''} ${isDashboard ? 'app-layout--dashboard' : ''} ${isWeatherPage ? 'app-layout--weather' : ''}`}>
      {/* Google-Style Two-Tier Clean Console Header */}
      <header className={`google-header-container ${isLandingPage ? 'google-header-container--landing' : ''}`}>
        {/* Tier 1: System Bar */}
        <div className="google-top-bar">
          <div className="google-top-left">
            <Link to={activeHazard ? `/dashboard?hazard=${activeHazard}` : '/dashboard'} className="portal-brand-link">
              <img src="/assets/hvra/logo.png" alt="HVRA Logo" className="portal-topbar-logo" />
              <div className="portal-topbar-titles">
                <span className="portal-gov-title">Government of Kerala</span>
                <span className="portal-app-title">HVRA Multi-Hazard Command Portal</span>
                <span className="portal-agency-title">Kerala State Disaster Management Authority (KSDMA)</span>
              </div>
            </Link>
          </div>

          <div className="google-top-center">
            {activeHazard ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Context Switcher for District in active hazard mode */}
                <div className="portal-district-pill">
                  <MapPin size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                  <select
                    className="portal-district-select"
                    value={activeDistrictId || ''}
                    onChange={(e) => setActiveDistrictId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    title="Switch territory"
                  >
                    <option value="">Thiruvananthapuram</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name.replace(' [DEMO]', '')}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} color="#64748b" style={{ flexShrink: 0, pointerEvents: 'none', marginLeft: '0.25rem' }} />
                </div>

                {/* Quick Search Trigger */}
                <button
                  className="portal-search-pill"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  title="Global search (Ctrl+K)"
                >
                  <Search size={14} color="#64748b" />
                  <span>Search {activeHazardMeta?.shortName || 'Flood'} assessments, taluks, indicators...</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                {/* District Switcher on Landing Page */}
                <div className="portal-district-pill portal-district-pill--landing">
                  <MapPin size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                  <select
                    className="portal-district-select"
                    value={activeDistrictId || ''}
                    onChange={(e) => setActiveDistrictId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    title="Switch territory"
                  >
                    <option value="">Thiruvananthapuram</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name.replace(' [DEMO]', '')}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} color="#64748b" style={{ flexShrink: 0, pointerEvents: 'none', marginLeft: '0.25rem' }} />
                </div>

                {/* 14 Revenue Districts Connected Badge */}
                <div className="portal-districts-connected-badge">
                  <span className="portal-pulse-dot" />
                  <span>14 Revenue Districts Connected</span>
                </div>
              </div>
            )}
          </div>

          <div className="google-top-right">
            {/* Notification Center Circular Button */}
            <Link
              to="/notifications"
              className="portal-circle-icon-btn"
              title="Notification Center"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </Link>

            {/* Profile / Auth Menu */}
            {isAuthenticated && user ? (
              <div style={{ position: 'relative' }}>
                <button
                  className="portal-user-badge-btn"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                >
                  <span className="portal-user-avatar-circle">
                    {(user.first_name?.[0] || user.username[0] || 'S').toUpperCase()}
                  </span>
                  <span className="portal-user-badge-name">
                    {user.profile?.role_label || 'Senior Employee'}
                  </span>
                  <ChevronDown size={14} color="#64748b" />
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
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                      >
                        <User size={15} />
                        <span>View Profile &amp; Jurisdiction</span>
                      </Link>
                      {/* Task Force Review Queue — only visible to reviewing authorities (Managers, District/State Admins) */}
                      {(isAdmin || user.profile?.role_code === 'MANAGER' || user.profile?.role_code === 'DISTRICT_OFFICIAL') && (
                        <Link
                          to="/review-queue"
                          className="dropdown-item"
                          onClick={() => setProfileMenuOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                        >
                          <ClipboardCheck size={15} />
                          <span>Task Force Review Queue</span>
                        </Link>
                      )}
                      <button
                        className="dropdown-item"
                        style={{
                          color: '#dc2626',
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                        onClick={handleLogout}
                      >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' }}>
                <NavLink
                  to="/login"
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Navigation Bar (Grouped into 3 Clean Dropdowns when a hazard is active!) */}
        {activeHazard && (
          <div className="google-nav-bar">
            <div className="google-nav-bar-inner">
              <button
                type="button"
                className="portal-tier2-back-title"
                onClick={() => {
                  clearHazard();
                  navigate('/dashboard');
                }}
                title="Return to 4-Column Hazard Gateway"
              >
                <ArrowLeft size={16} />
                <span>HVRA {activeHazardMeta?.shortName || 'Flood'} Portal</span>
              </button>

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
                    location.pathname.startsWith('/risk-assessments')
                      ? 'active'
                      : ''
                  } ${openNavDropdown === 'hazard' ? 'open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenNavDropdown((prev) => (prev === 'hazard' ? null : 'hazard'));
                  }}
                  title={`${activeHazardMeta?.shortName || 'Hazard'} Operations & Assessments`}
                >
                  <span className="google-nav-dropdown-icon">{renderHazardIcon(activeHazard, 16)}</span>
                  <span>{activeHazardMeta?.shortName || 'Hazard'} Hub</span>
                  <ChevronDown size={13} className="google-nav-arrow" />
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
                      <span className="google-nav-menu-icon">{renderHazardIcon(activeHazard, 18)}</span>
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
                      <span className="google-nav-menu-icon">
                        <FileText size={18} color="#dc2626" />
                      </span>
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
                      <span className="google-nav-menu-icon">
                        <Sliders size={18} color="#7c3aed" />
                      </span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Composite Risk Builder</span>
                        <span className="google-nav-menu-desc">Module 4 Multi-criteria weighted risk (R = H × V × E)</span>
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
                  <span className="google-nav-dropdown-icon">
                    <Building2 size={16} />
                  </span>
                  <span>Department &amp; Field</span>
                  <ChevronDown size={13} className="google-nav-arrow" />
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
                      <span className="google-nav-menu-icon">
                        <Radio size={18} color="#dc2626" />
                      </span>
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
                      <span className="google-nav-menu-icon">
                        <Building2 size={18} color="#0d9488" />
                      </span>
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
                      <span className="google-nav-menu-icon">
                        <ClipboardCheck size={18} color="#dc2626" />
                      </span>
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
                    location.pathname.startsWith('/reports') ||
                    location.pathname.startsWith('/data-library') ||
                    location.pathname.startsWith('/flood-data') ||
                    location.pathname.startsWith('/saved-queries')
                      ? 'active'
                      : ''
                  } ${openNavDropdown === 'data' ? 'open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenNavDropdown((prev) => (prev === 'data' ? null : 'data'));
                  }}
                  title="Generated Reports, Spatial Layers, Datasets & Saved Queries"
                >
                  <span className="google-nav-dropdown-icon">
                    <Database size={16} />
                  </span>
                  <span>Data &amp; Libraries</span>
                  <ChevronDown size={13} className="google-nav-arrow" />
                </button>

                {openNavDropdown === 'data' && (
                  <div className="google-nav-menu">
                    <NavLink
                      to={`/reports?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/reports' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">
                        <FileText size={18} color="#0284c7" />
                      </span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Generated &amp; Saved Reports</span>
                        <span className="google-nav-menu-desc">Unified statutory reports, composite risk dossiers &amp; review routing</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to={`/data-library?hazard=${activeHazard}`}
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/data-library' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">
                        <Database size={18} color="#0d9488" />
                      </span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Spatial Data Library</span>
                        <span className="google-nav-menu-desc">GIS shapefiles, GeoJSON catalogues &amp; layer inspector</span>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/saved-queries"
                      className={({ isActive }) =>
                        `google-nav-menu-item ${isActive && location.pathname === '/saved-queries' ? 'active' : ''}`
                      }
                      onClick={() => setOpenNavDropdown(null)}
                    >
                      <span className="google-nav-menu-icon">
                        <Bookmark size={18} color="#f59e0b" />
                      </span>
                      <div className="google-nav-menu-text">
                        <span className="google-nav-menu-title">Saved Queries &amp; Templates</span>
                        <span className="google-nav-menu-desc">Reusable spatial query templates &amp; shareable links</span>
                      </div>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* Direct Live Disaster Alerts & Weather Navigation Button */}
              <NavLink
                to="/weather"
                className={({ isActive }) =>
                  `google-nav-item ${isActive || location.pathname.startsWith('/weather') || location.pathname.startsWith('/live-weather') ? 'active' : ''}`
                }
                title="Live Disaster News, Official Alerts & Weather Radar"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none' }}
              >
                <Radio size={15} color="#dc2626" />
                <span>Live Disaster &amp; Weather</span>
                {quickWeather && (
                  <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '999px', fontWeight: 800 }}>
                    LIVE
                  </span>
                )}
              </NavLink>

              {isAdmin && (
                <NavLink
                  to="/settings"
                  className={({ isActive }) => `google-nav-item ${isActive ? 'active' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Settings size={15} />
                  <span>Settings</span>
                </NavLink>
              )}
            </nav>
          </div>

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
        {/* Page Content with Silk-smooth Route Transitions */}
        <main className="page-content">
          <div key={location.pathname} className="page-transition-wrapper">
            <Outlet />
          </div>
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
