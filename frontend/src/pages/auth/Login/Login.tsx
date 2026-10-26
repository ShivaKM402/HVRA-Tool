/**
 * Login Page — 5-Tier Governance Role Hierarchy
 * 1. Employee (Line Department Field Entry)
 * 2. Senior Employee (Department Verification & Sign-off)
 * 3. Manager (Multi-Agency Review & Coordination)
 * 4. District Administrator (District Collectorate / DDMA Approval)
 * 5. State Administrator (Statewide SDMA Command & Master Policy)
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Loader2,
  LogIn,
  AlertTriangle,
} from 'lucide-react';
import hvraLogo from '/assets/hvra/logo.png';
import './Login.css';

interface GovernanceRoleAccount {
  level: number;
  label: string;
  roleBadge: string;
  username: string;
  password: string;
  role: string;
  desc: string;
  scope: string;
  category: 'FIELD' | 'ADMIN';
  iconBg: string;
}

const GOVERNANCE_ROLES: GovernanceRoleAccount[] = [
  {
    level: 1,
    label: 'Employee',
    roleBadge: 'Level 1 – Field Staff',
    username: 'employee',
    password: 'employee123',
    role: 'DEPARTMENT_OFFICER',
    desc: 'Enters field telemetry...',
    scope: '@employee · Line Department / Panchayats',
    category: 'FIELD',
    iconBg: '#1d4ed8',
  },
  {
    level: 2,
    label: 'Senior Employee',
    roleBadge: 'Level 2 – Department Lead',
    username: 'senior_employee',
    password: 'senior123',
    role: 'SENIOR_OFFICER',
    desc: 'Verifies baseline rec...',
    scope: '@senior_employee · Executive Engineer / HoD Office',
    category: 'FIELD',
    iconBg: '#0d9488',
  },
  {
    level: 3,
    label: 'Manager',
    roleBadge: 'Level 3 – Operations Lead',
    username: 'manager',
    password: 'manager123',
    role: 'MANAGER',
    desc: 'Coordinates inter-d...',
    scope: '@manager · DEOC Operations / Review Queue',
    category: 'FIELD',
    iconBg: '#8b5cf6',
  },
  {
    level: 4,
    label: 'Level 4 – DDMA Authority',
    roleBadge: 'Level 4 – DDMA Authority',
    username: 'district_admin',
    password: 'district123',
    role: 'DISTRICT_OFFICIAL',
    desc: 'Formally endorses &...',
    scope: '@district_admin · District Collectorate / DDMA',
    category: 'ADMIN',
    iconBg: '#ea580c',
  },
  {
    level: 5,
    label: 'State Administrator',
    roleBadge: 'Level 5 – State SDMA Head',
    username: 'state_admin',
    password: 'admin123',
    role: 'PLATFORM_ADMIN',
    desc: 'Statewide governan...',
    scope: '@state_admin · Kerala State Disaster Management',
    category: 'ADMIN',
    iconBg: '#0284c7',
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'FIELD' | 'ADMIN'>('ALL');
  const [activeAccountUser, setActiveAccountUser] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  const performLogin = async (u: string, p: string) => {
    setError(null);
    setBusy(true);
    try {
      const user = await login(u.trim(), p);
      let dest = from;
      const roleCode = user.profile?.role_code;

      if (roleCode === 'PLATFORM_ADMIN' || user.is_staff) {
        dest = from === '/dashboard' ? '/dashboard' : from;
      } else if (roleCode === 'DEPARTMENT_OFFICER' || roleCode === 'SENIOR_OFFICER') {
        dest = '/department-coordination';
      } else if (roleCode === 'MANAGER' || roleCode === 'DISTRICT_OFFICIAL') {
        dest = '/review-queue';
      }
      navigate(dest, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }
    performLogin(username, password);
  };

  const handleInstantLogin = (acc: GovernanceRoleAccount) => {
    setActiveAccountUser(acc.username);
    setUsername(acc.username);
    setPassword(acc.password);
    performLogin(acc.username, acc.password);
  };

  const handleFillOnly = (acc: GovernanceRoleAccount) => {
    setActiveAccountUser(acc.username);
    setUsername(acc.username);
    setPassword(acc.password);
    setError(null);
  };

  const filteredRoles = GOVERNANCE_ROLES.filter((acc) => {
    if (activeTab === 'ALL') return true;
    return acc.category === activeTab;
  });

  return (
    <div className="login-viewport">
      {/* Full-page Kerala landscape + digital topo background */}
      <div className="login-bg" />

      {/* ── Top Portal Header Bar ── */}
      <header className="login-topbar">
        <div className="login-brand-left">
          <img src={hvraLogo} alt="HVRA Logo" className="login-logo-img" />
          <div className="login-brand-titles">
            <span className="login-gov-kerala">Government of Kerala</span>
            <span className="login-app-name">HVRA Multi-Hazard Command Portal</span>
            <span className="login-framework-sub">Kerala State Disaster Management Authority (KSDMA)</span>
          </div>
        </div>

        <div className="login-topbar-badge">
          <span className="login-pulse-dot" />
          <span>Statutory Governance Hierarchy</span>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="login-main">
        {/* Hero Section */}
        <div className="login-hero">
          <div className="login-hero-pill">
            <span>5-TIER OFFICER SIGN-IN</span>
          </div>
          <h1 className="login-hero-title">
            Sign in to the<br />
            <strong>HVRA Command Center</strong>
          </h1>
          <p className="login-hero-sub">
            Select your administrative role below for 1-click access, or sign in using your official credentials.
          </p>
        </div>

        {/* ── Split Grid: Quick-Fill First (Left) + Manual (Right) ── */}
        <div className="login-split-grid">
          {/* ── Quick-Fill Panel (PROMINENT FIRST) ── */}
          <div className="login-quick-panel">
            <div className="login-quick-head">
              <div className="login-quick-title-group">
                <h3>
                  <span className="login-quick-zap-icon">
                    <Zap size={16} color="#ffffff" fill="#ffffff" />
                  </span>
                  <span>Quick-Fill &amp; 1-Click Sign-In</span>
                </h3>
                <p>Click any officer role to sign in instantly without typing.</p>
              </div>

              {/* Filter Tabs */}
              <div className="login-filter-tabs">
                <button
                  type="button"
                  className={`login-tab-btn ${activeTab === 'ALL' ? 'login-tab-btn--active' : ''}`}
                  onClick={() => setActiveTab('ALL')}
                >
                  All 5 Roles
                </button>
                <button
                  type="button"
                  className={`login-tab-btn ${activeTab === 'FIELD' ? 'login-tab-btn--active' : ''}`}
                  onClick={() => setActiveTab('FIELD')}
                >
                  Field &amp; Ops (3)
                </button>
                <button
                  type="button"
                  className={`login-tab-btn ${activeTab === 'ADMIN' ? 'login-tab-btn--active' : ''}`}
                  onClick={() => setActiveTab('ADMIN')}
                >
                  Administrators (2)
                </button>
              </div>
            </div>

            {/* List of 5 Governance Roles */}
            <div className="login-group-section">
              <div className="login-role-grid">
                {filteredRoles.map((acc) => {
                  const isSelected = activeAccountUser === acc.username;
                  return (
                    <div
                      key={acc.username}
                      className={`login-role-card ${isSelected ? 'login-role-card-active' : ''}`}
                      onClick={() => handleFillOnly(acc)}
                      onDoubleClick={() => handleInstantLogin(acc)}
                      title="Click to select credentials, double-click to sign in"
                    >
                      <div className="login-role-left">
                        <div className="login-role-icon" style={{ backgroundColor: acc.iconBg }}>
                          <User size={18} color="#ffffff" />
                        </div>
                        <div className="login-role-meta">
                          <span className="login-role-name">{acc.label}</span>
                          <span className="login-role-badge">
                            {acc.roleBadge}
                          </span>
                          <span className="login-role-desc">{acc.desc}</span>
                          <span className="login-role-user">
                            {acc.scope}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="login-divider" />

          {/* ── Manual Sign-In Card (Right) ── */}
          <div className="login-form-card">
            <div className="login-form-header">
              <h2 className="login-form-title">Officer Credentials</h2>
              <p className="login-form-sub">Enter official username &amp; password or choose a quick role.</p>
            </div>

            {error && (
              <div className="login-alert-error">
                <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label className="login-field-label" htmlFor="login-username">
                  Official Username
                </label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <User size={16} color="#64748b" />
                  </span>
                  <input
                    id="login-username"
                    className="login-input"
                    type="text"
                    placeholder="e.g. employee, manager, district_admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-field-label" htmlFor="login-password">
                  <span>Secure Password</span>
                </label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <Lock size={16} color="#64748b" />
                  </span>
                  <input
                    id="login-password"
                    className="login-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="login-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={busy}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {busy ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                    <span>Authenticating…</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Sign In to Portal</span>
                  </>
                )}
              </button>
            </form>

            <div className="login-footer-links">
              Need a government officer account?{' '}
              <Link to="/register" className="login-register-link">
                Register here
              </Link>

              <div className="login-compliance-badge">
                <ShieldCheck size={16} color="#059669" />
                <span>Protected by KSDMA Role-Based Security Framework (HVRA §2)</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="login-bottom-bar">
        © 2026 Kerala State Disaster Management Authority (KSDMA). All rights reserved.
      </footer>
    </div>
  );
}