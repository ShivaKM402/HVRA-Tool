import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRiskAssessmentReport, downloadRiskReportDocx, downloadRiskReportPdf } from '../../services/api';

const RISK_COLORS: Record<string, string> = {
  VERY_HIGH: '#7f1d1d',
  HIGH: '#ef4444',
  MODERATE: '#f59e0b',
  LOW: '#22c55e',
};

const CLASS_ORDER = ['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW'] as const;

export default function RiskReportView() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getRiskAssessmentReport(parseInt(id, 10));
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load report.');
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Generating Risk Report...</span>
      </div>
    );
  }

  if (error || !report || !report.metadata) {
    return (
      <div className="alert alert-error" style={{ margin: '2rem' }}>
        <span>⚠️</span>
        <div>{error || report?.message || 'Risk report not found or assessment is not yet completed.'}</div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <Link to={`/risk-assessments/${id}/results`} className="btn btn-secondary">Back to Results</Link>
          <Link to="/reports" className="btn btn-secondary">All Reports</Link>
        </div>
      </div>
    );
  }

  const { metadata, classification_summary, risk_class_labels, climate_context, findings, recommendations, block_results } = report;
  const weights = metadata?.weights || {};
  const inputs = metadata?.inputs || {};
  const isMultiplicative = metadata?.formula !== 'ADDITIVE';

  const handleDownloadDocx = async () => {
    try {
      setDownloadingFormat('docx');
      const filename = (metadata?.name || 'Risk_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadRiskReportDocx(parseInt(id!, 10), `${filename}.docx`);
    } catch (err: any) {
      alert('Failed to download Word document: ' + err.message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingFormat('pdf');
      const filename = (metadata?.name || 'Risk_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadRiskReportPdf(parseInt(id!, 10), `${filename}.pdf`);
    } catch (err: any) {
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem' }}>

      {/* Top Action Bar (hidden on print) */}
      <div className="report-action-bar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
        background: '#f8fafc', padding: '1rem 1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={`/risk-assessments/${id}/results`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            ← Back to Risk Results
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
            onClick={() => window.print()}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Report Document */}
      <div className="report-document card" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: '#0f172a', color: '#fff', padding: '2rem 2.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>
            HAZARD, VULNERABILITY & RISK ASSESSMENT TOOL (HVRA)
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.5rem 0 0.25rem' }}>
            {metadata?.name || 'Composite Risk Assessment Report'}
          </h1>
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>
            Composite Risk (Module 4) · {isMultiplicative ? 'Risk = H × V × E' : 'Weighted Sum'}
          </div>
        </div>

        {/* Metadata */}
        <div className="report-meta" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '1.25rem 2.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem', color: '#334155' }}>
            <div><strong style={{ color: '#475569' }}>State:</strong> {metadata?.state || 'Kerala'}</div>
            <div><strong style={{ color: '#475569' }}>District:</strong> {metadata?.district || 'District'}</div>
            <div><strong style={{ color: '#475569' }}>Level:</strong> {metadata?.level || 'BLOCK'}</div>
            <div><strong style={{ color: '#475569' }}>Status:</strong> {metadata?.status || 'COMPLETED'}</div>
            <div><strong style={{ color: '#475569' }}>Formula:</strong> {isMultiplicative ? 'Multiplicative (R = H^wH × V^wV × E^wE)^(1/Σw)' : 'Weighted Sum'}</div>
            <div><strong style={{ color: '#475569' }}>Weights:</strong> H={weights.hazard} · V={weights.vulnerability} · E={weights.exposure}</div>
          </div>
        </div>

        <div style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* 1. Executive summary */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              1. Executive Summary
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7, margin: 0 }}>
              This report presents the composite risk profile for <strong>{metadata?.district}</strong> district,{' '}
              <strong>{metadata?.state}</strong>, combining Hazard (H), Vulnerability (V) and Exposure (E) module scores
              into a single risk score on a 0–10 scale using the{' '}
              <strong>{isMultiplicative ? 'weighted multiplicative' : 'weighted additive'}</strong> model.{' '}
              {block_results?.length || 0} administrative blocks were evaluated and classified into four risk tiers
              (Very High / High / Moderate / Low).
            </p>
          </section>

          {/* 2. Input modules */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              2. Input Module Assessments
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.88rem' }}>
              <div>🌊 <strong>Hazard (H):</strong> {inputs.hazard_assessment || 'Not provided — component skipped'}</div>
              <div>👥 <strong>Vulnerability (V):</strong> {inputs.vulnerability_assessment || 'Not provided — component skipped'}</div>
              <div>🏗️ <strong>Exposure (E):</strong> {inputs.exposure_assessment || 'Not provided — component skipped'}</div>
            </div>
          </section>

          {/* 3. Climate Context (HVRA §4.9) */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              3. Climate Context
            </h2>
            {(climate_context || []).length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                Climate context data (e.g., precipitation trends, extreme weather projections) is not available for this scenario.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(climate_context || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderLeft: '4px solid #0ea5e9', borderRadius: '6px', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>{c.title}</h4>
                      {c.is_demo && <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>DEMO</span>}
                    </div>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#334155', lineHeight: 1.55 }}>{c.statement}</p>
                    {(c.source || c.vintage) && (
                      <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#64748b' }}>
                        {c.source && <span><strong>Source:</strong> {c.source}</span>}
                        {c.vintage && <span style={{ marginLeft: '0.75rem' }}><strong>Vintage:</strong> {c.vintage}</span>}
                        {c.source_url && (
                          <span style={{ marginLeft: '0.75rem' }}>
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

          {/* 4. Classification summary */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              4. Risk Classification Summary
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {CLASS_ORDER.map(cls => (
                <div key={cls} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: RISK_COLORS[cls] }}>
                    {classification_summary?.[cls] || 0}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                    {risk_class_labels?.[cls] || cls.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Block results */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              5. Unit-Level Risk Results
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#fff' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Block Unit</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Hazard</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Vulnerability</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Exposure</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Risk (0-10)</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {(block_results || []).map((b: any, idx: number) => (
                    <tr key={idx} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>{b.unit_name}</td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right' }}>{b.hazard_score !== null && b.hazard_score !== undefined ? b.hazard_score.toFixed(2) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right' }}>{b.vulnerability_score !== null && b.vulnerability_score !== undefined ? b.vulnerability_score.toFixed(2) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right' }}>{b.exposure_score !== null && b.exposure_score !== undefined ? b.exposure_score.toFixed(2) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{b.risk_score?.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        <span className="badge" style={{ fontSize: '0.65rem', background: `${RISK_COLORS[b.risk_class]}22`, color: RISK_COLORS[b.risk_class], fontWeight: 700 }}>
                          {(risk_class_labels?.[b.risk_class] || b.risk_class).toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Findings */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              6. Priority Findings
            </h2>
            <ul style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7, margin: 0, paddingLeft: '1.25rem' }}>
              <li>
                <strong>Very High Risk Units:</strong>{' '}
                {findings?.very_high_units?.length
                  ? `${findings.very_high_units.length} block(s) — ${findings.very_high_units.join(', ')}`
                  : 'None identified in this scenario.'}
              </li>
              {findings?.top_units?.map((t: any, idx: number) => (
                <li key={idx}>
                  <strong>Top ranked unit #{idx + 1}:</strong> {t.unit_name} (risk {t.risk_score?.toFixed(2)})
                </li>
              ))}
            </ul>
          </section>

          {/* 7. Recommendations */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              7. Strategic Recommendations & Priority Actions
            </h2>
            <ul style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7, margin: 0, paddingLeft: '1.25rem' }}>
              {(recommendations || []).map((rec: string, idx: number) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </section>

          {/* 8. Disclaimer */}
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
              8. Annexures & Data Provenance Notice
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
              Disclaimer: This report was compiled automatically by the HVRA prototype platform. All scores and classes
              are computed for decision support. Hazard, Vulnerability and Exposure inputs are based on prototype DEMO
              DATA and should be replaced with validated survey data before official use.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}