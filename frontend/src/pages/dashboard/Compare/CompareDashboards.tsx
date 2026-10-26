/**
 * Compare Dashboards Page (HVRA §3.4 / Section 6)
 * Side-by-side comparison of 2 or more districts with drill-down to classification maps.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDistricts, getAssessments } from '@/services/api';
import type { AdministrativeUnit, Assessment } from '@/types';
import './CompareDashboards.css';

export default function CompareDashboards() {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [selectedDistrict1, setSelectedDistrict1] = useState<number>(0);
  const [selectedDistrict2, setSelectedDistrict2] = useState<number>(0);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [dList, aList] = await Promise.all([
          getDistricts(),
          getAssessments(),
        ]);
        setDistricts(dList);
        setAssessments(aList.results || []);

        if (dList.length >= 2) {
          const tvm = dList.find((d) => d.name.toLowerCase().includes('thiruvananthapuram')) || dList[0];
          const other = dList.find((d) => d.id !== tvm.id) || dList[1];
          setSelectedDistrict1(tvm.id);
          setSelectedDistrict2(other.id);
        }
      } catch (err) {
        console.warn('Could not load comparison data', err);
      }
    }
    loadData();
  }, []);

  const d1 = districts.find((d) => d.id === selectedDistrict1);
  const d2 = districts.find((d) => d.id === selectedDistrict2);

  const getDistrictAssessments = (districtId: number) => {
    return assessments.filter((a) => a.district === districtId);
  };

  const d1Assessments = d1 ? getDistrictAssessments(d1.id) : [];
  const d2Assessments = d2 ? getDistrictAssessments(d2.id) : [];

  const handleDrill = (districtId: number) => {
    const matched = assessments.find((a) => a.district === districtId);
    if (matched) {
      navigate(`/assessments/${matched.id}/results?tab=classification`);
    } else {
      navigate(`/new-assessment?district=${districtId}`);
    }
  };

  return (
    <div className="compare-container">
      {/* Header */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              <Link to="/dashboard">Dashboard</Link> / <span>Cross-District Comparison</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
              ⚖️ Cross-District Comparative Assessment
            </h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Benchmark hazard exposure, vulnerability indices, and high-risk administrative units side-by-side.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/new-assessment?module=HAZARD" className="btn btn-primary btn-sm">
              + Run New Assessment
            </Link>
          </div>
        </div>

        {/* District Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
              Primary District (Benchmark A)
            </label>
            <select
              className="form-control"
              value={selectedDistrict1}
              onChange={(e) => setSelectedDistrict1(parseInt(e.target.value, 10))}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name} District</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
              Comparison District (Benchmark B)
            </label>
            <select
              className="form-control"
              value={selectedDistrict2}
              onChange={(e) => setSelectedDistrict2(parseInt(e.target.value, 10))}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name} District</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Side by Side Comparison Grid */}
      <div className="compare-grid">
        {/* Column 1 */}
        <div className="compare-column card">
          <div className="compare-column-header">
            <h2 className="compare-column-title">{d1?.name || 'District 1'}</h2>
            <button className="btn btn-primary btn-sm" onClick={() => d1 && handleDrill(d1.id)}>
              Drill into Classification →
            </button>
          </div>

          <div className="compare-metrics-list">
            <div className="compare-metric-row">
              <span className="compare-metric-label">Completed Assessments</span>
              <span className="compare-metric-value">{d1Assessments.length}</span>
            </div>
            <div className="compare-metric-row">
              <span className="compare-metric-label">Primary Hazard Coverage</span>
              <span className="compare-metric-value">Monsoon Flood & Waterlogging</span>
            </div>
            <div className="compare-metric-row">
              <span className="compare-metric-label">Administrative Resolution</span>
              <span className="compare-metric-value">Blocks (11 Units)</span>
            </div>
            <div className="compare-metric-row">
              <span className="compare-metric-label">Highest Observed Risk Band</span>
              <span className="badge badge-error">HH (High Hazard)</span>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>Assessments in this District</h4>
            {d1Assessments.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No assessments generated yet.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.84rem', color: '#334155' }}>
                {d1Assessments.map((a) => (
                  <li key={a.id} style={{ marginBottom: '0.35rem' }}>
                    <Link to={`/assessments/${a.id}/results?tab=classification`} style={{ color: '#dc2626', fontWeight: 600 }}>
                      {a.name}
                    </Link>{' '}
                    ({a.module_type})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div className="compare-column card">
          <div className="compare-column-header">
            <h2 className="compare-column-title">{d2?.name || 'District 2'}</h2>
            <button className="btn btn-primary btn-sm" onClick={() => d2 && handleDrill(d2.id)}>
              Drill into Classification →
            </button>
          </div>

          <div className="compare-metrics-list">
            <div className="compare-metric-row">
              <span className="compare-metric-label">Completed Assessments</span>
              <span className="compare-metric-value">{d2Assessments.length}</span>
            </div>
            <div className="compare-metric-row">
              <span className="compare-metric-label">Primary Hazard Coverage</span>
              <span className="compare-metric-value">Flood, Coastal & Drainage</span>
            </div>
            <div className="compare-metric-row">
              <span className="compare-metric-label">Administrative Resolution</span>
              <span className="compare-metric-value">Blocks & Panchayats</span>
            </div>
            <div className="compare-metric-row">
              <span className="compare-metric-label">Highest Observed Risk Band</span>
              <span className="badge badge-warning">MH (Moderate Hazard)</span>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>Assessments in this District</h4>
            {d2Assessments.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                No assessments generated yet.{' '}
                <Link to={`/new-assessment?district=${d2?.id}`} style={{ color: '#dc2626' }}>
                  Run assessment now →
                </Link>
              </div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.84rem', color: '#334155' }}>
                {d2Assessments.map((a) => (
                  <li key={a.id} style={{ marginBottom: '0.35rem' }}>
                    <Link to={`/assessments/${a.id}/results?tab=classification`} style={{ color: '#dc2626', fontWeight: 600 }}>
                      {a.name}
                    </Link>{' '}
                    ({a.module_type})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
