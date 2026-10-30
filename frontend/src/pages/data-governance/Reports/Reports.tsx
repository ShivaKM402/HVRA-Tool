import { MapIcon } from '@/components/MapIcon/MapIcon';
import { DeleteButton } from '@/components/DeleteButton/DeleteButton';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getAssessments,
  downloadReportDocx,
  downloadReportPdf,
  downloadReportCsv,
  downloadReportBundle,
  getRiskAssessments,
  downloadRiskReportDocx,
  downloadRiskReportPdf,
  downloadRiskReportBundle,
  getSavedQueries,
  deleteSavedQuery,
  shareSavedQuery,
  runSavedQuery,
  submitAssessmentForReview,
  submitRiskForReview,
  deleteAssessment,
  deleteRiskAssessment,
} from '@/services/api';
import type { Assessment, RiskAssessment, SavedQuery, ApprovalStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useHazard } from '@/context/HazardContext';
import SendDocumentModal from '@/components/Modals/SendDocumentModal';

const APPROVAL_BADGES: Record<ApprovalStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'badge-draft' },
  SUBMITTED: { label: 'Submitted', cls: 'badge-warning' },
  APPROVED: { label: 'Approved', cls: 'badge-success' },
  REJECTED: { label: 'Rejected', cls: 'badge-error' },
};

/** Inline Task Force review cell — submit from the directory, review on the results page. */
function TaskForceCell({
  kind,
  id,
  approvalStatus,
  isCompleted,
  onChange,
  submittedBy,
  reviewerName,
  sentTo,
  onOpenSendModal,
}: {
  kind: 'assessment' | 'risk';
  id: number;
  approvalStatus?: ApprovalStatus;
  isCompleted: boolean;
  onChange: () => void;
  submittedBy?: string | null;
  reviewerName?: string;
  sentTo?: string | null;
  onOpenSendModal?: () => void;
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
      const payload = {
        sent_to: 'Senior Department Reviewer (Level 2 Technical Review)',
        note: 'Submitted via Generated & Saved Reports Repository',
        reviewer_org: 'District Disaster Management Authority (DDMA)',
      };
      if (kind === 'assessment') {
        await submitAssessmentForReview(id, payload);
      } else {
        await submitRiskForReview(id, payload);
      }
      onChange();
    } catch (err: any) {
      setError(err.message || 'Failed to submit for review.');
    } finally {
      setBusy(false);
    }
  };

  const senderShort = submittedBy ? submittedBy.split('(')[0].trim() : 'Analyst';
  const targetRecipient = sentTo || reviewerName || 'Senior Reviewer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
      <span className={`badge ${badge.cls}`} style={{ fontSize: '0.68rem', fontWeight: 700 }}>
        {badge.label}
      </span>
      {status === 'PENDING' && isCompleted && isAuthenticated && (
        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', whiteSpace: 'nowrap' }}
          onClick={() => {
            if (onOpenSendModal) {
              onOpenSendModal();
            } else {
              submit();
            }
          }}
          disabled={busy}
          title="Submit to Senior Reviewer for Technical Verification & Endorsement"
        >
          {busy ? 'Submitting…' : '📤 Submit to Senior'}
        </button>
      )}
      {status === 'SUBMITTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', textAlign: 'center' }}>
          <Link
            to={`/${kind === 'risk' ? 'risk-assessments' : 'assessments'}/${id}/results`}
            style={{ fontSize: '0.7rem', fontWeight: 700, color: isAdmin ? '#dc2626' : '#b45309', textDecoration: 'none' }}
          >
            {isAdmin ? 'Verify & Review →' : '⏳ In Review'}
          </Link>
          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} title={`Submitted by ${submittedBy || 'Analyst'}`}>
            From: <strong>{senderShort}</strong>
          </span>
          <span
            style={{
              fontSize: '0.64rem',
              color: '#0369a1',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '4px',
              padding: '0.1rem 0.35rem',
              fontWeight: 600,
              maxWidth: '130px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`Sent to: ${targetRecipient}`}
          >
            ➡️ {targetRecipient}
          </span>
        </div>
      )}
      {status === 'APPROVED' && reviewerName && (
        <span style={{ fontSize: '0.66rem', color: '#166534', fontWeight: 600 }} title={`Endorsed by ${reviewerName}`}>
          ✓ By: {reviewerName}
        </span>
      )}
      {error && <span style={{ fontSize: '0.65rem', color: '#dc2626' }}>{error}</span>}
    </div>
  );
}

export default function Reports() {
  const { canDelete } = useAuth();
  const { activeHazard, activeHazardMeta } = useHazard();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hazardFilter, setHazardFilter] = useState(activeHazard || '');
  const [viewFilter, setViewFilter] = useState<'all' | 'submitted' | 'approved' | 'draft' | 'risk' | 'queries'>('all');

  useEffect(() => {
    if (activeHazard) {
      setHazardFilter(activeHazard);
    }
  }, [activeHazard]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [savedQueriesLoading, setSavedQueriesLoading] = useState(false);
  const [savedQueryNotice, setSavedQueryNotice] = useState<string | null>(null);
  const [runningQueryId, setRunningQueryId] = useState<number | null>(null);

  // Senior / Manager Dispatch Modal State
  const [sendModalConfig, setSendModalConfig] = useState<{
    isOpen: boolean;
    documentType: 'assessment' | 'risk_assessment' | 'spatial_dataset' | 'query' | 'document';
    documentId?: number;
    documentTitle: string;
    subtitle?: string;
    fileFormat?: string;
    hazardType?: string;
    districtName?: string;
  } | null>(null);

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

  const loadAllReports = async () => {
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
  };

  useEffect(() => {
    loadAllReports();
    reloadSavedQueries();
  }, []);

  const refreshRow = (_id?: number) => {
    loadAllReports();
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

  const handleDeleteAssessment = async (a: Assessment) => {
    if (!window.confirm(`Are you sure you want to delete assessment "${a.name}"?\n\nThis will permanently remove the assessment report, map layers, and indicator results.`)) {
      return;
    }
    try {
      await deleteAssessment(a.id);
      setAssessments(prev => prev.filter(item => item.id !== a.id));
      setSavedQueryNotice(`Assessment "${a.name}" deleted successfully.`);
      setTimeout(() => setSavedQueryNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to delete assessment: ${err.message || 'Error'}`);
    }
  };

  const handleDeleteRisk = async (r: RiskAssessment) => {
    if (!window.confirm(`Are you sure you want to delete composite risk report "${r.name}"?\n\nThis will permanently remove the composite risk profile and results.`)) {
      return;
    }
    try {
      await deleteRiskAssessment(r.id);
      setRiskAssessments(prev => prev.filter(item => item.id !== r.id));
      setSavedQueryNotice(`Composite risk scenario "${r.name}" deleted successfully.`);
      setTimeout(() => setSavedQueryNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to delete risk assessment: ${err.message || 'Error'}`);
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

  const handleDownload = async (id: number, name: string, format: 'docx' | 'pdf' | 'csv' | 'bundle') => {
    try {
      setDownloadingId(id);
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (format === 'docx') {
        await downloadReportDocx(id, `${safeName}.docx`);
      } else if (format === 'pdf') {
        await downloadReportPdf(id, `${safeName}.pdf`);
      } else if (format === 'bundle') {
        await downloadReportBundle(id, `${safeName}_data_package.zip`);
      } else {
        await downloadReportCsv(id, `${safeName}.csv`);
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRiskDownload = async (id: number, name: string, format: 'docx' | 'pdf' | 'bundle') => {
    try {
      setDownloadingId(id);
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (format === 'docx') {
        await downloadRiskReportDocx(id, `${safeName}.docx`);
      } else if (format === 'bundle') {
        await downloadRiskReportBundle(id, `${safeName}_data_package.zip`);
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

  const effectiveHazard = activeHazard || hazardFilter;

  // Base search & hazard filters
  const baseFilteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      const q = searchQuery.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q) || (a.district_name || '').toLowerCase().includes(q);
      const matchHazard = !effectiveHazard || (a.hazard_type && a.hazard_type.toUpperCase() === effectiveHazard.toUpperCase());
      return matchName && matchHazard;
    });
  }, [assessments, searchQuery, effectiveHazard]);

  const baseFilteredRisk = useMemo(() => {
    return riskAssessments.filter(r => {
      const q = searchQuery.toLowerCase();
      const matchName = !q || r.name.toLowerCase().includes(q) || (r.district_name || '').toLowerCase().includes(q);
      if (!effectiveHazard) return matchName;
      const hName = (r.hazard_assessment_name || '').toUpperCase();
      const rName = r.name.toUpperCase();
      const matchesHazard = hName.includes(effectiveHazard) || rName.includes(effectiveHazard);
      return matchName && (matchesHazard || !r.hazard_assessment_name);
    });
  }, [riskAssessments, searchQuery, effectiveHazard]);

  // View Filter breakdown (All, Submitted/Sent, Approved, Drafts)
  const submittedAssessments = useMemo(
    () => baseFilteredAssessments.filter(a => a.approval_status === 'SUBMITTED'),
    [baseFilteredAssessments]
  );
  const submittedRisk = useMemo(
    () => baseFilteredRisk.filter(r => r.approval_status === 'SUBMITTED'),
    [baseFilteredRisk]
  );

  const approvedAssessments = useMemo(
    () => baseFilteredAssessments.filter(a => a.approval_status === 'APPROVED'),
    [baseFilteredAssessments]
  );
  const approvedRisk = useMemo(
    () => baseFilteredRisk.filter(r => r.approval_status === 'APPROVED'),
    [baseFilteredRisk]
  );

  const draftAssessments = useMemo(
    () => baseFilteredAssessments.filter(a => !a.approval_status || a.approval_status === 'PENDING'),
    [baseFilteredAssessments]
  );
  const draftRisk = useMemo(
    () => baseFilteredRisk.filter(r => !r.approval_status || r.approval_status === 'PENDING'),
    [baseFilteredRisk]
  );

  const totalSubmittedCount = submittedAssessments.length + submittedRisk.length;
  const totalApprovedCount = approvedAssessments.length + approvedRisk.length;
  const totalDraftCount = draftAssessments.length + draftRisk.length;
  const totalAllCount = baseFilteredAssessments.length + baseFilteredRisk.length;

  // Active items to display based on viewFilter
  const displayAssessments = useMemo(() => {
    if (viewFilter === 'submitted') return submittedAssessments;
    if (viewFilter === 'approved') return approvedAssessments;
    if (viewFilter === 'draft') return draftAssessments;
    if (viewFilter === 'risk') return [];
    if (viewFilter === 'queries') return [];
    return baseFilteredAssessments;
  }, [viewFilter, submittedAssessments, approvedAssessments, draftAssessments, baseFilteredAssessments]);

  const displayRisk = useMemo(() => {
    if (viewFilter === 'submitted') return submittedRisk;
    if (viewFilter === 'approved') return approvedRisk;
    if (viewFilter === 'draft') return draftRisk;
    if (viewFilter === 'queries') return [];
    return baseFilteredRisk;
  }, [viewFilter, submittedRisk, approvedRisk, draftRisk, baseFilteredRisk]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.35rem' }}>
              <span>📑</span>
              <span>Generated &amp; Saved Reports Repository</span>
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>
              Centralized statutory archive of all baseline module assessments, composite risk dossiers, and multi-tier supervisor routing.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to={activeHazard ? `/risk-builder?hazard=${activeHazard}` : '/risk-builder'} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🎛️</span> Composite Risk Builder
            </Link>
            <Link to={activeHazard ? `/new-assessment?module=HAZARD&hazard=${activeHazard}` : '/new-assessment'} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>➕</span> Generate New Assessment
            </Link>
          </div>
        </div>

        {/* Quick View Segment Filter Tabs (Direct user requirement: "see reports sent to senior or manager") */}
        <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0.65rem 1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.85rem' }}
            onClick={() => setViewFilter('all')}
          >
            📋 All Reports ({totalAllCount})
          </button>

          <button
            type="button"
            className={`btn btn-sm ${viewFilter === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '0.3rem 0.85rem',
              background: viewFilter === 'submitted' ? '#dc2626' : '#fff7ed',
              color: viewFilter === 'submitted' ? '#fff' : '#c2410c',
              borderColor: viewFilter === 'submitted' ? '#dc2626' : '#fed7aa',
            }}
            onClick={() => setViewFilter('submitted')}
            title="Reports dispatched to Senior Officers & Managers for verification"
          >
            📤 Sent to Senior / Manager ({totalSubmittedCount})
          </button>

          <button
            type="button"
            className={`btn btn-sm ${viewFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.85rem',
              background: viewFilter === 'approved' ? '#16a34a' : '#f0fdf4',
              color: viewFilter === 'approved' ? '#fff' : '#15803d',
              borderColor: viewFilter === 'approved' ? '#16a34a' : '#bbf7d0',
            }}
            onClick={() => setViewFilter('approved')}
          >
            ✅ Approved &amp; Published ({totalApprovedCount})
          </button>

          <button
            type="button"
            className={`btn btn-sm ${viewFilter === 'draft' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.85rem' }}
            onClick={() => setViewFilter('draft')}
          >
            📝 Internal Drafts ({totalDraftCount})
          </button>

          <button
            type="button"
            className={`btn btn-sm ${viewFilter === 'risk' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.85rem' }}
            onClick={() => setViewFilter('risk')}
          >
            🎯 Composite Risk ({baseFilteredRisk.length})
          </button>

          <button
            type="button"
            className={`btn btn-sm ${viewFilter === 'queries' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.85rem' }}
            onClick={() => setViewFilter('queries')}
          >
            🔖 Saved Query Templates ({savedQueries.length})
          </button>
        </div>

        {/* Search & Hazard Controls */}
        <div className="card-body" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search reports by title, officer name, or district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              {activeHazard && activeHazardMeta ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    background: `${activeHazardMeta.color}15`,
                    border: `1.5px solid ${activeHazardMeta.color}44`,
                    borderRadius: '8px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: activeHazardMeta.color,
                  }}
                >
                  <span>{activeHazardMeta.icon}</span>
                  <span>Domain: {activeHazardMeta.shortName}</span>
                </div>
              ) : (
                <select
                  className="form-control"
                  value={hazardFilter}
                  onChange={(e) => setHazardFilter(e.target.value)}
                >
                  <option value="">All Hazards</option>
                  <option value="FLOOD">🌊 Flood</option>
                  <option value="LANDSLIDE">⛰️ Landslide</option>
                  <option value="COASTAL">🏖️ Coastal Inundation</option>
                  <option value="EXTREME_WEATHER">⚡ Extreme Weather</option>
                </select>
              )}
            </div>
            {searchQuery || (!activeHazard && hazardFilter) ? (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
                onClick={() => { setSearchQuery(''); if (!activeHazard) setHazardFilter(''); }}
              >
                Clear Search
              </button>
            ) : null}
          </div>
        </div>

        {/* Notice for "Sent to Senior / Manager" filter */}
        {viewFilter === 'submitted' && (
          <div
            style={{
              margin: '1rem 1.5rem 0 1.5rem',
              background: '#fff7ed',
              border: '1.5px solid #fed7aa',
              borderRadius: '8px',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>📤</span>
            <div>
              <div style={{ fontWeight: 800, color: '#9a3412', fontSize: '0.9rem' }}>
                Multi-Level Review Routing: Reports Sent to Senior Officers &amp; Managers ({totalSubmittedCount})
              </div>
              <div style={{ fontSize: '0.8rem', color: '#c2410c', marginTop: '0.2rem' }}>
                These reports have been generated and dispatched up the chain of authority. You can track who submitted the report (From), whom it was routed to (Sent To), and review remarks.
              </div>
            </div>
          </div>
        )}

        {/* Assessment Reports Table */}
        {viewFilter !== 'queries' && (
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
                <div>Loading reports repository...</div>
              </div>
            ) : error ? (
              <div className="alert alert-error" style={{ margin: '1.5rem' }}>
                ⚠️ {error}
              </div>
            ) : displayAssessments.length === 0 && viewFilter !== 'risk' ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📑</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>
                  {viewFilter === 'submitted'
                    ? 'No reports currently pending review with Senior or Manager'
                    : 'No assessment reports found for this filter'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {viewFilter === 'submitted'
                    ? 'Submit completed assessments to forward them for supervisor verification.'
                    : 'Run an assessment in the Query Builder to generate structured reports.'}
                </div>
                {viewFilter !== 'submitted' && (
                  <Link to="/new-assessment" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                    Start New Assessment
                  </Link>
                )}
              </div>
            ) : displayAssessments.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', margin: 0 }}>
                  <thead style={{ background: 'var(--bg-surface)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Assessment Title &amp; Territory</th>
                      <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Hazard / Module</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Originator (From)</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Workflow Routing &amp; Sent To</th>
                      <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Generated</th>
                      <th style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>Actions &amp; Exports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayAssessments.map((a) => {
                      const author = a.created_by_name || 'GIS Analyst';
                      const targetReviewer = a.sent_to || a.reviewer_name || 'Senior Department Reviewer (Level 2)';
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <Link to={`/assessments/${a.id}/report`} style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'none', fontSize: '0.92rem' }}>
                              {a.name}
                            </Link>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                              📍 <strong>{a.district_name || 'District'}</strong>, {a.state_name || 'Kerala'} · Level: {a.administrative_level}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                              Method: {a.normalization_method} · Indicators: {a.result_count || 'Standard'}
                            </div>
                          </td>

                          <td style={{ textAlign: 'center', padding: '1rem' }}>
                            <span className={`badge ${moduleBadge(a.module_code).cls}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {moduleBadge(a.module_code).emoji} {a.module_code === 'HAZARD' ? a.hazard_type : moduleBadge(a.module_code).label}
                            </span>
                          </td>

                          {/* Originator (From) */}
                          <td style={{ padding: '1rem', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span>👤</span>
                                <span>{author.split('(')[0].trim()}</span>
                              </div>
                              {author.includes('(') && (
                                <div style={{ fontSize: '0.72rem', color: '#475569', background: '#f1f5f9', borderRadius: '4px', padding: '0.15rem 0.4rem', width: 'fit-content' }}>
                                  {author.substring(author.indexOf('('))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Workflow Routing & Sent To (Direct user requirement) */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            {a.approval_status === 'SUBMITTED' ? (
                              <div
                                style={{
                                  background: '#fff7ed',
                                  border: '1.5px solid #fed7aa',
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.65rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem',
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span>📤</span>
                                  <span>Sent to: {targetReviewer}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span>⏳ Pending Level 2 Technical Verification</span>
                                </div>
                                {a.submitted_at && (
                                  <div style={{ fontSize: '0.68rem', color: '#7c2d12' }}>
                                    Dispatched: {new Date(a.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </div>
                                )}
                              </div>
                            ) : a.approval_status === 'APPROVED' ? (
                              <div
                                style={{
                                  background: '#f0fdf4',
                                  border: '1.5px solid #bbf7d0',
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.65rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem',
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span>✅</span>
                                  <span>Certified by: {a.reviewer_name || 'Approving Authority'}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                                  Statutory SDMA Endorsement Clear
                                </div>
                              </div>
                            ) : a.approval_status === 'REJECTED' ? (
                              <div
                                style={{
                                  background: '#fef2f2',
                                  border: '1.5px solid #fecaca',
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.65rem',
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#991b1b' }}>
                                  ❌ Returned for Revision
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>
                                  {a.review_comment || `By ${a.reviewer_name || 'Supervisor'}`}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <span className="badge badge-draft" style={{ fontSize: '0.7rem', width: 'fit-content' }}>
                                  📝 Internal Draft (Not yet sent)
                                </span>
                                <TaskForceCell
                                  kind="assessment"
                                  id={a.id}
                                  approvalStatus={a.approval_status}
                                  isCompleted={a.status === 'COMPLETED'}
                                  onChange={() => refreshRow(a.id)}
                                  submittedBy={a.created_by_name}
                                  reviewerName={a.reviewer_name}
                                  sentTo={a.sent_to}
                                  onOpenSendModal={() =>
                                    setSendModalConfig({
                                      isOpen: true,
                                      documentType: 'assessment',
                                      documentId: a.id,
                                      documentTitle: a.name,
                                      subtitle: `District: ${a.district_name || 'Kerala'} · Hazard: ${a.hazard_type || 'FLOOD'}`,
                                      fileFormat: 'PDF',
                                      hazardType: a.hazard_type || 'FLOOD',
                                      districtName: a.district_name,
                                    })
                                  }
                                />
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'center', padding: '1rem' }}>
                            <span className={`badge ${a.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                              {a.status}
                            </span>
                          </td>

                          <td style={{ padding: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                            {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>

                          <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              <Link
                                to={`/department-coordination?assessmentId=${a.id}`}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#0d9488', borderColor: '#ccfbf1', background: '#f0fdfa', fontWeight: 600 }}
                                title="Department Line Data Coordination"
                              >
                                🏛️ Depts
                              </Link>
                              <Link to={`/assessments/${a.id}/report`} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem' }} title="View Structured Dossier">
                                👁️ View
                              </Link>
                              <Link to={`/assessments/${a.id}/results`} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem' }} title="Interactive Map Results">
                                <MapIcon /> Map
                              </Link>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#b91c1c' }}
                                title="Download Word DOCX"
                                onClick={() => handleDownload(a.id, a.name, 'docx')}
                                disabled={downloadingId === a.id}
                              >
                                📄 DOCX
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#dc2626' }}
                                title="Download PDF"
                                onClick={() => handleDownload(a.id, a.name, 'pdf')}
                                disabled={downloadingId === a.id}
                              >
                                📥 PDF
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0', fontWeight: 600 }}
                                title="Export Complete Data Package (ZIP) for Cross-Agency Sharing"
                                onClick={() => handleDownload(a.id, a.name, 'bundle')}
                                disabled={downloadingId === a.id}
                              >
                                📦 Package
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.28rem 0.6rem',
                                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Send Report & PDF to Senior Reviewer or Manager"
                                onClick={() =>
                                  setSendModalConfig({
                                    isOpen: true,
                                    documentType: 'assessment',
                                    documentId: a.id,
                                    documentTitle: a.name,
                                    subtitle: `District: ${a.district_name || 'Kerala'} · Hazard: ${a.hazard_type || 'FLOOD'}`,
                                    fileFormat: 'PDF',
                                    hazardType: a.hazard_type || 'FLOOD',
                                    districtName: a.district_name,
                                  })
                                }
                              >
                                <span>📤</span> Send
                              </button>
                              {canDelete && (
                                <DeleteButton onClick={() => handleDeleteAssessment(a)} title="Delete Assessment Report" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Composite Risk (Module 4) Directory */}
      {(viewFilter === 'all' || viewFilter === 'submitted' || viewFilter === 'approved' || viewFilter === 'draft' || viewFilter === 'risk') && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
                <span>🎯</span> Composite Risk Reports (Module 4 — R = H × V × E)
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                Scenario-based multi-criteria risk dossiers combining completed Hazard, Vulnerability and Exposure assessments with supervisor review.
              </div>
            </div>
            <Link to={activeHazard ? `/risk-builder?hazard=${activeHazard}` : '/risk-builder'} className="btn btn-primary btn-sm">
              + New Risk Scenario
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
                <div>Loading risk reports...</div>
              </div>
            ) : displayRisk.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>
                  {viewFilter === 'submitted'
                    ? 'No composite risk reports currently pending review'
                    : 'No composite risk assessments in this filter'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Combine Module 1–3 results to generate and endorse composite risk profiles.
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', margin: 0 }}>
                  <thead style={{ background: 'var(--bg-surface)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Risk Scenario &amp; Territory</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Inputs &amp; Weights</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Originator (From)</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Workflow Routing &amp; Sent To</th>
                      <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Generated</th>
                      <th style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>Actions &amp; Exports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRisk.map((r) => {
                      const components = [
                        r.hazard_assessment ? 'H' : null,
                        r.vulnerability_assessment ? 'V' : null,
                        r.exposure_assessment ? 'E' : null,
                      ].filter(Boolean).join(' + ');
                      const weights = `H${r.hazard_weight}·V${r.vulnerability_weight}·E${r.exposure_weight}`;
                      const author = r.created_by_name || 'State Risk Officer';
                      const targetReviewer = r.sent_to || r.reviewer_name || 'Senior Department Reviewer (Level 2)';

                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <Link to={`/risk-assessments/${r.id}/report`} style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'none', fontSize: '0.92rem' }}>
                              {r.name}
                            </Link>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                              📍 <strong>{r.district_name || 'District'}</strong>, {r.state_name || 'Kerala'} · {r.administrative_level}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                              Formula: {r.formula === 'MULTIPLICATIVE' ? 'R = H × V × E' : 'Weighted Sum'}
                            </div>
                          </td>

                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{components || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Weights: {weights}
                            </div>
                          </td>

                          {/* Originator (From) */}
                          <td style={{ padding: '1rem', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span>👤</span>
                                <span>{author.split('(')[0].trim()}</span>
                              </div>
                              {author.includes('(') && (
                                <div style={{ fontSize: '0.72rem', color: '#475569', background: '#f1f5f9', borderRadius: '4px', padding: '0.15rem 0.4rem', width: 'fit-content' }}>
                                  {author.substring(author.indexOf('('))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Workflow Routing & Sent To */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            {r.approval_status === 'SUBMITTED' ? (
                              <div
                                style={{
                                  background: '#fff7ed',
                                  border: '1.5px solid #fed7aa',
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.65rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem',
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span>📤</span>
                                  <span>Sent to: {targetReviewer}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#9a3412' }}>
                                  ⏳ Pending Level 2/3 Endorsement
                                </div>
                                {r.submitted_at && (
                                  <div style={{ fontSize: '0.68rem', color: '#7c2d12' }}>
                                    Dispatched: {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </div>
                                )}
                              </div>
                            ) : r.approval_status === 'APPROVED' ? (
                              <div
                                style={{
                                  background: '#f0fdf4',
                                  border: '1.5px solid #bbf7d0',
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.65rem',
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span>✅</span>
                                  <span>Certified by: {r.reviewer_name || 'Approving Manager'}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                                  Multi-Hazard Risk Dossier Endorsed
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <span className="badge badge-draft" style={{ fontSize: '0.7rem', width: 'fit-content' }}>
                                  📝 Scenario Draft
                                </span>
                                <TaskForceCell
                                  kind="risk"
                                  id={r.id}
                                  approvalStatus={r.approval_status}
                                  isCompleted={r.status === 'COMPLETED'}
                                  onChange={() => refreshRow(r.id)}
                                  submittedBy={r.created_by_name}
                                  reviewerName={r.reviewer_name}
                                  sentTo={r.sent_to}
                                  onOpenSendModal={() =>
                                    setSendModalConfig({
                                      isOpen: true,
                                      documentType: 'risk_assessment',
                                      documentId: r.id,
                                      documentTitle: r.name,
                                      subtitle: `District: ${r.district_name || 'Kerala'} · Multi-Hazard Composite Risk`,
                                      fileFormat: 'PDF',
                                      hazardType: 'MULTI-HAZARD',
                                      districtName: r.district_name,
                                    })
                                  }
                                />
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'center', padding: '1rem' }}>
                            <span className={`badge ${r.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                              {r.status}
                            </span>
                          </td>

                          <td style={{ padding: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent'}
                          </td>

                          <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              <Link to={`/risk-assessments/${r.id}/report`} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem' }} title="View Risk Dossier">
                                👁️ View
                              </Link>
                              <Link to={`/risk-assessments/${r.id}/results`} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem' }} title="Interactive Risk Map">
                                <MapIcon /> Map
                              </Link>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#b91c1c' }}
                                title="Download Word DOCX"
                                onClick={() => handleRiskDownload(r.id, r.name, 'docx')}
                                disabled={downloadingId === r.id}
                              >
                                📄 DOCX
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#dc2626' }}
                                title="Download PDF"
                                onClick={() => handleRiskDownload(r.id, r.name, 'pdf')}
                                disabled={downloadingId === r.id}
                              >
                                📥 PDF
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0', fontWeight: 600 }}
                                title="Export Complete Multi-Hazard Risk Data Package (ZIP)"
                                onClick={() => handleRiskDownload(r.id, r.name, 'bundle')}
                                disabled={downloadingId === r.id}
                              >
                                📦 Package
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.28rem 0.6rem',
                                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Send Composite Risk Dossier to Senior Reviewer or Manager"
                                onClick={() =>
                                  setSendModalConfig({
                                    isOpen: true,
                                    documentType: 'risk_assessment',
                                    documentId: r.id,
                                    documentTitle: r.name,
                                    subtitle: `District: ${r.district_name || 'Kerala'} · Multi-Hazard Composite Risk`,
                                    fileFormat: 'PDF',
                                    hazardType: 'MULTI-HAZARD',
                                    districtName: r.district_name,
                                  })
                                }
                              >
                                <span>📤</span> Send
                              </button>
                              {canDelete && (
                                <DeleteButton onClick={() => handleDeleteRisk(r)} title="Delete Composite Risk Assessment" />
                              )}
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
      )}

      {/* Saved Queries (HVRA §3.3 — reusable & shareable queries) */}
      {(viewFilter === 'all' || viewFilter === 'queries') && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
              <span>🔖</span> Saved Queries &amp; Reusable Templates
            </h2>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Reusable spatial query templates — re-run with live telemetry or share via token link.
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
              <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
                <div className="empty-state-icon" style={{ fontSize: '2rem' }}>🔖</div>
                <div className="empty-state-title" style={{ fontWeight: 600, marginTop: '0.5rem' }}>No saved queries yet</div>
                <div className="empty-state-description" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  In the Query Builder's Review step, click "Save Query" to store a reusable configuration.
                </div>
                <Link to="/new-assessment" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                  Open Query Builder
                </Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', margin: 0 }}>
                  <thead style={{ background: 'var(--bg-surface)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>Template Name</th>
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
                              style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}
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
                            {canDelete && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', color: '#dc2626' }}
                                onClick={() => handleDeleteQuery(q)}
                                title="Delete Template"
                              >
                                🗑️
                              </button>
                            )}
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
      )}

      {/* Universal Senior / Manager Dispatch Modal */}
      {sendModalConfig && (
        <SendDocumentModal
          isOpen={sendModalConfig.isOpen}
          onClose={() => setSendModalConfig(null)}
          documentType={sendModalConfig.documentType}
          documentId={sendModalConfig.documentId}
          documentTitle={sendModalConfig.documentTitle}
          subtitle={sendModalConfig.subtitle}
          fileFormat={sendModalConfig.fileFormat}
          hazardType={sendModalConfig.hazardType}
          districtName={sendModalConfig.districtName}
          onSuccess={() => {
            if (sendModalConfig.documentType === 'assessment' && sendModalConfig.documentId) {
              refreshRow(sendModalConfig.documentId);
            } else if (sendModalConfig.documentType === 'risk_assessment' && sendModalConfig.documentId) {
              refreshRow(sendModalConfig.documentId);
            } else {
              loadAllReports();
            }
          }}
        />
      )}
    </div>
  );
}
