/**
 * Login page — token authentication (HVRA §2).
 * Quick-fill buttons for the seeded demo accounts.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Platform Admin', username: 'admin', password: 'admin123', role: 'PLATFORM_ADMIN' },
  { label: 'State Official', username: 'state', password: 'state123', role: 'STATE_OFFICIAL' },
  { label: 'District Official', username: 'ernakulam', password: 'district123', role: 'DISTRICT_OFFICIAL' },
  { label: 'Analyst', username: 'analyst', password: 'analyst123', role: 'ANALYST' },
  { label: 'Viewer', username: 'viewer', password: 'viewer123', role: 'VIEWER' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      navigate(user.profile?.role_code === 'PLATFORM_ADMIN' || user.is_staff ? '/settings' : from, {
        replace: true,
      });
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', padding: '2rem 1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="card-header" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>🌊</div>
          <h2 className="card-title" style={{ justifyContent: 'center' }}>HVRA Digital Tool</h2>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Sign in — State Disaster Management Framework
          </div>
        </div>

        <div className="card-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Username
              </label>
              <input
                className="form-control"
                placeholder="e.g. analyst"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Password
              </label>
              <input
                className="form-control"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '1rem' }} disabled={busy}>
              {busy ? 'Signing in…' : '🔐 Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#2563eb', fontWeight: 600 }}>
              Register here
            </Link>
          </div>

          {/* Demo accounts */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              Demo Accounts (click to fill)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', fontSize: '0.82rem' }}
                  onClick={() => fillDemo(acc.username, acc.password)}
                >
                  <span>👤 {acc.label}</span>
                  <span style={{ color: acc.role === 'PLATFORM_ADMIN' ? '#7c3aed' : '#64748b', fontWeight: 600 }}>{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}