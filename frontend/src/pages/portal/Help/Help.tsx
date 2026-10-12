/**
 * Help & Documentation Page (HVRA §8 / Section 6)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import OnboardingTour from '@/components/OnboardingTour/OnboardingTour';

export default function Help() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  return (
    <div style={{ maxWidth: 840, margin: '1rem auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              <Link to="/dashboard">Dashboard</Link> / <span>Help & Guides</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
              ❓ Help Center, Workflow Guide & Compliance
            </h1>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setIsOnboardingOpen(true)}>
            🚀 Launch Onboarding Tour
          </button>
        </div>
      </div>

      {/* Quick Navigation / Shortcuts */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-heading)' }}>
          ⌨️ Keyboard Shortcuts & Quick Navigation
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Global Command Palette</span>
            <kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text-heading)' }}>Ctrl+K</kbd>
          </div>
          <div style={{ background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Close Modal / Popups</span>
            <kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text-heading)' }}>Esc</kbd>
          </div>
          <div style={{ background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Print Report View</span>
            <kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text-heading)' }}>Ctrl+P</kbd>
          </div>
        </div>
      </div>

      {/* 3 Outputs Connected Pipeline */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-heading)' }}>
          🔄 The Three Connected Outputs (HVRA §1)
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Every query entered by a district or state disaster management officer automatically yields three connected, sequential outputs:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>1. Thematic Map</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Raw spatial hazard polygons, flood inundation contours, fault lines, and historical disaster events plotted over administrative boundaries.
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>2. Administrative Classification</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Standardized 4-band choropleth (NH, LH, MH, HH) calculated relative to neighbouring units within the district with unit attribute tables.
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>3. Chapter-wise Report</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Auto-compiled 11-chapter narrative with study area profiles, hazard intensity classifications, spatial maps, and action recommendations exportable to PDF/DOCX.
            </div>
          </div>
        </div>
      </div>

      {/* GIGW 3.0 & Accessibility Standards */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#0f172a' }}>
          ♿ GIGW 3.0 & WCAG 2.1 AA Accessibility Standards (HVRA §8)
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.86rem', color: '#475569', lineHeight: 1.6 }}>
          <li><strong>Colorblind-Safe Palettes:</strong> Classification maps use a sequential, perceptible ramp (NH: Slate, LH: Teal, MH: Amber, HH: Crimson) and never rely on color alone — explicit text labels (NH, LH, MH, HH) always accompany colored elements.</li>
          <li><strong>Text Contrast:</strong> High-contrast typography exceeding the 4.5:1 minimum ratio for standard text and 3:1 for large headers.</li>
          <li><strong>Keyboard Navigability:</strong> All dropdowns, modal windows, table items, and command palettes support standard keyboard control.</li>
        </ul>
      </div>

      <OnboardingTour
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
}
