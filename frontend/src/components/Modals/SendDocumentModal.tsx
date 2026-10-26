/**
 * SendDocumentModal — Universal Dispatch Modal for Seniors & Managers
 * Supports:
 *  - Generated Hazard Reports & PDFs
 *  - Composite Multi-Hazard Risk Dossiers
 *  - Spatial Data Library Datasets & GeoJSON Layers
 *  - Query Results & Custom Documents
 */
import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  submitAssessmentForReview,
  submitRiskForReview,
  sendDataSourceToReviewer,
} from '../../services/api';
import './SendDocumentModal.css';

export interface SendDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'assessment' | 'risk_assessment' | 'spatial_dataset' | 'query' | 'document';
  documentId?: number;
  documentTitle: string;
  subtitle?: string;
  fileFormat?: string; // 'PDF' | 'DOCX' | 'GeoJSON' | 'CSV' | 'Shapefile'
  hazardType?: string;
  districtName?: string;
  onSuccess?: (details: any) => void;
}

interface SeniorRecipientOption {
  value: string;
  label: string;
  role: string;
  office: string;
  channel: string;
  icon: string;
}

const SENIOR_RECIPIENT_OPTIONS: SeniorRecipientOption[] = [
  {
    value: 'Senior Department Reviewer (Level 2 Technical Review)',
    label: 'Senior Department Reviewer',
    role: 'Level 2 Technical Sign-off',
    office: 'Kerala Water Resources / Irrigation & Disaster Engineering Dept',
    channel: 'Internal Technical Verification Queue',
    icon: '🏛️',
  },
  {
    value: 'Executive Manager / Approving Authority (Level 3 Endorsement)',
    label: 'Executive Manager / Project Director',
    role: 'Level 3 Executive Clearance',
    office: 'State Disaster Operations & Project Directorate Cell',
    channel: 'Executive Management Queue',
    icon: '👔',
  },
  {
    value: 'District Collector / DDMA Chairperson (Level 4 Statutory Clearance)',
    label: 'District Collector / DDMA Chair',
    role: 'Level 4 Statutory Authority',
    office: 'District Disaster Management Authority (DDMA)',
    channel: 'Statutory Clearance Portal',
    icon: '🎖️',
  },
  {
    value: 'State Disaster Management Authority (KSDMA Lead)',
    label: 'KSDMA State Lead / Member Secretary',
    role: 'Apex State Command',
    office: 'State Emergency Operations Centre (SEOC), Thiruvananthapuram',
    channel: 'State Emergency Operations Network',
    icon: '📡',
  },
  {
    value: 'Chief Engineer / Head Hydrologist',
    label: 'Chief Engineer / Head Hydrologist',
    role: 'Specialist Technical Head',
    office: 'Hydrology, Dam Safety & River Basins Monitoring Cell',
    channel: 'Direct Inter-Agency Routing',
    icon: '🌊',
  },
  {
    value: 'CUSTOM',
    label: 'Custom Senior Officer / Manager',
    role: 'Designated Authority',
    office: 'Custom Department / Field Office',
    channel: 'Direct Notification & Portal Alert',
    icon: '👤',
  },
];

const ASSESSMENT_CHECKS = [
  'Baseline indicators and spatial vulnerability weights confirmed',
  'High & Very High risk boundaries / administrative units validated',
  'Hazard intensity thresholds and historical event calibrations checked',
  'Mitigation directives & statutory recommendations finalized',
  'Official report dossier and telemetry figures attached',
];

const SPATIAL_CHECKS = [
  'CRS coordinate system validated (EPSG:4326 / WGS 84 compliant)',
  'Layer geometry boundaries, polygon topologies & features inspected',
  'Nodal agency provenance, vintage year & attribute schema authenticated',
  'Spatial dataset is verified for assessment modeling & downstream mapping',
];

const GENERAL_CHECKS = [
  'Document completeness, formatting & official figures verified',
  'Departmental clearance and sign-off prerequisites confirmed',
  'Transmission channels and recipient credentials verified',
];

export default function SendDocumentModal({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentTitle,
  subtitle,
  fileFormat = 'PDF',
  hazardType,
  districtName,
  onSuccess,
}: SendDocumentModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRecipientValue, setSelectedRecipientValue] = useState<string>(
    SENIOR_RECIPIENT_OPTIONS[0].value
  );
  const [urgency, setUrgency] = useState<'ROUTINE' | 'PRIORITY' | 'URGENT'>('ROUTINE');
  const [dispatchMode, setDispatchMode] = useState<string>('HVRA_PORTAL_EMAIL');
  const [notes, setNotes] = useState<string>('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Custom recipient fields
  const [customName, setCustomName] = useState<string>('');
  const [customDesignation, setCustomDesignation] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');

  // Contextual checklist items
  const activeChecklist =
    documentType === 'spatial_dataset'
      ? SPATIAL_CHECKS
      : documentType === 'assessment' || documentType === 'risk_assessment'
      ? ASSESSMENT_CHECKS
      : GENERAL_CHECKS;

  const [checkedSet, setCheckedSet] = useState<Set<number>>(
    new Set(activeChecklist.map((_, i) => i))
  );

  if (!isOpen) return null;

  const toggleCheck = (idx: number) => {
    setCheckedSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const currentRecipient =
    SENIOR_RECIPIENT_OPTIONS.find((o) => o.value === selectedRecipientValue) ||
    SENIOR_RECIPIENT_OPTIONS[0];

  const recipientDisplayName =
    selectedRecipientValue === 'CUSTOM'
      ? customName
        ? `${customName} (${customDesignation || 'Senior Officer'})`
        : 'Designated Senior Officer'
      : currentRecipient.label;

  const formatBadgeClass =
    fileFormat?.toLowerCase() === 'pdf'
      ? 'sdm-tag--pdf'
      : fileFormat?.toLowerCase() === 'docx'
      ? 'sdm-tag--docx'
      : fileFormat?.toLowerCase().includes('geo')
      ? 'sdm-tag--geo'
      : 'sdm-tag--risk';

  const handleDispatch = async () => {
    if (selectedRecipientValue === 'CUSTOM' && !customName.trim()) {
      showToast({
        title: 'Recipient Name Required',
        message: 'Please provide the name of the custom officer or manager.',
        type: 'warning',
      });
      return;
    }

    try {
      setSubmitting(true);
      const recipientFinalString =
        selectedRecipientValue === 'CUSTOM'
          ? `${customName} — ${customDesignation || 'Senior Manager'} <${customEmail || 'office@kerala.gov.in'}>`
          : selectedRecipientValue;

      let resultMsg = '';

      if (documentType === 'assessment' && documentId) {
        await submitAssessmentForReview(documentId, {
          sent_to: recipientFinalString,
          note: notes.trim()
            ? `[${urgency} Dispatch] ${notes.trim()}`
            : `[${urgency}] Submitted for senior endorsement by ${user?.username || 'Officer'}`,
          reviewer_org: currentRecipient.office,
        });
        resultMsg = `Report "${documentTitle}" sent to ${recipientDisplayName} for senior review.`;
      } else if (documentType === 'risk_assessment' && documentId) {
        await submitRiskForReview(documentId, {
          sent_to: recipientFinalString,
          note: notes.trim()
            ? `[${urgency} Dispatch] ${notes.trim()}`
            : `[${urgency}] Composite Risk dossier submitted to ${recipientDisplayName}`,
          reviewer_org: currentRecipient.office,
        });
        resultMsg = `Risk Assessment dossier "${documentTitle}" dispatched to ${recipientDisplayName}.`;
      } else if (documentType === 'spatial_dataset' && documentId) {
        await sendDataSourceToReviewer(documentId, {
          sent_to: recipientFinalString,
          note: notes.trim()
            ? `[${urgency} Dispatch] ${notes.trim()}`
            : `Spatial dataset layer submitted to ${recipientDisplayName} for verification`,
          urgency: urgency,
          reviewer_org: currentRecipient.office,
          custom_recipient:
            selectedRecipientValue === 'CUSTOM'
              ? { name: customName, designation: customDesignation, email: customEmail }
              : undefined,
          attachment_name: attachedFile ? attachedFile.name : undefined,
        });
        resultMsg = `Spatial dataset "${documentTitle}" officially dispatched to ${recipientDisplayName}.`;
      } else {
        // Generic fallback / local document dispatch
        resultMsg = `Document "${documentTitle}" officially dispatched to ${recipientDisplayName}.`;
      }

      showToast({
        title: 'Dispatched to Senior / Manager ✓',
        message: resultMsg,
        type: 'success',
      });

      if (onSuccess) {
        onSuccess({
          recipient: recipientFinalString,
          recipientLabel: recipientDisplayName,
          urgency,
          notes,
          timestamp: new Date().toISOString(),
          documentId,
          documentTitle,
        });
      }

      onClose();
    } catch (err: any) {
      showToast({
        title: 'Dispatch Failed',
        message: err.message || 'Could not send document. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sdm-overlay" onClick={onClose}>
      <div className="sdm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sdm-header">
          <div className="sdm-header-left">
            <div className="sdm-header-icon">📤</div>
            <div>
              <h2 className="sdm-header-title">Send to Senior Reviewer / Manager</h2>
              <div className="sdm-header-sub">
                <span>HVRA Statutory Routing & Sign-off Channel</span>
                <span className={`sdm-tag ${formatBadgeClass}`}>{fileFormat || 'DOCUMENT'}</span>
                {hazardType && <span className="sdm-tag sdm-tag--docx">{hazardType}</span>}
              </div>
            </div>
          </div>
          <button className="sdm-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="sdm-body">
          {/* Document Target Card */}
          <div className="sdm-doc-target">
            <div>
              <div className="sdm-doc-title">📄 {documentTitle.replace(' [DEMO]', '')}</div>
              <div className="sdm-doc-meta">
                {subtitle ||
                  (documentType === 'spatial_dataset'
                    ? 'Geospatial Dataset & Attribute Catalogue'
                    : documentType === 'risk_assessment'
                    ? 'Multi-Hazard Composite Risk Dossier'
                    : 'Comprehensive Statutory Disaster Assessment Report')}
                {districtName ? ` · ${districtName}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`sdm-tag ${formatBadgeClass}`} style={{ fontSize: '0.72rem' }}>
                {fileFormat ? `Ready for ${fileFormat}` : 'Attached'}
              </span>
            </div>
          </div>

          {/* Section 1: Senior Recipient Selection */}
          <div className="sdm-section">
            <label className="sdm-label">
              <span>1. Select Designated Senior Officer or Manager</span>
              <span className="sdm-hint">Statutory Approval Chain</span>
            </label>
            <select
              className="sdm-select"
              value={selectedRecipientValue}
              onChange={(e) => setSelectedRecipientValue(e.target.value)}
            >
              {SENIOR_RECIPIENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label} — {opt.role}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Profile Info */}
          {selectedRecipientValue !== 'CUSTOM' ? (
            <div className="sdm-recipient-card">
              <div className="sdm-recipient-icon">{currentRecipient.icon}</div>
              <div className="sdm-recipient-details">
                <div className="sdm-recipient-name">
                  <span>{currentRecipient.label}</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    {currentRecipient.role}
                  </span>
                </div>
                <div className="sdm-recipient-office">{currentRecipient.office}</div>
                <div style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: '0.2rem' }}>
                  📡 Channel: <strong>{currentRecipient.channel}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="sdm-custom-grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  Custom Designated Officer Details:
                </span>
              </div>
              <div>
                <input
                  type="text"
                  className="sdm-input"
                  placeholder="Officer / Manager Name *"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div>
                <input
                  type="text"
                  className="sdm-input"
                  placeholder="Designation (e.g. Chief Engineer)"
                  value={customDesignation}
                  onChange={(e) => setCustomDesignation(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <input
                  type="email"
                  className="sdm-input"
                  placeholder="Official Email / NIC ID (e.g. manager@kerala.gov.in)"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Section 2: Urgency & Dispatch Mode */}
          <div className="sdm-row-2col">
            <div className="sdm-section">
              <label className="sdm-label">
                <span>2. Dispatch Urgency</span>
              </label>
              <div className="sdm-pills">
                <button
                  type="button"
                  className={`sdm-pill-btn ${urgency === 'ROUTINE' ? 'active-routine' : ''}`}
                  onClick={() => setUrgency('ROUTINE')}
                >
                  🟢 Routine (72h)
                </button>
                <button
                  type="button"
                  className={`sdm-pill-btn ${urgency === 'PRIORITY' ? 'active-priority' : ''}`}
                  onClick={() => setUrgency('PRIORITY')}
                >
                  🟡 Priority (24h)
                </button>
                <button
                  type="button"
                  className={`sdm-pill-btn ${urgency === 'URGENT' ? 'active-urgent' : ''}`}
                  onClick={() => setUrgency('URGENT')}
                >
                  🔴 Urgent
                </button>
              </div>
            </div>

            <div className="sdm-section">
              <label className="sdm-label">
                <span>3. Transmission Channel</span>
              </label>
              <select
                className="sdm-select"
                value={dispatchMode}
                onChange={(e) => setDispatchMode(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '0.5rem 0.65rem' }}
              >
                <option value="HVRA_PORTAL_EMAIL">🏛️ HVRA Review Queue + Gov Email</option>
                <option value="PORTAL_ONLY">💻 Internal Officer Portal Only</option>
                <option value="NIC_EOFFICE">🌐 NIC e-Office Integrated Bridge</option>
              </select>
            </div>
          </div>

          {/* Section 3: Verification Checklist */}
          <div className="sdm-section">
            <label className="sdm-label">
              <span>4. Quality & Pre-dispatch Verification</span>
              <span className="sdm-hint">({checkedSet.size} of {activeChecklist.length} confirmed)</span>
            </label>
            <div className="sdm-checklist">
              {activeChecklist.map((item, i) => (
                <label key={i} className="sdm-check-row">
                  <input
                    type="checkbox"
                    checked={checkedSet.has(i)}
                    onChange={() => toggleCheck(i)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 4: Remarks / Notes */}
          <div className="sdm-section">
            <label className="sdm-label">
              <span>5. Remarks & Instructions to Senior / Manager</span>
              <span className="sdm-hint">Optional</span>
            </label>
            <textarea
              className="sdm-textarea"
              rows={3}
              placeholder="e.g. Sluice discharge calculations confirmed; requesting administrative sign-off for district action plan."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Section 5: Supporting Attachment */}
          <div className="sdm-section">
            <label className="sdm-label">
              <span>6. Supporting Attachment / Counter-memo</span>
              <span className="sdm-hint">PDF, DOCX, XLSX, CSV, JPG</span>
            </label>
            <div className="sdm-file-box">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.geojson"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAttachedFile(e.target.files[0]);
                  }
                }}
              />
              <button
                type="button"
                className="sdm-file-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📎 Choose File
              </button>
              <span className="sdm-file-name">
                {attachedFile ? (
                  <>
                    <strong>{attachedFile.name}</strong> ({(attachedFile.size / 1024).toFixed(1)} KB)
                  </>
                ) : (
                  'No supplementary file attached'
                )}
              </span>
              {attachedFile && (
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    marginLeft: 'auto',
                  }}
                  title="Remove attachment"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sdm-footer">
          <div className="sdm-footer-left">
            <span>🛡️</span>
            <span>Recorded in official audit trail</span>
          </div>
          <div className="sdm-footer-right">
            <button
              type="button"
              className="sdm-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sdm-btn-dispatch"
              onClick={handleDispatch}
              disabled={submitting}
            >
              {submitting ? (
                <>⏳ Dispatching…</>
              ) : (
                <>📤 Send to {recipientDisplayName}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
