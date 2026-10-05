/**
 * Saved Queries & Templates Page
 * View saved query templates, re-run them with one click, or share them.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSavedQueries, deleteSavedQuery, runSavedQuery } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { ShareQueryModal } from '@/components/Modals/ShareQueryModal';
import { DeleteButton } from '@/components/DeleteButton/DeleteButton';
import type { SavedQuery } from '@/types';
import './SavedQueries.css';

export default function SavedQueries() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForShare, setSelectedForShare] = useState<SavedQuery | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);

  const fetchQueries = async () => {
    try {
      setLoading(true);
      const res = await getSavedQueries();
      setQueries(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.warn('Could not load saved queries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const handleRun = async (q: SavedQuery) => {
    try {
      setRunningId(q.id);
      const result = await runSavedQuery(q.id);
      showToast({
        title: 'Query Executing',
        message: `Executing template "${q.name}"...`,
        type: 'info',
      });
      const newId = result.assessment?.id || result.risk_assessment?.id;
      if (newId) {
        navigate(`/assessments/${newId}/processing`);
      } else {
        // Navigate to query builder with prefill parameters
        navigate(`/new-assessment?module=${q.module_type}&district=${q.district || ''}`);
      }
    } catch (err: any) {
      showToast({
        title: 'Run Query Failed',
        message: err.message || 'Could not execute saved query.',
        type: 'error',
      });
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) return;
    try {
      await deleteSavedQuery(id);
      showToast({
        title: 'Query Deleted',
        message: `Template "${name}" has been removed.`,
        type: 'info',
      });
      setQueries((prev) => prev.filter((q) => q.id !== id));
    } catch (err: any) {
      showToast({
        title: 'Delete Failed',
        message: err.message || 'Could not delete saved query.',
        type: 'error',
      });
    }
  };

  return (
    <div className="saved-queries-container">
      {/* Header */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              <Link to="/dashboard">Dashboard</Link> / <span>Saved Queries</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
              🔖 Saved Assessment Queries & Templates
            </h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Preconfigured indicator weighting and administrative scopes. Re-run identical queries across seasons or share them with domain departments.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link to="/new-assessment?module=HAZARD" className="btn btn-primary btn-sm">
              + New Hazard Query
            </Link>
            <Link to="/risk-builder" className="btn btn-secondary btn-sm">
              + Risk Builder
            </Link>
          </div>
        </div>
      </div>

      {/* Query Cards Grid */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ marginTop: '0.75rem', color: '#64748b' }}>Loading saved queries...</div>
        </div>
      ) : queries.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📑</div>
          <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No Saved Queries Yet</h3>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.88rem' }}>
            When configuring an assessment in the Query Builder, click &ldquo;Save as Query Template&rdquo; to store your parameters for future seasons.
          </p>
          <Link to="/new-assessment?module=HAZARD" className="btn btn-primary">
            Configure Your First Query →
          </Link>
        </div>
      ) : (
        <div className="query-grid">
          {queries.map((q) => (
            <div key={q.id} className="query-card">
              <div className="query-card-header">
                <span className="badge badge-info">{q.module_type}</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {new Date(q.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="query-card-title">{q.name}</h3>
              <p className="query-card-desc">{q.description || 'No description provided.'}</p>

              <div className="query-meta-pills">
                <span className="query-pill">📍 District: {q.district_name || 'All'}</span>
                <span className="query-pill">📐 Resolution: {q.administrative_level}</span>
                <span className="query-pill">⚡ Method: {q.parameters?.classification_method || 'threshold'}</span>
              </div>

              <div className="query-card-footer">
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRun(q)}
                    disabled={runningId === q.id}
                  >
                    {runningId === q.id ? 'Running...' : 'Run Again 🚀'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedForShare(q)}
                    title="Share Public Link"
                  >
                    Share 🔗
                  </button>
                </div>

                <DeleteButton 
                  onClick={() => handleDelete(q.id, q.name)}
                  title="Delete Template"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      <ShareQueryModal
        isOpen={Boolean(selectedForShare)}
        onClose={() => setSelectedForShare(null)}
        query={selectedForShare}
      />
    </div>
  );
}
