import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  getRiskAssessment,
  getRiskAssessmentResults,
  downloadRiskReportDocx,
  downloadRiskReportPdf,
} from '../../services/api';
import type { RiskAssessment, RiskResultsResponse, ApprovalStatus } from '../../types';
import ResultsMap from '../../components/Map/ResultsMap';
import ApprovalPanel from '../../components/ApprovalPanel/ApprovalPanel';

const RISK_COLORS: Record<string, string> = {
  VERY_HIGH: '#7f1d1d',
  HIGH: '#ef4444',
  MODERATE: '#f59e0b',
  LOW: '#22c55e',
};

const RISK_LABELS: Record<string, string> = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
};

const CLASS_ORDER = ['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW'] as const;

export default function RiskResults() {
  const { id } = useParams();
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [resultsData, setResultsData] = useState<RiskResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'docx' | 'pdf' | null>(null);

  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(true);

  // Task Force review status (HVRA §8.2)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);

  useEffect(() => {
    if (risk) setApprovalStatus(risk.approval_status || 'PENDING');
  }, [risk]);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const riskId = parseInt(id, 10);
        const [details, res] = await Promise.all([
          getRiskAssessment(riskId),
          getRiskAssessmentResults(riskId),
        ]);
        setRisk(details);
        setResultsData(res);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load risk assessment results.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleDownload = async (format: 'docx' | 'pdf') => {
    if (!risk) return;
    try {
      setDownloading(format);
      const safeName = risk.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (format === 'docx') await downloadRiskReportDocx(risk.id, `${safeName}.docx`);
      else await downloadRiskReportPdf(risk.id, `${safeName}.pdf`);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading risk dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>⚠️</span>
        <div>{error}</div>
      </div>
    );
  }

  if (!risk || !resultsData) {
    return <div>No data found.</div>;
  }

  const chartData = CLASS_ORDER.map(cls => ({
    name: cls,
    count: resultsData.classification_summary?.[cls] || 0,
    color: resultsData.risk_class_colors?.[cls] || RISK_COLORS[cls],
    label: resultsData.risk_class_labels?.[cls] || RISK_LABELS[cls],
  }));

  const isMultiplicative = resultsData.formula === 'MULTIPLICATIVE';
  const weights = resultsData.weights || {};

  const rows = [...resultsData.results].sort((a, b) =>
    sortDesc
      ? (b.risk_score ?? -1) - (a.risk_score ?? -1)
      : (a.risk_score ?? -1) - (b.risk_score ?? -1)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header Info */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              Risk Dashboard: {risk.name}
              <span className={`badge ${risk.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                {risk.status}
              </span>
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              <strong>{risk.state_name || 'Kerala'}</strong> / <strong>{risk.district_name || 'District'}</strong> /
              <strong> {risk.administrative_level}</strong> / <strong>Risk = H × V × E</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
              Formula: <strong>{isMultiplicative ? 'Multiplicative' : 'Weighted Sum'}</strong> · Weights: H={weights.hazard} · V={weights.vulnerability} · E={weights.exposure}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="badge badge-warning" style={{ fontSize: '0.85rem' }}>⚠️ DEMO DATA</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }} disabled={downloading !== null} onClick={() => handleDownload('docx')}>
              {downloading === 'docx' ? 'Generating...' : '⬇️ DOCX'}
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }} disabled={downloading !== null} onClick={() => handleDownload('pdf')}>
              {downloading === 'pdf' ? 'Generating...' : '⬇️ PDF'}
            </button>
            <Link to={`/risk-assessments/${risk.id}/report`} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
              📄 View Report
            </Link>
          </div>
        </div>

        <div className="card-body">
          {/* Summary KPIs */}
          <div className="grid-5" style={{ gap: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>Total Units</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>{resultsData.total_units}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
              <div style={{ color: '#7f1d1d', fontSize: '0.8rem', fontWeight: 600 }}>Very High Risk</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#7f1d1d' }}>{chartData[0].count}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
              <div style={{ color: '#991b1b', fontSize: '0.8rem', fontWeight: 600 }}>High Risk</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444' }}>{chartData[1].count}</div>
            </div>
            <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '8px', border: '1px solid #fef08a', textAlign: 'center' }}>
              <div style={{ color: '#854d0e', fontSize: '0.8rem', fontWeight: 600 }}>Moderate Risk</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b' }}>{chartData[2].count}</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <div style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 600 }}>Low Risk</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#22c55e' }}>{chartData[3].count}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Minimum Risk Score:</span>
              <strong style={{ fontSize: '1.1rem' }}>{resultsData.min_score?.toFixed(2) || 0}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Average Risk Score:</span>
              <strong style={{ fontSize: '1.1rem' }}>{resultsData.average_score?.toFixed(2) || 0}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Highest Risk Score:</span>
              <strong style={{ fontSize: '1.1rem' }}>{resultsData.max_score?.toFixed(2) || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Task Force review workflow */}
      {approvalStatus && (
        <ApprovalPanel
          kind="risk"
          id={risk.id}
          status={approvalStatus}
          isCompleted={risk.status === 'COMPLETED'}
          onStatusChanged={(s) => setApprovalStatus(s)}
        />
      )}

      {/* Main Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: '600px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3 className="card-title">Composite Risk Map</h3>
            </div>
            <div className="card-body" style={{ padding: 0, flexGrow: 1 }}>
              <ResultsMap
                key={`risk-map-${risk.id}`}
                assessmentId={risk.id}
                variant="risk"
                selectedBlockId={selectedBlockId}
                onBlockSelect={setSelectedBlockId}
                resultsData={resultsData.results}
                colorMap={resultsData.risk_class_colors}
                classificationLabels={resultsData.risk_class_labels}
                legendTitle="Risk Classification"
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Risk Classification Summary</h3>
            </div>
            <div className="card-body" style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="label" type="category" width={100} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Risk Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Unit-Level Risk Results</h3>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              onClick={() => setSortDesc(d => !d)}
            >
              {sortDesc ? 'Score ↓' : 'Score ↑'}
            </button>
          </div>
          <div className="card-body" style={{ height: '100%', overflow: 'auto', padding: 0 }}>
            <table className="results-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#fff' }}>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Block Unit</th>
                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>H</th>
                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>V</th>
                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>E</th>
                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>Risk</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Class</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isSelected = selectedBlockId === r.administrative_unit;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedBlockId(r.administrative_unit)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : undefined,
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>{r.unit_name}</td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>{r.hazard_score?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>{r.vulnerability_score?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>{r.exposure_score?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', fontWeight: 700 }}>{r.risk_score?.toFixed(2)}</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                        <span className="badge" style={{ fontSize: '0.65rem', background: `${RISK_COLORS[r.risk_class]}22`, color: RISK_COLORS[r.risk_class], fontWeight: 700, border: `1px solid ${RISK_COLORS[r.risk_class]}55` }}>
                          {RISK_LABELS[r.risk_class] || r.risk_class}
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

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
        <Link to="/reports" className="btn btn-secondary">← Back to Reports</Link>
      </div>
    </div>
  );
}