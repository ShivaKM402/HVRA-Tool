import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getHazards,
  getStates,
  getDistricts,
  getBlocks,
  getIndicators,
  getDataSources,
  getAssessments,
  createAssessment,
  createRiskAssessment,
  processAssessment,
  previewAssessment,
  uploadDataset,
  createSavedQuery,
} from '../../services/api';
import type { AssessmentPreview } from '../../services/api';
import type {
  HazardType,
  AdministrativeUnit,
  HazardIndicator,
  DataSource,
  Assessment
} from '../../types';
import KeralaMap from '../../components/Map/KeralaMap';
import AddDistrictModal from './AddDistrictModal';
import QueryBuilder, { type QueryModule } from './QueryBuilder';
import './NewAssessment.css';

const STEPS = [
  'Hazard & Module',
  'Area',
  'Indicators',
  'Weightage',
  'Data Sources',
  'Review'
];

const RISK_STEPS = [
  'Module & Scope',
  'Area',
  'Risk Components & Weights',
  'Review'
];


export default function NewAssessment() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const territoryRestricted =
    user?.profile?.role_code === 'STATE_OFFICIAL' ||
    user?.profile?.role_code === 'DISTRICT_OFFICIAL';

  // Sidebar module links (/new-assessment?module=VULNERABILITY etc.)
  const moduleParam = (searchParams.get('module') || 'HAZARD').toUpperCase();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');

  // Assessment Module (HVRA Framework)
  const [assessmentModule, setAssessmentModule] = useState<'HAZARD' | 'VULNERABILITY' | 'EXPOSURE' | 'COMPOSITE_RISK'>('HAZARD');

  useEffect(() => {
    const valid = ['HAZARD', 'VULNERABILITY', 'EXPOSURE', 'COMPOSITE_RISK'];
    if (valid.includes(moduleParam) && moduleParam !== assessmentModule) {
      setAssessmentModule(moduleParam as typeof assessmentModule);
      setCurrentStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleParam]);

  // Administrative granularity — BLOCK (taluka) or VILLAGE (demo villages auto-seeded per block).
  const [administrativeLevel, setAdministrativeLevel] = useState<'BLOCK' | 'VILLAGE'>('BLOCK');

  // Save-query UI (HVRA §3.3)
  const [queryName, setQueryName] = useState('');
  const [saveQueryMessage, setSaveQueryMessage] = useState<string | null>(null);
  const [savingQuery, setSavingQuery] = useState(false);

  // Custom Dataset Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Data loaded from API
  const [hazards, setHazards] = useState<HazardType[]>([]);
  const [states, setStates] = useState<AdministrativeUnit[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [, setBlocks] = useState<AdministrativeUnit[]>([]);
  const [indicators, setIndicators] = useState<HazardIndicator[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // User selections
  const [selectedHazardCode, setSelectedHazardCode] = useState<string>('');
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  
  // Indicators selection { id: weight }
  const [indicatorWeights, setIndicatorWeights] = useState<Record<number, number>>({});
  const [enabledIndicators, setEnabledIndicators] = useState<Set<number>>(new Set());
  
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<number | null>(null);

  // Module 4 (Composite Risk) state
  const [moduleAssessments, setModuleAssessments] = useState<Record<string, Assessment[]>>({});
  const [riskHazardId, setRiskHazardId] = useState<number | ''>('');
  const [riskVulnerabilityId, setRiskVulnerabilityId] = useState<number | ''>('');
  const [riskExposureId, setRiskExposureId] = useState<number | ''>('');
  const [riskWeights, setRiskWeights] = useState<{ hazard: number; vulnerability: number; exposure: number }>({
    hazard: 1.0,
    vulnerability: 1.0,
    exposure: 1.0,
  });
  const [riskFormula, setRiskFormula] = useState<'MULTIPLICATIVE' | 'ADDITIVE'>('MULTIPLICATIVE');

  const steps = assessmentModule === 'COMPOSITE_RISK' ? RISK_STEPS : STEPS;

  // ------------------------------------------------------------------
  // Live preview (spec Screen 1) — real composite scores, nothing saved.
  // ------------------------------------------------------------------
  const [preview, setPreview] = useState<AssessmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [useCustomUpload, setUseCustomUpload] = useState(false);

  const enabledIndicatorConfigs = useMemo(
    () =>
      indicators
        .filter((ind) => enabledIndicators.has(ind.id))
        .map((ind) => ({
          code: ind.code,
          weight: indicatorWeights[ind.id] ?? ind.default_weight ?? 5,
        })),
    [indicators, enabledIndicators, indicatorWeights],
  );

  const totalEnabledWeight = useMemo(
    () => enabledIndicatorConfigs.reduce((sum, i) => sum + (i.weight || 0), 0),
    [enabledIndicatorConfigs],
  );

  const isRisk = assessmentModule === 'COMPOSITE_RISK';

  // Viewer is read-only (HVRA §2) — the query builder is a write tool.
  const isReadOnlyViewer = user?.profile?.role_code === 'VIEWER';

  const runPreview = useCallback(async () => {
    if (isRisk || !selectedDistrictId) {
      setPreview(null);
      return;
    }
    if (assessmentModule === 'HAZARD' && !selectedHazardCode) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await previewAssessment({
        module_type: assessmentModule,
        hazard_type: selectedHazardCode || 'FLOOD',
        district: selectedDistrictId,
        administrative_level: administrativeLevel,
        normalization_method: 'min_max',
        classification_method: 'threshold',
        indicators: enabledIndicatorConfigs,
      });
      setPreview(data);
    } catch (err: any) {
      setPreview(null);
      setPreviewError(
        err?.response?.data?.message || err?.message || 'Preview failed.',
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [
    isRisk,
    selectedDistrictId,
    selectedHazardCode,
    assessmentModule,
    administrativeLevel,
    enabledIndicatorConfigs,
  ]);

  // Debounced recompute so slider drags stay responsive.
  useEffect(() => {
    if (isRisk) return;
    if (!selectedDistrictId) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => { void runPreview(); }, 450);
    return () => clearTimeout(t);
  }, [runPreview, isRisk, selectedDistrictId]);

  const handleToggleIndicator = (id: number) => {
    setEnabledIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleWeightChange = (id: number, weight: number) => {
    setIndicatorWeights((prev) => ({ ...prev, [id]: weight }));
  };

  const handleResetWeights = () => {
    const next: Record<number, number> = {};
    indicators.forEach((ind) => { next[ind.id] = ind.default_weight || 5; });
    setIndicatorWeights(next);
    setEnabledIndicators(new Set(indicators.map((i) => i.id)));
  };

  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoadingData(true);
        const [hz, st, dt, bl] = await Promise.all([
          getHazards(),
          getStates(),
          getDistricts(),
          getBlocks()
        ]);
        
        setHazards(hz);
        setStates(st);
        setDistricts(dt);
        setBlocks(bl);
        
        // Auto-select Kerala as default state (can be changed)
        const kerala = st.find(s => s.name.includes('Kerala'));
        if (kerala) setSelectedStateId(kerala.id);
        // No auto-select of district — user picks from the visual grid


      } catch (err: unknown) {
        console.error(err);
        setError('Failed to load initial data from API.');
      } finally {
        setLoadingData(false);
      }
    }
    fetchInitialData();
  }, []);

  // Fetch indicators & datasets when hazard is selected (Module 1 only)
  useEffect(() => {
    if (assessmentModule !== 'HAZARD') return;
    if (selectedHazardCode) {
      const loadHazardData = async () => {
        try {
          const inds = await getIndicators(selectedHazardCode);
          setIndicators(inds);
          
          const srcRes = await getDataSources();
          setDataSources(srcRes.results);
          if (srcRes.results.length > 0 && !selectedDataSourceId) {
            setSelectedDataSourceId(srcRes.results[0].id);
          }

          // Setup initial weights based on defaults
          const initialWeights: Record<number, number> = {};
          const initiallyEnabled = new Set<number>();
          inds.forEach(ind => {
            initialWeights[ind.id] = ind.default_weight || 5;
            initiallyEnabled.add(ind.id); // Enable all by default
          });
          setIndicatorWeights(initialWeights);
          setEnabledIndicators(initiallyEnabled);
        } catch(e) {
          console.error(e);
        }
      };
      loadHazardData();
    }
  }, [selectedHazardCode, assessmentModule]);

  // Fetch indicators & datasets for Vulnerability / Exposure modules
  useEffect(() => {
    if (assessmentModule !== 'VULNERABILITY' && assessmentModule !== 'EXPOSURE') return;
    const loadModuleIndicators = async () => {
      try {
        const inds = await getIndicators(undefined, assessmentModule);
        setIndicators(inds);

        const srcRes = await getDataSources();
        setDataSources(srcRes.results);
        if (srcRes.results.length > 0) {
          setSelectedDataSourceId(prev => {
            if (prev && srcRes.results.some(s => s.id === prev)) return prev;
            return srcRes.results[0].id;
          });
        }

        const initialWeights: Record<number, number> = {};
        const initiallyEnabled = new Set<number>();
        inds.forEach(ind => {
          initialWeights[ind.id] = ind.default_weight || 5;
          initiallyEnabled.add(ind.id);
        });
        setIndicatorWeights(initialWeights);
        setEnabledIndicators(initiallyEnabled);
      } catch(e) {
        console.error(e);
      }
    };
    loadModuleIndicators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentModule]);

  // Fetch completed module assessments for the Composite Risk flow (Module 4)
  useEffect(() => {
    if (assessmentModule !== 'COMPOSITE_RISK') return;
    const loadCompletedModules = async () => {
      try {
        const [h, v, e] = await Promise.all([
          getAssessments({ module_type: 'HAZARD', status: 'COMPLETED' }),
          getAssessments({ module_type: 'VULNERABILITY', status: 'COMPLETED' }),
          getAssessments({ module_type: 'EXPOSURE', status: 'COMPLETED' }),
        ]);
        const byModule: Record<string, Assessment[]> = {
          HAZARD: (h.results || []),
          VULNERABILITY: (v.results || []),
          EXPOSURE: (e.results || []),
        };
        setModuleAssessments(byModule);
      } catch(err: unknown) {
        console.error(err);
        setModuleAssessments({});
      }
    };
    loadCompletedModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentModule]);

  // Update selected data source when district changes
  useEffect(() => {
    if (dataSources.length > 0 && selectedDistrictId) {
      const dist = districts.find(d => d.id === selectedDistrictId);
      const distName = dist ? dist.name.replace(' [DEMO]', '').trim() : '';
      const otherDistricts = districts
        .map(d => d.name.replace(' [DEMO]', '').trim())
        .filter(n => n.toLowerCase() !== distName.toLowerCase());

      const visibleSources = dataSources.filter(src => {
        if (!distName) return true;
        const matchesThis = src.name.toLowerCase().includes(distName.toLowerCase()) || 
                            src.description.toLowerCase().includes(distName.toLowerCase());
        if (matchesThis) return true;
        const matchesOther = otherDistricts.some(other => 
          other.length > 2 && (
            src.name.toLowerCase().includes(other.toLowerCase()) || 
            src.description.toLowerCase().includes(other.toLowerCase())
          )
        );
        return !matchesOther;
      });
      if (visibleSources.length > 0 && (!selectedDataSourceId || !visibleSources.find(s => s.id === selectedDataSourceId))) {
        setSelectedDataSourceId(visibleSources[0].id);
      }
    }
  }, [selectedDistrictId, dataSources, districts, selectedDataSourceId]);

  // Navigation handlers
  const handleNext = () => {
    const isRisk = assessmentModule === 'COMPOSITE_RISK';

    // Validation before moving next
    if (currentStep === 0 && !isRisk && !selectedHazardCode) {
      setError('Please select a hazard to continue.');
      return;
    }
    if (currentStep === 1 && (!selectedStateId || !selectedDistrictId)) {
      setError('Administrative area must be selected.');
      return;
    }
    if (currentStep === 2 && !isRisk && enabledIndicators.size === 0) {
      setError('Please select at least one indicator.');
      return;
    }
    if (isRisk && currentStep === 2) {
      if (!riskHazardId && !riskVulnerabilityId && !riskExposureId) {
        setError('Link at least one completed module assessment (H, V or E) to build the risk profile.');
        return;
      }
    }
    if (currentStep === 3) {
      if (isRisk) {
        const { hazard: hW, vulnerability: vW, exposure: eW } = riskWeights;
        if ([hW, vW, eW].some(w => isNaN(w) || w < 0 || w > 10)) {
          setError('Risk weights must be numeric values between 0 and 10.');
          return;
        }
      } else {
        // Validate weights are 0-10 for non-Total Area indicators
        let isValid = true;
        const weightedIndicators = indicators.filter(ind => enabledIndicators.has(ind.id) && ind.code !== 'TOTAL_AREA');
        weightedIndicators.forEach(ind => {
          const w = indicatorWeights[ind.id];
          if (w < 0 || w > 10 || isNaN(w)) {
            isValid = false;
          }
        });
        if (!isValid) {
          setError('Weights must be numeric values between 0 and 10.');
          return;
        }
      }
    }

    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // Save the current wizard configuration as a reusable query (HVRA §3.3).
  const handleSaveQuery = async () => {
    try {
      setSavingQuery(true);
      setSaveQueryMessage(null);
      if (!queryName.trim()) throw new Error('Provide a query name.');
      if (!selectedStateId || !selectedDistrictId) throw new Error('State or District missing');

      const parameters: Record<string, any> =
        assessmentModule === 'COMPOSITE_RISK'
          ? {
              name: queryName.trim(),
              description: 'Saved composite risk query (HVRA §3.3).',
              hazard_assessment: riskHazardId || null,
              vulnerability_assessment: riskVulnerabilityId || null,
              exposure_assessment: riskExposureId || null,
              formula: riskFormula,
              hazard_weight: riskWeights.hazard,
              vulnerability_weight: riskWeights.vulnerability,
              exposure_weight: riskWeights.exposure,
            }
          : {
              name: queryName.trim(),
              description: 'Saved assessment query (HVRA §3.3).',
              data_source: selectedDataSourceId || null,
              normalization_method: 'min_max',
              classification_method: 'threshold',
              indicators: Array.from(enabledIndicators).map(id => ({
                indicator_id: id,
                weight: indicatorWeights[id],
                data_source_id: selectedDataSourceId || null,
              })),
            };

      await createSavedQuery({
        name: queryName.trim(),
        description: parameters.description,
        module_type: assessmentModule === 'COMPOSITE_RISK' ? 'COMPOSITE_RISK' : assessmentModule,
        hazard_type: assessmentModule === 'HAZARD' ? selectedHazardCode : '',
        state: selectedStateId,
        district: selectedDistrictId,
        administrative_level: administrativeLevel,
        parameters,
      });
      setSaveQueryMessage(
        `✅ Query saved. Re-run or share it any time from the Reports → Saved Queries section.`
      );
    } catch (err: any) {
      setSaveQueryMessage(`⚠️ ${err.message || 'Failed to save query.'}`);
    } finally {
      setSavingQuery(false);
    }
  };

  const renderSaveQueryCard = () => (
    <div className="review-card" style={{ marginTop: '1.25rem', border: '1px dashed #94a3b8' }}>
      <div className="review-section" style={{ borderBottom: 'none' }}>
        <h4>🔖 Save This Configuration as a Query</h4>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.75rem' }}>
          Store the exact parameters (area, hazard, indicators, weights) so the assessment can be re-run
          and shared with other users via a public link.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="e.g. Flood exposure screening — Ernakulam district"
            value={queryName}
            onChange={e => { setQueryName(e.target.value); setSaveQueryMessage(null); }}
          />
          <button
            className="btn btn-secondary"
            disabled={savingQuery || !queryName.trim()}
            onClick={handleSaveQuery}
          >
            {savingQuery ? 'Saving…' : '💾 Save Query'}
          </button>
        </div>
        {saveQueryMessage && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: saveQueryMessage.startsWith('⚠️') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
            {saveQueryMessage}
          </div>
        )}
      </div>
    </div>
  );

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!selectedStateId || !selectedDistrictId) throw new Error("State or District missing");

      // Module 4 — Composite Risk flow
      if (assessmentModule === 'COMPOSITE_RISK') {
        const riskPayload = {
          name: `Composite Risk Assessment (Module 4) — ${districts.find(d => d.id === selectedDistrictId)?.name.replace(' [DEMO]', '') || 'District'} (${new Date().toLocaleDateString('en-GB')})`,
          description: "Risk = H × V × E combining completed Hazard, Vulnerability and Exposure assessments.",
          state: selectedStateId,
          district: selectedDistrictId,
          administrative_level: administrativeLevel,
          hazard_assessment: riskHazardId || null,
          vulnerability_assessment: riskVulnerabilityId || null,
          exposure_assessment: riskExposureId || null,
          formula: riskFormula,
          hazard_weight: riskWeights.hazard,
          vulnerability_weight: riskWeights.vulnerability,
          exposure_weight: riskWeights.exposure,
        };
        const res = await createRiskAssessment(riskPayload);
        const riskId = res.risk_assessment?.id;
        if (riskId) {
          navigate(`/risk-assessments/${riskId}/results`);
        } else {
          throw new Error(res.processing?.message || 'Failed to create risk assessment.');
        }
        return;
      }

      // Format payload (Modules 1–3)
      const payloadIndicators = Array.from(enabledIndicators).map(id => ({
        indicator_id: id,
        weight: indicatorWeights[id],
        data_source_id: selectedDataSourceId || undefined
      }));

      const distObj = districts.find(d => d.id === selectedDistrictId);
      const distName = distObj ? distObj.name.replace(' [DEMO]', '').trim() : 'Unknown';
      const hzObj = hazards.find(h => h.code === selectedHazardCode);
      const hzName = hzObj ? hzObj.name : 'Multi-Hazard';
      const modLabels = {
        HAZARD: 'Hazard Assessment (Module 1)',
        VULNERABILITY: 'Vulnerability Assessment (Module 2)',
        EXPOSURE: 'Exposure Assessment (Module 3)',
        COMPOSITE_RISK: 'Composite Risk Assessment (Module 4)'
      };

      const payload = {
        name: `${hzName} ${modLabels[assessmentModule]} — ${distName} (${new Date().toLocaleDateString('en-GB')})`,
        description: `Automated assessment conducted under the HVRA Decision Framework for ${distName} district.`,
        module_type: assessmentModule,
        hazard_type: assessmentModule === 'HAZARD' ? selectedHazardCode : '',
        state: selectedStateId,
        district: selectedDistrictId,
        administrative_level: administrativeLevel,
        data_source: selectedDataSourceId || undefined,
        normalization_method: "min_max",
        classification_method: "threshold",
        indicators: payloadIndicators
      };

      const assessment = await createAssessment(payload);
      
      // Phase 5: Trigger the processing engine
      await processAssessment(assessment.id);

      navigate(`/assessments/${assessment.id}/results`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate assessment.');
      setIsSubmitting(false);
    }
  };


  // --- Step Renders ---
  
  const renderStepHazard = () => (
    <div className="wizard-step">
      {/* 1. HVRA Framework Module Selector */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 className="wizard-step-title" style={{ marginBottom: '0.5rem' }}>1. Select HVRA Assessment Module</h3>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1rem' }}>
          Select the dimension of the disaster management framework to evaluate:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
          {[
            { id: 'HAZARD', num: 'Module 1', title: 'Hazard Assessment (H)', icon: '🌊', desc: 'Spatial hazard probability, return periods, and historical events.' },
            { id: 'VULNERABILITY', num: 'Module 2', title: 'Vulnerability Assessment (V)', icon: '👥', desc: 'Socio-economic fragility, demographics, and housing susceptibility.' },
            { id: 'EXPOSURE', num: 'Module 3', title: 'Exposure Assessment (E)', icon: '🏗️', desc: 'Population headcount, critical assets, and lifeline infrastructure.' },
            { id: 'COMPOSITE_RISK', num: 'Module 4', title: 'Composite Risk Matrix (R)', icon: '⚡', desc: 'Integrated risk computation: Risk = Hazard × Vulnerability × Exposure.' },
          ].map((mod) => (
            <div
              key={mod.id}
              onClick={() => setAssessmentModule(mod.id as any)}
              style={{
                border: assessmentModule === mod.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: assessmentModule === mod.id ? '#eff6ff' : '#ffffff',
                borderRadius: '8px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{mod.icon}</span>
                <span className={`badge ${assessmentModule === mod.id ? 'badge-primary' : 'badge-draft'}`} style={{ fontSize: '0.65rem' }}>
                  {mod.num}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{mod.title}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', lineHeight: 1.4 }}>{mod.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Hazard Type Grid (Module 1 only) */}
      {assessmentModule !== 'COMPOSITE_RISK' && (
        <>
          <h3 className="wizard-step-title">2. Which primary hazard do you want to assess?</h3>
          <div className="hazard-grid">
            {hazards.map((hazard) => (
              <div
                key={hazard.code}
                className={`hazard-card ${!hazard.is_active ? 'disabled' : ''} ${selectedHazardCode === hazard.code ? 'selected' : ''}`}
                onClick={() => {
                  if (hazard.is_active) {
                    setSelectedHazardCode(hazard.code);
                    setError(null);
                  }
                }}
                style={{ '--hazard-color': hazard.color } as React.CSSProperties}
              >
                <div className="hazard-card-icon">{hazard.icon || '⚠️'}</div>
                <div className="hazard-card-name">{hazard.name}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#64748b', textAlign: 'center' }}>
                  {hazard.description}
                </div>
                {!hazard.is_active && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <span className="badge badge-draft" style={{ fontSize: '0.65rem' }}>Coming Soon</span>
                  </div>
                )}
                {selectedHazardCode === hazard.code && (
                  <div className="hazard-selected-mark">✓</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Composite Risk (Module 4) scope panel */}
      {assessmentModule === 'COMPOSITE_RISK' && (
        <div className="alert alert-info">
          <span>⚡</span>
          <div>
            <strong>Composite Risk = Hazard × Vulnerability × Exposure</strong>
            <div style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
              The Module 4 flow links your already-completed Hazard (Module 1), Vulnerability (Module 2) and
              Exposure (Module 3) assessments, applies the weighted multiplicative risk formula and generates a
              unit-level risk classification (Very High / High / Moderate / Low).
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              Next: select the administrative area, then link the module assessments and set scenario weights.
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStepArea = () => {
    const selectedDistrict = districts.find(d => d.id === selectedDistrictId);

    // Which districts to show based on selected state + search query
    const visibleDistricts = districts
      .filter(d => selectedStateId ? d.parent_id === selectedStateId : true)
      .filter(d => {
        const q = districtSearch.toLowerCase();
        return !q || d.name.toLowerCase().includes(q);
      });

    return (
      <div className="wizard-step">
        {/* Add District Modal */}
        {showAddDistrict && (
          <AddDistrictModal
            states={states}
            defaultStateId={selectedStateId}
            onSuccess={(newDistrict) => {
              // Add to local list and auto-select it
              setDistricts(prev => [...prev, newDistrict]);
              setSelectedDistrictId(newDistrict.id);
              if (newDistrict.parent_id) setSelectedStateId(newDistrict.parent_id);
            }}
            onClose={() => setShowAddDistrict(false)}
          />
        )}

        <h3 className="wizard-step-title">Select Administrative Area</h3>

        {territoryRestricted && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
            borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.82rem',
            marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <span>📍</span>
            <span>
              You are scoped to <strong>{user?.profile?.role_code === 'DISTRICT_OFFICIAL'
                ? `district ${user?.profile?.district_name || ''}`
                : `state ${user?.profile?.state_name || ''}`}</strong> (HVRA §2). Only
              administrative units inside your assigned territory are listed and assessments may only be
              created there.
            </span>
          </div>
        )}

        {/* State selector chips */}
        <div className="area-section">
          <div className="area-section-label">📌 State</div>
          <div className="area-state-chips">
            {states.map(state => (
              <button
                key={state.id}
                className={`area-state-chip ${selectedStateId === state.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedStateId(state.id);
                  setSelectedDistrictId(null);
                  setDistrictSearch('');
                }}
              >
                {selectedStateId === state.id && <span>✓ </span>}
                {state.name}
              </button>
            ))}
          </div>
        </div>

        {/* District picker */}
        <div className="area-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="area-section-label" style={{ marginBottom: 0 }}>🏙️ District</div>
            <button
              className="area-add-btn"
              onClick={() => setShowAddDistrict(true)}
            >
              <span>➕</span> Add New District
            </button>
          </div>

          {/* Search box */}
          <div className="area-search-wrap">
            <span className="area-search-icon">🔍</span>
            <input
              type="text"
              className="area-search-input"
              placeholder="Search districts…"
              value={districtSearch}
              onChange={e => setDistrictSearch(e.target.value)}
            />
            {districtSearch && (
              <button className="area-search-clear" onClick={() => setDistrictSearch('')}>✕</button>
            )}
          </div>

          {/* District cards */}
          <div className="area-district-grid">
            {visibleDistricts.length === 0 ? (
              <div className="area-empty">
                <div style={{ fontSize: '2rem' }}>🔍</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>No districts found</div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Try a different search or add a new district
                </div>
                <button className="area-add-btn" onClick={() => setShowAddDistrict(true)}>
                  ➕ Add "{districtSearch}" as a New District
                </button>
              </div>
            ) : (
              visibleDistricts.map(d => {
                const isSelected = selectedDistrictId === d.id;
                const cleanName = d.name.replace(' [DEMO]', '').trim();
                return (
                  <button
                    key={d.id}
                    className={`area-district-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => { setSelectedDistrictId(d.id); setError(null); }}
                  >
                    <div className="area-district-card-check">{isSelected ? '✓' : ''}</div>
                    <div className="area-district-card-name">{cleanName}</div>
                    <div className="area-district-card-meta">
                      {d.parent_name && <span className="area-district-state-badge">{d.parent_name}</span>}
                      {d.is_demo && <span className="area-district-demo-badge">Demo</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Administrative granularity — BLOCK (taluka) or VILLAGE level */}
        <div className="area-section">
          <div className="area-section-label">🗂️ Administrative Granularity</div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`area-state-chip ${administrativeLevel === 'BLOCK' ? 'selected' : ''}`}
              onClick={() => setAdministrativeLevel('BLOCK')}
            >
              {administrativeLevel === 'BLOCK' && <span>✓ </span>}
              🏘️ Block / Taluka Level
            </button>
            <button
              type="button"
              className={`area-state-chip ${administrativeLevel === 'VILLAGE' ? 'selected' : ''}`}
              onClick={() => setAdministrativeLevel('VILLAGE')}
            >
              {administrativeLevel === 'VILLAGE' && <span>✓ </span>}
              🛖 Village Level
            </button>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
            {administrativeLevel === 'VILLAGE'
              ? 'Village-level assessments are computed over the demo villages auto-seeded under each block of the selected district.'
              : 'Block-level assessments are computed over the taluka/block administrative units of the selected district.'}
          </div>
        </div>

        {/* Selected summary + map */}
        {selectedDistrict && (
          <div className="area-selected-summary">
            <div className="area-selected-info">
              <span className="area-selected-icon">📍</span>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedDistrict.name.replace(' [DEMO]', '')}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {selectedDistrict.parent_name} · Block level assessment
                </div>
              </div>
            </div>
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header"><h4 className="card-title" style={{ fontSize: '1rem' }}>🗺️ Map Preview</h4></div>
              <div className="card-body" style={{ padding: 0 }}>
                <KeralaMap selectedDistrict={selectedDistrict} hideDropdown={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStepRiskInputs = () => {
    const districtFiltered = (module: 'HAZARD' | 'VULNERABILITY' | 'EXPOSURE') =>
      (moduleAssessments[module] || []).filter(a => a.district === selectedDistrictId);

    const hList = districtFiltered('HAZARD');
    const vList = districtFiltered('VULNERABILITY');
    const eList = districtFiltered('EXPOSURE');

    const weightSlider = (
      label: string,
      value: number,
      field: 'hazard' | 'vulnerability' | 'exposure',
      color: string
    ) => (
      <div className="weightage-item" key={field}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color }}>{label}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Scenario weight (0–10). Higher = more influence on the combined risk score.
          </div>
        </div>
        <div style={{ width: '220px' }}>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={value}
            onChange={(e) => setRiskWeights(prev => ({ ...prev, [field]: parseFloat(e.target.value) }))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
            <span>0</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{value.toFixed(1)}</span>
            <span>10</span>
          </div>
        </div>
      </div>
    );

    const assessmentSelect = (
      label: string,
      list: Assessment[],
      value: number | '',
      onChange: (id: number | '') => void,
      emptyHint: string
    ) => (
      <div className="weightage-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{list.length} completed</span>
        </div>
        {list.length === 0 ? (
          <div className="alert alert-warning" style={{ margin: 0, fontSize: '0.8rem' }}>
            <span>⚠️</span>
            <div>{emptyHint}</div>
          </div>
        ) : (
          <select
            className="form-control"
            value={value}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : '')}
          >
            <option value="">— Select assessment —</option>
            {list.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.hazard_type || a.module_code} · score {a.result_count} units
              </option>
            ))}
          </select>
        )}
      </div>
    );

    return (
      <div className="wizard-step">
        <h3 className="wizard-step-title">Link Module Assessments & Configure Risk Formula</h3>
        <p className="text-muted mb-6">
          Combine completed Hazard, Vulnerability and Exposure assessments executed over the <strong>same district</strong>.
          At least one component is required; unused components are excluded from the calculation.
        </p>

        <div className="review-section">
          <h4>Input Module Assessments</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {assessmentSelect(
              '🌊 Hazard (Module 1)',
              hList,
              riskHazardId,
              setRiskHazardId,
              'No completed Hazard assessment for this district yet. Run Module 1 first.'
            )}
            {assessmentSelect(
              '👥 Vulnerability (Module 2)',
              vList,
              riskVulnerabilityId,
              setRiskVulnerabilityId,
              'No completed Vulnerability assessment for this district yet. Run Module 2 first.'
            )}
            {assessmentSelect(
              '🏗️ Exposure (Module 3)',
              eList,
              riskExposureId,
              setRiskExposureId,
              'No completed Exposure assessment for this district yet. Run Module 3 first.'
            )}
          </div>
        </div>

        <div className="review-section">
          <h4>Risk Formula</h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="riskFormula"
                checked={riskFormula === 'MULTIPLICATIVE'}
                onChange={() => setRiskFormula('MULTIPLICATIVE')}
              />
              <span>
                <strong>Multiplicative</strong> — R = (H^wH × V^wV × E^wE)^(1/Σw)
                <span className="text-muted text-small" style={{ marginLeft: '0.5rem' }}>(recommended)</span>
              </span>
            </label>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="riskFormula"
                checked={riskFormula === 'ADDITIVE'}
                onChange={() => setRiskFormula('ADDITIVE')}
              />
              <span><strong>Weighted Sum</strong> — R = (wH·H + wV·V + wE·E) / Σw</span>
            </label>
          </div>
        </div>

        <div className="review-section" style={{ borderBottom: 'none' }}>
          <h4>Scenario Weights (0–10)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {weightSlider('Hazard weight', riskWeights.hazard, 'hazard', '#ef4444')}
            {weightSlider('Vulnerability weight', riskWeights.vulnerability, 'vulnerability', '#f59e0b')}
            {weightSlider('Exposure weight', riskWeights.exposure, 'exposure', '#2563eb')}
          </div>
        </div>
      </div>
    );
  };

  const renderStepIndicators = () => (
    <div className="wizard-step">
      <h3 className="wizard-step-title">Select Indicators</h3>
      <p className="text-muted mb-6">Select the indicators to include in the assessment calculation.</p>
      
      <div className="indicator-list">
        {indicators.map(ind => {
          const isEnabled = enabledIndicators.has(ind.id);
          return (
            <div key={ind.id} className={`indicator-item ${isEnabled ? 'enabled' : ''}`}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', width: '100%', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={isEnabled}
                  onChange={(e) => {
                    const newSet = new Set(enabledIndicators);
                    if (e.target.checked) newSet.add(ind.id);
                    else newSet.delete(ind.id);
                    setEnabledIndicators(newSet);
                  }}
                  style={{ marginTop: '0.25rem' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-gov-navy)' }}>{ind.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>{ind.description}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Unit: {ind.unit}<br/>
                  Default Weight: {ind.default_weight}
                </div>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStepWeightage = () => (
    <div className="wizard-step">
      <h3 className="wizard-step-title">Configure Weightage</h3>
      <div className="alert alert-info mb-6">
        <span>ℹ️</span>
        <div>
          Weightage is used by the assessment engine to determine the contribution of each selected indicator.
          Enter a value between 0 and 10.
        </div>
      </div>
      
      <div className="weightage-list">
        {indicators
          .filter(ind => enabledIndicators.has(ind.id) && ind.code !== 'TOTAL_AREA')
          .map(ind => (
          <div key={ind.id} className="weightage-item">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{ind.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Unit: {ind.unit}</div>
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Weight [0-10]</label>
              <input 
                type="number" 
                className="form-control"
                min="0" max="10" step="0.1"
                value={indicatorWeights[ind.id] !== undefined ? indicatorWeights[ind.id] : ''}
                onChange={(e) => {
                  setIndicatorWeights(prev => ({
                    ...prev,
                    [ind.id]: parseFloat(e.target.value)
                  }));
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const handleUploadCustomDataset = async () => {
    if (!uploadFileObj) {
      setError('Please select a .geojson, .json, or .csv file to upload.');
      return;
    }
    try {
      setIsUploading(true);
      setError(null);
      const fd = new FormData();
      fd.append('file', uploadFileObj);
      fd.append('name', uploadFileName || uploadFileObj.name);
      fd.append('hazard_type', selectedHazardCode || 'FLOOD');
      fd.append('organization', 'User Upload');
      fd.append('description', `Custom uploaded dataset (${uploadFileObj.name})`);
      const res = await uploadDataset(fd);
      const srcRes = await getDataSources();
      setDataSources(srcRes.results);
      if (res.data_source_id) {
        setSelectedDataSourceId(res.data_source_id);
      }
      setShowUploadModal(false);
      setUploadFileName('');
      setUploadFileObj(null);
      setUploadSuccessMsg(`Dataset "${uploadFileName || uploadFileObj.name}" successfully uploaded, parsed, and selected!`);
      setTimeout(() => setUploadSuccessMsg(null), 6000);
    } catch (err: any) {
      setError('Dataset upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const renderStepDataSources = () => (
    <div className="wizard-step">
      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📁</span> Upload Custom Spatial Dataset
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Upload custom GeoJSON polygons/points or CSV incident data. The file will be parsed, checked for coordinate validity, and registered as an assessment layer.
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Dataset Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 2024 Monsoon Water Extent Survey"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Select File (.geojson, .json, .csv)
                </label>
                <input
                  type="file"
                  accept=".geojson,.json,.csv,.zip"
                  className="form-control"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFileObj(e.target.files[0]);
                      if (!uploadFileName) {
                        setUploadFileName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                />
              </div>

              {uploadFileObj && (
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                  📄 <strong>{uploadFileObj.name}</strong> ({(uploadFileObj.size / 1024).toFixed(1)} KB)
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUploadCustomDataset}
                  disabled={isUploading || !uploadFileObj}
                >
                  {isUploading ? 'Validating & Uploading...' : 'Upload & Attach'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h3 className="wizard-step-title" style={{ marginBottom: '0.25rem' }}>Select Data Sources</h3>
          <p className="text-muted" style={{ margin: 0 }}>Select the primary dataset or upload your own spatial boundary/incident layer.</p>
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0f172a' }}
          onClick={() => setShowUploadModal(true)}
        >
          <span>➕</span> Upload Custom Dataset
        </button>
      </div>

      {uploadSuccessMsg && (
        <div className="alert alert-success mb-6" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
          <span>✓</span>
          <div>{uploadSuccessMsg}</div>
        </div>
      )}
      
      <div className="datasource-list">
        {dataSources
          .filter(src => {
            const dist = districts.find(d => d.id === selectedDistrictId);
            const distName = dist ? dist.name.replace(' [DEMO]', '').trim() : '';
            if (!src.is_builtin) return true;
            if (!distName) return true;
            const matchesThis = src.name.toLowerCase().includes(distName.toLowerCase()) || 
                                src.description.toLowerCase().includes(distName.toLowerCase());
            if (matchesThis) return true;
            const otherDistricts = districts
              .map(d => d.name.replace(' [DEMO]', '').trim())
              .filter(n => n.toLowerCase() !== distName.toLowerCase());
            const matchesOther = otherDistricts.some(other => 
              other.length > 2 && (
                src.name.toLowerCase().includes(other.toLowerCase()) || 
                src.description.toLowerCase().includes(other.toLowerCase())
              )
            );
            return !matchesOther;
          })
          .map(src => {
          const isSelected = selectedDataSourceId === src.id;
          const isDemo = src.is_demo || src.name.includes('[DEMO]');
          const isCustom = !src.is_builtin;
          return (
            <div key={src.id} className={`datasource-item ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDataSourceId(src.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <input 
                  type="radio" 
                  checked={isSelected}
                  onChange={() => setSelectedDataSourceId(src.id)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {src.name}
                    {isCustom && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>USER UPLOAD</span>}
                    {isDemo && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>DEMO DATA</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{src.description}</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>
                  Source: {src.organization || 'Unknown'}<br/>
                  Vintage: {src.vintage || 'N/A'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStepReview = () => {
    const kerala = states.find(s => s.id === selectedStateId);
    const selectedDistrictObj = districts.find(d => d.id === selectedDistrictId);
    const selectedHz = hazards.find(h => h.code === selectedHazardCode);
    const selectedSrc = dataSources.find(s => s.id === selectedDataSourceId);

    // Module 4 — Composite Risk review
    if (assessmentModule === 'COMPOSITE_RISK') {
      const nameOf = (list: Assessment[], id: number | '') => {
        const found = list.find(a => a.id === id);
        return found ? found.name : null;
      };
      const hSel = nameOf(moduleAssessments['HAZARD'] || [], riskHazardId);
      const vSel = nameOf(moduleAssessments['VULNERABILITY'] || [], riskVulnerabilityId);
      const eSel = nameOf(moduleAssessments['EXPOSURE'] || [], riskExposureId);

      return (
        <div className="wizard-step">
          <h3 className="wizard-step-title">Review Composite Risk Query</h3>

          <div className="review-card">
            <div className="review-section">
              <h4>Assessment Framework & Scope</h4>
              <div className="grid-2">
                <div><span className="text-muted">HVRA Module:</span> <strong>Composite Risk (Module 4)</strong></div>
                <div><span className="text-muted">Formula:</span> <strong>{riskFormula === 'MULTIPLICATIVE' ? 'Multiplicative (R = H × V × E)' : 'Weighted Sum'}</strong></div>
                <div><span className="text-muted">State:</span> <strong>{kerala?.name || 'Kerala'}</strong></div>
                <div><span className="text-muted">District:</span> <strong>{selectedDistrictObj?.name || 'District'}</strong></div>
                <div><span className="text-muted">Administrative Level:</span> <strong>{administrativeLevel === 'VILLAGE' ? 'Village Level' : 'Block / Taluka Level'}</strong></div>
                <div><span className="text-muted">Risk Scale:</span> <strong>0–10 (Very High / High / Moderate / Low)</strong></div>
              </div>
            </div>

            <div className="review-section">
              <h4>Linked Module Assessments</h4>
              <ul className="review-list">
                <li>🌊 Hazard: <strong>{hSel || '— Not linked'}</strong></li>
                <li>👥 Vulnerability: <strong>{vSel || '— Not linked'}</strong></li>
                <li>🏗️ Exposure: <strong>{eSel || '— Not linked'}</strong></li>
              </ul>
            </div>

            <div className="review-section" style={{ borderBottom: 'none' }}>
              <h4>Scenario Weights</h4>
              <ul className="review-list">
                <li>Hazard weight: <strong>{riskWeights.hazard.toFixed(1)}</strong></li>
                <li>Vulnerability weight: <strong>{riskWeights.vulnerability.toFixed(1)}</strong></li>
                <li>Exposure weight: <strong>{riskWeights.exposure.toFixed(1)}</strong></li>
              </ul>
              <div className="alert alert-warning" style={{ margin: '0.75rem 0 0' }}>
                <span>ℹ️</span>
                <div>Risk is computed from the completed module assessments listed above. Prototype outputs use demo data.</div>
              </div>
            </div>
          </div>
          {renderSaveQueryCard()}
        </div>
      );
    }

    return (
      <div className="wizard-step">
        <h3 className="wizard-step-title">Review Assessment Query</h3>
        
        <div className="review-card">
          <div className="review-section">
            <h4>Assessment Framework & Scope</h4>
            <div className="grid-2">
              <div><span className="text-muted">HVRA Module:</span> <strong>{assessmentModule.replace('_', ' ')}</strong></div>
              <div><span className="text-muted">Primary Hazard:</span> <strong>{selectedHz?.name || 'Flood'}</strong></div>
              <div><span className="text-muted">State:</span> <strong>{kerala?.name || 'Kerala'}</strong></div>
              <div><span className="text-muted">District:</span> <strong>{selectedDistrictObj?.name || 'District'}</strong></div>
              <div><span className="text-muted">Administrative Level:</span> <strong>{administrativeLevel === 'VILLAGE' ? 'Village Level' : 'Block / Taluka Level'}</strong></div>
              <div><span className="text-muted">Scoring Method:</span> <strong>Min-Max (0–10 Scale)</strong></div>
            </div>
          </div>
          
          <div className="review-section">
            <h4>Indicators Selected ({enabledIndicators.size})</h4>
            <ul className="review-list">
              {indicators.filter(ind => enabledIndicators.has(ind.id)).map(ind => (
                <li key={ind.id}>
                  ✓ <strong>{ind.name}</strong>
                  {ind.code !== 'TOTAL_AREA' && (
                    <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Weight: {indicatorWeights[ind.id]}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="review-section" style={{ borderBottom: 'none' }}>
            <h4>Data Sources</h4>
            {selectedSrc ? (
              <div>
                <strong>{selectedSrc.name}</strong><br/>
                <span className="text-muted text-small">{selectedSrc.organization} · Vintage {selectedSrc.vintage}</span>
              </div>
            ) : (
              <span className="text-muted">Default baseline catalog dataset selected.</span>
            )}
          </div>
        </div>
        {renderSaveQueryCard()}
      </div>
    );
  };

  if (loadingData) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading builder...</span>
      </div>
    );
  }

  return (
    <div className="new-assessment-container">
      {/* Add-district modal is shared by both the query builder and the
          Composite Risk wizard. */}
      {showAddDistrict && (
        <AddDistrictModal
          states={states}
          defaultStateId={selectedStateId}
          onSuccess={(newDistrict) => {
            setDistricts(prev => [...prev, newDistrict]);
            setSelectedDistrictId(newDistrict.id);
            if (newDistrict.parent_id) setSelectedStateId(newDistrict.parent_id);
          }}
          onClose={() => setShowAddDistrict(false)}
        />
      )}

      {/* ============================================================
          Modules 1–3: single-page step-by-step query builder (Screen 1)
          ============================================================ */}
      {!isRisk && isReadOnlyViewer && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👁️</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Read-only access</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Your <strong>Viewer</strong> role can browse published maps, scores and reports,
              but cannot run new assessments. Ask a Platform Admin to change your role if you
              need to create or edit assessments.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1.25rem' }}>
              <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
              <Link to="/reports" className="btn btn-secondary">Browse Reports</Link>
            </div>
          </div>
        </div>
      )}

      {!isRisk && !isReadOnlyViewer && (
        <QueryBuilder
          moduleType={assessmentModule as QueryModule}
          onModuleChange={(m) => {
            setAssessmentModule(m);
            setCurrentStep(0);
            setError(null);
            setSearchParams({ module: m });
          }}
          hazards={hazards}
          selectedHazardCode={selectedHazardCode}
          onHazardChange={(code) => { setSelectedHazardCode(code); setError(null); }}
          administrativeLevel={administrativeLevel}
          onAdministrativeLevelChange={setAdministrativeLevel}
          states={states}
          districts={districts}
          selectedStateId={selectedStateId}
          selectedDistrictId={selectedDistrictId}
          onStateChange={(id) => { setSelectedStateId(id); setSelectedDistrictId(null); }}
          onDistrictChange={(id) => { setSelectedDistrictId(id); setError(null); }}
          districtSearch={districtSearch}
          onDistrictSearchChange={setDistrictSearch}
          onAddDistrict={() => setShowAddDistrict(true)}
          indicators={indicators}
          enabledIndicators={enabledIndicators}
          onToggleIndicator={handleToggleIndicator}
          indicatorWeights={indicatorWeights}
          onWeightChange={handleWeightChange}
          onResetWeights={handleResetWeights}
          totalWeight={totalEnabledWeight}
          dataSources={dataSources}
          selectedDataSourceId={selectedDataSourceId}
          onDataSourceChange={setSelectedDataSourceId}
          uploadFileObj={uploadFileObj}
          uploadFileName={uploadFileName}
          onUploadFileNameChange={setUploadFileName}
          onUploadFileChange={setUploadFileObj}
          onUploadSubmit={handleUploadCustomDataset}
          isUploading={isUploading}
          uploadSuccessMsg={uploadSuccessMsg}
          useCustomUpload={useCustomUpload}
          onUseCustomUploadChange={setUseCustomUpload}
          preview={preview}
          previewLoading={previewLoading}
          previewError={previewError}
          onRefreshPreview={() => { void runPreview(); }}
          queryName={queryName}
          onQueryNameChange={setQueryName}
          onSaveQuery={handleSaveQuery}
          savingQuery={savingQuery}
          saveQueryMessage={saveQueryMessage}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={error}
          territoryNotice={territoryRestricted ? (
            user?.profile?.role_code === 'DISTRICT_OFFICIAL'
              ? `📍 You are scoped to district ${user?.profile?.district_name || ''} (HVRA §2). Only units inside your territory are listed.`
              : `📍 You are scoped to state ${user?.profile?.state_name || ''} (HVRA §2). Only units inside your territory are listed.`
          ) : null}
        />
      )}

      {/* ============================================================
          Module 4 (Composite Risk): existing link-and-weight wizard
          ============================================================ */}
      {isRisk && !isReadOnlyViewer && (
        <>
      {/* Wizard Header */}
      <div className="wizard-header card mb-6">
        <div className="stepper">
          {steps.map((step, index) => {
            let statusClass = '';
            if (index < currentStep) statusClass = 'completed';
            else if (index === currentStep) statusClass = 'active';
            
            return (
              <div key={step} className={`step-item ${statusClass}`}>
                <div className="step-circle">{index < currentStep ? '✓' : index + 1}</div>
                <div className="step-label">{step}</div>
                {index < steps.length - 1 && <div className="step-line" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card">
        <div className="card-body">
          {error && (
            <div className="alert alert-error mb-6">
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {(() => {
            const stepLabel = steps[currentStep];
            if (['Hazard & Module', 'Module & Scope'].includes(stepLabel)) return renderStepHazard();
            if (stepLabel === 'Area') return renderStepArea();
            if (stepLabel === 'Risk Components & Weights') return renderStepRiskInputs();
            if (stepLabel === 'Indicators') return renderStepIndicators();
            if (stepLabel === 'Weightage') return renderStepWeightage();
            if (stepLabel === 'Data Sources') return renderStepDataSources();
            return renderStepReview();
          })()}
        </div>
        
        {/* Wizard Footer Controls */}
        <div className="card-footer wizard-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleBack} 
            disabled={currentStep === 0 || isSubmitting}
          >
            Back
          </button>
          
          {currentStep < steps.length - 1 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Generating...' : 'Generate Assessment'}
            </button>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
