/**
 * Register page — public self-registration (HVRA §2).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', padding: '2rem 1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <div className="card-header" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>🌊</div>
          <h2 className="card-title" style={{ justifyContent: 'center' }}>Create an Account</h2>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            HVRA Digital Tool — role-based access
          </div>
        </div>

        <div className="card-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>First Name</label>
                <input className="form-control" style={inputStyle} value={form.first_name} onChange={set('first_name')} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Last Name</label>
                <input className="form-control" style={inputStyle} value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Username *</label>
              <input className="form-control" style={inputStyle} value={form.username} onChange={set('username')} autoFocus required />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Email</label>
              <input className="form-control" type="email" style={inputStyle} value={form.email} onChange={set('email')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Password *</label>
                <input className="form-control" type="password" style={inputStyle} value={form.password} onChange={set('password')} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Confirm *</label>
                <input className="form-control" type="password" style={inputStyle} value={form.password2} onChange={set('password2')} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Role</label>
                <select className="form-control" style={inputStyle} value={form.role} onChange={set('role')}>
                  {ROLES.map((r) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}>Organization</label>
                <input className="form-control" style={inputStyle} placeholder="e.g. KSDMA" value={form.organization} onChange={set('organization')} />
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', marginTop: '0.5rem' }} disabled={busy}>
              {busy ? 'Creating account…' : 'Register'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}