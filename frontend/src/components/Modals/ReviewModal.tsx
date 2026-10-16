/**
 * ReviewModal — Simple Submit for Senior Review
 * Clean form: review notes checklist + attach document + send to person.
 */
import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  submitAssessmentForReview,
  submitRiskForReview,
  approveAssessment,
  rejectAssessment,
  approveRisk,
  rejectRisk,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Modals.css';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'submit' | 'decision';
  assessmentId: number;
  assessmentName: string;
  isRisk?: boolean;
  onSuccess: (newStatus: string) => void;
}

const REVIEW_ITEMS = [
  'Indicator weights verified',
  'GIS data and boundary validated',
  'Historical event records confirmed',
  'Scoring results reviewed',
  'Attached supporting documents',
];

const SEND_TO_OPTIONS = [
  { value: 'Senior Department Reviewer (Level 2 Technical Review)', label: 'Senior Department Reviewer (Level 2 Technical Review)' },
  { value: 'Executive Manager / Approving Authority (Level 3 Endorsement)', label: 'Executive Manager / Approving Authority (Level 3 Endorsement)' },
  { value: 'District Collector / DDMA Chairperson (Level 4 Statutory Clearance)', label: 'District Collector / DDMA Chairperson (Level 4 Statutory Clearance)' },
  { value: 'State Disaster Management Authority (KSDMA Lead)', label: 'State Disaster Management Authority (KSDMA Lead)' },
];

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
  const fileRef = useRef<HTMLInputElement>(null);

  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [sendTo, setSendTo] = useState(SEND_TO_OPTIONS[0].value);
  const [note, setNote] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Decision mode state
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewerOrg, setReviewerOrg] = useState('Kerala State Disaster Management Authority');
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const toggleCheck = (i: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setAttachedFile(f);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const recipient = SEND_TO_OPTIONS.find(o => o.value === sendTo)?.label || sendTo;
      const payload = {
        sent_to: recipient,
        note: note,
        reviewer_org: 'Kerala State Disaster Management Authority (KSDMA)',
      };
      if (isRisk) {
        await submitRiskForReview(assessmentId, payload);
      } else {
        await submitAssessmentForReview(assessmentId, payload);
      }
      showToast({
        title: 'Dispatched for Review ✓',
        message: `Report sent to ${recipient}.`,
        type: 'success',
      });
      onSuccess('SUBMITTED');
      onClose();
    } catch (err: any) {
      showToast({ title: 'Failed', message: err.message || 'Could not submit.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!comment.trim() && decision === 'REJECT') {
      showToast({ title: 'Comment required', message: 'Please add a note for rejection.', type: 'warning' });
      return;
    }
    try {
      setLoading(true);
      const reviewerName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || 'Task Force Officer';
      if (decision === 'APPROVE') {
        isRisk
          ? await approveRisk(assessmentId, comment)
          : await approveAssessment(assessmentId, comment, reviewerName, reviewerOrg);
        showToast({ title: 'Approved ✓', message: `"${assessmentName}" has been endorsed.`, type: 'success' });
        onSuccess('APPROVED');
      } else {
        isRisk
          ? await rejectRisk(assessmentId, comment)
          : await rejectAssessment(assessmentId, comment, reviewerName, reviewerOrg);
        showToast({ title: 'Returned', message: 'Assessment returned with revision notes.', type: 'info' });
        onSuccess('REJECTED');
      }
      onClose();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Could not record decision.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /* ─── SUBMIT MODE ─────────────────────────────────────── */
  if (mode === 'submit') {
    return (
      <div className="rm-backdrop" onClick={onClose}>
        <div className="rm-box" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="rm-header">
            <span className="rm-title">📤 Send for Senior Review</span>
            <button className="rm-close" onClick={onClose}>×</button>
          </div>

          {/* Body */}
          <div className="rm-body">

            {/* 1. Review checklist */}
            <div className="rm-section">
              <label className="rm-label">1. What have you reviewed? <span className="rm-hint">(tick all that apply)</span></label>
              <div className="rm-checklist">
                {REVIEW_ITEMS.map((item, i) => (
                  <label key={i} className="rm-check-row">
                    <input
                      type="checkbox"
                      checked={checkedItems.has(i)}
                      onChange={() => toggleCheck(i)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Send to */}
            <div className="rm-section">
              <label className="rm-label">2. Send to</label>
              <select
                className="rm-select"
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
              >
                {SEND_TO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* 3. Attach document */}
            <div className="rm-section">
              <label className="rm-label">3. Attach document <span className="rm-hint">(optional)</span></label>
              <div className="rm-file-row">
                <button
                  type="button"
                  className="rm-file-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  📎 Choose File
                </button>
                <span className="rm-file-name">
                  {attachedFile ? attachedFile.name : 'No file chosen'}
                </span>
                {attachedFile && (
                  <button
                    type="button"
                    className="rm-file-remove"
                    onClick={() => { setAttachedFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                    title="Remove file"
                  >×</button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.csv,.xlsx,.png,.jpg"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {/* 4. Note */}
            <div className="rm-section">
              <label className="rm-label">4. Note <span className="rm-hint">(optional)</span></label>
              <textarea
                className="rm-textarea"
                rows={2}
                placeholder="Any additional comments for the reviewer…"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="rm-footer">
            <button className="rm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="rm-btn-send" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Sending…' : '📤 Send for Review'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── DECISION MODE (for reviewers) ───────────────────── */
  return (
    <div className="rm-backdrop" onClick={onClose}>
      <div className="rm-box" onClick={e => e.stopPropagation()}>

        <div className="rm-header">
          <span className="rm-title">🏛️ Review Decision</span>
          <button className="rm-close" onClick={onClose}>×</button>
        </div>

        <div className="rm-body">

          {/* Decision toggle */}
          <div className="rm-section">
            <label className="rm-label">Decision</label>
            <div className="rm-toggle-row">
              <button
                type="button"
                className={`rm-toggle ${decision === 'APPROVE' ? 'rm-toggle-approve' : ''}`}
                onClick={() => setDecision('APPROVE')}
              >✓ Approve</button>
              <button
                type="button"
                className={`rm-toggle ${decision === 'REJECT' ? 'rm-toggle-reject' : ''}`}
                onClick={() => setDecision('REJECT')}
              >✕ Return</button>
            </div>
          </div>

          {/* Send to / Agency */}
          <div className="rm-section">
            <label className="rm-label">Reviewing Agency</label>
            <input
              className="rm-input"
              value={reviewerOrg}
              onChange={e => setReviewerOrg(e.target.value)}
              placeholder="e.g. KSDMA / District Collectorate"
            />
          </div>

          {/* Notes */}
          <div className="rm-section">
            <label className="rm-label">
              Comments {decision === 'REJECT' && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <textarea
              className="rm-textarea"
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                decision === 'APPROVE'
                  ? 'Endorsement notes (optional)…'
                  : 'Reason for returning (required)…'
              }
            />
          </div>
        </div>

        <div className="rm-footer">
          <button className="rm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="rm-btn-send"
            onClick={handleDecision}
            disabled={loading}
            style={{ background: decision === 'APPROVE' ? '#16a34a' : '#dc2626' }}
          >
            {loading ? 'Processing…' : decision === 'APPROVE' ? '✓ Submit Approval' : '✕ Return Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
