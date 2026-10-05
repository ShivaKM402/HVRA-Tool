/**
 * Login page — token authentication (HVRA §2).
 * Quick-fill buttons for the seeded demo accounts.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(14,165,233,0.2)',
        borderRadius: 'var(--radius-2xl)',
        animation: 'fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        <div className="card-header" style={{
          textAlign: 'center',
          flexDirection: 'column',
          padding: '2rem 2rem 1.25rem',
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #06d6a0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 1rem',
            boxShadow: '0 4px 20px rgba(14,165,233,0.5), 0 0 0 4px rgba(14,165,233,0.12)',
            animation: 'waveFloat 2s ease-in-out infinite'
          }}>
            🌊
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.65rem',
            fontWeight: 700,
            color: 'var(--text-heading)',
            margin: 0,
            letterSpacing: '-0.025em'
          }}>
            HVRA Digital Tool
          </h2>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Kerala State Disaster Management Framework
          </div>
        </div>

        <div className="card-body" style={{ padding: '1.75rem 2rem 2rem' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label className="form-label">
                Official Username
              </label>
              <input
                className="form-control"
                placeholder="e.g. analyst or admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="form-label">
                Secure Password
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

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={busy}
            >
              {busy ? 'Authenticating…' : '🔐 Sign In to Command Center'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.86rem', color: '#64748b' }}>
            Need an officer account?{' '}
            <Link to="/register" style={{ color: '#2563eb', fontWeight: 700 }}>
              Register here
            </Link>
          </div>

          {/* Quick Demo Credentials */}
          <div style={{ marginTop: '1.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
            <div style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.75rem'
            }}>
              Quick-Fill Prototype Accounts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', padding: '0.5rem 0.85rem' }}
                  onClick={() => fillDemo(acc.username, acc.password)}
                >
                  <span style={{ fontWeight: 600 }}>👤 {acc.label}</span>
                  <span className="badge badge-info" style={{ fontSize: '0.66rem' }}>
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}