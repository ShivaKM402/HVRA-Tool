/**
 * Dashboard page
 * Shows summary stats and recent assessments.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkHealth, getAssessments, getHazards, getDistricts } from '../../services/api';
import type { Assessment, HealthCheckResponse, HazardType, AdministrativeUnit } from '../../types';
import KottayamMap from '../../components/Map/KottayamMap';
import './Dashboard.css';

function StatusBadge({ status }: { status: string }) {
  const cls = `badge badge-${status.toLowerCase()}`;
  return <span className={cls}>{status}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [hazards, setHazards] = useState<HazardType[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [healthData, assessData, hazardData, districtData] = await Promise.all([
          checkHealth(),
          getAssessments(),
          getHazards(),
          getDistricts(),
        ]);
        setHealth(healthData);
        setAssessments(assessData.results || []);
        setHazards(hazardData);
        setDistricts(districtData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completedCount = assessments.filter((a) => a.status === 'COMPLETED').length;
  const activeHazards = hazards.filter((h) => h.is_active).length;

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <span>❌</span>
          <div>
            <strong>Backend Connection Error</strong>
            <p style={{ marginTop: '0.25rem' }}>{error}</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              Make sure the Django backend is running: <code>python manage.py runserver</code>
            </p>
          </div>
        </div>
        <div className="alert alert-info">
          <span>ℹ️</span>
          <div>
            <strong>Getting Started</strong>
            <ol style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: '2' }}>
              <li>Open a terminal in <code>backend/</code></li>
              <li>Activate virtual environment: <code>venv\Scripts\activate</code></li>
              <li>Run migrations: <code>python manage.py migrate</code></li>
              <li>Seed demo data: <code>python manage.py seed_demo_data</code></li>
              <li>Start server: <code>python manage.py runserver</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Demo data notice */}
      <div className="demo-notice mb-6">
        <span className="demo-notice-icon">⚠️</span>
        <div>
          <strong>DEMO DATA MODE</strong> — All data displayed is synthetic demo data for prototype
          demonstration only. It does not represent official government data. Replace with official
          datasets for production use.
        </div>
      </div>

      {/* Health status */}
      {health && (
        <div className="health-bar mb-6">
          <span className="health-dot" />
          <span>
            {health.service} — <strong>{health.version}</strong> —
            Database: <strong>{health.database}</strong> ({health.database_engine}) —
            Django: <strong>{health.django_version}</strong>
          </span>
        </div>
      )}

      {/* Phase 2 Preselected Pilot Scope Banner */}
      <div className="card mb-6" style={{ background: '#f8fafc', borderLeft: '4px solid var(--color-primary)' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                Pilot District Foundation — Preselected Context
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>State:</span>{' '}
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Kerala</strong>
                </div>
                <div style={{ color: '#cbd5e1' }}>/</div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>District:</span>{' '}
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Kottayam</strong>
                </div>
                <div style={{ color: '#cbd5e1' }}>/</div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Administrative Level:</span>{' '}
                  <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>Block (12 Pilot Units)</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                Single District Prototype
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pilot Map Section */}
      <div className="mb-8">
        <KottayamMap />
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-8">
        <div className="stat-card" style={{ '--stat-color': '#3b82f6', '--stat-bg': '#eff6ff' } as React.CSSProperties}>
          <div className="stat-card-icon">📋</div>
          <div className="stat-card-value">{assessments.length}</div>
          <div className="stat-card-label">Total Assessments</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#22c55e', '--stat-bg': '#f0fdf4' } as React.CSSProperties}>
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-value">{completedCount}</div>
          <div className="stat-card-label">Completed Assessments</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#f97316', '--stat-bg': '#fff7ed' } as React.CSSProperties}>
          <div className="stat-card-icon">⚠️</div>
          <div className="stat-card-value">{activeHazards}</div>
          <div className="stat-card-label">Available Hazards</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': '#8b5cf6', '--stat-bg': '#f5f3ff' } as React.CSSProperties}>
          <div className="stat-card-icon">🗺️</div>
          <div className="stat-card-value">{districts.length}</div>
          <div className="stat-card-label">Pilot District (Kottayam)</div>
        </div>
      </div>

      {/* Recent assessments */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="card-title">Recent Assessments</h2>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/new-assessment')}
            id="btn-new-assessment"
          >
            + New Assessment
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {assessments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No assessments yet</div>
              <div className="empty-state-description">
                Create your first hazard assessment to get started.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/new-assessment')}
                style={{ marginTop: '1rem' }}
              >
                + New Assessment
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Hazard</th>
                  <th>District</th>
                  <th>Admin Level</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <div className="font-medium">{assessment.name}</div>
                      {assessment.description && (
                        <div className="text-small text-muted">{assessment.description}</div>
                      )}
                    </td>
                    <td>
                      <span className="hazard-tag" data-hazard={assessment.hazard_type}>
                        {assessment.hazard_type}
                      </span>
                    </td>
                    <td>{assessment.district_name}</td>
                    <td>
                      <span className="badge badge-draft">{assessment.administrative_level}</span>
                    </td>
                    <td className="text-small text-muted">
                      {new Date(assessment.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <StatusBadge status={assessment.status} />
                    </td>
                    <td>
                      {assessment.status === 'COMPLETED' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/assessments/${assessment.id}/results`)}
                        >
                          View Results
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/assessments/${assessment.id}/results`)}
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Available hazards */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Available Hazards</h2>
        </div>
        <div className="card-body">
          <div className="hazard-grid">
            {hazards.map((hazard) => (
              <div
                key={hazard.code}
                className={`hazard-card${hazard.is_active ? ' active' : ' disabled'}`}
                style={{ '--hazard-color': hazard.color } as React.CSSProperties}
              >
                <div className="hazard-card-icon">{hazard.icon || '⚠️'}</div>
                <div className="hazard-card-name">{hazard.name}</div>
                {hazard.is_active ? (
                  <span className="badge badge-completed" style={{ fontSize: '0.65rem' }}>
                    Available
                  </span>
                ) : (
                  <span className="badge badge-draft" style={{ fontSize: '0.65rem' }}>
                    Coming Soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
