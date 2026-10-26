/**
 * DepartmentCoordinationPage — Clean visual design.
 * Streamlined 5-step workflow:
 * 1. Select Line Department (5 official departments)
 * 2. Select Review Type & Verification Checklist
 * 3. Attach Document / File
 * 4. Select Senior Recipient (Send To)
 * 5. Add Remarks & Submit for Sign-off
 */
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useHazard, HAZARD_CATALOG, HazardCode } from '../../../context/HazardContext';
import { useAuth } from '../../../context/AuthContext';
import { getAssessments, postDepartmentSubmission, getDepartmentSubmissions } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import type { Assessment, DepartmentSubmissionsResponse } from '../../../types';
import './DepartmentCoordinationPage.css';

export const OFFICIAL_DEPARTMENTS = [
  {
    value: 'Water Resources (Irrigation)',
    icon: '🌊',
    shortName: 'Water Resources',
    desc: 'River gauges, dam storage & hydrology telemetry',
  },
  {
    value: 'LSGD / Panchayats',
    icon: '🏛️',
    shortName: 'LSGD / Panchayats',
    desc: 'Local body wards, building permits & household density',
  },
  {
    value: 'PWD Roads & Bridges',
    icon: '🛣️',
    shortName: 'PWD Roads',
    desc: 'Road network submergence & bridge clearance data',
  },
  {
    value: 'Economics & Statistics',
    icon: '📊',
    shortName: 'Economics & Stats',
    desc: 'Socio-economic indicators & vulnerable population counts',
  },
  {
    value: 'Health & Family Welfare',
    icon: '🏥',
    shortName: 'Health Department',
    desc: 'Hospital capacities, emergency beds & medical response',
  },
];

export const REVIEW_TYPES = [
  { value: 'pre_monsoon', label: '🌧️ Pre-Monsoon Hazard Preparedness Review' },
  { value: 'baseline_validation', label: '📋 Baseline Data & GIS Boundary Validation' },
  { value: 'damage_assessment', label: '🏚️ Post-Event Damage & Impact Verification' },
  { value: 'statutory_clearance', label: '⚖️ Statutory Multi-Department Clearance' },
  { value: 'contingency_audit', label: '🛡️ Emergency Contingency & Resource Audit' },
];

export const SEND_TO_OPTIONS = [
  {
    value: 'district_collector',
    label: '🏢 District Collector (DDMA Chairman)',
    role: 'Statutory Approval Authority (Level 4)',
    office: 'District Disaster Management Authority (DDMA)',
    portalAccount: '@district_admin',
    officialEmail: 'collectorate.kottayam@kerala.gov.in',
    controlRoomPhone: '1077 (Toll-Free DEOC) / 0481-2562201',
    dispatchMode: 'In-Portal Approval Queue (e-Office Statutory Clearance)',
  },
  {
    value: 'ksdma_officer',
    label: '🔰 KSDMA Senior Disaster Management Officer',
    role: 'State Review & Protocol Compliance (Level 5)',
    office: 'Kerala State Disaster Management Authority',
    portalAccount: '@state_admin',
    officialEmail: 'ksdma.disaster@kerala.gov.in',
    controlRoomPhone: '1070 (Toll-Free SEOC) / 0471-2364424',
    dispatchMode: 'Statewide SDMA Command Queue',
  },
  {
    value: 'state_coordinator',
    label: '🏛️ State Disaster Management Coordinator',
    role: 'Inter-Agency Coordination Lead',
    office: 'Revenue & Disaster Management Dept',
    portalAccount: '@state_admin',
    officialEmail: 'revenue.disaster@kerala.gov.in',
    controlRoomPhone: '0471-2333198',
    dispatchMode: 'Revenue Department Intranet Queue',
  },
  {
    value: 'task_force_lead',
    label: '📋 DEOC Task Force Lead',
    role: 'Operational Readiness Lead (Level 3)',
    office: 'District Emergency Operations Center',
    portalAccount: '@manager',
    officialEmail: 'deoc.operations@kerala.gov.in',
    controlRoomPhone: '1077 (24x7 Control Room)',
    dispatchMode: 'DEOC Review Board & Field Queue',
  },
  {
    value: 'department_head',
    label: '👤 Head of Department (Chief Engineer / Director)',
    role: 'Internal Line Department Sign-off (Level 2)',
    office: 'State Directorate',
    portalAccount: '@senior_employee',
    officialEmail: 'chiefengineer.line@kerala.gov.in',
    controlRoomPhone: '0471-2324900',
    dispatchMode: 'Department Directorate Queue',
  },
];

export const REVIEW_CHECKS = [
  { id: 1, label: 'Field survey records verified & cross-checked', icon: '🔍' },
  { id: 2, label: 'Department baseline data confirmed & validated', icon: '📊' },
  { id: 3, label: 'Hazard area boundaries & GIS records verified', icon: '🗺️' },
  { id: 4, label: 'Supporting clearance documentation attached', icon: '📎' },
];

export default function DepartmentCoordinationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { activeHazard, activeHazardMeta, clearHazard } = useHazard();
  const fileRef = useRef<HTMLInputElement>(null);

  const DEFAULT_HAZARD_IDS: Record<HazardCode, number> = {
    FLOOD: 86, LANDSLIDE: 87, COASTAL: 88, EXTREME_WEATHER: 89,
  };

  const assessmentIdFromQuery = searchParams.get('assessmentId');
  const initialId = parseInt(assessmentIdFromQuery || String(DEFAULT_HAZARD_IDS[activeHazard as HazardCode] || 86), 10);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState<number>(initialId);
  const [submissionHistory, setSubmissionHistory] = useState<DepartmentSubmissionsResponse | null>(null);

  // Form states
  const [department, setDepartment] = useState<string>(OFFICIAL_DEPARTMENTS[0].value);
  const [reviewType, setReviewType] = useState<string>(REVIEW_TYPES[0].value);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set([1, 2]));
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sendTo, setSendTo] = useState<string>(SEND_TO_OPTIONS[0].value);
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string>('');

  const currentMeta = activeHazardMeta || HAZARD_CATALOG[activeHazard as HazardCode] || HAZARD_CATALOG.FLOOD;
  const currentRecipient = SEND_TO_OPTIONS.find(o => o.value === sendTo) || SEND_TO_OPTIONS[0];
  const currentDeptMeta = OFFICIAL_DEPARTMENTS.find(d => d.value === department) || OFFICIAL_DEPARTMENTS[0];
  const currentReviewMeta = REVIEW_TYPES.find(r => r.value === reviewType) || REVIEW_TYPES[0];

  // Auto-detect user department if logged in as a department officer
  useEffect(() => {
    if (user?.profile?.department) {
      const match = OFFICIAL_DEPARTMENTS.find(d =>
        d.value.toLowerCase().includes(user.profile!.department!.toLowerCase()) ||
        user.profile!.department!.toLowerCase().includes(d.shortName.toLowerCase())
      );
      if (match) {
        setDepartment(match.value);
      }
    }
  }, [user]);

  // Load assessments
  useEffect(() => {
    getAssessments()
      .then(res => {
        if (res.results) setAssessments(res.results);
      })
      .catch(() => {});
  }, []);

  // Load existing department submissions for current assessment
  useEffect(() => {
    if (!assessmentId) return;
    getDepartmentSubmissions(assessmentId)
      .then(res => setSubmissionHistory(res))
      .catch(() => setSubmissionHistory(null));
  }, [assessmentId]);

  const toggleCheck = (id: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllChecks = () => {
    if (checkedItems.size === REVIEW_CHECKS.length) {
      setCheckedItems(new Set());
    } else {
      setCheckedItems(new Set(REVIEW_CHECKS.map(c => c.id)));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const recipientName = currentRecipient.label.replace(/^.{2}/, '').trim();

      await postDepartmentSubmission(assessmentId, {
        department: department,
        notes: notes.trim()
          ? `[${currentReviewMeta.label.replace(/^.{2}/, '').trim()}] ${notes.trim()} (Sent to: ${recipientName})`
          : `[${currentReviewMeta.label.replace(/^.{2}/, '').trim()}] Verified by ${department} and submitted to ${recipientName}.`,
        source_type: 'Department Field Survey',
        designation: department,
        attachment_name: attachedFile ? attachedFile.name : undefined,
      });

      setSubmitted(true);
      setSubmittedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      showToast({
        title: 'Review Sent Successfully ✓',
        message: `${department} report dispatched to ${recipientName}.`,
        type: 'success',
      });

      // Refresh submissions history
      getDepartmentSubmissions(assessmentId)
        .then(res => setSubmissionHistory(res))
        .catch(() => {});
    } catch (err: any) {
      showToast({
        title: 'Submission Error',
        message: err.message || 'Could not send report. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hazardAssessments = assessments.filter(a => !activeHazard || a.hazard_type === activeHazard);
  const selectedAssessment = assessments.find(a => a.id === assessmentId);

  /* ── SUCCESS STATE ── */
  if (submitted) {
    return (
      <div className="dc-page">
        <div className="dc-success-card">
          <div className="dc-success-icon-wrap">
            <span className="dc-success-icon">✓</span>
          </div>

          <span className="dc-success-tag">Review Dispatched</span>
          <h2 className="dc-success-title">Report Successfully Sent!</h2>
          <p className="dc-success-sub">
            The <strong>{department}</strong> sign-off dossier has been officially submitted for senior review.
          </p>

          {/* Receipt Box */}
          <div className="dc-receipt-box">
            <div className="dc-receipt-row">
              <span className="dc-receipt-label">Recipient:</span>
              <span className="dc-receipt-val">{currentRecipient.label}</span>
            </div>
            <div className="dc-receipt-row">
              <span className="dc-receipt-label">Review Type:</span>
              <span className="dc-receipt-val">{currentReviewMeta.label}</span>
            </div>
            <div className="dc-receipt-row">
              <span className="dc-receipt-label">Assessment:</span>
              <span className="dc-receipt-val">
                {selectedAssessment ? selectedAssessment.name.replace(' [DEMO]', '') : `Assessment #${assessmentId}`}
              </span>
            </div>
            <div className="dc-receipt-row">
              <span className="dc-receipt-label">Checks Completed:</span>
              <span className="dc-receipt-val">{checkedItems.size} of {REVIEW_CHECKS.length} verified</span>
            </div>
            {attachedFile && (
              <div className="dc-receipt-row">
                <span className="dc-receipt-label">Attached Document:</span>
                <span className="dc-receipt-val dc-receipt-file">
                  📄 {attachedFile.name} ({formatFileSize(attachedFile.size)})
                </span>
              </div>
            )}
            <div className="dc-receipt-row">
              <span className="dc-receipt-label">Submitted At:</span>
              <span className="dc-receipt-val">{submittedAt || 'Just now'}</span>
            </div>
          </div>

          <div className="dc-success-actions">
            <button
              type="button"
              className="dc-btn-primary"
              onClick={() => {
                setSubmitted(false);
                setNotes('');
                setAttachedFile(null);
                setCheckedItems(new Set([1, 2]));
              }}
            >
              ＋ Submit Another Review
            </button>
            <Link to={`/dashboard?hazard=${activeHazard || 'FLOOD'}`} className="dc-btn-secondary">
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dc-page">
      {/* ── Page Header ── */}
      <div className="dc-header">
        <div className="dc-header-left">
          <span className="dc-badge" style={{ background: currentMeta.color }}>
            {currentMeta.icon} {currentMeta.shortName}
          </span>
          <div>
            <h1 className="dc-page-title">Department Review & Sign-off</h1>
            <p className="dc-page-sub">
              Streamlined sign-off portal: verify records, attach reports, and dispatch to senior review authorities.
            </p>
          </div>
        </div>
        <div className="dc-header-right">
          <Link to={`/dashboard?hazard=${activeHazard || 'FLOOD'}`} className="dc-btn-secondary">
            ← Dashboard
          </Link>
          <button
            type="button"
            className="dc-btn-ghost"
            onClick={() => {
              clearHazard();
              navigate('/dashboard');
            }}
          >
            Change Hazard
          </button>
        </div>
      </div>

      {/* ── Active Assessment Selector Bar ── */}
      <div className="dc-context-bar">
        <div className="dc-context-item">
          <span className="dc-context-label">Target Assessment:</span>
          {hazardAssessments.length > 0 ? (
            <select
              className="dc-select dc-select--compact"
              value={String(assessmentId)}
              onChange={e => setAssessmentId(parseInt(e.target.value, 10))}
            >
              {hazardAssessments.map(a => (
                <option key={a.id} value={String(a.id)}>
                  {a.name.replace(' [DEMO]', '')} ({a.hazard_type})
                </option>
              ))}
            </select>
          ) : (
            <span className="dc-context-val">Assessment #{assessmentId}</span>
          )}
        </div>
        <div className="dc-context-status">
          <span className="dc-status-dot"></span>
          <span>Official Statutory Portal</span>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="dc-card">

        {/* ── STEP 1: Select Department ── */}
        <div className="dc-section">
          <div className="dc-section-header">
            <span className="dc-step-badge">Step 1</span>
            <div>
              <h2 className="dc-section-title">Select Your Department</h2>
              <p className="dc-section-desc">Choose from the 5 official line departments responsible for sign-off.</p>
            </div>
          </div>

          {/* Clean Dropdown */}
          <div className="dc-field">
            <label className="dc-label" htmlFor="dept-select">
              Department Dropdown
            </label>
            <select
              id="dept-select"
              className="dc-select dc-select--lg"
              value={department}
              onChange={e => setDepartment(e.target.value)}
            >
              {OFFICIAL_DEPARTMENTS.map(d => (
                <option key={d.value} value={d.value}>
                  {d.icon} {d.value} — {d.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Selection Pills */}
          <div className="dc-dept-pills">
            {OFFICIAL_DEPARTMENTS.map(d => (
              <button
                key={d.value}
                type="button"
                className={`dc-dept-pill ${department === d.value ? 'dc-dept-pill--active' : ''}`}
                onClick={() => setDepartment(d.value)}
              >
                <span className="dc-pill-icon">{d.icon}</span>
                <span className="dc-pill-text">{d.shortName}</span>
              </button>
            ))}
          </div>

          <div className="dc-dept-active-info">
            <span className="dc-info-icon">{currentDeptMeta.icon}</span>
            <div>
              <strong>{currentDeptMeta.value}</strong>
              <div className="dc-info-sub">{currentDeptMeta.desc}</div>
            </div>
          </div>
        </div>

        {/* ── STEP 2: Review Type & Checklist ── */}
        <div className="dc-section">
          <div className="dc-section-header">
            <span className="dc-step-badge">Step 2</span>
            <div>
              <h2 className="dc-section-title">Review Details & Verifications Needed</h2>
              <p className="dc-section-desc">Select the review type and confirm the items your department has verified.</p>
            </div>
          </div>

          {/* Review Type Dropdown */}
          <div className="dc-field">
            <label className="dc-label" htmlFor="review-type-select">
              Type of Review Needed
            </label>
            <select
              id="review-type-select"
              className="dc-select"
              value={reviewType}
              onChange={e => setReviewType(e.target.value)}
            >
              {REVIEW_TYPES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Checklist */}
          <div className="dc-checks-wrapper">
            <div className="dc-checks-top">
              <span className="dc-checks-label">
                Required Verification Checklist ({checkedItems.size}/{REVIEW_CHECKS.length} completed)
              </span>
              <button
                type="button"
                className="dc-checks-toggle-all"
                onClick={handleSelectAllChecks}
              >
                {checkedItems.size === REVIEW_CHECKS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="dc-checklist">
              {REVIEW_CHECKS.map(item => {
                const isChecked = checkedItems.has(item.id);
                return (
                  <label
                    key={item.id}
                    className={`dc-check-card ${isChecked ? 'dc-check-card--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(item.id)}
                      className="dc-checkbox-input"
                    />
                    <span className="dc-check-icon">{item.icon}</span>
                    <span className="dc-check-text">{item.label}</span>
                    <span className="dc-check-mark">{isChecked ? '✓' : ''}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── STEP 3: Attach Document ── */}
        <div className="dc-section">
          <div className="dc-section-header">
            <span className="dc-step-badge">Step 3</span>
            <div>
              <h2 className="dc-section-title">Attach Verification Document</h2>
              <p className="dc-section-desc">Attach supporting field survey reports, clearance sheets, or signed memos.</p>
            </div>
          </div>

          <div
            className={`dc-upload-zone ${attachedFile ? 'dc-upload-zone--has-file' : ''}`}
            onClick={() => fileRef.current?.click()}
          >
            {attachedFile ? (
              <div className="dc-file-preview">
                <span className="dc-file-icon">📄</span>
                <div className="dc-file-meta">
                  <span className="dc-file-name">{attachedFile.name}</span>
                  <span className="dc-file-size">{formatFileSize(attachedFile.size)}</span>
                </div>
                <button
                  type="button"
                  className="dc-btn-remove"
                  onClick={e => {
                    e.stopPropagation();
                    setAttachedFile(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <div className="dc-upload-prompt">
                <span className="dc-upload-icon">📁</span>
                <span className="dc-upload-main">Click or drop file to attach document</span>
                <span className="dc-upload-hint">Supported formats: PDF, DOCX, XLSX, CSV, JPG, PNG (Max 25 MB)</span>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                setAttachedFile(e.target.files[0]);
              }
            }}
          />
        </div>

        {/* ── STEP 4: Send to Senior Person ── */}
        <div className="dc-section">
          <div className="dc-section-header">
            <span className="dc-step-badge">Step 4</span>
            <div>
              <h2 className="dc-section-title">Send to Senior Reviewer</h2>
              <p className="dc-section-desc">Choose the designated authority or senior officer to review and sign off.</p>
            </div>
          </div>

          {/* Send To Dropdown */}
          <div className="dc-field">
            <label className="dc-label" htmlFor="send-to-select">
              Select Recipient Authority
            </label>
            <select
              id="send-to-select"
              className="dc-select dc-select--lg"
              value={sendTo}
              onChange={e => setSendTo(e.target.value)}
            >
              {SEND_TO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.office}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Profile Badge with Official Contact & Dispatch Channels */}
          <div className="dc-recipient-card">
            <div className="dc-recipient-icon">🏛️</div>
            <div className="dc-recipient-info">
              <div className="dc-recipient-topline">
                <span className="dc-recipient-name">{currentRecipient.label}</span>
                <span className="dc-recipient-account-badge">{currentRecipient.portalAccount}</span>
              </div>
              <span className="dc-recipient-office">{currentRecipient.office}</span>
              <span className="dc-recipient-role">Statutory Authority: <strong>{currentRecipient.role}</strong></span>

              {/* Official Contact Endpoints & Routing */}
              <div className="dc-recipient-contacts-grid">
                <div className="dc-contact-chip">
                  <span className="dc-contact-icon">💻</span>
                  <div>
                    <span className="dc-contact-label">Internal Routing</span>
                    <span className="dc-contact-value">{currentRecipient.dispatchMode}</span>
                  </div>
                </div>
                <div className="dc-contact-chip">
                  <span className="dc-contact-icon">✉️</span>
                  <div>
                    <span className="dc-contact-label">Official NIC Email</span>
                    <span className="dc-contact-value">{currentRecipient.officialEmail}</span>
                  </div>
                </div>
                <div className="dc-contact-chip">
                  <span className="dc-contact-icon">📞</span>
                  <div>
                    <span className="dc-contact-label">24x7 Control Room Phone</span>
                    <span className="dc-contact-value">{currentRecipient.controlRoomPhone}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Explanation */}
              <div className="dc-dispatch-explanation">
                ℹ️ <strong>How this is delivered:</strong> This report is securely dispatched into the officer&apos;s digital review queue inside this portal (tied to their official role). No external phone number or manual email is required for submission.
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 5: Remarks / Notes ── */}
        <div className="dc-section">
          <div className="dc-section-header">
            <span className="dc-step-badge">Step 5</span>
            <div>
              <h2 className="dc-section-title">Remarks & Notes</h2>
              <p className="dc-section-desc">Provide any notes, field observations, or priority instructions (optional).</p>
            </div>
          </div>

          <div className="dc-field">
            <textarea
              className="dc-textarea"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Sluice gate telemetry verified; culvert cleaning recommendations included in attached clearance memo."
            />
          </div>
        </div>

        {/* ── SUBMIT ACTION ROW ── */}
        <div className="dc-action-bar">
          <button
            type="button"
            className="dc-btn-submit"
            onClick={handleSubmit}
            disabled={submitting || checkedItems.size === 0}
          >
            {submitting ? '⏳ Dispatching Report…' : `📤 Send Report to ${currentRecipient.label.replace(/^.{2}/, '').trim()}`}
          </button>

          {checkedItems.size === 0 && (
            <span className="dc-validation-msg">
              ⚠️ Please confirm at least one item in Step 2 to enable dispatch.
            </span>
          )}
        </div>

      </div>

      {/* ── Existing Department Submissions Status ── */}
      {submissionHistory && submissionHistory.departments && submissionHistory.departments.length > 0 && (
        <div className="dc-history-card">
          <div className="dc-history-header">
            <h3 className="dc-history-title">Assessment Coordination Status</h3>
            <span className="dc-history-badge">
              {submissionHistory.submitted_departments} of {submissionHistory.total_departments} Departments Submitted
            </span>
          </div>

          <div className="dc-history-grid">
            {submissionHistory.departments.map((dept, idx) => {
              const isCurrent = dept.department === department;
              const isSubmitted = dept.status === 'SUBMITTED';
              const officer = dept.officer_name || dept.submitted_by;
              return (
                <div
                  key={idx}
                  className={`dc-history-item ${isSubmitted ? 'dc-history-item--submitted' : ''} ${
                    isCurrent ? 'dc-history-item--current' : ''
                  }`}
                >
                  <div className="dc-history-item-top">
                    <span className="dc-history-dept-name">{dept.department}</span>
                    <span className={`dc-history-pill ${isSubmitted ? 'dc-history-pill--done' : 'dc-history-pill--pending'}`}>
                      {isSubmitted ? '✓ Submitted' : 'Pending'}
                    </span>
                  </div>
                  {officer && (
                    <div className="dc-history-officer">By: {officer}</div>
                  )}
                  {dept.attachment_name && (
                    <div className="dc-history-officer">📎 {dept.attachment_name}</div>
                  )}
                  {dept.submitted_at && (
                    <div className="dc-history-date">{new Date(dept.submitted_at).toLocaleDateString()}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
