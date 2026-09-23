import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAssessmentReport } from '../../services/api';

export default function ReportView() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getAssessmentReport(parseInt(id, 10));
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
        <span>Generating Report...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="alert alert-error" style={{ margin: '2rem' }}>
        <span>⚠️</span>
        <div>{error || 'Report not found.'}</div>
        <Link to={`/assessments/${id}/results`} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Results</Link>
      </div>
    );
  }

  const { metadata, methodology, historical_profile, classification_summary, findings, recommendations, block_results } = report;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', padding: '3rem 4rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
      
      {/* Report Header */}
      <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Final Assessment Report
            </div>
            <h1 style={{ margin: '0.5rem 0', fontSize: '2.2rem', color: '#0f172a' }}>{metadata.name}</h1>
            <div style={{ fontSize: '1.1rem', color: '#475569' }}>
              {metadata.state} → {metadata.district} → {metadata.level} Level
            </div>
          </div>
          {metadata.is_demo && (
            <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
              ⚠️ DEMO DATA
            </div>
          )}
        </div>
        <div style={{ marginTop: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
          <strong>Generated on:</strong> {new Date(metadata.created_at).toLocaleString()} | <strong>Hazard:</strong> {metadata.hazard_type} | <strong>Status:</strong> {metadata.status}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', fontSize: '1.05rem', lineHeight: '1.6', color: '#334155' }}>
        
        {/* 1. Introduction & Objectives */}
        <section>
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Introduction & Objectives</h2>
          <p>
            The purpose of this assessment is to evaluate and classify the spatial distribution of <strong>{metadata.hazard_type}</strong> hazard across the targeted administrative units. 
            The objective is to establish a deterministic, indicator-based hazard score for each administrative block to guide localized disaster risk reduction planning.
          </p>
        </section>

        {/* 2. Study Area */}
        <section>
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. Study Area</h2>
          <p>
            The assessment covers the <strong>{metadata.district}</strong> district in the state of <strong>{metadata.state}</strong>. 
            The analysis was conducted at the <strong>{metadata.level}</strong> administrative level, encompassing a total of <strong>{block_results.length}</strong> blocks.
          </p>
        </section>

        {/* 3. Data & Methodology */}
        <section>
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Data & Methodology</h2>
          <p>
            The hazard assessment utilizes a composite scoring methodology. Raw spatial metrics (such as flood-prone area percentages and historical event frequencies) are extracted via GIS processing. These metrics are normalized and weighted to produce a final composite score on a 0–10 scale.
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
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>4. Historical Hazard Profile</h2>
          <p>
            An analysis of the historical event catalogue recorded a total of <strong>{historical_profile.total_events}</strong> distinct {metadata.hazard_type.toLowerCase()} events across the assessed blocks. These events form the basis for the frequency indicator calculations.
          </p>
        </section>

        {/* 5. Climate Context */}
        <section>
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>5. Climate Context</h2>
          <div style={{ padding: '1rem', background: '#f1f5f9', color: '#64748b', fontStyle: 'italic', borderRadius: '4px' }}>
            Climate context data (e.g., precipitation trends, extreme weather projections) is not included in this prototype phase.
          </div>
        </section>

        {/* 6. Hazard Classification */}
        <section>
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
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>{r.flood_prone_percentage.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem' }}>{r.event_count}</td>
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
          <h2 style={{ color: '#1e293b', fontSize: '1.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>10. Recommendations (Prototype)</h2>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {recommendations.map((rec: string, idx: number) => (
              <li key={idx} style={{ marginBottom: '0.5rem' }}>{rec}</li>
            ))}
          </ul>
        </section>

        {/* 11. Annexures */}
        <section>
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
    </div>
  );
}
