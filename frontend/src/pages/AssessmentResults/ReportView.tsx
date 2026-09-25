import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAssessmentReport } from '../../services/api';
import './ReportView.css';

export default function ReportView() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState(1);
  const [regenerating, setRegenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

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

  // Chapter list for the table of contents (spec Screen 4).
  const chapters = [
    { n: 1, title: 'Introduction & Objectives', id: 'ch-1' },
    { n: 2, title: 'Study Area Profile', id: 'ch-2' },
    { n: 3, title: 'Data Sources & Methodology', id: 'ch-3' },
    { n: 4, title: 'Hazard / Indicator Profile', id: 'ch-4' },
    { n: 5, title: 'Climate Context', id: 'ch-5' },
    { n: 6, title: 'Hazard Intensity Classification', id: 'ch-6' },
    { n: 7, title: 'Thematic & Admin-level Maps', id: 'ch-7' },
    { n: 8, title: 'Indicator Analysis', id: 'ch-8' },
    { n: 9, title: 'Findings & Priority Areas', id: 'ch-9' },
    { n: 10, title: 'Recommendations', id: 'ch-10' },
    { n: 11, title: 'Annexures', id: 'ch-11' },
  ];

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
  }, [report]);

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

  const isHazardModule = !metadata?.module_type || metadata.module_type === 'HAZARD';
  const moduleSubject = metadata?.hazard_type || (metadata?.module_label || 'Hazard');
  const subjectNoun = isHazardModule
    ? moduleSubject
    : (moduleSubject.replace(/ Assessment/i, '').toLowerCase() || 'indicator');

  const handleDownloadDocx = async () => {
    try {
      setDownloadingFormat('docx');
      const { downloadReportDocx } = await import('../../services/api');
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
      const { downloadReportPdf } = await import('../../services/api');
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
      const { downloadReportCsv } = await import('../../services/api');
      const filename = (metadata?.name || 'Assessment_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadReportCsv(parseInt(id!, 10), `${filename}_results.csv`);
    } catch (err: any) {
      alert('Failed to download CSV: ' + err.message);
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
            className="btn btn-secondary rpt-regen"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating…' : '↻ Auto-regenerate'}
          </button>
          <button
            type="button"
            className="rpt-export"
            onClick={handleDownloadDocx}
            disabled={downloadingFormat !== null}
          >
            {downloadingFormat === 'docx' ? 'Generating…' : 'Export as DOCX / PDF'}
          </button>
          <div className="rpt-toc-mini">
            <button className="rpt-mini-btn" onClick={handleDownloadDocx} disabled={downloadingFormat !== null}>
              DOCX
            </button>
            <button className="rpt-mini-btn" onClick={handleDownloadPdf} disabled={downloadingFormat !== null}>
              PDF
            </button>
            <button className="rpt-mini-btn" onClick={handleDownloadCsv} disabled={downloadingFormat !== null}>
              CSV
            </button>
            <button className="rpt-mini-btn" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>

        <div className="rpt-toc-links">
          <Link to={`/assessments/${id}/results`} className="rpt-mini-btn">
            ← Map results
          </Link>
          <Link to="/reports" className="rpt-mini-btn">
            All reports
          </Link>
        </div>
      </aside>

      {/* ==========================================================
          Right: live report preview
          ========================================================== */}
      <div className="rpt-preview" ref={previewRef}>
      {/* Top Action Bar (hidden on print) */}
      <div className="report-action-bar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
        background: '#f8fafc', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={`/assessments/${id}/results`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            ← Back to Map Results
          </Link>
          <Link to="/reports" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            📚 All Reports
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb' }}
            onClick={handleDownloadDocx}
            disabled={downloadingFormat !== null}
          >
            📄 {downloadingFormat === 'docx' ? 'Generating DOCX...' : 'Download Word (DOCX)'}
          </button>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#dc2626' }}
            onClick={handleDownloadPdf}
            disabled={downloadingFormat !== null}
          >
            📥 {downloadingFormat === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={handleDownloadCsv}
            disabled={downloadingFormat !== null}
          >
            📊 {downloadingFormat === 'csv' ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => window.print()}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Main Printable Document Sheet */}
      <div className="printable-report-sheet" style={{
        background: '#fff', padding: '3.5rem 4.5rem',
        boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)', borderRadius: '8px', border: '1px solid #e2e8f0'
      }}>
        
        {/* Report Header */}
        <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                State Disaster Management Framework · HVRA Digital Tool
              </div>
              <h1 style={{ margin: '0.5rem 0', fontSize: '2.1rem', color: '#0f172a', fontWeight: 800 }}>{metadata.name}</h1>
              <div style={{ fontSize: '1.1rem', color: '#475569', fontWeight: 600 }}>
                {metadata.state} → {metadata.district} → {metadata.level} Administrative Assessment
              </div>
            </div>
            {metadata.is_demo && (
              <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                ⚠️ DEMO ASSESSMENT
              </div>
            )}
          </div>
          <div style={{ marginTop: '1.25rem', color: '#64748b', fontSize: '0.85rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span><strong>Generated:</strong> {new Date(metadata.created_at).toLocaleString()}</span>
            <span><strong>Module:</strong> {metadata.module_label || 'Hazard Assessment'}{metadata.hazard_type ? ` · Hazard: ${metadata.hazard_type}` : ''}</span>
            <span><strong>Status:</strong> {metadata.status}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', fontSize: '1.02rem', lineHeight: '1.6', color: '#334155' }}>
        
        {/* 1. Introduction & Objectives */}
        <section>
          <span id="ch-1" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Introduction & Objectives</h2>
          <p>
            The purpose of this assessment is to evaluate and classify the spatial distribution of <strong>{' '}{subjectNoun}</strong>{isHazardModule ? ' hazard' : ''} across the targeted administrative units. 
            The objective is to establish a deterministic, indicator-based {isHazardModule ? 'hazard' : 'module'} score for each administrative block to guide localized disaster risk reduction planning.
          </p>
        </section>

        {/* 2. Study Area */}
        <section>
          <span id="ch-2" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. Study Area</h2>
          <p>
            The assessment covers the <strong>{metadata.district}</strong> district in the state of <strong>{metadata.state}</strong>. 
            The analysis was conducted at the <strong>{metadata.level}</strong> administrative level, encompassing a total of <strong>{block_results.length}</strong> blocks.
          </p>
        </section>

        {/* 3. Data & Methodology */}
        <section>
          <span id="ch-3" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Data & Methodology</h2>
          <p>
            {isHazardModule ? (
              <>The {metadata.hazard_type || ''} assessment utilizes a composite scoring methodology. Raw spatial metrics (such as flood-prone area percentages and historical event frequencies) are extracted via GIS processing. These metrics are normalized and weighted to produce a final composite score on a 0–10 scale.</>
            ) : (
              <>This module utilizes a deterministic indicator scoring methodology. Indicator values for each administrative block are generated from the module's indicator library (prototype DEMO DATA) and normalized to a 0–10 scale before weighted aggregation into a final composite score.</>
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

        {/* 4. Historical Hazard Profile */}
        <section>
          <span id="ch-4" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{isHazardModule ? '4. Historical Hazard Profile' : '4. Indicator Database Profile'}</h2>
          <p>
            {isHazardModule ? (
              <>An analysis of the historical event catalogue recorded a total of <strong>{historical_profile.total_events}</strong> distinct {metadata.hazard_type.toLowerCase()} events across the assessed blocks. These events form the basis for the frequency indicator calculations.</>
            ) : (
              <>Indicators for this module are derived from deterministic administrative and demographic database attributes (prototype DEMO DATA) rather than a historical event catalogue. No historical event dependency is required for this module.</>
            )}
          </p>
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
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #0ea5e9', borderRadius: '6px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: 700 }}>{c.title}</h4>
                    {c.is_demo && (
                      <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>DEMO</span>
                    )}
                  </div>
                  <p style={{ margin: '0.5rem 0 0.25rem', color: '#334155', fontSize: '0.92rem', lineHeight: '1.55' }}>{c.statement}</p>
                  {(c.source || c.vintage) && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                      {c.source && <span><strong>Source:</strong> {c.source}</span>}
                      {c.vintage && <span style={{ marginLeft: '1rem' }}><strong>Vintage:</strong> {c.vintage}</span>}
                      {c.source_url && (
                        <span style={{ marginLeft: '1rem' }}>
                          <a href={c.source_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Link ↗</a>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. Hazard Classification */}
        <section>
          <span id="ch-6" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>6. Hazard Classification Summary</h2>
          <p>Blocks are classified into four deterministic categories based on their calculated composite hazard score:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ textAlign: 'center', background: '#fef2f2', padding: '1rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{classification_summary.HH}</div>
              <div style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>High Hazard (HH)</div>
            </div>
            <div style={{ textAlign: 'center', background: '#fff7ed', padding: '1rem', borderRadius: '6px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f97316' }}>{classification_summary.MH}</div>
              <div style={{ fontSize: '0.85rem', color: '#9a3412', fontWeight: 600 }}>Mod Hazard (MH)</div>
            </div>
            <div style={{ textAlign: 'center', background: '#fefce8', padding: '1rem', borderRadius: '6px', border: '1px solid #fef08a' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#eab308' }}>{classification_summary.LH}</div>
              <div style={{ fontSize: '0.85rem', color: '#854d0e', fontWeight: 600 }}>Low Hazard (LH)</div>
            </div>
            <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '1rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>{classification_summary.NH}</div>
              <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>No Hazard (NH)</div>
            </div>
          </div>
        </section>

        {/* 7. Maps */}
        <section>
          <span id="ch-7" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>7. Maps & Visualizations</h2>
          <p>
            The spatial distribution of the hazard classification has been rendered interactively. To view the high-resolution dynamic map, please navigate to the Assessment Dashboard.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link to={`/assessments/${id}/results`} className="btn btn-primary">
              View Interactive Map Dashboard
            </Link>
          </div>
        </section>

        {/* 8. Indicator Analysis */}
        <section>
          <span id="ch-8" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>8. Indicator Analysis (Block-level Results)</h2>
          <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.9rem', margin: 0 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Block Name</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem' }}>Flood-prone %</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem' }}>Events</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem' }}>Comp. Score</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>Class</th>
                </tr>
              </thead>
              <tbody>
                {block_results.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{r.unit_name}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>
                      {r.metadata?.flood_prone_percentage !== undefined ? r.metadata.flood_prone_percentage.toFixed(1) + '%' : r.flood_prone_percentage !== undefined ? r.flood_prone_percentage.toFixed(1) + '%' : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>{r.metadata?.event_count ?? r.event_count ?? '—'}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 'bold' }}>{(r.composite_score || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                      <span className={`badge badge-${r.classification === 'HH' ? 'error' : r.classification === 'MH' ? 'warning' : r.classification === 'LH' ? 'info' : 'success'}`}>
                        {r.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 9. Findings & Priority Areas */}
        <section>
          <span id="ch-9" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>9. Findings & Priority Areas</h2>
          <ul style={{ paddingLeft: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              The assessment identifies <strong>{findings.hh_blocks.length}</strong> block(s) classified as High Hazard (HH): 
              {findings.hh_blocks.length > 0 ? ` ${findings.hh_blocks.join(', ')}.` : ' None.'}
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              The highest recorded composite hazard score is <strong>{findings.max_score.toFixed(2)}</strong>, observed in <strong>{findings.max_score_block}</strong>.
            </li>
          </ul>
        </section>

        {/* 10. Recommendations */}
        <section>
          <span id="ch-10" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>10. Recommendations (Prototype)</h2>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {recommendations.map((rec: string, idx: number) => (
              <li key={idx} style={{ marginBottom: '0.5rem' }}>{rec}</li>
            ))}
          </ul>
        </section>

        {/* 11. Annexures */}
        <section>
          <span id="ch-11" className="rpt-anchor" />
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>11. Annexures</h2>
          <div style={{ background: '#fefce8', padding: '1.5rem', border: '1px solid #fef08a', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#854d0e' }}>Disclaimer: DEMO DATA</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#713f12' }}>
              This report, including all geospatial representations, statistical counts, scores, and classifications, is generated using synthetic prototype data. 
              The findings and recommendations presented herein do not represent official government statistics or actionable risk management guidelines. 
              This document is produced strictly for the purpose of demonstrating software capabilities.
            </p>
          </div>
        </section>
      </div>

        {/* Page footer (spec Screen 4) */}
        <div className="rpt-pagefoot">
          <span>Page {activeChapter} of {chapters.length}</span>
          <span>NDMA HVRA Platform — Auto-generated Report</span>
        </div>

      </div>
      </div>
    </div>
  );
}
