/**
 * Export Options Modal
 * Allows downloading PDF, DOCX, CSV or triggering browser print.
 */
import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
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

  if (!isOpen) return null;

  const handleDownload = async (format: 'pdf' | 'docx' | 'csv' | 'print') => {
    if (format === 'print') {
      onClose();
      window.print();
      return;
    }

    try {
      setDownloading(format);
      const endpointPrefix = isRisk ? `/api/risk-assessments/${assessmentId}` : `/api/assessments/${assessmentId}`;
      const url = `${endpointPrefix}/export/${format}/`;
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${assessmentName.toLowerCase().replace(/\s+/g, '_')}_report.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({
        title: 'Report Export Initiated',
        message: `${format.toUpperCase()} export for "${assessmentName}" downloaded successfully.`,
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
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: 'left' }}>
        <div className="onboard-header">
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Report Generation & Export
            </div>
            <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>Choose Export Format</h3>
          </div>
          <button className="onboard-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
        </div>

        <div className="onboard-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
