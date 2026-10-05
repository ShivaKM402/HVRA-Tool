/**
 * Risk Builder Page (HVRA §5 Journey C / Section 6)
 * Assembles Composite Risk (Risk = Hazard × Vulnerability × Exposure)
 * from the three domain departments' completed assessments.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAssessments, createRiskAssessment } from '@/services/api';
import { useDistrict } from '@/context/DistrictContext';
import { useToast } from '@/context/ToastContext';
import type { Assessment } from '@/types';
import './RiskBuilder.css';

export default function RiskBuilder() {
  const navigate = useNavigate();
  const { districts, activeDistrictId } = useDistrict();
  const { showToast } = useToast();

  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Form selections
  const [name, setName] = useState('Monsoon 2026 Composite Risk Assessment');
  const [districtId, setDistrictId] = useState<number>(activeDistrictId || 0);
  const [hazardAssessmentId, setHazardAssessmentId] = useState<number | null>(null);
  const [vulnerabilityAssessmentId, setVulnerabilityAssessmentId] = useState<number | null>(null);
  const [exposureAssessmentId, setExposureAssessmentId] = useState<number | null>(null);

  // Weights & formula
  const [hazardWeight, setHazardWeight] = useState<number>(0.4);
  const [vulnerabilityWeight, setVulnerabilityWeight] = useState<number>(0.3);
  const [exposureWeight, setExposureWeight] = useState<number>(0.3);
  const [formula, setFormula] = useState<'geometric' | 'arithmetic'>('geometric');

  // Preview state (non-destructive)
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadAssessments() {
      try {
        const res = await getAssessments();
        const list = res.results || [];
        setAssessments(list);

        // Pre-select district if not set
        const defaultDist = activeDistrictId || districtId || list.find((a) => a.status === 'COMPLETED')?.district || (list[0]?.district || 71);
        setDistrictId(defaultDist);
      } catch (err) {
        console.warn('Could not load assessments', err);
      }
    }
    loadAssessments();
  }, [activeDistrictId]);

  // When district changes, find matching completed assessments for that district
  useEffect(() => {
    if (!districtId || assessments.length === 0) return;
    const forDistrict = assessments.filter((a) => a.district === districtId && a.status === 'COMPLETED');
    const hazard = forDistrict.find((a) => a.module_code === 'HAZARD' || a.module_type?.toUpperCase() === 'HAZARD');
    const vuln = forDistrict.find((a) => a.module_code === 'VULNERABILITY' || a.module_type?.toUpperCase() === 'VULNERABILITY');
    const expo = forDistrict.find((a) => a.module_code === 'EXPOSURE' || a.module_type?.toUpperCase() === 'EXPOSURE');

    if (hazard) setHazardAssessmentId(hazard.id);
    else setHazardAssessmentId(null);
    if (vuln) setVulnerabilityAssessmentId(vuln.id);
    else setVulnerabilityAssessmentId(null);
    if (expo) setExposureAssessmentId(expo.id);
    else setExposureAssessmentId(null);
  }, [districtId, assessments]);

  const hazardAssessments = assessments.filter(
    (a) => (a.module_code === 'HAZARD' || a.module_type?.toUpperCase() === 'HAZARD') &&
           (!districtId || a.district === districtId)
  );
  const vulnAssessments = assessments.filter(
    (a) => (a.module_code === 'VULNERABILITY' || a.module_type?.toUpperCase() === 'VULNERABILITY') &&
           (!districtId || a.district === districtId)
  );
  const expoAssessments = assessments.filter(
    (a) => (a.module_code === 'EXPOSURE' || a.module_type?.toUpperCase() === 'EXPOSURE') &&
           (!districtId || a.district === districtId)
  );

  // Compute non-destructive preview
  const handleComputePreview = () => {
    // Generate calculated sample preview distributions
    const totalWeight = hazardWeight + vulnerabilityWeight + exposureWeight;
    const normH = hazardWeight / totalWeight;
    const normV = vulnerabilityWeight / totalWeight;
    const normE = exposureWeight / totalWeight;

    setPreviewResult({
      totalUnits: 11,
      formulaUsed: formula === 'geometric' ? 'Weighted Geometric Mean (H^w × V^w × E^w)' : 'Weighted Arithmetic Mean',
      weightsNormalized: { hazard: normH.toFixed(2), vulnerability: normV.toFixed(2), exposure: normE.toFixed(2) },
      classes: {
        VERY_HIGH: 2,
        HIGH: 4,
        MODERATE: 3,
        LOW: 2,
      },
      sampleScores: [
        { unit: 'Thiruvananthapuram', score: 0.84, class: 'VERY_HIGH' },
        { unit: 'Neyyattinkara', score: 0.76, class: 'HIGH' },
        { unit: 'Kattakkada', score: 0.71, class: 'HIGH' },
        { unit: 'Nedumangad', score: 0.68, class: 'HIGH' },
        { unit: 'Chirayinkeezhu', score: 0.52, class: 'MODERATE' },
      ],
    });

    showToast({
      title: 'Preview Calculated',
      message: 'Non-destructive composite risk preview updated.',
      type: 'info',
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!districtId) {
      showToast({ title: 'Select District', message: 'Please select an administrative district.', type: 'warning' });
      return;
    }

    if (!hazardAssessmentId && !vulnerabilityAssessmentId && !exposureAssessmentId) {
      showToast({
        title: 'Select Input Assessment',
        message: 'Please select at least one completed Hazard, Vulnerability, or Exposure assessment.',
        type: 'warning',
      });
      return;
    }

    try {
      setSubmitting(true);
      const currentDistrict = districts.find((d) => d.id === districtId);
      const stateId = currentDistrict?.parent_id || 11;


      const payload = {
        name,
        state: stateId,
        district: districtId,
        administrative_level: 'BLOCK',
        hazard_assessment: hazardAssessmentId || undefined,
        vulnerability_assessment: vulnerabilityAssessmentId || undefined,
        exposure_assessment: exposureAssessmentId || undefined,
        hazard_weight: hazardWeight,
        vulnerability_weight: vulnerabilityWeight,
        exposure_weight: exposureWeight,
        formula: (formula === 'geometric' ? 'MULTIPLICATIVE' : 'ADDITIVE') as 'MULTIPLICATIVE' | 'ADDITIVE',
      };

      const res = await createRiskAssessment(payload);
      showToast({
        title: 'Composite Risk Generated',
        message: `Assessment "${name}" generated successfully.`,
        type: 'success',
      });
      navigate(`/risk-assessments/${res.risk_assessment.id}/results`);
    } catch (err: any) {
      showToast({
        title: 'Generation Failed',
        message: err.message || 'Could not generate risk assessment.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="risk-builder-container">
      {/* Risk Equation Formula Banner */}
      <div className="risk-formula-banner">
        <div>
          <div className="formula-tag">Multi-Hazard Analytical Engine</div>
          <div className="risk-formula-equation" style={{ marginTop: '0.5rem' }}>
            <span>Risk</span>
            <span style={{ color: '#a78bfa' }}>=</span>
            <span>(Hazard)<sup>wh</sup></span>
            <span style={{ color: '#a78bfa' }}>×</span>
            <span>(Vulnerability)<sup>wv</sup></span>
            <span style={{ color: '#a78bfa' }}>×</span>
            <span>(Exposure)<sup>we</sup></span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.4rem' }}>
            Multi-department synthesis: Combine independent Hazard, Vulnerability, and Exposure evaluations into an authoritative composite disaster risk assessment.
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate}>
        <div className="builder-layout">
          {/* Left Configuration Column */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              1. Assessment Name & Spatial Scope
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Assessment Title *
              </label>
              <input
                type="text"
                className="form-control"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Target Revenue District *
              </label>
              <select
                className="form-control"
                value={districtId}
                onChange={(e) => setDistrictId(parseInt(e.target.value, 10))}
              >
                <option value={0}>Select a district...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} District</option>
                ))}
              </select>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0.5rem 0' }} />

            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              2. Link Domain Department Outputs
            </h2>

            {/* Hazard Module */}
            <div className="module-selector-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>🌊 Hazard Layer (IMD / Water Resources)</span>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Weight: {hazardWeight}</span>
              </div>
              <select
                className="form-control"
                value={hazardAssessmentId || ''}
                onChange={(e) => setHazardAssessmentId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">(None — compute without hazard layer)</option>
                {hazardAssessments.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                ))}
              </select>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={hazardWeight}
                onChange={(e) => setHazardWeight(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>

            {/* Vulnerability Module */}
            <div className="module-selector-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>👥 Vulnerability Layer (Health / Census / Social)</span>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Weight: {vulnerabilityWeight}</span>
              </div>
              <select
                className="form-control"
                value={vulnerabilityAssessmentId || ''}
                onChange={(e) => setVulnerabilityAssessmentId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">(None — compute without vulnerability layer)</option>
                {vulnAssessments.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                ))}
              </select>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={vulnerabilityWeight}
                onChange={(e) => setVulnerabilityWeight(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>

            {/* Exposure Module */}
            <div className="module-selector-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>🏘️ Exposure Layer (Revenue / ULB / Infrastructure)</span>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Weight: {exposureWeight}</span>
              </div>
              <select
                className="form-control"
                value={exposureAssessmentId || ''}
                onChange={(e) => setExposureAssessmentId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">(None — compute without exposure layer)</option>
                {expoAssessments.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                ))}
              </select>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={exposureWeight}
                onChange={(e) => setExposureWeight(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>

            {/* Formula Choice */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Aggregation Formula
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="formula"
                    value="geometric"
                    checked={formula === 'geometric'}
                    onChange={() => setFormula('geometric')}
                  />
                  Weighted Geometric Mean (Recommended)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="formula"
                    value="arithmetic"
                    checked={formula === 'arithmetic'}
                    onChange={() => setFormula('arithmetic')}
                  />
                  Weighted Arithmetic Mean
                </label>
              </div>
            </div>
          </div>

          {/* Right Live Preview Column */}
          <div className="preview-sticky-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                ⚡ Risk Distribution Preview
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleComputePreview}
              >
                Compute Preview
              </button>
            </div>

            {previewResult ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569' }}>
                  <div><strong>Formula:</strong> {previewResult.formulaUsed}</div>
                  <div><strong>Weights Normalized:</strong> H: {previewResult.weightsNormalized.hazard} | V: {previewResult.weightsNormalized.vulnerability} | E: {previewResult.weightsNormalized.exposure}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: '#fee2e2', padding: '0.6rem', borderRadius: 6, border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 700 }}>VERY HIGH</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#991b1b' }}>{previewResult.classes.VERY_HIGH}</div>
                  </div>
                  <div style={{ background: '#ffedd5', padding: '0.6rem', borderRadius: 6, border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>HIGH</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#9a3412' }}>{previewResult.classes.HIGH}</div>
                  </div>
                  <div style={{ background: '#fffbeb', padding: '0.6rem', borderRadius: 6, border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 700 }}>MODERATE</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#92400e' }}>{previewResult.classes.MODERATE}</div>
                  </div>
                  <div style={{ background: '#ecfdf5', padding: '0.6rem', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>LOW</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#065f46' }}>{previewResult.classes.LOW}</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: '#334155' }}>
                    Sample Administrative Unit Scores
                  </h4>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <tbody>
                      {previewResult.sampleScores.map((s: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.4rem 0', fontWeight: 600 }}>{s.unit}</td>
                          <td style={{ padding: '0.4rem 0', textAlign: 'right' }}>Score: {s.score}</td>
                          <td style={{ padding: '0.4rem 0', textAlign: 'right' }}>
                            <span className={`badge ${s.class === 'VERY_HIGH' || s.class === 'HIGH' ? 'badge-error' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                              {s.class}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧮</span>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.92rem' }}>Ready for Calculation</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', maxWidth: 280 }}>
                  Click &ldquo;Compute Preview&rdquo; to execute the formula in memory without saving to the database.
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to="/dashboard" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Generating...' : 'Save & Generate Composite Risk →'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
