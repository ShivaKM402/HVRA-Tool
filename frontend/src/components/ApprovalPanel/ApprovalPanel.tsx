/**
 * ApprovalPanel — Disaster Management Task Force review workflow (HVRA §8.2).
 *
 * Renders the approval lifecycle (PENDING → SUBMITTED → APPROVED/REJECTED)
 * for an assessment or a composite risk assessment. Writes are restricted:
 *  - any authenticated user may submit for review;
 *  - only Platform Admins (isAdmin) may approve / reject.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  submitAssessmentForReview,
  approveAssessment,
  rejectAssessment,
  submitRiskForReview,
  approveRisk,
  rejectRisk,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ApprovalStatus } from '../../types';

interface ApprovalPanelProps {
  kind: 'assessment' | 'risk';
  id: number;
  status: ApprovalStatus;
  isCompleted: boolean;
  hasChanges?: boolean;
  onStatusChanged?: (status: ApprovalStatus) => void;
}

const STATUS_BADGE: Record<ApprovalStatus, { label: string; cls: string; icon: string }> = {
  PENDING: { label: 'Pending Review', cls: 'badge-draft', icon: '⏳' },
  SUBMITTED: { label: 'Submitted for Review', cls: 'badge-warning', icon: '📤' },
  APPROVED: { label: 'Approved / Endorsed', cls: 'badge-success', icon: '✅' },
  REJECTED: { label: 'Rejected', cls: 'badge-error', icon: '❌' },
};

export default function ApprovalPanel({
  kind,
  id,
  status,
  isCompleted,
  onStatusChanged,
}: ApprovalPanelProps) {
  const { isAdmin, isAuthenticated, user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');

  // Viewer is read-only (HVRA §2): submitting work for Task Force review is a
  // contributing action, so hide the button for Viewers.
  const canSubmit = isAuthenticated && user?.profile?.role_code !== 'VIEWER';

  const badge = STATUS_BADGE[status] || STATUS_BADGE.PENDING;

  const refresh = (newStatus: ApprovalStatus) => onStatusChanged?.(newStatus);

  const handleAction = async (action: 'submit' | 'approve' | 'reject') => {
    setBusy(action);
    setError(null);
    try {
      if (action === 'submit') {
        if (kind === 'assessment') {
          await submitAssessmentForReview(id);
        } else {
          await submitRiskForReview(id);
        }
        refresh('SUBMITTED');
      } else {
        const fn =
          kind === 'assessment'
            ? (id: number) => approveAssessment(id, comment)
            : (id: number) => approveRisk(id, comment);
        const rf =
          kind === 'assessment'
            ? (id: number) => rejectAssessment(id, comment)
            : (id: number) => rejectRisk(id, comment);
        await (action === 'approve' ? fn(id) : rf(id));
        refresh(action === 'approve' ? 'APPROVED' : 'REJECTED');
      }
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="card"
      style={{ borderLeft: `4px solid ${status === 'APPROVED' ? '#22c55e' : status === 'REJECTED' ? '#ef4444' : status === 'SUBMITTED' ? '#f59e0b' : '#94a3b8'}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h4 className="card-title" style={{ margin: 0, fontSize: '1rem' }}>
            🏛️ Disaster Management Task Force Review
          </h4>
          <span className={`badge ${badge.cls}`} style={{ fontSize: '0.75rem', fontWeight: 700 }}>
            {badge.icon} {status}
          </span>
        </div>

        {canSubmit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {status === 'PENDING' && (
              <button
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => handleAction('submit')}
                disabled={busy !== null || !isCompleted}
                title={isCompleted ? 'Submit for Task Force review' : 'Only completed assessments can be submitted'}
              >
                {busy === 'submit' ? 'Submitting…' : '📤 Submit for Review'}
              </button>
            )}

            {status === 'SUBMITTED' && isAdmin && (
              <>
                <input
                  className="form-control"
                  style={{ width: 170, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  placeholder="Reviewer name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                />
                <input
                  className="form-control"
                  style={{ width: 230, fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  placeholder="Review comment (optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#16a34a', fontWeight: 700 }}
                  onClick={() => handleAction('approve')}
                  disabled={busy !== null}
                >
                  {busy === 'approve' ? 'Approving…' : '✓ Approve'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#dc2626', fontWeight: 700 }}
                  onClick={() => handleAction('reject')}
                  disabled={busy !== null}
                >
                  {busy === 'reject' ? 'Rejecting…' : '✕ Reject'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
        {error && (
          <div className="alert alert-error" style={{ margin: '0 0 0.5rem', padding: '0.5rem 0.75rem' }}>
            ⚠️ {error}
          </div>
        )}
        {!isCompleted && (
          <div>
            Assessment must reach <strong>COMPLETED</strong> status before it can enter the Task Force review queue.
          </div>
        )}
        {status === 'PENDING' && isCompleted && (
          <div>Not yet submitted. Submit the assessment to the Disaster Management Task Force for endorsement.</div>
        )}
        {status === 'SUBMITTED' && !isAdmin && (
          <div>
            This assessment is awaiting Task Force endorsement. An authorised {''}
            platform administrator will approve or reject it.
          </div>
        )}
        {status === 'SUBMITTED' && isAdmin && (
          <div>Approve to endorse, or reject to send it back to the analysing officer with a comment.</div>
        )}
        {status === 'APPROVED' && (
          <div>
            Endorsed by the Task Force{status === 'APPROVED' ? '' : ''}. This assessment is officially recognised for
            planning purposes. <Link to={`/${kind === 'risk' ? 'risk-assessments' : 'assessments'}/${id}/report`}>View report</Link>
          </div>
        )}
        {status === 'REJECTED' && (
          <div>The Task Force returned this assessment for revision. Re-submit after addressing the review comment.</div>
        )}
      </div>
    </div>
  );
}