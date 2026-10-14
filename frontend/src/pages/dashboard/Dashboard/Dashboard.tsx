/**
 * HVRA Digital Platform — Executive Disaster Risk & Intelligence Command Center
 * Modernized UI/UX per HVRA Sections 3 & 4
 */
import { MapIcon } from '@/components/MapIcon/MapIcon';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkHealth, getAssessments, getHazards, getDistricts, deleteAssessment } from '@/services/api';
import type { Assessment, HealthCheckResponse, HazardType, AdministrativeUnit } from '@/types';
import { useHazard, HAZARD_CATALOG, type HazardCode } from '@/context/HazardContext';
import KeralaMap from '@/components/Map/KeralaMap';
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
  const { activeHazard, activeHazardMeta, setActiveHazard, clearHazard } = useHazard();

  const [_health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [hazards, setHazards] = useState<HazardType[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<AdministrativeUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [tableModuleFilter, setTableModuleFilter] = useState('ALL');


  // Department Taskforce definitions for each hazard domain
  const HAZARD_DEPARTMENT_TASKS: Record<
    HazardCode,
    Array<{
      department: string;
      role: string;
      indicators: string[];
      status: 'SUBMITTED' | 'PENDING';
      officer: string;
      assessmentId: number;
    }>
  > = {
    FLOOD: [
      {
        department: 'Water Resources Department (Irrigation)',
        role: 'Hydrological River Gauge & Reservoir Surge Telemetry',
        indicators: ['Flood-prone Area (%)', 'River Gauge Discharge Anomaly', 'Flood Frequency'],
        status: 'SUBMITTED',
        officer: 'Er. Ramesh K. (Executive Engineer, Hydrology)',
        assessmentId: 86,
      },
      {
        department: 'Local Self Government (LSGD / Panchayats)',
        role: 'Inundation Habitations, Shelter Logs & Kutcha Housing',
        indicators: ['Residential Buildings in Floodplain', 'Kutcha Housing Stock', 'Relief Shelter Shortfall'],
        status: 'SUBMITTED',
        officer: 'Sri. Suresh V. (Assistant Director of Panchayats)',
        assessmentId: 86,
      },
      {
        department: 'Public Works Department (PWD)',
        role: 'Submerged Roadways, Culverts & Lifeline Bridges',
        indicators: ['Submersible Road Length (km)', 'Highways in Hazard Zone', 'Drainage Inadequacy'],
        status: 'PENDING',
        officer: 'Executive Engineer (PWD Roads Division)',
        assessmentId: 86,
      },
      {
        department: 'Health & Family Welfare Department',
        role: 'Critical Hospital Access & Post-Flood Epidemic Surveillance',
        indicators: ['Critical Facilities Exposed', 'Emergency Health Access Gap'],
        status: 'PENDING',
        officer: 'District Medical Officer (DMO Thiruvananthapuram)',
        assessmentId: 86,
      },
    ],
    LANDSLIDE: [
      {
        department: 'Mining & Geology / KSDMA',
        role: 'Western Ghats Slip Zones, Debris Inundation & Quarry Monitoring',
        indicators: ['Landslide Susceptibility Zone (%)', 'Historical Debris Flow Incidents'],
        status: 'SUBMITTED',
        officer: 'Smt. Latha M. (Deputy Collector, KSDMA)',
        assessmentId: 87,
      },
      {
        department: 'Water Resources Department (Irrigation)',
        role: 'Antecedent Soil Moisture & Precipitation Trigger Anomaly',
        indicators: ['Cumulative Rainfall Trigger Anomaly', 'Basin Discharge Logs'],
        status: 'SUBMITTED',
        officer: 'Er. Ramesh K. (Hydrology Division)',
        assessmentId: 87,
      },
      {
        department: 'Department of Environment & Climate Change',
        role: 'Steep Slopes (>30°) & Forest Buffer Depletion',
        indicators: ['Steep Slope Terrain Area (>30°)', 'Vegetation Loss Index'],
        status: 'PENDING',
        officer: 'Environmental Officer (Kottayam Range)',
        assessmentId: 87,
      },
    ],
    COASTAL: [
      {
        department: 'Harbour Engineering Department',
        role: 'Sea Wall Structural Integrity & Shoreline Retreat Monitoring',
        indicators: ['Annual Shoreline Retreat & Erosion Rate (m/yr)', 'Sea Wall Condition'],
        status: 'SUBMITTED',
        officer: 'Er. Mathew P. (Harbour Engineering Dept)',
        assessmentId: 88,
      },
      {
        department: 'Local Self Government & Fisheries',
        role: 'Fisherfolk Settlement Inundation & High Tide Ingress (200m)',
        indicators: ['Fisherfolk & Coastal Dwellings within 200m HTL'],
        status: 'PENDING',
        officer: 'Joint Director of Fisheries (Trivandrum Coast)',
        assessmentId: 88,
      },
      {
        department: 'Water Resources Department (Irrigation)',
        role: 'Tidal Ingress & River Estuary Backwater Surges',
        indicators: ['Peak High-Tide & Storm Inundation Surge Depth'],
        status: 'PENDING',
        officer: 'Executive Engineer (Canals & Estuaries)',
        assessmentId: 88,
      },
    ],
    EXTREME_WEATHER: [
      {
        department: 'Revenue & Disaster Management (KSDMA)',
        role: 'Ground Flash Lightning Density & Automated Alert Dissemination',
        indicators: ['Lightning Strike Flash Density (flashes/km²)', 'Squall Warning Logs'],
        status: 'SUBMITTED',
        officer: 'State Emergency Operations Center (SEOC)',
        assessmentId: 89,
      },
      {
        department: 'India Meteorological Department (IMD)',
        role: 'Doppler Radar Squall Gust Velocity & Convective Cell Tracking',
        indicators: ['Severe Thunderstorm Peak Gust Velocity (km/h)'],
        status: 'PENDING',
        officer: 'Meteorologist-in-Charge (IMD Thiruvananthapuram)',
        assessmentId: 89,
      },
      {
        department: 'Local Self Government (LSGD / Panchayats)',
        role: 'Tin / Sheet / Kutcha Roof Vulnerability to Wind Damage',
        indicators: ['Kutcha / Sheet Roof Structures Exposed to Gusts'],
        status: 'PENDING',
        officer: 'Town Planning Inspector (LSGD Kottayam)',
        assessmentId: 89,
      },
    ],
  };

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

  const completedCount = useMemo(() => scopedAssessments.filter((a) => a.status === 'COMPLETED').length, [scopedAssessments]);
  const activeHazards = useMemo(() => hazards.filter((h) => h.is_active).length, [hazards]);

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

  // ── FIRST PAGE: Dedicated 4-Column Box Selection Screen (When no hazard is selected) ──
  if (activeHazard === null) {
    return (
      <div className="hazard-selection-page-wrapper">
        <div className="hazard-selection-container">
          {/* Official Emblem & State Header */}
          <div className="hazard-portal-header">
            <div className="hazard-emblem-badge">
              <span style={{ fontSize: '1.4rem' }}>🏛️</span>
              <div>
                <div style={{ fontWeight: 800, letterSpacing: '0.04em', fontSize: '0.85rem', color: '#1e3a8a', textTransform: 'uppercase' }}>
                  Government of Kerala • Disaster Management Department
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Kerala State Disaster Management Authority (KSDMA) • State Emergency Operations Center
                </div>
              </div>
            </div>
            <div className="hazard-portal-live-pill">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>14 Revenue Districts Connected</span>
            </div>
          </div>

          {/* Central Hero Heading */}
          <div className="hazard-portal-hero">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dbeafe', color: '#1e40af', padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <span>🏛️</span> KERALA STATE DISASTER MANAGEMENT AUTHORITY (KSDMA)
            </div>
            <h1 className="hazard-portal-title">
              Select a Hazard Domain to Enter
            </h1>
            <p className="hazard-portal-subtitle">
              Choose one of the 4 operational hazard boxes below. When you enter a domain, all analytical models, line-department taskforces, indicators, and spatial assessment dossiers inside will be configured <strong>strictly and exclusively</strong> for that hazard.
            </p>
          </div>

          {/* 4 Clean Box Columns Grid */}
          <div className="hazard-gateway-boxes-grid">
            {(['FLOOD', 'LANDSLIDE', 'COASTAL', 'EXTREME_WEATHER'] as HazardCode[]).map((code) => {
              const meta = HAZARD_CATALOG[code];
              const stats = hazardStats[code];
              const indCount = code === 'FLOOD' ? 21 : code === 'LANDSLIDE' ? 4 : 3;

              return (
                <div
                  key={code}
                  className="hazard-gateway-box"
                  style={{
                    '--box-color': meta.color,
                    '--box-bg': `${meta.color}15`,
                  } as React.CSSProperties}
                  onClick={() => setActiveHazard(code)}
                >
                  <div className="hazard-box-icon-bubble">{meta.icon}</div>
                  <h3 className="hazard-box-title">{meta.name}</h3>
                  <div className="hazard-box-tagline">{meta.tagline}</div>

                  <div className="hazard-box-bottom-area" style={{ marginTop: 'auto', paddingTop: '1.25rem' }}>
                    <div className="hazard-box-stats-row" style={{ border: 'none', padding: '0.4rem 0' }}>
                      <span><strong>{indCount}</strong> Indicators</span>
                      <span><strong>{stats.count}</strong> Runs</span>
                    </div>

                    <button className="hazard-box-btn" type="button">
                      <span>Open {meta.shortName} Portal</span>
                      <span>➔</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 2. DEDICATED HAZARD-SCOPED WORKSPACE (When a hazard box was clicked) ──
  return (
    <div className="dashboard-wrapper">
      {/* ── Google-Style Clean Header (100% Scoped to Active Hazard Domain) ── */}
      <div className="dashboard-page-header">
        <div className="dashboard-header-text">
          <div className="dashboard-header-pill">
            {activeHazardMeta?.icon} Kerala State Disaster Management Authority • {activeHazardMeta?.shortName} Domain Console
          </div>
          <h1 className="dashboard-header-title">
            {activeHazardMeta?.name} &amp; Risk Intelligence
          </h1>
          <p className="dashboard-header-desc">
            {activeHazardMeta?.tagline}. Dedicated line-department data submissions, telemetry indicators, and spatial assessment dossiers.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeHazardMeta?.color,
              borderColor: activeHazardMeta?.color,
            }}
            onClick={() => navigate(`/new-assessment?module=HAZARD&hazard=${activeHazard}`)}
          >
            <span>+</span> Run {activeHazardMeta?.shortName} Assessment
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ color: activeHazardMeta?.color, borderColor: `${activeHazardMeta?.color}40`, background: `${activeHazardMeta?.color}0a`, fontWeight: 700 }}
            onClick={() => navigate(hazardStats[activeHazard].primaryId ? `/department-coordination?assessmentId=${hazardStats[activeHazard].primaryId}` : `/department-coordination?hazard=${activeHazard}`)}
            title="Departmental Data Coordination for this hazard"
          >
            🏛️ {activeHazardMeta?.shortName} Dept Tasks
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => clearHazard()}
            title="Return to 4-Column Hazard Selection Gateway"
            style={{ fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' }}
          >
            ⬅ Change Hazard (4 Columns)
          </button>
        </div>
      </div>

      <div className="dashboard">
        {/* ── 1. Executive KPI Metrics Grid (Scoped to Domain) ── */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--kpi-accent': activeHazardMeta?.color || '#4f46e5', '--kpi-bg': activeHazardMeta ? `${activeHazardMeta.color}10` : '#eff0ff', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '📋', label: 'View All Reports', onClick: () => navigate('/reports') },
              { icon: '➕', label: 'New Assessment', onClick: () => navigate(activeHazard ? `/new-assessment?module=HAZARD&hazard=${activeHazard}` : '/new-assessment?module=HAZARD') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble">{activeHazardMeta?.icon || '📋'}</div>
            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
              {activeHazardMeta ? `${activeHazardMeta.shortName} Domain` : 'All Modules'}
            </span>
          </div>
          <div className="kpi-value">{scopedAssessments.length}</div>
          <div className="kpi-label">
            {activeHazardMeta ? `${activeHazardMeta.shortName} Risk Assessments` : 'Total Risk Assessments'}
          </div>
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
          <div className="kpi-label">
            {activeHazardMeta ? `${activeHazardMeta.shortName} Validated Syntheses` : 'Completed Syntheses'}
          </div>
          <div className="kpi-subtext">
            <span>📄 Ready for statutory report export</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#f59e0b', '--kpi-bg': '#fffbeb', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '⚠️', label: 'View Hazards', onClick: () => navigate('/data-library') },
              { icon: '🌊', label: 'Run Hazard Assessment', onClick: () => navigate(activeHazard ? `/new-assessment?module=HAZARD&hazard=${activeHazard}` : '/new-assessment?module=HAZARD') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble">📊</div>
            <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Monitored</span>
          </div>
          <div className="kpi-value">
            {activeHazard === 'FLOOD' ? 21 : activeHazard === 'LANDSLIDE' ? 4 : activeHazard === 'COASTAL' ? 3 : activeHazard === 'EXTREME_WEATHER' ? 3 : activeHazards}
          </div>
          <div className="kpi-label">
            {activeHazardMeta ? `${activeHazardMeta.shortName} Key Indicators` : 'Active Kerala Hazards'}
          </div>
          <div className="kpi-subtext">
            <span>{activeHazardMeta ? `Lead: ${activeHazardMeta.leadAgency.split('(')[0]}` : '🌊 Riverine, Pluvial & Flash Flood Risk'}</span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#8b5cf6', '--kpi-bg': '#f5f3ff', position: 'relative' } as React.CSSProperties}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <CardMenu items={[
              { icon: '🗺️', label: 'Explore Districts', onClick: () => navigate('/admin-units') },
            ]} />
          </div>
          <div className="kpi-header">
            <div className="kpi-icon-bubble">🏛️</div>
            <span className="badge badge-completed" style={{ fontSize: '0.68rem' }}>
              {activeHazard ? 'Coordinated' : 'Full Coverage'}
            </span>
          </div>
          <div className="kpi-value">
            {activeHazard ? (HAZARD_DEPARTMENT_TASKS[activeHazard]?.length || 4) : districts.length}
          </div>
          <div className="kpi-label">
            {activeHazardMeta ? 'Responsible Line Departments' : 'Revenue Districts Synced'}
          </div>
          <div className="kpi-subtext">
            <span>{activeHazardMeta ? 'Multi-agency indicator validation' : '📍 Taluka & Grama Panchayat resolution'}</span>
          </div>
        </div>
      </div>

      {/* ── 3. Spatial Intelligence & District Inspector ── */}
      <div className="spatial-command-layout">
        <div className="spatial-theater-card" id="geospatial-theater-anchor">
          <div className="spatial-theater-header">
            <div className="spatial-theater-title">
              <span style={{ fontSize: '1.3rem' }}>🗺️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>
                  Geospatial Flood Risk &amp; Territory Intelligence Center
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  State-wide administrative boundaries, flood inundation zones, and telemetry monitoring
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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

          <KeralaMap selectedDistrict={selectedDistrict} />
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

            <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--border-default)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Assessments Recorded:</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-heading)' }}>{districtAssessments.length}</span>
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

      {/* ── 3. Recent Assessments & 3-Output Pipeline Ledger ── */}
      <div className="ledger-card">
        <div className="ledger-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{activeHazardMeta ? activeHazardMeta.icon : '📋'}</span>
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
              onClick={() => navigate(activeHazard ? `/new-assessment?module=HAZARD&hazard=${activeHazard}` : '/new-assessment')}
              id="btn-new-assessment-table"
            >
              + New {activeHazardMeta ? activeHazardMeta.shortName : ''} Assessment
            </button>
          </div>
        </div>

        <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
          {filteredAssessments.length === 0 ? (
            <div className="empty-state" style={{ margin: '2rem' }}>
              <div className="empty-state-icon">{activeHazardMeta?.icon || '📋'}</div>
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
                style={{ marginTop: '0.85rem' }}
              >
                + Start {activeHazardMeta ? activeHazardMeta.shortName : ''} Assessment
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
                          style={{ background: '#f0fdfa', color: '#0d9488', borderColor: '#ccfbf1' }}
                        >
                          🏛️ Tasks
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
    </div>
    </div>
  );
}
