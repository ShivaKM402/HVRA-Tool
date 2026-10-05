/**
 * HVRA Digital Platform — Executive Disaster Risk & Intelligence Command Center
 * Modernized UI/UX per HVRA Sections 3 & 4
 */
import { MapIcon } from '@/components/MapIcon/MapIcon';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { checkHealth, getAssessments, getHazards, getDistricts, getDashboardSummary, getRiskDashboardSummary, deleteAssessment } from '@/services/api';
import type { Assessment, HealthCheckResponse, HazardType, AdministrativeUnit, DashboardSummaryResponse } from '@/types';
import KeralaMap from '@/components/Map/KeralaMap';
import DigitalTwin3D from '@/components/Map3D/DigitalTwin3D';
import './Dashboard.css';

// ── 3-dot Card Actions Menu ──────────────────────────────────
interface CardMenuItem { label: string; icon: string; onClick: () => void; }
function CardMenu({ items }: { items: CardMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="section-menu-wrapper" ref={ref}>
      <button
        className="section-dots-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title="Card options"
        style={{ fontSize: '1.3rem', letterSpacing: '0.05em', padding: '2px 6px' }}
      >
        &#8942;
      </button>
      {open && (
        <div className="section-dots-menu">
          {items.map((item) => (
            <button key={item.label} className="section-dots-menu-item" onClick={() => { item.onClick(); setOpen(false); }}>
              <span style={{ marginRight: '0.35rem' }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModernStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let badgeClass = 'badge badge-draft';
  let dotColor = '#94a3b8';

  if (s === 'COMPLETED') {
    badgeClass = 'badge badge-completed';
    dotColor = '#10b981';
  } else if (s === 'PROCESSING') {
    badgeClass = 'badge badge-processing';
    dotColor = '#f59e0b';
  } else if (s === 'QUEUED') {
    badgeClass = 'badge badge-queued';
    dotColor = '#3b82f6';
  } else if (s === 'FAILED') {
    badgeClass = 'badge badge-failed';
    dotColor = '#ef4444';
  }

  return (
    <span className={badgeClass} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [_health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [hazards, setHazards] = useState<HazardType[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<AdministrativeUnit | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'3D' | '2D'>('2D');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [tableModuleFilter, setTableModuleFilter] = useState('ALL');

  // Cross-district comparison (HVRA §3.4)
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [summaryModule, setSummaryModule] = useState<'HAZARD' | 'VULNERABILITY' | 'EXPOSURE' | 'COMPOSITE_RISK'>('HAZARD');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const data =
          summaryModule === 'COMPOSITE_RISK'
            ? await getRiskDashboardSummary()
            : await getDashboardSummary({ module_type: summaryModule });
        if (!cancelled) setSummary(data);
      } catch (err: any) {
        if (!cancelled) setSummaryError(err.message || 'Failed to load district summary.');
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [summaryModule]);

  useEffect(() => {
    const load = async () => {
      try {
        const [healthData, assessData, hazardData, districtData] = await Promise.all([
          checkHealth(),
          getAssessments(),
          getHazards(),
          getDistricts(),
        ]);
        setHealth(healthData);
        setAssessments(assessData.results || []);
        setHazards(hazardData);
        setDistricts(districtData);
        if (districtData && districtData.length > 0) {
          setSelectedDistrict(districtData[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completedCount = useMemo(() => assessments.filter((a) => a.status === 'COMPLETED').length, [assessments]);
  const activeHazards = useMemo(() => hazards.filter((h) => h.is_active).length, [hazards]);

  // District-specific assessment count for dossier
  const districtAssessments = useMemo(() => {
    if (!selectedDistrict) return [];
    const cleanDist = selectedDistrict.name.replace(' [DEMO]', '').toLowerCase();
    return assessments.filter(a =>
      a.district === selectedDistrict.id ||
      (a.district_name && a.district_name.toLowerCase().includes(cleanDist))
    );
  }, [selectedDistrict, assessments]);

  // Filtered recent assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      const matchSearch =
        searchQuery === '' ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.district_name && a.district_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.hazard_type && a.hazard_type.toLowerCase().includes(searchQuery.toLowerCase()));

      const mod = a.module_code || a.module_type || a.hazard_type || '';
      const matchModule = tableModuleFilter === 'ALL' || mod.toUpperCase() === tableModuleFilter.toUpperCase();

      return matchSearch && matchModule;
    });
  }, [assessments, searchQuery, tableModuleFilter]);

  const handleDeleteAssessment = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete assessment "${name}"?\n\nThis will permanently remove the assessment and all linked classification results.`)) {
      return;
    }
    try {
      await deleteAssessment(id);
      setAssessments(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(`Failed to delete assessment: ${err.message || 'Error occurred'}`);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', marginTop: '0.5rem' }}>
          Initializing Kerala Spatial Intelligence Center…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: '2rem auto' }}>
        <div className="alert alert-error mb-6">
          <span style={{ fontSize: '1.5rem' }}>❌</span>
          <div>
            <strong style={{ fontSize: '1.05rem' }}>Backend Connection Failure</strong>
            <p style={{ marginTop: '0.35rem' }}>{error}</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Ensure the Django backend is executing on <code>http://localhost:8000</code>.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Remediation Guide</h3>
          </div>
          <div className="card-body">
            <ol style={{ paddingLeft: '1.25rem', lineHeight: '2', color: '#475569' }}>
              <li>Open terminal in <code>backend/</code> directory</li>
              <li>Activate environment: <code>venv\Scripts\activate</code></li>
              <li>Run migrations: <code>python manage.py migrate</code></li>
              <li>Start server: <code>python manage.py runserver 8000</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      {/* ── Cinematic 3D Digital Twin Hero Command Banner ── */}
      <div className="dashboard-hero-banner" style={{ backgroundImage: "linear-gradient(180deg, rgba(8, 11, 20, 0.35) 0%, rgba(3, 7, 18, 0.65) 100%), url('/hero.jpg')" }}>
        <div className="hero-overlay">
          <div className="hero-content-cluster" style={{ textAlign: 'center', maxWidth: '850px', padding: '0 1rem', zIndex: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '9999px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              <span>🌐</span> 3D Digital Twin &amp; Risk Intelligence Platform
            </div>
            <h1 className="hero-main-text" style={{ fontSize: '2.8rem', lineHeight: 1.15, marginBottom: '0.85rem', fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 4px 16px rgba(0,0,0,0.8)' }}>
              HVRA Spatial Intelligence
            </h1>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                HAZARD (H)
              </span>
              <span style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#d8b4fe', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                VULNERABILITY (V)
              </span>
              <span style={{ background: 'rgba(6, 182, 212, 0.2)', border: '1px solid rgba(6, 182, 212, 0.4)', color: '#67e8f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                EXPOSURE (E)
              </span>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '1.15rem', fontWeight: 500, marginBottom: '1.8rem', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
              "Understand Risk Before It Becomes an Emergency."
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '10px', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.5)' }}
                onClick={() => {
                  document.getElementById('geospatial-theater-anchor')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                ENTER 3D RISK PLATFORM ➔
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="dashboard-hero-footer">
        <h2>Spatial Command &amp; Decision Support</h2>
      </div>

      <div className="dashboard">

      {/* ── 2. Executive KPI Metrics Grid ── */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--kpi-accent': '#4f46e5', '--kpi-bg': '#eff0ff', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '📋', label: 'View All Reports', onClick: () => navigate('/reports') },
              { icon: '➕', label: 'New Assessment', onClick: () => navigate('/new-assessment?module=HAZARD') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble">📋</div>
            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>All Modules</span>
          </div>
          <div className="kpi-value">{assessments.length}</div>
          <div className="kpi-label">Total Risk Assessments</div>
          <div className="kpi-subtext">
            <span>⚡ Continuous ledger updates</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#10b981', '--kpi-bg': '#ecfdf5', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '✅', label: 'View Completed', onClick: () => navigate('/reports') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble">✅</div>
            <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>100% Validated</span>
          </div>
          <div className="kpi-value">{completedCount}</div>
          <div className="kpi-label">Completed Syntheses</div>
          <div className="kpi-subtext">
            <span>📄 Ready for statutory report export</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#f59e0b', '--kpi-bg': '#fffbeb', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '⚠️', label: 'View Hazards', onClick: () => navigate('/data-library') },
              { icon: '🌊', label: 'Run Hazard Assessment', onClick: () => navigate('/new-assessment?module=HAZARD') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble">⚠️</div>
            <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Monitored</span>
          </div>
          <div className="kpi-value">{activeHazards}</div>
          <div className="kpi-label">Active Kerala Hazards</div>
          <div className="kpi-subtext">
            <span>🌊 Flood, Landslide, Coastal &amp; Cyclonic</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#8b5cf6', '--kpi-bg': '#f5f3ff', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '🗺️', label: 'Explore Districts', onClick: () => navigate('/admin-units') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble"><MapIcon /></div>
            <span className="badge badge-completed" style={{ fontSize: '0.68rem' }}>Full Coverage</span>
          </div>
          <div className="kpi-value">{districts.length}</div>
          <div className="kpi-label">Revenue Districts Synced</div>
          <div className="kpi-subtext">
            <span>📍 Taluka &amp; Grama Panchayat resolution</span>
          </div>
        </div>
      </div>

      {/* ── 3. Spatial Intelligence & District Inspector ── */}
      <div className="spatial-command-layout">
        <div className="spatial-theater-card" id="geospatial-theater-anchor">
          <div className="spatial-theater-header">
            <div className="spatial-theater-title">
              <span style={{ fontSize: '1.3rem' }}>🌐</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>
                  3D Risk Intelligence &amp; Digital Twin Theater
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Explore 3D terrain, Risk X-Ray, Risk DNA, and 4D climate scenario simulations
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {/* 3D / 2D View Switcher */}
              <div style={{ display: 'inline-flex', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: mapViewMode === '3D' ? '#3b82f6' : 'transparent',
                    color: mapViewMode === '3D' ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setMapViewMode('3D')}
                >
                  🌐 3D Digital Twin
                </button>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: mapViewMode === '2D' ? '#3b82f6' : 'transparent',
                    color: mapViewMode === '2D' ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setMapViewMode('2D')}
                >
                  🗺️ 2D Cartographic
                </button>
              </div>

              <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                {selectedDistrict ? selectedDistrict.name.replace(' [DEMO]', '') : 'All Districts'}
              </span>
            </div>
          </div>

          {/* Quick District Selector Pills */}
          <div className="district-pill-scroll">
            {districts.map((d) => (
              <button
                key={d.id}
                className={`district-pill-btn${selectedDistrict?.id === d.id ? ' active' : ''}`}
                onClick={() => setSelectedDistrict(d)}
              >
                {d.name.replace(' [DEMO]', '')}
              </button>
            ))}
          </div>

          {mapViewMode === '3D' ? (
            <DigitalTwin3D
              selectedDistrict={selectedDistrict}
              assessmentId={districtAssessments[0]?.id || 85}
            />
          ) : (
            <KeralaMap selectedDistrict={selectedDistrict} />
          )}
        </div>

        {/* Selected District Dossier Card */}
        <div className="district-dossier-card">
          <div>
            <div className="dossier-hero">
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.25rem' }}>
                Territory Profile
              </div>
              <div className="dossier-name">
                {selectedDistrict?.name.replace(' [DEMO]', '') || 'Kerala State'}
              </div>
              <span className="dossier-badge">
                Administrative Code: {selectedDistrict?.code || 'KL-ALL'}
              </span>
            </div>

            <div className="dossier-stat-row">
              <div className="dossier-stat-box">
                <div className="dossier-stat-val">
                  {selectedDistrict?.centroid_lat ? `${selectedDistrict.centroid_lat.toFixed(2)}°N` : '10.50°N'}
                </div>
                <div className="dossier-stat-lbl">Latitude</div>
              </div>
              <div className="dossier-stat-box">
                <div className="dossier-stat-val">
                  {selectedDistrict?.centroid_lon ? `${selectedDistrict.centroid_lon.toFixed(2)}°E` : '76.20°E'}
                </div>
                <div className="dossier-stat-lbl">Longitude</div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Assessments Recorded:</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{districtAssessments.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Multi-Hazard Tier:</span>
                <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Tier 1 Priority</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
              onClick={() => {
                if (selectedDistrict) {
                  navigate(`/new-assessment?module=HAZARD&district=${selectedDistrict.id}`);
                } else {
                  navigate('/new-assessment?module=HAZARD');
                }
              }}
            >
              🌊 Run Hazard Run for this District
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%' }}
              onClick={() => navigate('/dashboard/compare')}
            >
              📊 Benchmark Against State Average
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Connected Workflow Portals (HVRA 4 Modules) ── */}
      <div className="workflow-section">
        <div className="section-header">
          <div className="section-title">
            <span>⚡</span>
            <span>HVRA Analytical Suite & Decision Pipelines</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Core statutory assessment modules under Kerala SDMA guidelines
          </span>
        </div>

        <div className="workflow-modules-grid">
          {/* Module 1: Hazard */}
          <div
            className="workflow-card"
            style={{ '--wf-color': '#2563eb', '--wf-shadow': 'rgba(37, 99, 235, 0.22)' } as React.CSSProperties}
            onClick={() => navigate('/new-assessment?module=HAZARD')}
          >
            <div>
              <div className="workflow-card-tag">Module 1 • Hydrology & Meteorology</div>
              <div className="workflow-card-icon">🌊</div>
              <div className="workflow-card-name">Hazard Assessment (H)</div>
              <div className="workflow-card-desc">
                Execute IMD precipitation exceedance, CWC river gauge thresholds, and landslide susceptibility queries.
              </div>
            </div>
            <div className="workflow-card-btn">
              Configure Query Parameters ➔
            </div>
          </div>

          {/* Module 2: Vulnerability */}
          <div
            className="workflow-card"
            style={{ '--wf-color': '#ea580c', '--wf-shadow': 'rgba(234, 88, 12, 0.22)' } as React.CSSProperties}
            onClick={() => navigate('/new-assessment?module=VULNERABILITY')}
          >
            <div>
              <div className="workflow-card-tag">Module 2 • Demographics & Built Env</div>
              <div className="workflow-card-icon">👥</div>
              <div className="workflow-card-name">Vulnerability Assessment (V)</div>
              <div className="workflow-card-desc">
                Evaluate socio-economic vulnerability, housing fragility, elderly/infant population density, and coping capacity.
              </div>
            </div>
            <div className="workflow-card-btn">
              Analyze Social Indicators ➔
            </div>
          </div>

          {/* Module 3: Exposure */}
          <div
            className="workflow-card"
            style={{ '--wf-color': '#059669', '--wf-shadow': 'rgba(5, 150, 105, 0.22)' } as React.CSSProperties}
            onClick={() => navigate('/new-assessment?module=EXPOSURE')}
          >
            <div>
              <div className="workflow-card-tag">Module 3 • Assets & Lifelines</div>
              <div className="workflow-card-icon">🏘️</div>
              <div className="workflow-card-name">Exposure Assessment (E)</div>
              <div className="workflow-card-desc">
                Overlay critical infrastructure, lifelines, healthcare centers, roads, and agrarian acreage in hazard zones.
              </div>
            </div>
            <div className="workflow-card-btn">
              Quantify Exposed Assets ➔
            </div>
          </div>

          {/* Module 4: Composite Risk */}
          <div
            className="workflow-card"
            style={{ '--wf-color': '#7c3aed', '--wf-shadow': 'rgba(124, 58, 237, 0.22)' } as React.CSSProperties}
            onClick={() => navigate('/risk-builder')}
          >
            <div>
              <div className="workflow-card-tag">Module 4 • Multi-Criteria Synthesis</div>
              <div className="workflow-card-icon">⚖️</div>
              <div className="workflow-card-name">Composite Risk Builder</div>
              <div className="workflow-card-desc">
                Synthesize H × V × E layers via customizable AHP weighted criteria into actionable statutory decision classes.
              </div>
            </div>
            <div className="workflow-card-btn">
              Build Risk Matrix ➔
            </div>
          </div>
        </div>

        {/* Secondary Governance & Data Tools */}
        <div className="secondary-tools-grid">
          <div className="secondary-tool-item" onClick={() => navigate('/review-queue')}>
            <div className="secondary-tool-icon">🏛️</div>
            <div>
              <div className="secondary-tool-title">Task Force Review Queue</div>
              <div className="secondary-tool-sub">Official endorsement and sign-off</div>
            </div>
          </div>

          <div className="secondary-tool-item" onClick={() => navigate('/dashboard/compare')}>
            <div className="secondary-tool-icon">📊</div>
            <div>
              <div className="secondary-tool-title">Cross-District Benchmarks</div>
              <div className="secondary-tool-sub">Side-by-side comparative analysis</div>
            </div>
          </div>

          <div className="secondary-tool-item" onClick={() => navigate('/data-library')}>
            <div className="secondary-tool-icon">🗃️</div>
            <div>
              <div className="secondary-tool-title">Spatial Data Library</div>
              <div className="secondary-tool-sub">GeoJSON, shapefiles & rasters</div>
            </div>
          </div>

          <div className="secondary-tool-item" onClick={() => navigate('/reports')}>
            <div className="secondary-tool-icon">📄</div>
            <div>
              <div className="secondary-tool-title">Statutory Reports Gallery</div>
              <div className="secondary-tool-sub">Chapter dossiers & PDF packages</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Cross-District Comparison Studio (Recharts + Table) ── */}
      <div className="compare-studio-card">
        <div className="compare-studio-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏙️</span> Cross-District Risk Spectrum (HVRA §3.4)
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
              District-aggregated severity scores across completed assessments for State resource allocation.
            </div>
          </div>

          <div className="compare-module-tabs">
            {(['HAZARD', 'VULNERABILITY', 'EXPOSURE', 'COMPOSITE_RISK'] as const).map((m) => (
              <button
                key={m}
                className={`compare-tab-btn${summaryModule === m ? ' active' : ''}`}
                onClick={() => setSummaryModule(m)}
              >
                {m === 'COMPOSITE_RISK' ? 'Composite Risk' : m[0] + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {summaryLoading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            Computing district spatial aggregations…
          </div>
        ) : summaryError ? (
          <div style={{ padding: '2rem' }}>
            <div className="alert alert-error">⚠️ {summaryError}</div>
          </div>
        ) : !summary || summary.districts.length === 0 ? (
          <div style={{ padding: '3rem 2rem' }}>
            <div className="empty-state">
              <div className="empty-state-icon">🏙️</div>
              <div className="empty-state-title">No completed {summaryModule.replace('_', ' ').toLowerCase()} assessments</div>
              <div className="empty-state-description">
                Execute assessments in at least two revenue districts to populate the comparative aggregation spectrum.
              </div>
            </div>
          </div>
        ) : (
          <div className="compare-body-grid">
            {/* Recharts Bar Chart */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                  District Average Severity Score (0 – 10 Scale)
                </h4>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {summary.districts.length} districts represented
                </span>
              </div>

              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.districts} margin={{ top: 8, right: 12, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="district_name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={65}
                      tickFormatter={(v: string) => v.replace(' [DEMO]', '').slice(0, 11)}
                    />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = Number(payload[0].value);
                          return (
                            <div className="custom-chart-tooltip">
                              <div className="tooltip-district-name">
                                {String(label).replace(' [DEMO]', '')} District
                              </div>
                              <div className="tooltip-score-val">
                                {val.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ 10</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                Severity: {val >= 7 ? 'High (HH)' : val >= 5 ? 'Moderate (MH)' : 'Low (LH)'}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="average_score" radius={[6, 6, 0, 0]}>
                      {summary.districts.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            d.average_score >= 7 ? '#ef4444' :
                            d.average_score >= 5 ? '#f59e0b' :
                            d.average_score >= 3 ? '#eab308' : '#10b981'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranked Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                  District Risk Ledger & Dominant Classes
                </h4>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                  Sorted by Score
                </span>
              </div>

              <div className="table-responsive" style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                      <th>District</th>
                      <th style={{ textAlign: 'center' }}>Runs</th>
                      <th style={{ textAlign: 'center' }}>Avg Score</th>
                      <th style={{ textAlign: 'center' }}>Top Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.districts.map((d, idx) => {
                      const summaryCounts = d.classification_summary || {};
                      const topCls = Object.entries(summaryCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '—';
                      return (
                        <tr key={d.district_id}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>
                            {idx + 1}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            {d.district_name.replace(' [DEMO]', '')}
                          </td>
                          <td style={{ textAlign: 'center' }}>{d.assessment_count}</td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>
                            <span style={{
                              color: d.average_score >= 7 ? '#ef4444' : d.average_score >= 5 ? '#d97706' : '#059669'
                            }}>
                              {d.average_score.toFixed(2)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${
                              topCls === 'HH' || topCls === 'VERY_HIGH' ? 'badge-hh' :
                              topCls === 'MH' || topCls === 'HIGH' ? 'badge-mh' :
                              topCls === 'LH' || topCls === 'MODERATE' ? 'badge-lh' : 'badge-nh'
                            }`}>
                              {topCls}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Recent Assessments & 3-Output Pipeline Ledger ── */}
      <div className="ledger-card">
        <div className="ledger-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span> Recent Assessments & 3-Output Pipeline
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
              Immediate access to Spatial Map, Administrative Classification Matrix, and Statutory Dossier Report.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Module Filter Pills */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              {(['ALL', 'HAZARD', 'VULNERABILITY', 'EXPOSURE'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTableModuleFilter(m)}
                  style={{
                    background: tableModuleFilter === m ? '#ffffff' : 'transparent',
                    border: 'none',
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: tableModuleFilter === m ? '#1e293b' : '#64748b',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: tableModuleFilter === m ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m === 'ALL' ? 'All Modules' : m[0] + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="ledger-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search assessments, districts..."
                className="ledger-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/new-assessment')}
              id="btn-new-assessment-table"
            >
              + New Assessment
            </button>
          </div>
        </div>

        <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
          {filteredAssessments.length === 0 ? (
            <div className="empty-state" style={{ margin: '2rem' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">
                {searchQuery ? 'No matching assessments found' : 'No assessments recorded yet'}
              </div>
              <div className="empty-state-description">
                {searchQuery
                  ? 'Try searching by a different term or clear your search filter.'
                  : 'Execute your first hazard assessment run to populate the 3-output pipeline.'}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/new-assessment')}
                style={{ marginTop: '0.85rem' }}
              >
                + Start Assessment
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assessment Profile</th>
                  <th>Hazard / Module</th>
                  <th>Territory</th>
                  <th>Resolution</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>3-Output Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.name}</div>
                      {a.description && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 280 }} className="truncate">
                          {a.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                        {a.hazard_type || a.module_type || a.module_code || 'Hazard'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{a.district_name}</td>
                    <td>
                      <span className="badge badge-draft">{a.administrative_level}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(a.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <ModernStatusBadge status={a.status} />
                    </td>
                    <td>
                      <div className="pipeline-actions-group" style={{ justifyContent: 'center' }}>
                        <button
                          className="pipeline-btn pipeline-btn-map"
                          onClick={() => navigate(`/assessments/${a.id}/results?tab=map`)}
                          title="View Geospatial Thematic Layer"
                        >
                          <MapIcon /> Map
                        </button>
                        <button
                          className="pipeline-btn pipeline-btn-classes"
                          onClick={() => navigate(`/assessments/${a.id}/results?tab=classification`)}
                          title="View Administrative Breakdown Matrix"
                        >
                          📊 Classes
                        </button>
                        <button
                          className="pipeline-btn pipeline-btn-report"
                          onClick={() => navigate(`/assessments/${a.id}/report`)}
                          title="Generate Official Statutory Dossier"
                        >
                          📄 Dossier
                        </button>
                        <button
                          className="pipeline-btn"
                          onClick={() => handleDeleteAssessment(a.id, a.name)}
                          title="Delete Assessment"
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            borderColor: '#fecaca',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 7. Monitored Kerala Hazard Modalities ── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌊</span> Monitored Kerala Hazard Modalities & Sensor Feeds
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Multi-hazard baseline datasets integrated with IMD, CWC, and NCESS
          </span>
        </div>
        <div className="card-body">
          <div className="hazard-modalities-grid">
            {hazards.map((h) => (
              <div
                key={h.code}
                className="hazard-modality-card"
                style={{ '--hazard-color': h.color || '#3b82f6' } as React.CSSProperties}
                onClick={() => {
                  if (h.is_active) {
                    navigate(`/new-assessment?module=HAZARD&hazard=${h.code}`);
                  }
                }}
              >
                <div className="hazard-modality-icon">{h.icon || '⚠️'}</div>
                <div className="hazard-modality-title">{h.name}</div>
                {h.is_active ? (
                  <span className="badge badge-completed" style={{ fontSize: '0.64rem' }}>
                    Telemetry Active
                  </span>
                ) : (
                  <span className="badge badge-draft" style={{ fontSize: '0.64rem' }}>
                    Scheduled
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
