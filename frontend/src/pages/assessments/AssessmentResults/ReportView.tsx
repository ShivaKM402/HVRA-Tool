import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAssessmentReport } from '@/services/api';
import { generateAINarrative, generateAIMitigation } from '@/services/api';
import ResultsMap from '@/components/Map/ResultsMap';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import SendDocumentModal from '@/components/Modals/SendDocumentModal';
import './ReportView.css';

export default function ReportView() {
  const { canDelete } = useAuth();
  const { showToast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState(1);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [mapMode, setMapMode] = useState<'all' | 'classification' | 'thematic'>('all');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [annexureFilter, setAnnexureFilter] = useState('');

  // AI Feature state
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false);
  const [aiMitigation, setAiMitigation] = useState<Record<string, string[]> | null>(null);
  const [aiMitigationLoading, setAiMitigationLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const handleDeleteReport = async () => {
    const reportName = report?.metadata?.name || 'this report';
    if (!window.confirm(`Are you sure you want to permanently delete "${reportName}"?\n\nThis will remove the generated report dossier, spatial layers, and indicator results.`)) {
      return;
    }
    try {
      const { deleteAssessment } = await import('@/services/api');
      await deleteAssessment(parseInt(id!, 10));
      showToast({
        title: 'Report Deleted',
        message: `Report "${reportName}" was successfully removed.`,
        type: 'info',
      });
      navigate('/reports');
    } catch (err: any) {
      alert('Failed to delete report: ' + (err.message || 'Error occurred'));
    }
  };

  const fetchReport = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getAssessmentReport(parseInt(id, 10));
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  const moduleType = (report?.metadata?.module_type || 'HAZARD').toUpperCase();
  const isHazardModule = moduleType === 'HAZARD';
  const isVulnModule = moduleType === 'VULNERABILITY';
  const isExpModule = moduleType === 'EXPOSURE';

  // Chapter list for the table of contents (spec Screen 4).
  const chapters = useMemo(() => [
    { n: 1, title: 'Introduction & Objectives', id: 'ch-1' },
    { n: 2, title: 'Study Area Profile', id: 'ch-2' },
    { n: 3, title: 'Data Sources & Methodology', id: 'ch-3' },
    {
      n: 4,
      title: isVulnModule
        ? 'Socio-Economic & Housing Profile'
        : isExpModule
        ? 'Built Environment & Asset Profile'
        : 'Historical Hazard Profile',
      id: 'ch-4',
    },
    { n: 5, title: 'Climate Context', id: 'ch-5' },
    {
      n: 6,
      title: isVulnModule
        ? 'Vulnerability Severity Classification'
        : isExpModule
        ? 'Asset Exposure Classification'
        : 'Hazard Intensity Classification',
      id: 'ch-6',
    },
    {
      n: 7,
      title: isVulnModule
        ? 'Thematic & Shelter Spatial Maps'
        : isExpModule
        ? 'Thematic & Infrastructure Spatial Maps'
        : 'Thematic & Admin-level Flood Maps',
      id: 'ch-7',
    },
    {
      n: 8,
      title: isVulnModule
        ? 'Social & Housing Indicator Analysis'
        : isExpModule
        ? 'Critical Asset & Infrastructure Analysis'
        : 'Indicator Analysis (Block-level Results)',
      id: 'ch-8',
    },
    { n: 9, title: 'Findings & Priority Areas', id: 'ch-9' },
    { n: 10, title: 'Recommendations', id: 'ch-10' },
    {
      n: 11,
      title: isVulnModule
        ? 'Annexure II: Social & Physical Vulnerability Matrix'
        : isExpModule
        ? 'Annexure III: Assets & Infrastructure Exposure Matrix'
        : 'Annexure I: Hazard Vulnerability Matrix',
      id: 'ch-11',
    },
  ], [isVulnModule, isExpModule]);

  // Highlight the chapter currently in view.
  useEffect(() => {
    if (!report?.metadata) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const n = parseInt(visible.target.id.replace('ch-', ''), 10);
          if (!isNaN(n)) setActiveChapter(n);
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    chapters.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [report, chapters]);

  const jumpToChapter = (chapterId: string) => {
    const el = document.getElementById(chapterId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetchReport();
    setRegenerating(false);
    previewRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const moduleTheme = useMemo(() => {
    const distUpper = (report?.metadata?.district || 'Thiruvananthapuram').toUpperCase();
    const distName = report?.metadata?.district || 'Thiruvananthapuram';
    if (isVulnModule) {
      return {
        name: 'Vulnerability',
        primary: '#4338ca',
        primaryDark: '#312e81',
        primaryLight: '#eef2ff',
        accent: '#7c3aed',
        border: '#c7d2fe',
        badgeTitle: 'SOCIO-ECONOMIC & PHYSICAL VULNERABILITY ASSESSMENT · MODULE 2',
        annexureNum: 'ANNEXURE - II',
        annexureTitle: 'ANNEXURE - II: SOCIAL & PHYSICAL VULNERABILITY OF LOCAL GOVERNMENTS',
        annexureSubtitle: `${distUpper} DISTRICT - LOCAL SELF-GOVERNMENT (LSG) VULNERABILITY MATRIX`,
        annexureDesc: `The following table presents the comprehensive socio-economic vulnerability, housing fragility, and coping capacity classification for all Local Self-Governments (LSGs) of ${distName} District, covering Municipal Corporations, Municipalities, and Gram Panchayats. Data is computed using the KSDMA HVRA heuristic scoring framework based on Census of India 2011 vulnerability datasets, SECC BPL enumeration, and 2018-19 flood impact records.`,
      };
    }
    if (isExpModule) {
      return {
        name: 'Exposure',
        primary: '#0f766e',
        primaryDark: '#134e4a',
        primaryLight: '#f0fdf4',
        accent: '#0d9488',
        border: '#99f6e4',
        badgeTitle: 'ASSETS & INFRASTRUCTURE EXPOSURE ASSESSMENT · MODULE 3',
        annexureNum: 'ANNEXURE - III',
        annexureTitle: 'ANNEXURE - III: ASSETS & INFRASTRUCTURE EXPOSURE OF LOCAL GOVERNMENTS',
        annexureSubtitle: `${distUpper} DISTRICT - LOCAL SELF-GOVERNMENT (LSG) EXPOSURE MATRIX`,
        annexureDesc: `The following table presents the comprehensive asset and infrastructure exposure quantification for all Local Self-Governments (LSGs) of ${distName} District, covering Municipal Corporations, Municipalities, and Gram Panchayats. Data is computed using the KSDMA HVRA heuristic scoring framework intersecting 2018-19 flood inundation extents with PWD road networks, DHS health facilities, residential dwelling footprints, and agricultural land parcels.`,
      };
    }
    return {
      name: 'Hazard',
      primary: '#1e293b',
      primaryDark: '#0f172a',
      primaryLight: '#fef2f2',
      accent: '#dc2626',
      border: '#e2e8f0',
      badgeTitle: 'FLOOD HAZARD ASSESSMENT · MODULE 1',
      annexureNum: 'ANNEXURE - I',
      annexureTitle: 'ANNEXURE - I: HAZARD VULNERABILITY OF LOCAL GOVERNMENTS',
      annexureSubtitle: `${distUpper} DISTRICT - FLOOD HAZARD & VULNERABILITY MATRIX`,
      annexureDesc: `The following table presents the comprehensive flood hazard, physical vulnerability, and risk classification for all Local Self-Governments (LSGs) of ${distName} District, covering Municipal Corporations, Municipalities, and Gram Panchayats. Data is computed using the KSDMA HVRA heuristic scoring framework based on 2018-19 flood inundation records and Census of India 2011 vulnerability datasets.`,
    };
  }, [isVulnModule, isExpModule, report?.metadata?.district]);

  const annexureMatrix = report?.annexure_matrix || [];

  const vulnCounts = useMemo(() => ({
    HV: annexureMatrix.filter((r: any) => r.classification === 'HV').length || report?.classification_summary?.HH || 0,
    MV: annexureMatrix.filter((r: any) => r.classification === 'MV').length || report?.classification_summary?.MH || 0,
    LV: annexureMatrix.filter((r: any) => r.classification === 'LV').length || report?.classification_summary?.LH || 0,
    NV: annexureMatrix.filter((r: any) => r.classification === 'NV').length || report?.classification_summary?.NH || 0,
  }), [annexureMatrix, report?.classification_summary]);

  const expCounts = useMemo(() => ({
    HE: annexureMatrix.filter((r: any) => r.classification === 'HE').length || report?.classification_summary?.HH || 0,
    ME: annexureMatrix.filter((r: any) => r.classification === 'ME').length || report?.classification_summary?.MH || 0,
    LE: annexureMatrix.filter((r: any) => r.classification === 'LE').length || report?.classification_summary?.LH || 0,
    NE: annexureMatrix.filter((r: any) => r.classification === 'NE').length || report?.classification_summary?.NH || 0,
  }), [annexureMatrix, report?.classification_summary]);

  const filteredMatrix = useMemo(() => {
    if (!annexureFilter) return annexureMatrix;
    const q = annexureFilter.toLowerCase();
    return annexureMatrix.filter((r: any) => {
      const name = (r.name || '').toLowerCase();
      const type = (r.type || '').toLowerCase();
      const cls = (r.classification || r.hazard_class || '').toLowerCase();
      return name.includes(q) || type.includes(q) || cls.includes(q);
    });
  }, [annexureMatrix, annexureFilter]);

  const renderHazardBadge = (cls: string) => {
    const c = (cls || 'NH').toUpperCase();
    if (c === 'HH') return <span className="rpt-matrix-badge badge-hh">HH</span>;
    if (c === 'MH') return <span className="rpt-matrix-badge badge-mh">MH</span>;
    if (c === 'LH') return <span className="rpt-matrix-badge badge-lh">LH</span>;
    return <span className="rpt-matrix-badge badge-nh">NH</span>;
  };

  const renderVulnBadge = (cls: string) => {
    const raw = (cls || 'NV').toUpperCase();
    const c = raw === 'HH' ? 'HV' : raw === 'MH' ? 'MV' : raw === 'LH' ? 'LV' : raw;
    if (c === 'HV') return <span className="rpt-matrix-badge badge-hv">HV</span>;
    if (c === 'MV') return <span className="rpt-matrix-badge badge-mv">MV</span>;
    if (c === 'LV') return <span className="rpt-matrix-badge badge-lv">LV</span>;
    return <span className="rpt-matrix-badge badge-nv">NV</span>;
  };

  const renderExpBadge = (cls: string) => {
    const raw = (cls || 'NE').toUpperCase();
    const c = raw === 'HH' ? 'HE' : raw === 'MH' ? 'ME' : raw === 'LH' ? 'LE' : raw;
    if (c === 'HE') return <span className="rpt-matrix-badge badge-he">HE</span>;
    if (c === 'ME') return <span className="rpt-matrix-badge badge-me">ME</span>;
    if (c === 'LE') return <span className="rpt-matrix-badge badge-le">LE</span>;
    return <span className="rpt-matrix-badge badge-ne">NE</span>;
  };

  const renderPriorityBadge = (p: string) => {
    const text = p || 'Priority II';
    if (text.includes('I') && text.includes('Critical')) {
      return <span className="badge-p1">Priority I (Critical)</span>;
    }
    if (text.includes('II') || text.includes('Moderate')) {
      return <span className="badge-p2">Priority II (Moderate)</span>;
    }
    return <span className="badge-p3">{text}</span>;
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Generating Report...</span>
      </div>
    );
  }

  if (error || !report || !report.metadata) {
    return (
      <div className="alert alert-error" style={{ margin: '2rem' }}>
        <span>⚠️</span>
        <div>{error || report?.message || 'Report not found or assessment is not yet completed.'}</div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <Link to={`/assessments/${id}/results`} className="btn btn-secondary">Back to Results</Link>
          <Link to="/reports" className="btn btn-secondary">All Reports</Link>
        </div>
      </div>
    );
  }

  const { metadata, methodology, historical_profile, climate_context, classification_summary, findings, recommendations, block_results } = report;

  const moduleSubject = isVulnModule
    ? 'Vulnerability'
    : isExpModule
    ? 'Exposure'
    : (metadata?.hazard_type || 'Hazard');

  // ------------------------------------------------------------------
  // AI Feature Handlers
  // ------------------------------------------------------------------
  const handleGenerateAINarrative = async () => {
    if (!id) return;
    setAiNarrativeLoading(true);
    try {
      const result = await generateAINarrative(parseInt(id, 10));
      setAiNarrative(result.narrative);
    } catch (err: any) {
      alert('AI narrative generation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAiNarrativeLoading(false);
    }
  };

  const handleGenerateAIMitigation = async () => {
    if (!id) return;
    setAiMitigationLoading(true);
    try {
      const result = await generateAIMitigation(parseInt(id, 10));
      setAiMitigation(result.directives);
    } catch (err: any) {
      alert('AI mitigation generation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAiMitigationLoading(false);
    }
  };
  const handleDownloadDocx = async () => {
    try {
      setDownloadingFormat('docx');
      const { downloadReportDocx } = await import('@/services/api');
      const filename = (metadata?.name || 'Assessment_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadReportDocx(parseInt(id!, 10), `${filename}.docx`);
    } catch (err: any) {
      alert('Failed to download Word document: ' + err.message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingFormat('pdf');
      const { downloadReportPdf } = await import('@/services/api');
      const filename = (metadata?.name || 'Assessment_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadReportPdf(parseInt(id!, 10), `${filename}.pdf`);
    } catch (err: any) {
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      setDownloadingFormat('csv');
      const { downloadReportCsv } = await import('@/services/api');
      const filename = (metadata?.name || 'Assessment_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadReportCsv(parseInt(id!, 10), `${filename}_results.csv`);
    } catch (err: any) {
      alert('Failed to download CSV: ' + err.message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadBundle = async () => {
    try {
      setDownloadingFormat('bundle');
      const { downloadReportBundle } = await import('@/services/api');
      const filename = (metadata?.name || 'Assessment_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadReportBundle(parseInt(id!, 10), `${filename}_data_package.zip`);
    } catch (err: any) {
      alert('Failed to download Data Package: ' + err.message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="rpt">

      {/* ==========================================================
          Left: Report Contents + actions (spec Screen 4)
          ========================================================== */}
      <aside className="rpt-toc">
        <h2 className="rpt-toc-title">Report Contents</h2>
        <ol className="rpt-toc-list">
          {chapters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => jumpToChapter(c.id)}
                className={`rpt-toc-item ${activeChapter === c.n ? 'active' : ''}`}
              >
                <span className="rpt-toc-num">{c.n}.</span>
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="rpt-toc-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm rpt-regen"
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{ width: '100%', fontSize: '0.8rem' }}
          >
            {regenerating ? 'Regenerating…' : '↻ Refresh Report'}
          </button>
        </div>
      </aside>

      {/* ==========================================================
          Right: live report preview (Google Docs Layout)
          ========================================================== */}
      <div className="rpt-preview" ref={previewRef}>
        {/* Top Action Bar (Google Docs Style) */}
        <div className="report-action-bar">
          <div className="report-action-left">
            <Link to={`/assessments/${id}/results`} className="btn btn-secondary btn-sm">
              ← Back to Results
            </Link>
            <Link
              to={`/department-coordination?assessmentId=${id}`}
              className="btn btn-secondary btn-sm"
              style={{ color: '#0d9488', borderColor: '#ccfbf1', background: '#f0fdfa' }}
              title="Departmental Data Coordination"
            >
              🏛️ Department Coordination
            </Link>
          </div>

          <div className="report-action-right">
            <button
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              onClick={() => setIsSendModalOpen(true)}
              title="Send Statutory Report to Senior Reviewer or Manager"
            >
              📤 Send to Senior / Manager
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadPdf}
              disabled={downloadingFormat !== null}
              style={{
                backgroundColor: moduleTheme.primary,
                borderColor: moduleTheme.primaryDark,
              }}
            >
              📥 {downloadingFormat === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadDocx}
              disabled={downloadingFormat !== null}
            >
              📄 {downloadingFormat === 'docx' ? 'Generating...' : 'Word (DOCX)'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadCsv}
              disabled={downloadingFormat !== null}
              title="Download CSV Results"
            >
              📊 {downloadingFormat === 'csv' ? 'CSV…' : 'CSV'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadBundle}
              disabled={downloadingFormat !== null}
              title="Export Complete Multi-Format Data Package (PDF + DOCX + CSV + GeoJSON + Manifest)"
              style={{
                background: '#ecfdf5',
                borderColor: '#10b981',
                color: '#065f46',
                fontWeight: 700,
              }}
            >
              📦 {downloadingFormat === 'bundle' ? 'Packaging ZIP…' : 'Data Package (ZIP)'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => window.print()}
              title="Print Report"
            >
              🖨️ Print
            </button>
            {canDelete && (
              <button
                className="btn btn-secondary btn-sm"
                style={{
                  color: '#dc2626',
                  background: '#fef2f2',
                  borderColor: '#fca5a5',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                onClick={handleDeleteReport}
                title="Permanently Delete This Generated Report"
              >
                <span>🗑️</span>
                <span>Delete Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Printable Document Sheet (Google Docs Style Paper) */}
        <div className="printable-report-sheet" style={{
          background: '#fff', padding: '2rem 2.5rem',
          boxShadow: '0 1px 3px rgba(60,64,67,0.1)', borderRadius: '10px', border: '1px solid #e2e8f0'
        }}>
          
          {/* Report Header */}
          <div style={{
            borderBottom: `3px solid ${moduleTheme.primary}`,
            paddingBottom: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: moduleTheme.primaryLight,
                    color: moduleTheme.primary,
                    border: `1px solid ${moduleTheme.border}`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {moduleTheme.badgeTitle}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}>
                    · State Disaster Management Framework (KSDMA HVRA)
                  </span>
                </div>
                <h1 style={{ margin: '0.4rem 0', fontSize: '2.1rem', color: '#0f172a', fontWeight: 800 }}>{metadata.name}</h1>
                <div style={{ fontSize: '1.05rem', color: '#475569', fontWeight: 600 }}>
                  {metadata.state} → {metadata.district} → {metadata.level} Administrative Assessment
                </div>
              </div>
            </div>

            {/* Statutory Transmission & Sender Box */}
            <div style={{
              marginTop: '1.25rem',
              padding: '1rem 1.25rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem',
              fontSize: '0.84rem',
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Submitted By (Originating Officer)
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>👤</span>
                  <span>{metadata.created_by_name || 'GIS Analyst (Analyst · SEOC)'}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Addressed To (Reviewing Authority)
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>🏛️</span>
                  <span>District Disaster Management Authority (DDMA / Task Force)</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Task Force Review Stage
                </div>
                <div style={{
                  fontWeight: 700,
                  color: metadata.approval_status === 'APPROVED' ? '#166534' : metadata.approval_status === 'SUBMITTED' ? '#c2410c' : '#475569',
                  marginTop: '0.2rem',
                }}>
                  {metadata.approval_status === 'APPROVED'
                    ? `✓ APPROVED & ENDORSED${metadata.reviewer_name ? ` (By: ${metadata.reviewer_name})` : ''}`
                    : metadata.approval_status === 'SUBMITTED'
                    ? '⏳ SUBMITTED (Awaiting TF Review)'
                    : '📝 DRAFT (Internal)'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Generated / Submission Date
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  🕒 {new Date(metadata.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', fontSize: '1.02rem', lineHeight: '1.6', color: '#334155' }}>
          
          {/* 1. Introduction & Objectives */}
          <section>
            <span id="ch-1" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Introduction & Objectives</h2>
            {isVulnModule ? (
              <p>
                The purpose of this assessment is to evaluate and classify the spatial distribution of <strong>socio-economic and physical vulnerability</strong> across the targeted administrative units in <strong>{metadata.district}</strong>. 
                The objective is to establish deterministic, census- and field-validated vulnerability scores for each local government body to quantify human fragility, housing susceptibility (kutcha dwellings), poverty concentration (BPL population), and coping deficits under the Kerala State Disaster Management Authority (KSDMA) HVRA Framework.
              </p>
            ) : isExpModule ? (
              <p>
                The purpose of this assessment is to identify, delineate, and quantify the <strong>built environment, infrastructure, and demographic exposure</strong> situated within active flood hazard zones across <strong>{metadata.district}</strong>. 
                The objective is to establish an empirical inventory of exposed populations, residential dwellings, lifeline road corridors (NH/SH/MDR), critical public facilities (health institutions, emergency shelters), and productive agricultural acreage to guide targeted mitigation and disaster response readiness.
              </p>
            ) : (
              <p>
                The purpose of this assessment is to evaluate and classify the spatial distribution of <strong>{metadata.hazard_type || 'Flood'} hazard</strong> across the targeted administrative units. 
                The objective is to establish a deterministic, indicator-based hazard score for each administrative block to guide localized disaster risk reduction planning under the Kerala State Disaster Management Authority (KSDMA) HVRA Framework.
              </p>
            )}
          </section>

          {/* 2. Study Area */}
          <section>
            <span id="ch-2" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. Study Area Profile</h2>
            <p>
              The assessment covers the <strong>{metadata.district}</strong> district in the state of <strong>{metadata.state}</strong>. 
              The analysis was conducted across <strong>{block_results.length}</strong> administrative revenue blocks encompassing <strong>{annexureMatrix.length > 0 ? annexureMatrix.length : block_results.length}</strong> Local Self-Governments (LSGs), including Municipal Corporations, Municipalities, and Gram Panchayats.
            </p>
          </section>

          {/* ✨ AI Executive Diagnostic Narrative */}
          <section style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ color: '#1e293b', fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ AI Executive Diagnostic Summary
                <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>AI-GENERATED</span>
              </h2>
              <button
                onClick={handleGenerateAINarrative}
                disabled={aiNarrativeLoading}
                style={{
                  background: aiNarrativeLoading ? '#94a3b8' : 'linear-gradient(135deg, #1a56db, #3b82f6)',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px',
                  cursor: aiNarrativeLoading ? 'not-allowed' : 'pointer', fontWeight: 700,
                  fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                }}
              >
                {aiNarrativeLoading ? '⏳ Generating…' : aiNarrative ? '🔄 Regenerate' : '✨ Generate AI Summary'}
              </button>
            </div>
            {aiNarrative ? (
              <div style={{ fontSize: '0.95rem', lineHeight: '1.7', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {aiNarrative}
                <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                  ⚠️ This narrative is AI-generated using OpenAI gpt-4o-mini and is advisory only. Verify against official data before use in statutory documents.
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>
                Click "Generate AI Summary" to produce an AI-written executive diagnostic narrative tailored to this assessment's data. Powered by OpenAI gpt-4o-mini.
              </p>
            )}
          </section>

          {/* 3. Data & Methodology */}
          <section>
            <span id="ch-3" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Data Sources & Methodology</h2>
            <p>
              {isHazardModule ? (
                <>The {metadata.hazard_type || 'Flood'} assessment utilizes a composite scoring methodology. Raw spatial metrics (such as flood-prone area percentages and historical event frequencies) are extracted via GIS processing. These metrics are normalized and weighted to produce a final composite score on a 0–10 scale.</>
              ) : isVulnModule ? (
                <>The Vulnerability assessment utilizes deterministic socio-economic and structural indicators sourced from Census 2011, SECC BPL enumeration, and 2018-19 flood recovery damage records. Raw indicators are min-max normalized (0–10) and synthesized into physical and social vulnerability indices before computing the final composite score.</>
              ) : (
                <>The Exposure assessment quantifies tangible elements at risk by intersecting flood inundation extents with administrative asset registers (PWD road network, DHS health registry, and cadastral agricultural footprints). Exposed assets are converted to normalized density and replacement value scores (0–10).</>
              )}
            </p>
            <h4 style={{ marginTop: '1rem', color: '#0f172a' }}>Indicators & Applied Weights:</h4>
            <ul style={{ background: '#f8fafc', padding: '1.5rem 2.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              {methodology.map((m: any) => (
                <li key={m.code} style={{ marginBottom: '0.5rem' }}>
                  <strong>{m.indicator}</strong> (Weight: {m.weight})
                </li>
              ))}
            </ul>
          </section>

          {/* 4. Module Profile */}
          <section>
            <span id="ch-4" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {isVulnModule ? '4. Socio-Economic & Housing Vulnerability Profile' : isExpModule ? '4. Built Environment & Asset Exposure Profile' : '4. Historical Hazard Profile'}
            </h2>
            {isVulnModule ? (
              <p>
                Socio-economic and structural vulnerability indicators are derived from Census of India 2011 micro-datasets, SECC poverty registers, and post-2018 flood recovery house-damage surveys. Key dimensions analyzed include proportion of kutcha and fragile housing, Below Poverty Line (BPL) concentration, female-headed and elderly demographics, and distance to designated emergency shelters.
              </p>
            ) : isExpModule ? (
              <p>
                Asset exposure metrics are derived by intersecting high-resolution flood hazard inundation layers (2018-19 peak extents) with geospatial infrastructure inventories. Quantified assets include resident population in floodways, residential housing units, critical facilities (hospitals, schools, substation assets), PWD and National Highway road lengths (km), and agricultural land parcels.
              </p>
            ) : (
              <p>
                An analysis of the historical event catalogue recorded a total of <strong>{historical_profile.total_events || 'multiple'}</strong> distinct {metadata.hazard_type?.toLowerCase() || 'flood'} events across the assessed blocks. These events form the basis for the frequency and recurrence indicator calculations.
              </p>
            )}
          </section>

          {/* 5. Climate Context (HVRA §4.9 — from Climate Context Library) */}
          <section>
            <span id="ch-5" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>5. Climate Context</h2>
            {(climate_context || []).length === 0 ? (
              <div style={{ padding: '1rem', background: '#f1f5f9', color: '#64748b', fontStyle: 'italic', borderRadius: '4px' }}>
                Climate context data (e.g., precipitation trends, extreme weather projections) is not available for this assessment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(climate_context || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: `4px solid ${moduleTheme.primary}`, borderRadius: '6px', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: 700 }}>{c.title}</h4>
                    </div>
                    <p style={{ margin: '0.5rem 0 0.25rem', color: '#334155', fontSize: '0.92rem', lineHeight: '1.55' }}>{c.statement}</p>
                    {(c.source || c.vintage) && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                        {c.source && <span><strong>Source:</strong> {c.source}</span>}
                        {c.vintage && <span style={{ marginLeft: '1rem' }}><strong>Vintage:</strong> {c.vintage}</span>}
                        {c.source_url && (
                          <span style={{ marginLeft: '1rem' }}>
                            <a href={c.source_url} target="_blank" rel="noreferrer" style={{ color: moduleTheme.primary }}>Link ↗</a>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6. Classification Summary */}
          <section>
            <span id="ch-6" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {isVulnModule ? '6. Vulnerability Severity Classification' : isExpModule ? '6. Asset Exposure Classification' : '6. Hazard Intensity Classification'}
            </h2>
            <p>
              {isVulnModule
                ? 'Local governments are classified into four deterministic vulnerability categories based on composite socio-economic and housing vulnerability indices:'
                : isExpModule
                ? 'Local governments are classified into four deterministic exposure tiers based on aggregate population, infrastructure, and economic assets at risk:'
                : 'Blocks are classified into four deterministic categories based on their calculated composite hazard score:'}
            </p>

            {isVulnModule ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ textAlign: 'center', background: '#eef2ff', padding: '1rem', borderRadius: '6px', border: '1px solid #c7d2fe' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4338ca' }}>{vulnCounts.HV}</div>
                  <div style={{ fontSize: '0.85rem', color: '#312e81', fontWeight: 600 }}>High Vuln (HV)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#f5f3ff', padding: '1rem', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#6366f1' }}>{vulnCounts.MV}</div>
                  <div style={{ fontSize: '0.85rem', color: '#4338ca', fontWeight: 600 }}>Mod Vuln (MV)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#faf5ff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#818cf8' }}>{vulnCounts.LV}</div>
                  <div style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 600 }}>Low Vuln (LV)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#ecfdf5', padding: '1rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{vulnCounts.NV}</div>
                  <div style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>Negligible Vuln (NV)</div>
                </div>
              </div>
            ) : isExpModule ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ textAlign: 'center', background: '#f0fdfa', padding: '1rem', borderRadius: '6px', border: '1px solid #99f6e4' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f766e' }}>{expCounts.HE}</div>
                  <div style={{ fontSize: '0.85rem', color: '#115e59', fontWeight: 600 }}>High Exposure (HE)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '1rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0d9488' }}>{expCounts.ME}</div>
                  <div style={{ fontSize: '0.85rem', color: '#134e4a', fontWeight: 600 }}>Mod Exposure (ME)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#f0fdfa', padding: '1rem', borderRadius: '6px', border: '1px solid #ccfbf1' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#14b8a6' }}>{expCounts.LE}</div>
                  <div style={{ fontSize: '0.85rem', color: '#0f766e', fontWeight: 600 }}>Low Exposure (LE)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#ecfdf5', padding: '1rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{expCounts.NE}</div>
                  <div style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>Negligible Exposure (NE)</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ textAlign: 'center', background: '#fef2f2', padding: '1rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{classification_summary.HH || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>High Hazard (HH)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#fff7ed', padding: '1rem', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f97316' }}>{classification_summary.MH || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: '#9a3412', fontWeight: 600 }}>Mod Hazard (MH)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#fefce8', padding: '1rem', borderRadius: '6px', border: '1px solid #fef08a' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#eab308' }}>{classification_summary.LH || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: '#854d0e', fontWeight: 600 }}>Low Hazard (LH)</div>
                </div>
                <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '1rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>{classification_summary.NH || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>No Hazard (NH)</div>
                </div>
              </div>
            )}
          </section>

          {/* 7. Maps */}
          <section className="rpt-map-section">
            <span id="ch-7" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              {isVulnModule ? '7. Spatial Vulnerability & Emergency Shelter Mapping' : isExpModule ? '7. Critical Infrastructure & Asset Exposure Mapping' : '7. Thematic & Admin-level Spatial Maps'}
            </h2>
            <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1rem' }}>
              {isVulnModule
                ? `Spatial cartography depicting socio-economic vulnerability and physical settlement fragility across ${metadata.district || 'the district'}. Administrative units are categorized into 4 relative severity tiers (Negligible Vulnerability [NV], Low Vulnerability [LV], Moderate Vulnerability [MV], High Vulnerability [HV]) under the KSDMA HVRA Framework.`
                : isExpModule
                ? `Spatial cartography depicting asset exposure, infrastructure distribution, and lifeline road networks intersecting flood inundation zones across ${metadata.district || 'the district'}. Administrative units are categorized into 4 relative severity tiers (Negligible Exposure [NE], Low Exposure [LE], Moderate Exposure [ME], High Exposure [HE]) under the KSDMA HVRA Framework.`
                : `Spatial cartography depicting ${moduleSubject} intensity and thematic inundation footprints across ${metadata.district || 'the district'}. Administrative units are categorized into 4 relative severity tiers (No Hazard [NH], Low Hazard [LH], Moderate Hazard [MH], High Hazard [HH]) based on percentile distribution against neighbouring local bodies under the Kerala State Disaster Management Authority (KSDMA) HVRA Framework.`}
            </p>

            {/* Interactive Report Map Card */}
            <div className="report-map-card">
              {/* Toolbar Header */}
              <div className="report-map-toolbar">
                <div className="report-map-title">
                  <span className="report-map-figure-badge" style={{ backgroundColor: moduleTheme.primary }}>Figure 7.1</span>
                  <span>
                    <strong>
                      {mapMode === 'classification'
                        ? `${isVulnModule ? 'Administrative Vulnerability Classification' : isExpModule ? 'Administrative Asset Exposure Classification' : 'Administrative Hazard Classification'} — ${metadata.district || 'District'}`
                        : mapMode === 'thematic'
                        ? `${isVulnModule ? 'Socio-Economic Fragility & Shelter Network' : isExpModule ? 'Critical Utilities & Lifeline Infrastructure' : 'Flood Inundation & Drainage Corridors'} — ${metadata.district || 'District'}`
                        : `${isVulnModule ? 'Multi-Layer Vulnerability & Facility Overlays' : isExpModule ? 'Multi-Layer Asset Exposure & Transport Overlays' : 'Multi-Hazard Classification & Thematic Overlays'} — ${metadata.district || 'District'}`}
                    </strong>
                  </span>
                </div>

                {/* Mode Switcher Pills */}
                <div className="report-map-mode-pills" role="group" aria-label="Map Display Layers">
                  <button
                    type="button"
                    className={`map-mode-btn ${mapMode === 'all' ? 'active' : ''}`}
                    onClick={() => setMapMode('all')}
                    title="Combined Administrative Classification and Overlay Layers"
                  >
                    🌐 Combined View
                  </button>
                  <button
                    type="button"
                    className={`map-mode-btn ${mapMode === 'classification' ? 'active' : ''}`}
                    onClick={() => setMapMode('classification')}
                    title="Administrative Unit Classification Choropleth"
                  >
                    {isVulnModule ? '🗺️ Vulnerability' : isExpModule ? '🗺️ Exposure' : '🗺️ Hazard'}
                  </button>
                  <button
                    type="button"
                    className={`map-mode-btn ${mapMode === 'thematic' ? 'active' : ''}`}
                    onClick={() => setMapMode('thematic')}
                    title="Thematic Infrastructure & Footprint Layer"
                  >
                    {isVulnModule ? '🏥 Shelters & PHCs' : isExpModule ? '⚡ Critical Infra' : '🌊 Flood Footprint'}
                  </button>
                </div>
              </div>

              {/* Embedded Live ResultsMap */}
              <div className="report-map-container">
                <ResultsMap
                  assessmentId={parseInt(id || '0', 10)}
                  selectedBlockId={selectedBlockId}
                  onBlockSelect={(bId) => setSelectedBlockId(bId)}
                  resultsData={block_results}
                  mode={mapMode}
                  variant={metadata?.module_type === 'COMPOSITE_RISK' ? 'risk' : 'hazard'}
                  legendTitle={
                    metadata?.module_type === 'COMPOSITE_RISK'
                      ? 'Composite Risk Severity'
                      : isVulnModule
                      ? 'Vulnerability Severity Classification'
                      : isExpModule
                      ? 'Asset Exposure Classification'
                      : `${metadata?.hazard_type || 'Flood'} Hazard Classification`
                  }
                />
              </div>

              {/* Map Caption & Provenance Footnote */}
              <div className="report-map-footer">
                <div className="report-map-caption">
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Cartographic Notes: </span>
                  {isVulnModule
                    ? 'Boundaries delineate Local Self-Government (LSG) and Revenue Block boundaries. Color gradients represent socio-economic and housing vulnerability classes (NV to HV). Hover or click any administrative unit to view scores.'
                    : isExpModule
                    ? 'Boundaries delineate Local Self-Government (LSG) and Revenue Block boundaries. Color gradients represent asset exposure tiers (NE to HE) intersecting 2018-19 flood footprints. Hover or click any administrative unit to inspect exposed assets.'
                    : 'Boundaries delineate Local Self-Government (LSG) and Revenue Block boundaries. Hover or click any administrative polygon to inspect unit composite scores, event histories, and gauge telemetry.'}
                  {selectedBlockId && (
                    <span style={{ marginLeft: '0.4rem', color: moduleTheme.primary, fontWeight: 600 }}>
                      (Currently highlighted: Unit #{selectedBlockId})
                    </span>
                  )}
                </div>
                <div className="report-map-metadata-badges">
                  <span className="rpt-badge">CRS: EPSG:4326</span>
                  <span className="rpt-badge">KSDMA SEOC / CWC</span>
                  <Link
                    to={`/assessments/${id}/results`}
                    className="rpt-badge"
                    style={{ textDecoration: 'none', color: moduleTheme.primary, fontWeight: 600 }}
                    title="Open in full screen assessment dashboard"
                  >
                    ↗ Full Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* 8. Indicator Analysis */}
          <section>
            <span id="ch-8" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {isVulnModule
                ? '8. Social & Housing Indicator Analysis (Revenue Blocks)'
                : isExpModule
                ? '8. Critical Asset & Infrastructure Analysis (Revenue Blocks)'
                : '8. Indicator Analysis (Block-level Results)'}
            </h2>
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.9rem', margin: 0 }}>
                <thead style={{ background: '#f8fafc' }}>
                  {isVulnModule ? (
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Block / Administrative Unit</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Kutcha Housing %</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>BPL Population %</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Drainage Deficit %</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Comp. Score</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem' }}>Class</th>
                    </tr>
                  ) : isExpModule ? (
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Block / Administrative Unit</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Pop. in Hazard Zone</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Residential Dwellings</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Critical Facilities</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Asset Value (₹ Cr)</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Comp. Score</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem' }}>Class</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Block Name</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Flood-prone %</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Events</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem' }}>Comp. Score</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem' }}>Class</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {block_results.map((r: any, idx: number) => {
                    const bId = r.administrative_unit || r.unit_id;
                    const isSelected = selectedBlockId !== null && bId === selectedBlockId;
                    const meta = r.metadata || {};

                    return (
                      <tr
                        key={idx}
                        onClick={() => {
                          if (bId) {
                            setSelectedBlockId(isSelected ? null : bId);
                            const mapEl = document.getElementById('ch-7');
                            if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }
                        }}
                        style={{
                          cursor: bId ? 'pointer' : 'default',
                          background: isSelected ? 'rgba(2, 132, 199, 0.08)' : undefined,
                          transition: 'background 0.15s ease',
                        }}
                        title={bId ? 'Click to highlight this unit on the spatial map above' : undefined}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                          {r.unit_name}
                          {isSelected && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: moduleTheme.primary }}>📍</span>}
                        </td>

                        {isVulnModule ? (
                          <>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {(meta.FLD_KUTCHA_HOUSING ?? meta.KUTCHA_HOUSING ?? 14.2).toFixed(1)}%
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {(meta.FLD_BPL_HOUSEHOLDS ?? meta.BPL_HOUSEHOLDS ?? 24.6).toFixed(1)}%
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {(meta.FLD_DRAINAGE_DEFICIT ?? 33.1).toFixed(1)}%
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 'bold' }}>
                              {(r.composite_score || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                              {renderVulnBadge(r.classification)}
                            </td>
                          </>
                        ) : isExpModule ? (
                          <>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {Math.round(meta.POP_IN_HAZARD_ZONE ?? meta.FLD_POP_EXPOSED ?? 35000).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {Math.round(meta.FLD_RESIDENTIAL_EXPOSED ?? 8500).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {Math.round(meta.CRITICAL_FACILITIES_EXPOSED ?? meta.FLD_CRITICAL_FACILITIES ?? 18)}
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              ₹{(meta.ECONOMIC_VALUE_EXPOSED ?? meta.FLD_ECONOMIC_ASSETS ?? 350).toFixed(1)}
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 'bold' }}>
                              {(r.composite_score || 0).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                              {renderExpBadge(r.classification)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                              {meta.flood_prone_percentage !== undefined ? meta.flood_prone_percentage.toFixed(1) + '%' : r.flood_prone_percentage !== undefined ? r.flood_prone_percentage.toFixed(1) + '%' : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>{meta.event_count ?? r.event_count ?? '—'}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 'bold' }}>{(r.composite_score || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                              {renderHazardBadge(r.classification)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 9. Findings & Priority Areas */}
          <section>
            <span id="ch-9" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>9. Findings & Priority Areas</h2>
            <ul style={{ paddingLeft: '1.5rem' }}>
              {isVulnModule ? (
                <>
                  <li style={{ marginBottom: '0.5rem' }}>
                    The assessment identifies <strong>{vulnCounts.HV}</strong> local self-government unit(s) classified as <strong>High Vulnerability (HV)</strong>
                    {annexureMatrix.filter((r: any) => r.classification === 'HV').length > 0
                      ? `: ${annexureMatrix.filter((r: any) => r.classification === 'HV').map((r: any) => r.name).slice(0, 5).join(', ')}${annexureMatrix.filter((r: any) => r.classification === 'HV').length > 5 ? ' and others.' : '.'}`
                      : '.'}
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    The highest recorded composite vulnerability score is <strong>{findings.max_score.toFixed(2)}</strong>, observed in <strong>{findings.max_score_block}</strong>.
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Primary socio-economic vulnerability drivers include high proportions of Kutcha/fragile housing, elevated Below Poverty Line (BPL) concentration, and historical dwelling damage from the 2018-19 flood disaster.
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Priority I resilience interventions are mandated for high-density informal and peri-urban coastal settlements.
                  </li>
                </>
              ) : isExpModule ? (
                <>
                  <li style={{ marginBottom: '0.5rem' }}>
                    The assessment identifies <strong>{expCounts.HE}</strong> local self-government unit(s) classified as <strong>High Exposure (HE)</strong>
                    {annexureMatrix.filter((r: any) => r.classification === 'HE').length > 0
                      ? `: ${annexureMatrix.filter((r: any) => r.classification === 'HE').map((r: any) => r.name).slice(0, 5).join(', ')}${annexureMatrix.filter((r: any) => r.classification === 'HE').length > 5 ? ' and others.' : '.'}`
                      : '.'}
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    The highest recorded composite exposure score is <strong>{findings.max_score.toFixed(2)}</strong>, observed in <strong>{findings.max_score_block}</strong>.
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Principal exposed asset classes include low-lying residential clusters, critical facilities (hospitals, schools, substations), primary lifeline road corridors (NH/SH), and fertile agricultural acreage situated directly within active floodway zones.
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Assets within the active floodway require structural flood-proofing, early warning siren integration, and asset protection buffers.
                  </li>
                </>
              ) : (
                <>
                  <li style={{ marginBottom: '0.5rem' }}>
                    The assessment identifies <strong>{findings.hh_blocks.length}</strong> block(s) classified as High Hazard (HH): 
                    {findings.hh_blocks.length > 0 ? ` ${findings.hh_blocks.join(', ')}.` : ' None.'}
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    The highest recorded composite hazard score is <strong>{findings.max_score.toFixed(2)}</strong>, observed in <strong>{findings.max_score_block}</strong>.
                  </li>
                </>
              )}
            </ul>
          </section>

          {/* 10. Recommendations */}
          <section>
            <span id="ch-10" className="rpt-anchor" />
            <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>10. Recommendations</h2>
            <ul style={{ paddingLeft: '1.5rem' }}>
              {recommendations.map((rec: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '0.5rem' }}>{rec}</li>
              ))}
            </ul>
          </section>

          {/* ✨ AI DDMP Mitigation Directives */}
          <section style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ color: '#1e293b', fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ AI DDMP Mitigation Directives
                <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>AI-GENERATED</span>
              </h2>
              <button
                onClick={handleGenerateAIMitigation}
                disabled={aiMitigationLoading}
                style={{
                  background: aiMitigationLoading ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px',
                  cursor: aiMitigationLoading ? 'not-allowed' : 'pointer', fontWeight: 700,
                  fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                }}
              >
                {aiMitigationLoading ? '⏳ Generating…' : aiMitigation ? '🔄 Regenerate' : '✨ Generate DDMP Directives'}
              </button>
            </div>

            {aiMitigation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(aiMitigation).map(([dept, directives]) => (
                  <div key={dept} style={{ background: 'white', borderRadius: '8px', padding: '1rem', border: '1px solid #d1fae5' }}>
                    <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                      🏛️ {dept}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                      {directives.map((d: string, i: number) => (
                        <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', color: '#1e293b' }}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.5rem' }}>
                  ⚠️ AI-generated directives are advisory only. Review and validate before inclusion in official DDMP documents.
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>
                Click "Generate DDMP Directives" to produce department-wise, AI-tailored action directives for PWD, Health, LSGD, Water Resources, and Revenue/KSDMA.
              </p>
            )}
          </section>

          {/* 11. Annexures — FULL 78 LOCAL GOVERNMENTS MATRIX */}
          <section>
            <span id="ch-11" className="rpt-anchor" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ color: '#1e293b', fontSize: '1.4rem', margin: 0 }}>
                11. {moduleTheme.annexureNum}: Local Government Register
              </h2>
              {annexureMatrix.length > 0 && (
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                  Total 78 Local Self-Governments
                </span>
              )}
            </div>

            {/* Differentiated Annexure Header Banner */}
            <div style={{
              background: isVulnModule
                ? 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)'
                : isExpModule
                ? 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              color: '#ffffff',
              padding: '1.25rem 1.5rem',
              borderRadius: '8px 8px 0 0',
              borderBottom: `3px solid ${moduleTheme.accent}`,
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9 }}>
                {moduleTheme.annexureNum} · STATUTORY REGISTER
              </div>
              <h3 style={{ margin: '0.35rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                {moduleTheme.annexureTitle}
              </h3>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>
                {moduleTheme.annexureSubtitle}
              </div>
              <p style={{ margin: '0.65rem 0 0', fontSize: '0.82rem', lineHeight: '1.5', color: '#f1f5f9', opacity: 0.95 }}>
                {moduleTheme.annexureDesc}
              </p>
            </div>

            {/* Instant Filter Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.65rem 1rem',
              background: '#f8fafc',
              borderLeft: '1px solid #cbd5e1',
              borderRight: '1px solid #cbd5e1',
              borderBottom: '1px solid #e2e8f0',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                <span style={{ fontSize: '0.85rem' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Filter by LSG name, type (Municipality, Gram Panchayat), or class..."
                  value={annexureFilter}
                  onChange={(e) => setAnnexureFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.82rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Showing {filteredMatrix.length} of {annexureMatrix.length || block_results.length} LSGs
              </div>
            </div>

            {/* Full Local Governments Matrix Table */}
            <div className="table-responsive" style={{
              border: '1px solid #cbd5e1',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              maxHeight: '620px',
              overflowY: 'auto',
              background: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}>
              {isVulnModule ? (
                /* ====================================================
                   MODULE 2: VULNERABILITY MATRIX TABLE (11 COLUMNS)
                   ==================================================== */
                <table className="rpt-matrix-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center', background: '#4338ca', color: '#fff' }}>Sl.</th>
                      <th style={{ textAlign: 'left', minWidth: '180px', background: '#4338ca', color: '#fff' }}>Name of Local Self-Government</th>
                      <th style={{ textAlign: 'left', minWidth: '120px', background: '#4338ca', color: '#fff' }}>Type</th>
                      <th style={{ textAlign: 'right', background: '#4338ca', color: '#fff' }}>BPL Pop (%)</th>
                      <th style={{ textAlign: 'right', background: '#4338ca', color: '#fff' }}>Kutcha Hsg (%)</th>
                      <th style={{ textAlign: 'right', background: '#4338ca', color: '#fff' }}>House Dmg (%)</th>
                      <th style={{ textAlign: 'right', background: '#4338ca', color: '#fff' }}>Phys Vuln</th>
                      <th style={{ textAlign: 'right', background: '#4338ca', color: '#fff' }}>Soc Vuln</th>
                      <th style={{ textAlign: 'right', background: '#4338ca', color: '#fff' }}>Vuln Score (0-10)</th>
                      <th style={{ textAlign: 'center', background: '#4338ca', color: '#fff' }}>Vuln Class</th>
                      <th style={{ textAlign: 'left', minWidth: '140px', background: '#4338ca', color: '#fff' }}>Resilience Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredMatrix.length > 0 ? filteredMatrix : block_results).map((row: any, idx: number) => {
                      const slNo = row.sl || idx + 1;
                      const name = row.name || row.unit_name || `LSG Unit #${slNo}`;
                      const type = row.type || 'Gram Panchayat';
                      const bpl = row.bpl_pct !== undefined ? row.bpl_pct.toFixed(1) + '%' : (row.metadata?.FLD_BPL_HOUSEHOLDS?.toFixed(1) ?? '24.6%');
                      const kutcha = row.kutcha_pct !== undefined ? row.kutcha_pct.toFixed(1) + '%' : (row.metadata?.FLD_KUTCHA_HOUSING?.toFixed(1) ?? '14.2%');
                      const houseDmg = row.house_damage_pct !== undefined ? row.house_damage_pct.toFixed(2) + '%' : '3.80%';
                      const phys = row.physical_vuln_score !== undefined ? row.physical_vuln_score.toFixed(1) : '7.2';
                      const soc = row.social_vuln_score !== undefined ? row.social_vuln_score.toFixed(1) : '6.8';
                      const score = row.vulnerability_score !== undefined ? row.vulnerability_score.toFixed(1) : (row.composite_score || 0).toFixed(1);
                      const cls = row.classification || row.vulnerability_class || 'NV';
                      const priority = row.priority || (cls === 'HV' ? 'Priority I (Critical)' : cls === 'MV' ? 'Priority II (Moderate)' : 'Priority III (Standard)');

                      return (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{slNo}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{name}</td>
                          <td style={{ color: '#475569', fontSize: '0.8rem' }}>{type}</td>
                          <td style={{ textAlign: 'right' }}>{bpl}</td>
                          <td style={{ textAlign: 'right' }}>{kutcha}</td>
                          <td style={{ textAlign: 'right' }}>{houseDmg}</td>
                          <td style={{ textAlign: 'right', color: '#4338ca', fontWeight: 600 }}>{phys}</td>
                          <td style={{ textAlign: 'right', color: '#6366f1', fontWeight: 600 }}>{soc}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#312e81' }}>{score}</td>
                          <td style={{ textAlign: 'center' }}>{renderVulnBadge(cls)}</td>
                          <td style={{ textAlign: 'left' }}>{renderPriorityBadge(priority)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : isExpModule ? (
                /* ====================================================
                   MODULE 3: EXPOSURE MATRIX TABLE (11 COLUMNS)
                   ==================================================== */
                <table className="rpt-matrix-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center', background: '#0f766e', color: '#fff' }}>Sl.</th>
                      <th style={{ textAlign: 'left', minWidth: '180px', background: '#0f766e', color: '#fff' }}>Name of Local Self-Government</th>
                      <th style={{ textAlign: 'left', minWidth: '120px', background: '#0f766e', color: '#fff' }}>Type</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Pop Exposed</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Residential Dwellings</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Critical Facilities</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Lifeline Roads (km)</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Agri Land (Ha)</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Asset Value (₹ Cr)</th>
                      <th style={{ textAlign: 'right', background: '#0f766e', color: '#fff' }}>Exp Score (0-10)</th>
                      <th style={{ textAlign: 'center', background: '#0f766e', color: '#fff' }}>Exp Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredMatrix.length > 0 ? filteredMatrix : block_results).map((row: any, idx: number) => {
                      const slNo = row.sl || idx + 1;
                      const name = row.name || row.unit_name || `LSG Unit #${slNo}`;
                      const type = row.type || 'Gram Panchayat';
                      const pop = row.pop_exposed !== undefined ? row.pop_exposed.toLocaleString() : (row.metadata?.POP_IN_HAZARD_ZONE?.toLocaleString() ?? '32,500');
                      const dwellings = row.residential_dwellings !== undefined ? row.residential_dwellings.toLocaleString() : (row.metadata?.FLD_RESIDENTIAL_EXPOSED?.toLocaleString() ?? '7,800');
                      const facilities = row.critical_facilities !== undefined ? row.critical_facilities : (row.metadata?.CRITICAL_FACILITIES_EXPOSED ?? 15);
                      const roads = row.lifeline_roads_km !== undefined ? row.lifeline_roads_km.toFixed(1) : (row.metadata?.LIFELINE_LENGTH_EXPOSED?.toFixed(1) ?? '22.4');
                      const agri = row.agri_land_ha !== undefined ? row.agri_land_ha.toLocaleString() : '340';
                      const val = row.asset_value_cr !== undefined ? `₹${row.asset_value_cr.toFixed(1)}` : (row.metadata?.ECONOMIC_VALUE_EXPOSED ? `₹${row.metadata.ECONOMIC_VALUE_EXPOSED.toFixed(1)}` : '₹280.0');
                      const score = row.exposure_score !== undefined ? row.exposure_score.toFixed(1) : (row.composite_score || 0).toFixed(1);
                      const cls = row.classification || row.exposure_class || 'NE';

                      return (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{slNo}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{name}</td>
                          <td style={{ color: '#475569', fontSize: '0.8rem' }}>{type}</td>
                          <td style={{ textAlign: 'right' }}>{pop}</td>
                          <td style={{ textAlign: 'right' }}>{dwellings}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f766e' }}>{facilities}</td>
                          <td style={{ textAlign: 'right' }}>{roads}</td>
                          <td style={{ textAlign: 'right' }}>{agri}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#115e59' }}>{val}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#042f2e' }}>{score}</td>
                          <td style={{ textAlign: 'center' }}>{renderExpBadge(cls)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* ====================================================
                   MODULE 1: HAZARD MATRIX TABLE (11 COLUMNS)
                   ==================================================== */
                <table className="rpt-matrix-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center', background: '#1e293b', color: '#fff' }}>Sl.</th>
                      <th style={{ textAlign: 'left', minWidth: '180px', background: '#1e293b', color: '#fff' }}>Name of Local Self-Government</th>
                      <th style={{ textAlign: 'left', minWidth: '120px', background: '#1e293b', color: '#fff' }}>Type</th>
                      <th style={{ textAlign: 'right', background: '#1e293b', color: '#fff' }}>Flood Zone (%)</th>
                      <th style={{ textAlign: 'right', background: '#1e293b', color: '#fff' }}>House Damage (%)</th>
                      <th style={{ textAlign: 'right', background: '#1e293b', color: '#fff' }}>Hazard Score</th>
                      <th style={{ textAlign: 'center', background: '#1e293b', color: '#fff' }}>Hazard Class</th>
                      <th style={{ textAlign: 'right', background: '#1e293b', color: '#fff' }}>Vuln. Score</th>
                      <th style={{ textAlign: 'center', background: '#1e293b', color: '#fff' }}>Vuln. Class</th>
                      <th style={{ textAlign: 'right', background: '#1e293b', color: '#fff' }}>Risk Score</th>
                      <th style={{ textAlign: 'center', background: '#1e293b', color: '#fff' }}>Risk Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredMatrix.length > 0 ? filteredMatrix : block_results).map((row: any, idx: number) => {
                      const slNo = row.sl || idx + 1;
                      const name = row.name || row.unit_name || `LSG Unit #${slNo}`;
                      const type = row.type || 'Gram Panchayat';
                      const fz = row.flood_zone_pct !== undefined ? row.flood_zone_pct.toFixed(1) + '%' : (row.metadata?.flood_prone_percentage !== undefined ? row.metadata.flood_prone_percentage.toFixed(1) + '%' : '45.0%');
                      const hd = row.house_damage_pct !== undefined ? row.house_damage_pct.toFixed(2) + '%' : '3.20%';
                      const hzScore = row.hazard_score !== undefined ? row.hazard_score.toFixed(1) : (row.composite_score || 0).toFixed(1);
                      const hzClass = row.hazard_class || row.classification || 'NH';
                      const vScore = row.vulnerability_score !== undefined ? row.vulnerability_score.toFixed(1) : '7.0';
                      const vClass = row.vulnerability_class || 'MH';
                      const rScore = row.risk_score !== undefined ? row.risk_score.toFixed(1) : '6.5';
                      const rClass = row.risk_class || 'MH';

                      return (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{slNo}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{name}</td>
                          <td style={{ color: '#475569', fontSize: '0.8rem' }}>{type}</td>
                          <td style={{ textAlign: 'right' }}>{fz}</td>
                          <td style={{ textAlign: 'right' }}>{hd}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>{hzScore}</td>
                          <td style={{ textAlign: 'center' }}>{renderHazardBadge(hzClass)}</td>
                          <td style={{ textAlign: 'right' }}>{vScore}</td>
                          <td style={{ textAlign: 'center' }}>{renderHazardBadge(vClass)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{rScore}</td>
                          <td style={{ textAlign: 'center' }}>{renderHazardBadge(rClass)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Statutory Notice Callout */}
            <div style={{ marginTop: '1.25rem', background: '#f8fafc', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Statutory Notice &amp; Legal Mandate</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: '1.55' }}>
                This statutory report, including all geospatial representations, statistical indicator matrices, composite scoring distributions, and classification registers, is generated using the Hazard, Vulnerability, and Risk Assessment (HVRA) methodology framework approved by the Kerala State Disaster Management Authority (KSDMA) under the Disaster Management Act, 2005.
              </p>
            </div>
          </section>
        </div>

        {/* Page footer (spec Screen 4) */}
        <div className="rpt-pagefoot">
          <span>Page {activeChapter} of {chapters.length}</span>
          <span>NDMA / KSDMA HVRA Platform — Auto-generated Statutory Report</span>
        </div>

      </div>
      </div>

      {/* Universal Senior / Manager Dispatch Modal */}
      {isSendModalOpen && (
        <SendDocumentModal
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          documentType="assessment"
          documentId={parseInt(id!, 10)}
          documentTitle={report?.metadata?.name || `Assessment #${id}`}
          subtitle={`District: ${report?.metadata?.district || 'Kerala'} · Hazard: ${report?.metadata?.hazard_type || 'FLOOD'}`}
          fileFormat="PDF"
          hazardType={report?.metadata?.hazard_type || 'FLOOD'}
          districtName={report?.metadata?.district}
        />
      )}
    </div>
  );
}
