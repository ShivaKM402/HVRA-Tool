/**
 * Register page — public self-registration (HVRA §2).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const ROLES = [
  { code: 'ANALYST', label: 'Analyst' },
  { code: 'VIEWER', label: 'Viewer' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password2: '',
    role: 'ANALYST',
    organization: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.password2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        password: form.password,
        role: form.role,
        organization: form.organization.trim() || undefined,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { width: '100%' };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 15% 20%, rgba(37, 99, 235, 0.18) 0%, rgba(9, 14, 26, 0.98) 70%), linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e293b 100%)',
      padding: '2.5rem 1rem'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: 500,
        boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-2xl)',
        background: '#ffffff',
        animation: 'fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        <div className="card-header" style={{
          textAlign: 'center',
          flexDirection: 'column',
          padding: '2rem 2rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(180deg, #ffffff 0%, #fafbfd 100%)'
        }}>
          <div style={{
            width: 50,
            height: 50,
            borderRadius: '14px',
            background: 'var(--color-primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            margin: '0 auto 0.85rem',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
          }}>
            🌊
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.55rem',
            fontWeight: 800,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.025em'
          }}>
            Officer Registration
          </h2>
          <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '0.35rem' }}>
            HVRA Digital Tool — Role-based Disaster Management Access
          </div>
        </div>

        <div className="card-body" style={{ padding: '1.75rem 2rem 2rem' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label className="form-label">First Name</label>
                <input className="form-control" style={inputStyle} value={form.first_name} onChange={set('first_name')} />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input className="form-control" style={inputStyle} value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>

            <div>
              <label className="form-label">Username *</label>
              <input className="form-control" style={inputStyle} value={form.username} onChange={set('username')} autoFocus required />
            </div>

            <div>
              <label className="form-label">Official Email</label>
              <input className="form-control" type="email" style={inputStyle} value={form.email} onChange={set('email')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label className="form-label">Password *</label>
                <input className="form-control" type="password" style={inputStyle} value={form.password} onChange={set('password')} required />
              </div>
              <div>
                <label className="form-label">Confirm *</label>
                <input className="form-control" type="password" style={inputStyle} value={form.password2} onChange={set('password2')} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label className="form-label">Assigned Role</label>
                <select className="form-control" style={inputStyle} value={form.role} onChange={set('role')}>
                  {ROLES.map((r) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Department / Org</label>
                <input className="form-control" style={inputStyle} placeholder="e.g. KSDMA" value={form.organization} onChange={set('organization')} />
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={busy}
            >
              {busy ? 'Creating Credentials…' : 'Register Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.86rem', color: '#64748b' }}>
            Already have credentials?{' '}
            <Link to="/login" style={{ color: '#2563eb', fontWeight: 700 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}