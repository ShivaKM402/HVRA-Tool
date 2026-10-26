/**
 * HVRA Digital Platform — Executive Disaster Risk & Intelligence Command Center
 * Modernized UI/UX per HVRA Sections 3 & 4
 */
import { MapIcon } from '@/components/MapIcon/MapIcon';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkHealth, getAssessments, getHazards, getDistricts, deleteAssessment } from '@/services/api';
import type { Assessment, HealthCheckResponse, HazardType, AdministrativeUnit } from '@/types';
import { useHazard, HAZARD_CATALOG, type HazardCode } from '@/context/HazardContext';
import KeralaMap from '@/components/Map/KeralaMap';
import {
  Waves,
  Mountain,
  Compass,
  Zap,
  Building2,
  ArrowRight,
  ArrowLeft,
  Radio,
  FileText,
  CheckCircle2,
  BarChart3,
  AlertTriangle,
  Plus,
  MapPin,
  TrendingUp,
  Activity,
  Trash2,
  Layers,
  Search,
  ChevronDown,
} from 'lucide-react';
import './Dashboard.css';

// ── Hazard Icon Component Helper ──
const renderHazardIcon = (code: HazardCode | null, size = 20) => {
  if (!code) return <Layers size={size} />;
  switch (code) {
    case 'FLOOD':
      return <Waves size={size} />;
    case 'LANDSLIDE':
      return <Mountain size={size} />;
    case 'COASTAL':
      return <Compass size={size} />;
    case 'EXTREME_WEATHER':
      return <Zap size={size} />;
    default:
      return <Layers size={size} />;
  }
};

// ── Hazard Card High-Resolution Imagery Mapping ──
const HAZARD_CARD_IMAGES: Record<HazardCode, string> = {
  FLOOD: '/assets/hvra/BG4.jpg',
  LANDSLIDE: '/landslide-card-bg.jpg',
  COASTAL: '/coastal-card-bg.jpg',
  EXTREME_WEATHER: '/lightning-card-bg.jpg',
};

const HAZARD_CARD_BANNERS: Record<HazardCode, string> = {
  FLOOD: '/assets/hvra/banner_flood.png',
  LANDSLIDE: '/assets/hvra/banner_landslide.png',
  COASTAL: '/assets/hvra/banner_coastal.png',
  EXTREME_WEATHER: '/assets/hvra/banner_weather.png',
};

const HAZARD_BUTTON_COLORS: Record<HazardCode, string> = {
  FLOOD: '#3b5998',
  LANDSLIDE: '#4a9b8e',
  COASTAL: '#7c4dbe',
  EXTREME_WEATHER: '#e67e22',
};

const HAZARD_DESCRIPTIONS: Record<HazardCode, string> = {
  FLOOD: 'Riverine inundation, dam discharge & backwater surges',
  LANDSLIDE: 'Slope stability, debris flow & Western Ghats slip zones',
  COASTAL: 'Storm surge, sea incursion & shoreline retreat',
  EXTREME_WEATHER: 'Severe squall gusts, lightning strikes & convective storms',
};

const HAZARD_PORTAL_LABELS: Record<HazardCode, string> = {
  FLOOD: 'Open Flood Portal',
  LANDSLIDE: 'Open Landslide Portal',
  COASTAL: 'Open Coastal Portal',
  EXTREME_WEATHER: 'Open Weather Portal',
};

// ── 3-dot Card Actions Menu ──────────────────────────────────
interface CardMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

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
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Card options"
        style={{ fontSize: '1.3rem', letterSpacing: '0.05em', padding: '2px 6px' }}
      >
        &#8942;
      </button>
      {open && (
        <div className="section-dots-menu">
          {items.map((item) => (
            <button
              key={item.label}
              className="section-dots-menu-item"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
              {item.label}
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
  const { activeHazard, activeHazardMeta, setActiveHazard, clearHazard } = useHazard();

  const [_health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [_hazards, setHazards] = useState<HazardType[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<AdministrativeUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [tableModuleFilter, setTableModuleFilter] = useState('ALL');

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

  // Per-hazard assessment counts and primary IDs for quick links
  const hazardStats = useMemo(() => {
    const stats: Record<HazardCode, { count: number; completed: number; primaryId: number }> = {
      FLOOD: { count: 0, completed: 0, primaryId: 0 },
      LANDSLIDE: { count: 0, completed: 0, primaryId: 0 },
      COASTAL: { count: 0, completed: 0, primaryId: 0 },
      EXTREME_WEATHER: { count: 0, completed: 0, primaryId: 0 },
    };

    assessments.forEach((a) => {
      const ht = (a.hazard_type || '').toUpperCase() as HazardCode;
      if (ht in stats) {
        stats[ht].count += 1;
        if (a.status === 'COMPLETED') stats[ht].completed += 1;
        if (!stats[ht].primaryId) stats[ht].primaryId = a.id;
      }
    });

    return stats;
  }, [assessments]);

  // Scoped assessments for active hazard (or all if no hazard selected)
  const scopedAssessments = useMemo(() => {
    if (!activeHazard) return assessments;
    return assessments.filter((a) => (a.hazard_type || '').toUpperCase() === activeHazard);
  }, [assessments, activeHazard]);

  // District-specific assessment count for dossier
  const districtAssessments = useMemo(() => {
    if (!selectedDistrict) return [];
    const cleanDist = selectedDistrict.name.replace(' [DEMO]', '').toLowerCase();
    return scopedAssessments.filter(a =>
      a.district === selectedDistrict.id ||
      (a.district_name && a.district_name.toLowerCase().includes(cleanDist))
    );
  }, [selectedDistrict, scopedAssessments]);

  // Filtered recent assessments (Strictly hazard-scoped)
  const filteredAssessments = useMemo(() => {
    return scopedAssessments.filter(a => {
      const matchSearch =
        searchQuery === '' ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.district_name && a.district_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.hazard_type && a.hazard_type.toLowerCase().includes(searchQuery.toLowerCase()));

      const mod = a.module_code || a.module_type || a.hazard_type || '';
      const matchModule = tableModuleFilter === 'ALL' || mod.toUpperCase() === tableModuleFilter.toUpperCase();

      return matchSearch && matchModule;
    });
  }, [scopedAssessments, searchQuery, tableModuleFilter]);

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
      <div className="loading-overlay" style={{ minHeight: '65vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-orbital" />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginTop: '1.25rem', fontWeight: 800, color: 'var(--text-heading, #0f172a)' }}>
          Initializing Kerala Spatial Intelligence Center…
        </span>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-muted, #64748b)', marginTop: '0.25rem' }}>
          Calibrating 14 District telemetry feeds, spatial boundaries, and analytical modules…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: '2rem auto' }}>
        <div className="alert alert-error mb-6">
          <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
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

  // ── FIRST PAGE: Dedicated 4-Column Box Selection Screen (When no hazard is selected) ──
  if (activeHazard === null) {
    return (
      <div className="hazard-selection-page-wrapper">
        <div className="hazard-selection-container">
          {/* Central Hero Heading */}
          <div className="hazard-portal-hero">
            <div className="hazard-portal-agency-chip" style={{ background: '#dc2626', border: '1px solid #dc2626', color: '#ffffff' }}>
              <span>Kerala State Disaster Management Authority (KSDMA)</span>
            </div>
            <h1 className="hazard-portal-title">
              Select a Hazard Domain to Enter
            </h1>
            <p className="hazard-portal-subtitle">
              Select one of the 4 operational hazard boxes to configure all models, taskforces, indicators, and spatial assessments exclusively for that hazard.
            </p>
          </div>

          {/* 4 Clean Box Columns Grid */}
          <div className="hazard-gateway-boxes-grid">
            {(['FLOOD', 'LANDSLIDE', 'COASTAL', 'EXTREME_WEATHER'] as HazardCode[]).map((code) => {
              const meta = HAZARD_CATALOG[code];
              const stats = hazardStats[code];

              return (
                <div
                  key={code}
                  className={`hazard-gateway-box hazard-gateway-box--${code}`}
                  onClick={() => setActiveHazard(code)}
                >
                  {/* Photo Banner with Live Telemetry chip & squircle icon */}
                  <div className="hazard-card-photo-banner">
                    <img
                      src={HAZARD_CARD_BANNERS[code]}
                      alt={meta.name}
                      className="hazard-card-banner-img"
                      loading="lazy"
                    />
                  </div>

                  {/* Card Content & Actions */}
                  <div className="hazard-card-body">
                    <h3 className="hazard-box-title">{meta.name}</h3>
                    <p className="hazard-box-tagline">{HAZARD_DESCRIPTIONS[code]}</p>

                    <div className="hazard-box-divider" />

                    <div className="hazard-box-stats-row">
                      <span><strong>21</strong> Indicators</span>
                      <span><strong>{stats.count || 2}</strong> Runs</span>
                    </div>

                    <button
                      className="hazard-box-btn"
                      type="button"
                      style={{ background: HAZARD_BUTTON_COLORS[code] }}
                    >
                      <span>{HAZARD_PORTAL_LABELS[code]}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Disaster Intelligence Strip */}
          <div className="hazard-portal-bottom-banner">
            <div className="hazard-bottom-banner-left">
              <div className="hazard-bottom-alert-icon">
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  <path d="M6 10C4 12.5 3 14.8 3 17C3 19.2 4 21.5 6 24" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M9.5 13C8.5 14.3 8 15.6 8 17C8 18.4 8.5 19.7 9.5 21" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M28 10C30 12.5 31 14.8 31 17C31 19.2 30 21.5 28 24" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M24.5 13C25.5 14.3 26 15.6 26 17C26 18.4 25.5 19.7 24.5 21" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                  <rect x="15" y="7" width="4" height="13" rx="2" fill="#ef4444"/>
                  <circle cx="17" cy="24" r="2.2" fill="#ef4444"/>
                </svg>
              </div>
              <div>
                <h4 className="hazard-bottom-title">
                  Real-time Disaster Monitoring &amp; Official Alert Feeds Active
                </h4>
                <p className="hazard-bottom-subtitle">
                  Consolidated multi-hazard bulletins from NDMA, SAC, IMD-KSDMA, USGS Seismology &amp; statewide verified news.
                </p>
              </div>
            </div>

            <button
              className="hazard-bottom-btn"
              onClick={() => navigate('/weather?tab=live-alerts')}
            >
              <span>Open Live Disaster Operations</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. DEDICATED HAZARD-SCOPED WORKSPACE (When a hazard box was clicked) ──
  return (
    <div className="dashboard-wrapper">
      <div
        className="dashboard-page-header"
        style={{
          backgroundImage: activeHazard === 'FLOOD'
            ? 'linear-gradient(90deg, rgba(8, 14, 26, 0.94) 0%, rgba(15, 23, 42, 0.85) 38%, rgba(15, 23, 42, 0.50) 70%, rgba(15, 23, 42, 0.25) 100%), url("/assets/hvra/BG4.jpg")'
            : `linear-gradient(90deg, rgba(8, 14, 26, 0.94) 0%, rgba(15, 23, 42, 0.85) 38%, rgba(15, 23, 42, 0.50) 70%, rgba(15, 23, 42, 0.25) 100%), url("${HAZARD_CARD_IMAGES[activeHazard] || '/kerala-hero-bg.jpg'}")`,
        }}
      >
        <div className="dashboard-header-inner">
          <div className="dashboard-header-text">
            <div className="dashboard-header-pill" style={{ background: '#dc2626', border: 'none', color: '#ffffff' }}>
              <span>Kerala State Disaster Management Authority • {activeHazardMeta?.shortName || 'Flood'} Domain Console</span>
            </div>
            <h1 className="dashboard-header-title">
              {activeHazardMeta?.name || 'Flood Hazard'} &amp; Risk Intelligence
            </h1>
            <p className="dashboard-header-desc">
              {activeHazardMeta?.tagline || 'Riverine inundation, dam discharge & backwater surges'}. Dedicated line-department data submissions, telemetry indicators, and spatial assessment dossiers.
            </p>

            <div className="dashboard-header-actions">
              <button
                className="btn btn-primary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: '#dc2626',
                  borderColor: '#dc2626',
                  fontWeight: 700,
                }}
                onClick={() => navigate(`/new-assessment?module=HAZARD&hazard=${activeHazard}`)}
              >
                <Plus size={15} />
                <span>Run {activeHazardMeta?.shortName || 'Flood'} Assessment</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  background: 'rgba(15, 23, 42, 0.7)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
                onClick={() =>
                  navigate(
                    hazardStats[activeHazard].primaryId
                      ? `/department-coordination?assessmentId=${hazardStats[activeHazard].primaryId}`
                      : `/department-coordination?hazard=${activeHazard}`
                  )
                }
                title="Departmental Data Coordination for this hazard"
              >
                <Building2 size={15} />
                <span>{activeHazardMeta?.shortName || 'Flood'} Dept Tasks</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/weather?tab=live-alerts')}
                title="Live Disaster Alerts, Official Warnings & Incident Feeds"
                style={{
                  fontWeight: 700,
                  color: '#dc2626',
                  background: '#ffffff',
                  borderColor: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                <Radio size={14} />
                <span>Live Alerts</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => clearHazard()}
                title="Return to 4-Column Hazard Selection Gateway"
                style={{
                  fontWeight: 700,
                  color: '#dc2626',
                  background: '#ffffff',
                  borderColor: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <ArrowLeft size={14} />
                <span>Change Hazard (4 Columns)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard">
        {/* ── 1. Executive KPI Metrics Grid (Scoped to Domain) ── */}
        <div className="kpi-grid">
          <div
            className="kpi-card"
            style={{ '--kpi-accent': '#dc2626' } as React.CSSProperties}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <Waves size={24} color="#dc2626" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="kpi-pill-chip" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  Flood Domain
                </span>
                <CardMenu
                  items={[
                    { icon: <FileText size={14} />, label: 'View All Reports', onClick: () => navigate('/reports') },
                    {
                      icon: <Plus size={14} />,
                      label: 'New Assessment',
                      onClick: () => navigate(`/new-assessment?module=HAZARD&hazard=${activeHazard}`),
                    },
                  ]}
                />
              </div>
            </div>
            <div className="kpi-value">{scopedAssessments.length}</div>
            <div className="kpi-label">
              Flood Risk Assessments
            </div>
            <div className="kpi-subtext">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <TrendingUp size={13} color="#dc2626" />
                <span>Continuous ledger updates</span>
              </span>
            </div>
          </div>

          <div
            className="kpi-card"
            style={{ '--kpi-accent': '#10b981' } as React.CSSProperties}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <CheckCircle2 size={24} color="#10b981" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="kpi-pill-chip" style={{ background: '#dcfce7', color: '#15803d' }}>
                  {scopedAssessments.length > 0 ? `${Math.round((scopedAssessments.filter((a) => a.status === 'COMPLETED').length / scopedAssessments.length) * 100)}% Validated` : 'Pipeline Ready'}
                </span>
                <CardMenu
                  items={[{ icon: <CheckCircle2 size={14} />, label: 'View Completed', onClick: () => navigate('/reports') }]}
                />
              </div>
            </div>
            <div className="kpi-value">{scopedAssessments.filter((a) => a.status === 'COMPLETED').length}</div>
            <div className="kpi-label">
              Flood Validated Syntheses
            </div>
            <div className="kpi-subtext">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <FileText size={13} color="#10b981" />
                <span>Ready for statutory report export</span>
              </span>
            </div>
          </div>

          <div
            className="kpi-card"
            style={{ '--kpi-accent': '#f59e0b' } as React.CSSProperties}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                <BarChart3 size={24} color="#f59e0b" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="kpi-pill-chip" style={{ background: '#fef9c3', color: '#a16207' }}>
                  Monitored
                </span>
                <CardMenu
                  items={[
                    { icon: <AlertTriangle size={14} />, label: 'View Hazards', onClick: () => navigate('/data-library') },
                    {
                      icon: <Plus size={14} />,
                      label: 'Run Hazard Assessment',
                      onClick: () => navigate(`/new-assessment?module=HAZARD&hazard=${activeHazard}`),
                    },
                  ]}
                />
              </div>
            </div>
            <div className="kpi-value">21</div>
            <div className="kpi-label">
              Flood Key Indicators
            </div>
            <div className="kpi-subtext">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Activity size={13} color="#f59e0b" />
                <span>Lead: Water Resources Department</span>
              </span>
            </div>
          </div>

          <div
            className="kpi-card"
            style={{ '--kpi-accent': '#8b5cf6' } as React.CSSProperties}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                <Building2 size={24} color="#8b5cf6" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="kpi-pill-chip" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                  Coordinated
                </span>
                <CardMenu
                  items={[
                    { icon: <MapPin size={14} />, label: 'Explore Districts', onClick: () => navigate('/admin-units') },
                  ]}
                />
              </div>
            </div>
            <div className="kpi-value">4</div>
            <div className="kpi-label">
              Responsible Line Departments
            </div>
            <div className="kpi-subtext">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <MapPin size={13} color="#8b5cf6" />
                <span>Multi-agency indicator validation</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. Spatial Intelligence & District Inspector ── */}
        <div className="spatial-command-layout">
          <div className="spatial-theater-card" id="geospatial-theater-anchor">
            <div className="spatial-theater-header">
              <div className="spatial-theater-title">
                <div className="spatial-theater-icon-box">
                  <MapPin size={22} color="#dc2626" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                    Geospatial Flood Risk &amp; Territory Intelligence Center
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    State-wide administrative boundaries, flood inundation zones, and telemetry monitoring.
                  </div>
                </div>
              </div>

              <div className="spatial-header-dropdown-pill">
                <span>{selectedDistrict ? selectedDistrict.name.replace(' [DEMO]', '').toUpperCase() : 'ALAPPUZHA'}</span>
                <ChevronDown size={14} color="#dc2626" />
              </div>
            </div>

            {/* Quick District Selector Pills */}
            <div className="district-pill-scroll">
              {districts.map((d) => (
                <button
                  key={d.id}
                  className={`district-pill-btn${(selectedDistrict?.id === d.id || (!selectedDistrict && d.name.toLowerCase().includes('alappuzha'))) ? ' active' : ''}`}
                  onClick={() => setSelectedDistrict(d)}
                >
                  {d.name.replace(' [DEMO]', '')}
                </button>
              ))}
            </div>

            <KeralaMap selectedDistrict={selectedDistrict} />
          </div>

          {/* Selected District Dossier Card */}
          <div className="district-dossier-card">
            <div className="dossier-header-title">
              Territory Profile
            </div>

            {/* Backwater Houseboat Banner Image */}
            <div className="dossier-photo-banner">
              <img
                src="/assets/hvra/BG1.jpg"
                alt={selectedDistrict?.name || 'Alappuzha Houseboat'}
                className="dossier-banner-img"
              />
            </div>

            <div className="dossier-content-body">
              <div className="dossier-name-row">
                <h4 className="dossier-name">
                  {selectedDistrict?.name.replace(' [DEMO]', '') || 'Alappuzha'}
                </h4>
                <span className="dossier-code-chip">
                  Administrative Code: {selectedDistrict?.code || 'KL-ALP'}
                </span>
              </div>

              {/* Lat & Lon Coordinate Boxes */}
              <div className="dossier-coordinates-grid">
                <div className="dossier-coord-box">
                  <div className="dossier-coord-icon dossier-coord-icon--green">
                    <MapPin size={18} color="#059669" />
                  </div>
                  <div className="dossier-coord-meta">
                    <span className="dossier-coord-val">
                      {selectedDistrict?.centroid_lat ? `${selectedDistrict.centroid_lat.toFixed(2)}° N` : '9.50° N'}
                    </span>
                    <span className="dossier-coord-lbl">Latitude</span>
                  </div>
                </div>

                <div className="dossier-coord-box">
                  <div className="dossier-coord-icon dossier-coord-icon--blue">
                    <MapPin size={18} color="#dc2626" />
                  </div>
                  <div className="dossier-coord-meta">
                    <span className="dossier-coord-val">
                      {selectedDistrict?.centroid_lon ? `${selectedDistrict.centroid_lon.toFixed(2)}° E` : '76.34° E'}
                    </span>
                    <span className="dossier-coord-lbl">Longitude</span>
                  </div>
                </div>
              </div>

              {/* Info Rows */}
              <div className="dossier-info-list">
                <div className="dossier-info-row">
                  <div className="dossier-info-left">
                    <FileText size={16} color="#dc2626" />
                    <span>Assessments Recorded</span>
                  </div>
                  <span className="dossier-info-val">{districtAssessments.length || 0}</span>
                </div>

                <div className="dossier-info-row">
                  <div className="dossier-info-left">
                    <AlertTriangle size={16} color="#dc2626" />
                    <span>Multi-Hazard Tier</span>
                  </div>
                  <span className="dossier-tier-pill">Tier 1 Priority</span>
                </div>
              </div>
            </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
              onClick={() => {
                if (selectedDistrict) {
                  navigate(`/new-assessment?module=HAZARD&district=${selectedDistrict.id}`);
                } else {
                  navigate('/new-assessment?module=HAZARD');
                }
              }}
            >
              <Plus size={15} />
              <span>Run {activeHazardMeta ? activeHazardMeta.shortName : 'Hazard'} Assessment for this District</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
              onClick={() => navigate('/dashboard/compare')}
            >
              <BarChart3 size={15} />
              <span>Benchmark Against State Average</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Recent Assessments & 3-Output Pipeline Ledger ── */}
      <div className="ledger-card">
        <div className="ledger-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {activeHazard ? renderHazardIcon(activeHazard, 18) : <FileText size={18} />}
              </span>
              <span>
                {activeHazardMeta ? `${activeHazardMeta.shortName} Assessment Ledger` : 'Recent Assessments & 3-Output Pipeline'}
              </span>
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
              {activeHazardMeta
                ? `Showing official assessments scoped exclusively to ${activeHazardMeta.name} (${filteredAssessments.length} runs).`
                : 'Immediate access to Spatial Map, Administrative Classification Matrix, and Statutory Dossier Report.'}
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
              <Search size={15} color="#94a3b8" />
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
              onClick={() => navigate(activeHazard ? `/new-assessment?module=HAZARD&hazard=${activeHazard}` : '/new-assessment')}
              id="btn-new-assessment-table"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} />
              <span>New {activeHazardMeta ? activeHazardMeta.shortName : ''} Assessment</span>
            </button>
          </div>
        </div>

        <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
          {filteredAssessments.length === 0 ? (
            <div className="empty-state" style={{ margin: '2rem' }}>
              <div className="empty-state-icon">
                {activeHazard ? renderHazardIcon(activeHazard, 32) : <FileText size={32} />}
              </div>
              <div className="empty-state-title">
                {searchQuery
                  ? 'No matching assessments found'
                  : `No ${activeHazardMeta ? activeHazardMeta.shortName : ''} assessments recorded yet`}
              </div>
              <div className="empty-state-description">
                {searchQuery
                  ? 'Try searching by a different term or clear your search filter.'
                  : `Execute your first ${activeHazardMeta ? activeHazardMeta.shortName : ''} hazard assessment run to populate the 3-output pipeline.`}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate(activeHazard ? `/new-assessment?module=HAZARD&hazard=${activeHazard}` : '/new-assessment')}
                style={{ marginTop: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Plus size={15} />
                <span>Start {activeHazardMeta ? activeHazardMeta.shortName : ''} Assessment</span>
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
                          className="pipeline-btn"
                          onClick={() => navigate(`/department-coordination?assessmentId=${a.id}`)}
                          title="View Line Department Data Coordination"
                          style={{
                            background: '#f0fdfa',
                            color: '#0d9488',
                            borderColor: '#ccfbf1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <Building2 size={12} />
                          <span>Tasks</span>
                        </button>
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
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <BarChart3 size={12} />
                          <span>Classes</span>
                        </button>
                        <button
                          className="pipeline-btn pipeline-btn-report"
                          onClick={() => navigate(`/assessments/${a.id}/report`)}
                          title="Generate Official Statutory Dossier"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <FileText size={12} />
                          <span>Dossier</span>
                        </button>
                        <button
                          className="pipeline-btn"
                          onClick={() => handleDeleteAssessment(a.id, a.name)}
                          title="Delete Assessment"
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            borderColor: '#fecaca',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={13} />
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
    </div>
    </div>
  );
}
