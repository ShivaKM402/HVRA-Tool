/**
 * Notification Center Page (HVRA §4 / Section 6)
 * Full history of system notifications, Task Force review decisions, and exports.
 */
import { Link } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';

export default function Notifications() {
  const { notifications, markAllRead, clearNotifications } = useToast();

  return (
    <div style={{ maxWidth: 760, margin: '1rem auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              <Link to="/dashboard">Dashboard</Link> / <span>Notification Center</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
              🔔 Notification Center & Audit Events
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
              Mark All Read
            </button>
            <button className="btn btn-secondary btn-sm" onClick={clearNotifications}>
              Clear History
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔕</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No Notifications Yet</h3>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>
              System events, review decisions, and export logs will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: n.read ? '#ffffff' : '#f0fdf4',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  borderLeft: `4px solid ${
                    n.type === 'success' ? '#16a34a' : n.type === 'error' ? '#dc2626' : n.type === 'warning' ? '#f59e0b' : '#dc2626'
                  }`,
                }}
              >
                <div style={{ flex: 1 }}>
                  {n.title && (
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      {n.title}
                    </div>
                  )}
                  <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.15rem' }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                    {new Date(n.timestamp).toLocaleString()}
                  </div>
                  {n.link && (
                    <Link
                      to={n.link}
                      style={{ display: 'inline-block', fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, marginTop: '0.35rem' }}
                    >
                      View Resource →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
