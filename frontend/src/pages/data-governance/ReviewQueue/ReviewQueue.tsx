/**
 * Task Force Review Queue Page (HVRA §8 / Section 6)
 * Enables designated Task Force reviewers and platform administrators to inspect,
 * endorse, or return assessments submitted by domain departments.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAssessments, getRiskAssessments } from '@/services/api';
import { useDistrict } from '@/context/DistrictContext';
import ReviewModal from '@/components/Modals/ReviewModal';
import type { Assessment, RiskAssessment } from '@/types';
import './ReviewQueue.css';

export default function ReviewQueue() {
  const { districts } = useDistrict();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // Default to ALL so approved and rejected files always stay visible

  // Modal State
  const [selectedItem, setSelectedItem] = useState<{ id: number; name: string; isRisk: boolean } | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [aData, rData] = await Promise.all([
        getAssessments(),
        getRiskAssessments(),
      ]);
      setAssessments(aData.results || []);
      setRiskAssessments(rData.results || []);
    } catch (err) {
      console.warn('Could not load review queue items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Normalize into single queue item list
  const combinedItems = [
    ...assessments.map((a) => ({
      id: a.id,
      name: a.name,
      module_type: a.module_type,
      district_id: a.district,
      district_name: a.district_name || 'Thiruvananthapuram',
      status: a.status,
      approval_status: a.approval_status || 'PENDING',
      created_by: a.created_by_name || 'District Officer',
      submitted_at: a.submitted_at || a.created_at,
      reviewer_name: a.reviewer_name,
      department_submissions: (a as any).department_submissions || {},
      isRisk: false,
    })),
    ...riskAssessments.map((r) => ({
      id: r.id,
      name: r.name,
      module_type: 'COMPOSITE_RISK',
      district_id: r.district,
      district_name: r.district_name || 'District',
      status: r.status,
      approval_status: r.approval_status || 'PENDING',
      created_by: r.created_by_name || 'State Officer',
      submitted_at: r.submitted_at || r.created_at,
      reviewer_name: r.reviewer_name,
      isRisk: true,
    })),
  ];

  // Filtering
  const filteredItems = combinedItems.filter((item) => {
    if (districtFilter !== 'ALL' && String(item.district_id) !== districtFilter) return false;
    if (moduleFilter !== 'ALL' && item.module_type !== moduleFilter) return false;
    if (statusFilter !== 'ALL' && item.approval_status !== statusFilter) return false;
    return true;
  });

  const pendingCount = combinedItems.filter((i) => i.approval_status === 'SUBMITTED').length;
  const approvedCount = combinedItems.filter((i) => i.approval_status === 'APPROVED').length;
  const rejectedCount = combinedItems.filter((i) => i.approval_status === 'REJECTED').length;

  const handleOpenDecision = (item: { id: number; name: string; isRisk: boolean }) => {
    setSelectedItem(item);
    setIsDecisionModalOpen(true);
  };

  return (
    <div className="review-queue-container">
      {/* Page Header */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              <Link to="/dashboard">Dashboard</Link> / <span>Task Force Review</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              🏛️ Task Force Review Queue
              {pendingCount > 0 && <span className="badge badge-warning">{pendingCount} Action Required</span>}
            </h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Statutory verification and formal endorsement of Hazard, Vulnerability, Exposure, and Composite Risk assessments submitted by district officers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchData}>
              🔄 Refresh Queue
            </button>
            <Link to="/reports" className="btn btn-primary btn-sm">
              📄 View Published Reports
            </Link>
          </div>
        </div>

        {/* Status Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
          <div
            onClick={() => setStatusFilter('SUBMITTED')}
            style={{
              padding: '0.85rem',
              borderRadius: 8,
              border: '1px solid #fed7aa',
              background: statusFilter === 'SUBMITTED' ? '#ffedd5' : '#fff7ed',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c2410c' }}>Pending Approval</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#9a3412', margin: '0.15rem 0' }}>{pendingCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#ea580c' }}>Requires TF Decision</div>
          </div>

          <div
            onClick={() => setStatusFilter('APPROVED')}
            style={{
              padding: '0.85rem',
              borderRadius: 8,
              border: '1px solid #bbf7d0',
              background: statusFilter === 'APPROVED' ? '#dcfce7' : '#f0fdf4',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d' }}>Endorsed / Approved</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534', margin: '0.15rem 0' }}>{approvedCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Formally Gazetted</div>
          </div>

          <div
            onClick={() => setStatusFilter('REJECTED')}
            style={{
              padding: '0.85rem',
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: statusFilter === 'REJECTED' ? '#fee2e2' : '#fef2f2',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c' }}>Revisions Requested</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b', margin: '0.15rem 0' }}>{rejectedCount}</div>
            <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>Returned with Notes</div>
          </div>

          <div
            onClick={() => setStatusFilter('ALL')}
            style={{
              padding: '0.85rem',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: statusFilter === 'ALL' ? '#e2e8f0' : '#f8fafc',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Total in System</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0.15rem 0' }}>{combinedItems.length}</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>All Modules</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
            Filter by District
          </label>
          <select
            className="form-control"
            style={{ minWidth: 160 }}
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
          >
            <option value="ALL">All Districts</option>
            {districts.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
            Filter by Module
          </label>
          <select
            className="form-control"
            style={{ minWidth: 160 }}
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="ALL">All Modules</option>
            <option value="HAZARD">Hazard Assessment</option>
            <option value="VULNERABILITY">Vulnerability Assessment</option>
            <option value="EXPOSURE">Exposure Assessment</option>
            <option value="COMPOSITE_RISK">Composite Risk (HVRA)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
            Review Status
          </label>
          <select
            className="form-control"
            style={{ minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Pending Review (Submitted)</option>
            <option value="APPROVED">Approved / Endorsed</option>
            <option value="REJECTED">Rejected / Returned</option>
            <option value="PENDING">Draft / Unsubmitted</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: '0.8rem', color: '#64748b' }}>
          Showing <strong>{filteredItems.length}</strong> items
        </div>
      </div>

      {/* Queue Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" />
            <div style={{ marginTop: '0.75rem', color: '#64748b' }}>Loading review queue...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No Assessments Found</h3>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>
              No submissions match the selected filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="review-table">
              <thead>
                <tr>
                  <th>Assessment Name</th>
                  <th>Module</th>
                  <th>District</th>
                  <th>Submitted By</th>
                  <th>Submission Date</th>
                  <th>Approval Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const targetReportUrl = item.isRisk
                    ? `/risk-assessments/${item.id}/report`
                    : `/assessments/${item.id}/report`;

                  return (
                    <tr key={`${item.isRisk ? 'risk' : 'std'}-${item.id}`}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <Link to={targetReportUrl} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                            {item.name}
                          </Link>
                          {/* Department Review Cards (Requirements Item 6) */}
                          {(item as any).department_submissions && Object.keys((item as any).department_submissions).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                              {Object.entries((item as any).department_submissions).map(([dName, sub]: [string, any]) => (
                                <div
                                  key={dName}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    background: sub.status === 'SUBMITTED' ? '#ecfdf5' : '#fffbeb',
                                    border: sub.status === 'SUBMITTED' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                                    color: sub.status === 'SUBMITTED' ? '#065f46' : '#92400e',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                  title={`${dName}: ${sub.officer_name || sub.submitted_by || 'Officer'} | ${sub.notes || 'Endorsed'}${sub.attachment_name ? ` (Evidence: ${sub.attachment_name})` : ''}`}
                                >
                                  <span>{sub.status === 'SUBMITTED' ? '✓' : '⏳'}</span>
                                  <strong>{dName.split(' ')[0]}:</strong>
                                  <span>{sub.status === 'SUBMITTED' ? 'Verified' : 'Pending'}</span>
                                  {sub.attachment_name && <span title={sub.attachment_name}>📎</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                          {item.module_type}
                        </span>
                      </td>
                      <td>{item.district_name}</td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>{item.created_by}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              item.approval_status === 'APPROVED' ? '#dcfce7' : item.approval_status === 'SUBMITTED' ? '#ffedd5' : item.approval_status === 'REJECTED' ? '#fee2e2' : '#f1f5f9',
                            color:
                              item.approval_status === 'APPROVED' ? '#15803d' : item.approval_status === 'SUBMITTED' ? '#c2410c' : item.approval_status === 'REJECTED' ? '#b91c1c' : '#475569',
                            fontWeight: 700,
                          }}
                        >
                          {item.approval_status === 'APPROVED' ? '✓ ENDORSED' : item.approval_status === 'REJECTED' ? '❌ REVISION REQ' : item.approval_status}
                        </span>
                        {item.reviewer_name && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                            By: {item.reviewer_name.split('(')[0].trim()}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            to={`/department-coordination?assessmentId=${item.id}`}
                            className="btn btn-secondary btn-sm"
                            title="Inspect Department Coordination & Verification"
                          >
                            🏛️ Coordination
                          </Link>
                          <Link to={targetReportUrl} className="btn btn-secondary btn-sm" title="Inspect Dossier">
                            Inspect 👁️
                          </Link>
                          {item.approval_status === 'APPROVED' && (
                            <a
                              href={`${item.isRisk ? '/api/risk-assessments' : '/api/assessments'}/${item.id}/export/bundle/`}
                              className="btn btn-secondary btn-sm"
                              title="Export Complete Data Package (ZIP) for Cross-Agency Sharing"
                              style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600 }}
                              download
                            >
                              📦 Package
                            </a>
                          )}
                          {item.approval_status === 'SUBMITTED' ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenDecision(item)}
                            >
                              Decide 🏛️
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenDecision(item)}
                              title="Modify / Re-evaluate Decision"
                            >
                              🔄 Re-evaluate
                            </button>
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

      {/* Decision Modal */}
      {selectedItem && (
        <ReviewModal
          isOpen={isDecisionModalOpen}
          onClose={() => setIsDecisionModalOpen(false)}
          mode="decision"
          assessmentId={selectedItem.id}
          assessmentName={selectedItem.name}
          isRisk={selectedItem.isRisk}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
