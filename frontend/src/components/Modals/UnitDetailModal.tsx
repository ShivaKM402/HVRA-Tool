/**
 * Unit Detail Modal
 * Displays administrative unit breakdown, classification, score and indicator contributions.
 */
import type { AssessmentResult } from '../../types';
import './Modals.css';

interface UnitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AssessmentResult | null;
  totalUnits?: number;
  rank?: number;
}

const CLASS_CONFIG: Record<string, { label: string; bg: string; color: string; desc: string }> = {
  NH: { label: 'NH (No Hazard)', bg: '#f1f5f9', color: '#475569', desc: 'Minimal or negligible hazard exposure.' },
  LH: { label: 'LH (Low Hazard)', bg: '#ecfdf5', color: '#047857', desc: 'Low relative hazard severity within the district.' },
  MH: { label: 'MH (Moderate Hazard)', bg: '#fffbeb', color: '#b45309', desc: 'Moderate relative hazard severity requiring vigilance.' },
  HH: { label: 'HH (High Hazard)', bg: '#fef2f2', color: '#b91c1c', desc: 'High relative hazard severity requiring immediate priority.' },
};

export default function UnitDetailModal({ isOpen, onClose, result, totalUnits = 11, rank }: UnitDetailModalProps) {
  if (!isOpen || !result) return null;

  const unitName = result.unit_name || `Unit #${result.administrative_unit}`;
  const classification = result.classification || 'NH';
  const conf = CLASS_CONFIG[classification] || CLASS_CONFIG.NH;
  const score = result.final_score ?? result.normalized_value ?? 0;
  const rawScore = result.raw_value ?? 0;

  return (
    <div className="onboard-overlay" onClick={onClose} style={{ zIndex: 9997 }}>
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, textAlign: 'left' }}>
        <div className="onboard-header" style={{ paddingBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Administrative Unit Detail
            </div>
            <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>{unitName}</h3>
          </div>
          <button className="onboard-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Classification Banner */}
          <div
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: 8,
              background: conf.bg,
              border: `1px solid ${conf.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: conf.color, fontWeight: 700 }}>
                CLASSIFICATION BAND
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: conf.color }}>
                {conf.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
                {conf.desc}
              </div>
            </div>
            <span
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                padding: '0.4rem 0.8rem',
                borderRadius: 6,
                background: '#ffffff',
                color: conf.color,
                boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
              }}
            >
              {classification}
            </span>
          </div>

          {/* Scores Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Normalized Score</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                {score.toFixed(3)}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Scale: 0.0 - 1.0</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Raw Metric Value</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                {rawScore.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Aggregated units</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>District Rank</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                {rank ? `#${rank}` : 'Top band'}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>of {totalUnits} units</div>
            </div>
          </div>

          {/* Additional Metadata */}
          <div style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
              Spatial Context & Methodology
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
              <li>Relative-to-neighbours classification applied within district scope.</li>
              <li>Calculated using min-max normalization against regional distribution.</li>
              <li>Administrative ID: <code>{result.administrative_unit}</code></li>
            </ul>
          </div>
        </div>

        <div className="onboard-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
