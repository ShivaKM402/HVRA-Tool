import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getHazards,
  getStates,
  getDistricts,
  getBlocks,
  getIndicators,
  getDataSources,
  createAssessment,
  processAssessment
} from '../../services/api';
import type {
  HazardType,
  AdministrativeUnit,
  HazardIndicator,
  DataSource
} from '../../types';
import KottayamMap from '../../components/Map/KottayamMap';
import './NewAssessment.css';

const STEPS = [
  'Hazard',
  'Area',
  'Indicators',
  'Weightage',
  'Data Sources',
  'Review'
];


export default function NewAssessment() {
  const navigate = useNavigate();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        
        // Auto select Kerala and Kottayam for Phase 4 Pilot
        const kerala = st.find(s => s.name.includes('Kerala'));
        if (kerala) setSelectedStateId(kerala.id);
        
        const kottayam = dt.find(d => d.name.includes('Kottayam'));
        if (kottayam) setSelectedDistrictId(kottayam.id);

      } catch (err: unknown) {
        console.error(err);
        setError('Failed to load initial data from API.');
      } finally {
        setLoadingData(false);
      }
    }
    fetchInitialData();
  }, []);

  // Fetch indicators & datasets when hazard is selected
  useEffect(() => {
    if (selectedHazardCode === 'FLOOD') {
      const loadHazardData = async () => {
        try {
          const inds = await getIndicators('FLOOD');
          setIndicators(inds);
          
          const srcRes = await getDataSources();
          setDataSources(srcRes.results);
          if (srcRes.results.length > 0) {
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
  }, [selectedHazardCode]);

  // Update selected data source when district changes
  useEffect(() => {
    if (dataSources.length > 0 && selectedDistrictId) {
      const dist = districts.find(d => d.id === selectedDistrictId);
      const distName = dist ? dist.name.replace(' [DEMO]', '').trim() : '';
      const visibleSources = dataSources.filter(src => {
        return distName ? (src.name.includes(distName) || src.description.includes(distName) || (!src.name.includes('Kottayam') && !src.name.includes('Thiruvananthapuram') && !src.name.includes('Ernakulam'))) : true;
      });
      if (visibleSources.length > 0 && (!selectedDataSourceId || !visibleSources.find(s => s.id === selectedDataSourceId))) {
        setSelectedDataSourceId(visibleSources[0].id);
      }
    }
  }, [selectedDistrictId, dataSources, districts, selectedDataSourceId]);

  // Navigation handlers
  const handleNext = () => {
    // Validation before moving next
    if (currentStep === 0 && !selectedHazardCode) {
      setError('Please select a hazard to continue.');
      return;
    }
    if (currentStep === 1 && (!selectedStateId || !selectedDistrictId)) {
      setError('Administrative area must be selected.');
      return;
    }
    if (currentStep === 2 && enabledIndicators.size === 0) {
      setError('Please select at least one indicator.');
      return;
    }
    if (currentStep === 3) {
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

    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!selectedStateId || !selectedDistrictId) throw new Error("State or District missing");

      // Format payload
      const payloadIndicators = Array.from(enabledIndicators).map(id => ({
        indicator_id: id,
        weight: indicatorWeights[id],
        data_source_id: selectedDataSourceId || undefined
      }));

      const distObj = districts.find(d => d.id === selectedDistrictId);
      const distName = distObj ? distObj.name.replace(' [DEMO]', '').trim() : 'Unknown';

      const payload = {
        name: `Flood Assessment - ${distName} - ${new Date().toLocaleDateString('en-GB')}`,
        description: "Generated from Query Builder prototype.",
        hazard_type: selectedHazardCode,
        state: selectedStateId,
        district: selectedDistrictId,
        administrative_level: "BLOCK",
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
      <h3 className="wizard-step-title">Which hazard do you want to assess?</h3>
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
    </div>
  );

  const renderStepArea = () => {
    const kerala = states.find(s => s.id === selectedStateId);
    const kottayam = districts.find(d => d.id === selectedDistrictId);

    return (
      <div className="wizard-step">
        <h3 className="wizard-step-title">Select Administrative Area</h3>
        <p className="text-muted mb-6">
          For the pilot prototype, you can select from Kottayam, Thiruvananthapuram, or Ernakulam districts.
        </p>

        <div className="grid-3 mb-6" style={{ gap: '1rem' }}>
          <div className="form-group">
            <label>State</label>
            <input type="text" className="form-control" value={kerala ? kerala.name : 'Kerala'} disabled />
          </div>
          <div className="form-group">
            <label>District</label>
            <select 
              className="form-control" 
              value={selectedDistrictId || ''} 
              onChange={e => setSelectedDistrictId(Number(e.target.value))}
            >
              {districts
                .filter(d => ['Kottayam', 'Thiruvananthapuram', 'Ernakulam'].some(name => d.name.includes(name)))
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name.replace(' [DEMO]', '')}
                  </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Administrative Level</label>
            <input type="text" className="form-control" value="Block" disabled />
          </div>
        </div>
        
        <div className="card">
          <div className="card-header"><h4 className="card-title" style={{ fontSize: '1rem' }}>Map Preview</h4></div>
          <div className="card-body" style={{ padding: 0 }}>
             <KottayamMap 
                districtKey={kottayam ? 
                  (kottayam.name.includes('Thiruvananthapuram') ? 'Thiruvananthapuram' : 
                   kottayam.name.includes('Ernakulam') ? 'Ernakulam' : 'Kottayam') 
                  : 'Kottayam'} 
                hideDropdown={true} 
             />
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

  const renderStepDataSources = () => (
    <div className="wizard-step">
      <h3 className="wizard-step-title">Select Data Sources</h3>
      <p className="text-muted mb-6">Select the primary dataset to use for this assessment.</p>
      
      <div className="datasource-list">
        {dataSources
          .filter(src => {
            const dist = districts.find(d => d.id === selectedDistrictId);
            const distName = dist ? dist.name.replace(' [DEMO]', '').trim() : '';
            return distName ? (src.name.includes(distName) || src.description.includes(distName) || (!src.name.includes('Kottayam') && !src.name.includes('Thiruvananthapuram') && !src.name.includes('Ernakulam'))) : true;
          })
          .map(src => {
          const isSelected = selectedDataSourceId === src.id;
          const isDemo = src.is_demo || src.name.includes('[DEMO]');
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
    const kottayam = districts.find(d => d.id === selectedDistrictId);
    const selectedHz = hazards.find(h => h.code === selectedHazardCode);
    const selectedSrc = dataSources.find(s => s.id === selectedDataSourceId);
    
    return (
      <div className="wizard-step">
        <h3 className="wizard-step-title">Review Assessment Query</h3>
        
        <div className="review-card">
          <div className="review-section">
            <h4>Assessment Summary</h4>
            <div className="grid-2">
              <div><span className="text-muted">State:</span> <strong>{kerala?.name || 'Kerala'}</strong></div>
              <div><span className="text-muted">District:</span> <strong>{kottayam?.name || 'Kottayam'}</strong></div>
              <div><span className="text-muted">Hazard:</span> <strong>{selectedHz?.name || 'Flood'}</strong></div>
              <div><span className="text-muted">Administrative Level:</span> <strong>Block</strong></div>
            </div>
          </div>
          
          <div className="review-section">
            <h4>Indicators Selected</h4>
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
                <span className="text-muted text-small">{selectedSrc.organization}</span>
              </div>
            ) : (
              <span className="text-muted">No primary data source selected.</span>
            )}
          </div>
        </div>
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
      {/* Wizard Header */}
      <div className="wizard-header card mb-6">
        <div className="stepper">
          {STEPS.map((step, index) => {
            let statusClass = '';
            if (index < currentStep) statusClass = 'completed';
            else if (index === currentStep) statusClass = 'active';
            
            return (
              <div key={step} className={`step-item ${statusClass}`}>
                <div className="step-circle">{index < currentStep ? '✓' : index + 1}</div>
                <div className="step-label">{step}</div>
                {index < STEPS.length - 1 && <div className="step-line" />}
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

          {currentStep === 0 && renderStepHazard()}
          {currentStep === 1 && renderStepArea()}
          {currentStep === 2 && renderStepIndicators()}
          {currentStep === 3 && renderStepWeightage()}
          {currentStep === 4 && renderStepDataSources()}
          {currentStep === 5 && renderStepReview()}
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
          
          {currentStep < STEPS.length - 1 ? (
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
    </div>
  );
}
