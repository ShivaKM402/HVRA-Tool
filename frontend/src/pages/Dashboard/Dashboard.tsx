/**
 * Dashboard page
 * Shows summary stats and recent assessments.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { checkHealth, getAssessments, getHazards, getDistricts, getDashboardSummary, getRiskDashboardSummary } from '../../services/api';
import type { Assessment, HealthCheckResponse, HazardType, AdministrativeUnit, DashboardSummaryResponse } from '../../types';
import KeralaMap from '../../components/Map/KeralaMap';
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
  const [selectedDistrict, setSelectedDistrict] = useState<AdministrativeUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cross-district comparison (HVRA §3.4)
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [summaryModule, setSummaryModule] = useState<'HAZARD' | 'VULNERABILITY' | 'EXPOSURE' | 'COMPOSITE_RISK'>('HAZARD');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const data =
          summaryModule === 'COMPOSITE_RISK'
            ? await getRiskDashboardSummary()
            : await getDashboardSummary({ module_type: summaryModule });
        if (!cancelled) setSummary(data);
      } catch (err: any) {
        if (!cancelled) setSummaryError(err.message || 'Failed to load district summary.');
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [summaryModule]);

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
        if (districtData && districtData.length > 0) {
          setSelectedDistrict(districtData[0]);
        }
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

      {/* Spatial Scope & Administrative Coverage */}
      <div className="card mb-6" style={{ background: '#f8fafc', borderLeft: '4px solid var(--color-primary)' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                Spatial Scope & Administrative Coverage
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>State:</span>{' '}
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Kerala</strong>
                </div>
                <div style={{ color: '#cbd5e1' }}>/</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>District:</span>{' '}
                  <select
                    value={selectedDistrict?.id || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const d = districts.find(item => item.id === id);
                      setSelectedDistrict(d || null);
                    }}
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    {districts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name.replace(' [DEMO]', '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ color: '#cbd5e1' }}>/</div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Administrative Level:</span>{' '}
                  <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>Block / Taluka Level</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                {districts.length} Districts Available
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="mb-8">
        <KeralaMap selectedDistrict={selectedDistrict} />
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
          <div className="stat-card-label">Active Districts (Kerala)</div>
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
                      <span className="hazard-tag" data-hazard={assessment.hazard_type || assessment.module_code}>
                        {assessment.hazard_type || assessment.module_type || assessment.module_code || 'Hazard'}
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

      {/* Cross-district comparison (HVRA §3.4) */}
      <div className="card mb-8">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>🏙️</span> Cross-District Comparison
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              District-averaged module scores across completed assessments — supports State-level prioritization.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(['HAZARD', 'VULNERABILITY', 'EXPOSURE', 'COMPOSITE_RISK'] as const).map((m) => (
              <button
                key={m}
                className={`btn ${summaryModule === m ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setSummaryModule(m)}
              >
                {m === 'COMPOSITE_RISK' ? 'Composite Risk' : m[0] + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body">
          {summaryLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
              Computing district-level aggregation…
            </div>
          ) : summaryError ? (
            <div className="alert alert-error">⚠️ {summaryError}</div>
          ) : !summary || summary.districts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏙️</div>
              <div className="empty-state-title">No completed {summaryModule.replace('_', ' ').toLowerCase()} assessments</div>
              <div className="empty-state-description">
                Complete assessments in at least two districts to populate the comparison.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="compare-grid">
              {/* Chart */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#334155' }}>Average Score by District</h4>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.districts} margin={{ top: 5, right: 10, left: -18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="district_name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} tickFormatter={(v: string) => v.replace(' [DEMO]', '').slice(0, 12)} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: any) => [Number(value).toFixed(2), 'Avg Score']}
                        labelFormatter={(label: any) => String(label).replace(' [DEMO]', '')}
                      />
                      <Bar dataKey="average_score" radius={[4, 4, 0, 0]}>
                        {summary.districts.map((d, i) => (
                          <Cell key={i} fill={d.average_score >= 7 ? '#ef4444' : d.average_score >= 5 ? '#f59e0b' : d.average_score >= 3 ? '#eab308' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="data-table" style={{ width: '100%', margin: 0, fontSize: '0.82rem' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>District</th>
                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>Assess.</th>
                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>Units</th>
                      <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>Avg Score</th>
                      <th style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>Top Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.districts.map((d) => {
                      const summaryCounts = d.classification_summary || {};
                      const topCls = Object.entries(summaryCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '—';
                      return (
                        <tr key={d.district_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>{d.district_name.replace(' [DEMO]', '')}</td>
                          <td style={{ textAlign: 'center', padding: '0.55rem 0.5rem' }}>{d.assessment_count}</td>
                          <td style={{ textAlign: 'center', padding: '0.55rem 0.5rem' }}>{d.unit_results}</td>
                          <td style={{ textAlign: 'center', padding: '0.55rem 0.5rem', fontWeight: 700 }}>{d.average_score.toFixed(2)}</td>
                          <td style={{ textAlign: 'center', padding: '0.55rem 0.75rem' }}>
                            <span className={`badge ${topCls === 'HH' || topCls === 'VERY_HIGH' ? 'badge-error' : topCls === 'MH' || topCls === 'HIGH' ? 'badge-warning' : 'badge-success'}`}>
                              {topCls}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
