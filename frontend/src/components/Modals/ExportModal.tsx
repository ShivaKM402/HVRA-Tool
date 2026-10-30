/**
 * Export Options Modal
 * Allows downloading PDF, DOCX, CSV or triggering browser print.
 */
import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import SendDocumentModal from './SendDocumentModal';
import './Modals.css';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: number;
  assessmentName: string;
  isRisk?: boolean;
}

export default function ExportModal({ isOpen, onClose, assessmentId, assessmentName, isRisk = false }: ExportModalProps) {
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async (format: 'pdf' | 'docx' | 'csv' | 'print' | 'bundle') => {
    if (format === 'print') {
      onClose();
      window.print();
      return;
    }

    try {
      setDownloading(format);
      const endpointPrefix = isRisk ? `/api/risk-assessments/${assessmentId}` : `/api/assessments/${assessmentId}`;
      const url = `${endpointPrefix}/export/${format}/`;
      const ext = format === 'bundle' ? 'zip' : format;
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${assessmentName.toLowerCase().replace(/\s+/g, '_')}_${format === 'bundle' ? 'data_package' : 'report'}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({
        title: format === 'bundle' ? 'Data Package Exported ✓' : 'Report Export Initiated',
        message: format === 'bundle'
          ? `Complete multi-format package (PDF, DOCX, CSV, GeoJSON & Metadata) downloaded.`
          : `${format.toUpperCase()} export for "${assessmentName}" downloaded successfully.`,
        type: 'success',
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Export Failed',
        message: err.message || `Failed to export ${format.toUpperCase()}.`,
        type: 'error',
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="onboard-overlay" onClick={onClose} style={{ zIndex: 9997 }}>
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, textAlign: 'left' }}>
        <div className="onboard-header">
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Report Generation & Cross-File Export (Stage 2)
            </div>
            <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>Choose Export Format</h3>
          </div>
          <button className="onboard-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Complete Data Package (ZIP) - Cross-Agency Standard */}
          <div
            onClick={() => handleDownload('bundle')}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 8,
              border: '1.5px solid #10b981',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#ecfdf5',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            <span style={{ fontSize: '1.85rem' }}>📦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Complete Data Package (.zip)
                <span style={{ fontSize: '0.65rem', background: '#10b981', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                  RECOMMENDED
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.15rem' }}>
                All files bundled: PDF & DOCX reports, CSV tables, GeoJSON spatial boundaries, and provenance certificate.
              </div>
            </div>
            <span
              className="btn btn-primary btn-sm"
              style={{
                pointerEvents: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#059669',
              }}
            >
              {downloading === 'bundle' ? 'Packaging...' : 'Export ZIP'}
            </span>
          </div>
          <div
            onClick={() => handleDownload('pdf')}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#ffffff',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            <span style={{ fontSize: '1.75rem' }}>📕</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                Official PDF Dossier
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Complete document with administrative boundaries, classification maps & recommendations.
              </div>
            </div>
            <span className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
              {downloading === 'pdf' ? 'Preparing...' : 'Download'}
            </span>
          </div>

          <div
            onClick={() => handleDownload('docx')}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#ffffff',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            <span style={{ fontSize: '1.75rem' }}>📘</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                Editable Word Document (.docx)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Full chapter breakdown ready for official state/district disaster management editing.
              </div>
            </div>
            <span className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
              {downloading === 'docx' ? 'Preparing...' : 'Download'}
            </span>
          </div>

          {!isRisk && (
            <div
              onClick={() => handleDownload('csv')}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: '#ffffff',
                transition: 'all 0.15s ease',
              }}
              className="hover-card"
            >
              <span style={{ fontSize: '1.75rem' }}>📊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                  Raw Tabular Data (.csv)
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Administrative unit IDs, raw indicator values, normalized metrics & classes.
                </div>
              </div>
              <span className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
                {downloading === 'csv' ? 'Preparing...' : 'Download'}
              </span>
            </div>
          )}

          <div
            onClick={() => handleDownload('print')}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#ffffff',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            <span style={{ fontSize: '1.75rem' }}>🖨️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                Print / Save via Browser
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Formatted print view optimized for physical briefing dossiers and presentations.
              </div>
            </div>
            <span className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
              Print
            </span>
          </div>

          <div
            onClick={() => {
              setIsSendModalOpen(true);
            }}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 8,
              border: '1.5px solid #bae6fd',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#f0f9ff',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            <span style={{ fontSize: '1.75rem' }}>📤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0369a1' }}>
                Send to Senior Reviewer / Manager
              </div>
              <div style={{ fontSize: '0.75rem', color: '#0284c7' }}>
                Directly dispatch official dossier with review checklist & notes to designated authority.
              </div>
            </div>
            <span
              className="btn btn-primary btn-sm"
              style={{
                pointerEvents: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              }}
            >
              Dispatch →
            </span>
          </div>
        </div>

        <div className="onboard-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>

      {isSendModalOpen && (
        <SendDocumentModal
          isOpen={isSendModalOpen}
          onClose={() => {
            setIsSendModalOpen(false);
            onClose();
          }}
          documentType={isRisk ? 'risk_assessment' : 'assessment'}
          documentId={assessmentId}
          documentTitle={assessmentName}
          fileFormat="PDF"
          onSuccess={() => {
            setIsSendModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
