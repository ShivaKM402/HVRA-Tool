/**
 * User Profile Page (HVRA Section 6 Utility)
 */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useDistrict } from '@/context/DistrictContext';

export default function Profile() {
  const { user, isAdmin, logout } = useAuth();
  const { activeDistrict } = useDistrict();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ maxWidth: 720, margin: '1rem auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
          <Link to="/dashboard">Dashboard</Link> / <span>User Profile</span>
        </div>
        <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
          👤 User Profile & Assigned Jurisdiction
        </h1>
      </div>

      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: isAdmin ? '#7c3aed' : '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              fontWeight: 800,
            }}
          >
            {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
              @{user?.username} · {user?.email || 'officer@ksdma.kerala.gov.in'}
            </div>
            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem' }}>
              <span className="badge badge-info">{user?.profile?.role_label || user?.profile?.role || 'Disaster Management Officer'}</span>
              {isAdmin && <span className="badge badge-warning">Task Force Administrator</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 10, border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Assigned Administrative State</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)', marginTop: '0.2rem' }}>Kerala</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 10, border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Active Operational District</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)', marginTop: '0.2rem' }}>
              {activeDistrict?.name || 'Thiruvananthapuram'} District
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 10, border: '1px solid var(--border-default)', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
          <strong style={{ color: 'var(--color-primary)' }}>Territorial Access Scoping (HVRA §2):</strong> Your account is authorized to generate assessments, configure indicators, and view published thematic outputs for all blocks and panchayats within your jurisdiction.
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-default)', paddingTop: '1.25rem' }}>
          <Link to="/dashboard" className="btn btn-secondary btn-sm">
            ← Back to Dashboard
          </Link>
          <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={handleLogout}>
            🚪 Sign Out of Platform
          </button>
        </div>
      </div>
    </div>
  );
}
