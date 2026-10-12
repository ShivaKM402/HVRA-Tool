/**
 * Public Read-Only Shared Query View
 * Accessible without login via share token.
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getSharedSavedQuery } from '@/services/api';
import type { SavedQuery } from '@/types';

export default function SharedQueryView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState<SavedQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getSharedSavedQuery(token)
      .then((data) => setQuery(data))
      .catch((err) => setError(err.message || 'Shared query not found or expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" />
        <div style={{ marginTop: '0.75rem', color: '#64748b' }}>Loading shared template...</div>
      </div>
    );
  }

  if (error || !query) {
    return (
      <div className="alert alert-error" style={{ maxWidth: 500, margin: '4rem auto', textAlign: 'center' }}>
        <h3>Template Not Found</h3>
        <p>{error || 'This link may have expired or is invalid.'}</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Go to HVRA Platform
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="badge badge-info">{query.module_type} ASSESSMENT</span>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Shared Template</span>
        </div>

        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: '#0f172a' }}>{query.name}</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {query.description || 'Public disaster risk assessment query template for Kerala.'}
        </p>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '1rem', border: '1px solid var(--border-default)', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Template Parameters
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
            <div><strong>District:</strong> {query.district_name || 'All Districts'}</div>
            <div><strong>Administrative Level:</strong> {query.administrative_level}</div>
            <div><strong>Hazard Type:</strong> {query.hazard_type || 'FLOOD'}</div>
            <div><strong>Scoring Method:</strong> {query.parameters?.classification_method || 'threshold'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Link to="/dashboard" className="btn btn-secondary">
            HVRA Dashboard
          </Link>
          <button
            className="btn btn-primary"
            onClick={() =>
              navigate(`/new-assessment?module=${query.module_type}&district=${query.district || ''}`)
            }
          >
            Run this Query Now 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
