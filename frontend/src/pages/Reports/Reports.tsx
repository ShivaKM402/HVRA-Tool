import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getAssessments,
  downloadReportDocx,
  downloadReportPdf,
  downloadReportCsv,
  getRiskAssessments,
  downloadRiskReportDocx,
  downloadRiskReportPdf,
  getSavedQueries,
  deleteSavedQuery,
  shareSavedQuery,
  runSavedQuery,
  submitAssessmentForReview,
  submitRiskForReview,
} from '../../services/api';
import type { Assessment, RiskAssessment, SavedQuery, ApprovalStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

const APPROVAL_BADGES: Record<ApprovalStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'badge-draft' },
  SUBMITTED: { label: 'Submitted', cls: 'badge-warning' },
  APPROVED: { label: 'Approved', cls: 'badge-success' },
  REJECTED: { label: 'Rejected', cls: 'badge-error' },
};

/** Inline Task Force review cell — submit from the directory, review on the results page. */
function TaskForceCell({ kind, id, approvalStatus, isCompleted, onChange }: {
  kind: 'assessment' | 'risk';
  id: number;
  approvalStatus?: ApprovalStatus;
  isCompleted: boolean;
  onChange: () => void;
}) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = approvalStatus || 'PENDING';
  const badge = APPROVAL_BADGES[status] || APPROVAL_BADGES.PENDING;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'assessment') {
        await submitAssessmentForReview(id);
      } else {
        await submitRiskForReview(id);
      }
      onChange();
    } catch (err: any) {
      setError(err.message || 'Failed to submit for review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <span className={`badge ${badge.cls}`} style={{ fontSize: '0.68rem', fontWeight: 700 }}>
        {badge.label}
      </span>
      {status === 'PENDING' && isCompleted && isAuthenticated && (
        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Submitting…' : '📤 Submit for Review'}
        </button>
      )}
      {status === 'SUBMITTED' && (
        <Link
          to={`/${kind === 'risk' ? 'risk-assessments' : 'assessments'}/${id}/results`}
          style={{ fontSize: '0.7rem', fontWeight: 600, color: isAdmin ? '#2563eb' : '#94a3b8', textDecoration: 'none' }}
        >
          {isAdmin ? 'Review →' : '⏳ Awaiting TF'}
        </Link>
      )}
      {error && <span style={{ fontSize: '0.65rem', color: '#dc2626' }}>{error}</span>}
    </div>
  );
}

export default function Reports() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hazardFilter, setHazardFilter] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [savedQueriesLoading, setSavedQueriesLoading] = useState(false);
  const [savedQueryNotice, setSavedQueryNotice] = useState<string | null>(null);
  const [runningQueryId, setRunningQueryId] = useState<number | null>(null);

  const reloadSavedQueries = async () => {
    try {
      setSavedQueriesLoading(true);
      const qs = await getSavedQueries();
      setSavedQueries(qs);
    } catch {
      // Saved queries are an optional section; ignore transient failures.
    } finally {
      setSavedQueriesLoading(false);
    }
  };

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        const [assess, risk] = await Promise.all([getAssessments(), getRiskAssessments()]);
        setAssessments(assess.results || []);
        setRiskAssessments(risk.results || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load assessments.');
      } finally {
        setLoading(false);
      }
    }
    loadReports();
    reloadSavedQueries();
  }, []);

  const refreshRow = (id: number) => {
    setAssessments(prev => prev.map(a => (a.id === id ? a : a)));
    setRiskAssessments(prev => prev.map(r => (r.id === id ? r : r)));
    reloadSavedQueries();
  };

  const handleDeleteQuery = async (q: SavedQuery) => {
    if (!window.confirm(`Delete saved query "${q.name}"?`)) return;
    try {
      await deleteSavedQuery(q.id);
      setSavedQueryNotice(`Query "${q.name}" deleted.`);
      reloadSavedQueries();
    } catch (err: any) {
      setSavedQueryNotice(`⚠️ ${err.message || 'Failed to delete query.'}`);
    }
  };

  const handleShareQuery = async (q: SavedQuery) => {
    try {
      const res = await shareSavedQuery(q.id);
      setSavedQueryNotice(`🔗 Share link generated: ${res.saved_query.share_url || '—'}`);
      reloadSavedQueries();
    } catch (err: any) {
      setSavedQueryNotice(`⚠️ ${err.message || 'Failed to share query.'}`);
    }
  };

  const handleRunQuery = async (q: SavedQuery) => {
    setRunningQueryId(q.id);
    setSavedQueryNotice(null);
    try {
      const res = await runSavedQuery(q.id);
      const target = res.risk_assessment
        ? `/risk-assessments/${res.risk_assessment.id}/results`
        : res.assessment
          ? `/assessments/${res.assessment.id}/results`
          : null;
      if (target) {
        window.location.href = target;
      } else {
        setSavedQueryNotice(`⚠️ ${res.message || 'Query run produced no assessment.'}`);
      }
    } catch (err: any) {
      setSavedQueryNotice(`⚠️ ${err.message || 'Failed to run query.'}`);
    } finally {
      setRunningQueryId(null);
    }
  };

  const handleDownload = async (id: number, name: string, format: 'docx' | 'pdf' | 'csv') => {
    try {
      setDownloadingId(id);
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (format === 'docx') {
        await downloadReportDocx(id, `${safeName}.docx`);
      } else if (format === 'pdf') {
        await downloadReportPdf(id, `${safeName}.pdf`);
      } else {
        await downloadReportCsv(id, `${safeName}.csv`);
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRiskDownload = async (id: number, name: string, format: 'docx' | 'pdf') => {
    try {
      setDownloadingId(id);
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (format === 'docx') {
        await downloadRiskReportDocx(id, `${safeName}.docx`);
      } else {
        await downloadRiskReportPdf(id, `${safeName}.pdf`);
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const MODULE_BADGES: Record<string, { label: string; emoji: string; cls: string }> = {
    HAZARD: { label: 'Hazard', emoji: '🌊', cls: 'badge-info' },
    VULNERABILITY: { label: 'Vulnerability', emoji: '👥', cls: 'badge-warning' },
    EXPOSURE: { label: 'Exposure', emoji: '🏗️', cls: 'badge-success' },
    COMPOSITE_RISK: { label: 'Composite Risk', emoji: '🎯', cls: 'badge-danger' },
  };
  const moduleBadge = (m?: string) =>
    MODULE_BADGES[(m || 'HAZARD').toUpperCase()] || MODULE_BADGES.HAZARD;

  const filtered = assessments.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchName = a.name.toLowerCase().includes(q) || (a.district_name || '').toLowerCase().includes(q);
    const isHazard = (a.module_code || 'HAZARD') === 'HAZARD';
    const matchHazard = !hazardFilter || (isHazard && a.hazard_type.toUpperCase() === hazardFilter.toUpperCase());
    return matchName && matchHazard;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>📄</span> Assessment Reports Library
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              Standardized 10-chapter assessment reports with automated scoring, geospatial indicators, and DOCX/PDF export.
            </div>
          </div>
          <Link to="/new-assessment" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>➕</span> Generate New Assessment
          </Link>
        </div>

        {/* Filters */}
        <div className="card-body" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search reports by title or district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <select
                className="form-control"
                value={hazardFilter}
                onChange={(e) => setHazardFilter(e.target.value)}
              >
                <option value="">All Hazard Types</option>
                <option value="FLOOD">🌊 Flood</option>
                <option value="LANDSLIDE">⛰️ Landslide</option>
                <option value="CYCLONE">🌀 Cyclone</option>
                <option value="DROUGHT">☀️ Drought</option>
                <option value="EARTHQUAKE">🌋 Earthquake</option>
              </select>
            </div>
            {searchQuery || hazardFilter ? (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
                onClick={() => { setSearchQuery(''); setHazardFilter(''); }}
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Reports List */}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
              <div>Loading reports directory...</div>
            </div>
          ) : error ? (
            <div className="alert alert-error" style={{ margin: '1.5rem' }}>
              ⚠️ {error}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📑</div>
              <div style={{ fontWeight: 600, color: '#334155' }}>No assessment reports found</div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Run an assessment in the Query Builder to auto-compile structured reports.
              </div>
              <Link to="/new-assessment" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                Start New Assessment
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Assessment Title</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Location</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Hazard</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Task Force</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Generated</th>
                    <th style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>Actions & Exports</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <Link to={`/assessments/${a.id}/report`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                          {a.name}
                        </Link>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Level: {a.administrative_level} · Method: {a.normalization_method}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{a.district_name || 'District'}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{a.state_name || 'Kerala'}</div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        <span className={`badge ${moduleBadge(a.module_code).cls}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {moduleBadge(a.module_code).emoji} {a.module_code === 'HAZARD' ? a.hazard_type : moduleBadge(a.module_code).label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        <span className={`badge ${a.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '1rem' }}>
                        <TaskForceCell
                          kind="assessment"
                          id={a.id}
                          approvalStatus={a.approval_status}
                          isCompleted={a.status === 'COMPLETED'}
                          onChange={() => refreshRow(a.id)}
                        />
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                        {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <Link to={`/assessments/${a.id}/report`} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} title="View Structured Report">
                            👁️ View
                          </Link>
                          <Link to={`/assessments/${a.id}/results`} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} title="Interactive Map Results">
                            🗺️ Map
                          </Link>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#2563eb' }}
                            title="Download Word DOCX"
                            onClick={() => handleDownload(a.id, a.name, 'docx')}
                            disabled={downloadingId === a.id}
                          >
                            📄 DOCX
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#dc2626' }}
                            title="Download PDF"
                            onClick={() => handleDownload(a.id, a.name, 'pdf')}
                            disabled={downloadingId === a.id}
                          >
                            📥 PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Composite Risk (Module 4) Directory */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>🎯</span> Composite Risk Reports (Module 4 — R = H × V × E)
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              Scenario-based risk profiles combining completed Hazard, Vulnerability and Exposure assessments with adjustable module weights.
            </div>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
              <div>Loading risk reports...</div>
            </div>
          ) : riskAssessments.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
              <div style={{ fontWeight: 600, color: '#334155' }}>No composite risk assessments yet</div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Combine Module 1–3 results to generate a risk profile.
              </div>
              <Link to="/new-assessment" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                Build Composite Risk Scenario
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Risk Scenario</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Inputs</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Formula</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Task Force</th>
                    <th style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>Actions & Exports</th>
                  </tr>
                </thead>
                <tbody>
                  {riskAssessments.map((r) => {
                    const components = [
                      r.hazard_assessment ? 'H' : null,
                      r.vulnerability_assessment ? 'V' : null,
                      r.exposure_assessment ? 'E' : null,
                    ].filter(Boolean).join(' + ');
                    const weights = `H${r.hazard_weight}·V${r.vulnerability_weight}·E${r.exposure_weight}`;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <Link to={`/risk-assessments/${r.id}/report`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                            {r.name}
                          </Link>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                            Level: {r.administrative_level} · Weights: {weights}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.district_name || 'District'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.state_name || 'Kerala'}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{components || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {r.hazard_assessment_name ? `H: ${r.hazard_assessment_name.slice(0, 28)}…` : ''}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {r.vulnerability_assessment_name ? `V: ${r.vulnerability_assessment_name.slice(0, 28)}…` : ''}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {r.exposure_assessment_name ? `E: ${r.exposure_assessment_name.slice(0, 28)}…` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                            {r.formula === 'MULTIPLICATIVE' ? 'R = H × V × E' : 'Weighted Sum'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <span className={`badge ${r.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          <TaskForceCell
                            kind="risk"
                            id={r.id}
                            approvalStatus={r.approval_status}
                            isCompleted={r.status === 'COMPLETED'}
                            onChange={() => refreshRow(r.id)}
                          />
                        </td>
                        <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            <Link to={`/risk-assessments/${r.id}/report`} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} title="View Risk Report">
                              👁️ View
                            </Link>
                            <Link to={`/risk-assessments/${r.id}/results`} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} title="Interactive Risk Map">
                              🗺️ Map
                            </Link>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#2563eb' }}
                              title="Download Word DOCX"
                              onClick={() => handleRiskDownload(r.id, r.name, 'docx')}
                              disabled={downloadingId === r.id}
                            >
                              📄 DOCX
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#dc2626' }}
                              title="Download PDF"
                              onClick={() => handleRiskDownload(r.id, r.name, 'pdf')}
                              disabled={downloadingId === r.id}
                            >
                              📥 PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Saved Queries (HVRA §3.3 — reusable & shareable queries) */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>🔖</span> Saved Queries
          </h2>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Reusable configurations — re-run or share via a public link.
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {savedQueryNotice && (
            <div className="alert alert-info" style={{ margin: '1rem' }}>
              <span>ℹ️</span>
              <div>{savedQueryNotice}</div>
            </div>
          )}

          {savedQueriesLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
              Loading saved queries…
            </div>
          ) : savedQueries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔖</div>
              <div className="empty-state-title">No saved queries yet</div>
              <div className="empty-state-description">
                In the Query Builder's Review step, click "Save Query" to store a reusable configuration.
              </div>
              <Link to="/new-assessment" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Open Query Builder
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Query</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Module</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Location</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Share Link</th>
                    <th style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQueries.map((q) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{q.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {q.description ? q.description.slice(0, 70) : `Saved ${new Date(q.created_at).toLocaleDateString()}`}
                          {q.is_shared && <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.62rem' }}>Shared</span>}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {q.module_type}{q.hazard_type ? ` · ${q.hazard_type}` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>
                        {q.district_name || 'All districts'}{q.administrative_level ? ` · ${q.administrative_level}` : ''}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>
                        {q.share_url ? (
                          <a
                            href={q.share_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}
                          >
                            🔗 Public link
                          </a>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}
                            onClick={() => handleShareQuery(q)}
                          >
                            Share
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                            onClick={() => handleRunQuery(q)}
                            disabled={runningQueryId === q.id}
                          >
                            {runningQueryId === q.id ? 'Running…' : '▶ Run'}
                          </button>
                          {!q.share_url && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                              onClick={() => handleShareQuery(q)}
                            >
                              🔗 Share
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', color: '#dc2626' }}
                            onClick={() => handleDeleteQuery(q)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
