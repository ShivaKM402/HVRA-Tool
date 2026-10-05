/**
 * Task Force Review Decision & Submit Modals
 * Supports submitting for review and approving/rejecting with comments.
 */
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  submitAssessmentForReview,
  approveAssessment,
  rejectAssessment,
  submitRiskForReview,
  approveRisk,
  rejectRisk,
} from '../../services/api';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'submit' | 'decision';
  assessmentId: number;
  assessmentName: string;
  isRisk?: boolean;
  onSuccess: (newStatus: string) => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  mode,
  assessmentId,
  assessmentName,
  isRisk = false,
  onSuccess,
}: ReviewModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [comment, setComment] = useState('');
  const [reviewerOrg, setReviewerOrg] = useState('Kerala State Disaster Management Authority');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmitReview = async () => {
    try {
      setLoading(true);
      if (isRisk) {
        await submitRiskForReview(assessmentId);
      } else {
        await submitAssessmentForReview(assessmentId);
      }

      showToast({
        title: 'Submitted for Review',
        message: `"${assessmentName}" has been placed in the Task Force Review Queue.`,
        type: 'success',
      });
      onSuccess('SUBMITTED');
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Submission Failed',
        message: err.message || 'Could not submit assessment for review.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!comment.trim() && decision === 'REJECT') {
      showToast({
        title: 'Review Comment Required',
        message: 'Please provide a comment explaining why this assessment was rejected.',
        type: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      const reviewerName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username || 'Task Force Officer';
      
      if (decision === 'APPROVE') {
        if (isRisk) {
          await approveRisk(assessmentId, comment);
        } else {
          await approveAssessment(assessmentId, comment, reviewerName, reviewerOrg);
        }
        showToast({
          title: 'Assessment Endorsed',
          message: `"${assessmentName}" has been formally approved by the Task Force.`,
          type: 'success',
        });
        onSuccess('APPROVED');
      } else {
        if (isRisk) {
          await rejectRisk(assessmentId, comment);
        } else {
          await rejectAssessment(assessmentId, comment, reviewerName, reviewerOrg);
        }
        showToast({
          title: 'Assessment Returned',
          message: `"${assessmentName}" returned to submitting officer with revision notes.`,
          type: 'info',
        });
        onSuccess('REJECTED');
      }
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Review Decision Error',
        message: err.message || 'Could not record Task Force decision.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboard-overlay" onClick={onClose} style={{ zIndex: 9997 }}>
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, textAlign: 'left' }}>
        <div className="onboard-header">
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Governance & Validation
            </div>
            <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>
              {mode === 'submit' ? 'Submit for Task Force Review' : 'Task Force Review Decision'}
            </h3>
          </div>
          <button className="onboard-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'submit' ? (
            <>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                Submitting <strong>&ldquo;{assessmentName}&rdquo;</strong> will place this assessment into the official <strong>Task Force Review Queue</strong>. Designated district and state reviewers will inspect the thematic layers, classification boundaries, and calculated scores before final government endorsement.
              </p>
              <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: '0.82rem', color: '#166534' }}>
                ✓ Once submitted, you can track endorsement status directly from your Dashboard and Reports gallery.
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Review Decision
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVE')}
                    className={`btn ${decision === 'APPROVE' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      justifyContent: 'center',
                      background: decision === 'APPROVE' ? '#16a34a' : undefined,
                      borderColor: decision === 'APPROVE' ? '#16a34a' : undefined,
                    }}
                  >
                    ✓ Endorse & Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECT')}
                    className={`btn ${decision === 'REJECT' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      justifyContent: 'center',
                      background: decision === 'REJECT' ? '#dc2626' : undefined,
                      borderColor: decision === 'REJECT' ? '#dc2626' : undefined,
                    }}
                  >
                    ✕ Request Revisions
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Reviewing Agency / Department
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={reviewerOrg}
                  onChange={(e) => setReviewerOrg(e.target.value)}
                  placeholder="e.g. KSDMA / District Collectorate"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Comments / Endorsement Notes {decision === 'REJECT' && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    decision === 'APPROVE'
                      ? 'e.g. Reviewed indicator weights and spatial overlay. Boundaries match field verification.'
                      : 'e.g. Please recalculate using updated 2026 monsoon rainfall dataset from IMD.'
                  }
                />
              </div>
            </>
          )}
        </div>

        <div className="onboard-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          {mode === 'submit' ? (
            <button className="btn btn-primary btn-sm" onClick={handleSubmitReview} disabled={loading}>
              {loading ? 'Submitting...' : 'Confirm Submission →'}
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={handleDecision}
              disabled={loading}
              style={{
                background: decision === 'APPROVE' ? '#16a34a' : '#dc2626',
                color: '#fff',
                border: 'none',
              }}
            >
              {loading ? 'Processing...' : decision === 'APPROVE' ? 'Submit Approval' : 'Submit Rejection'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
