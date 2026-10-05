/**
 * Onboarding Tour Modal
 * 4-step guided walk-through explaining the HVRA end-to-end workflow.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OnboardingTour.css';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to the HVRA Digital Platform',
      badge: 'National Tool · Kerala Pilot',
      icon: '🛡️',
      content:
        'A standardized disaster management decision-support system enabling officers to generate defensible hazard, vulnerability, exposure, and composite risk assessments without GIS training.',
      highlights: [
        'Multi-hazard coverage: Floods, Coastal hazards, Landslides, Droughts',
        'Standardized 4-band classification: NH, LH, MH, and HH',
        'Defensible mathematical scoring and relative neighbor analysis',
      ],
    },
    {
      title: '1. Structured Query & Scoring Engine',
      badge: 'Step 1: Configure & Weight',
      icon: '⚙️',
      content:
        'Select your district and administrative resolution (Block or Grama Panchayat). Choose hazard layers, configure indicator weights, and get live preview scoring before persisting.',
      highlights: [
        'Spatial territory scoping based on your designated jurisdiction',
        'Save queries as templates to re-run with future seasonal data',
        'Cross-departmental data contribution (IMD, GSI, Census, PWD)',
      ],
    },
    {
      title: '2. The Three Connected Outputs',
      badge: 'Step 2: Continuous Journey',
      icon: '🗺️',
      content:
        'Every assessment progresses along a 3-tab journey so results and reports are always connected:',
      highlights: [
        '1. Thematic Map: Raw spatial hazard polygons, lines & historical events',
        '2. Administrative Classification Map: Choropleth NH/LH/MH/HH with attribute table',
        '3. Chapter-wise Report: Auto-compiled narrative with maps & PDF export',
      ],
    },
    {
      title: '3. Task Force Governance & Composite Risk',
      badge: 'Step 3: Multi-Module & Review',
      icon: '🏛️',
      content:
        'Domain departments assess Hazard, Vulnerability, and Exposure at the source. Combine them into Composite Risk (H × V × E) and submit for official Task Force endorsement.',
      highlights: [
        'Risk Builder: weighted geometric mean across completed modules',
        'Task Force Review Queue: formal review, endorsement, and audit trail',
        'Compare Dashboards: benchmark risk across neighboring districts',
      ],
    },
  ];

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((c) => c + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem('hvra_onboarding_completed', 'true');
    onClose();
  };

  const handleStartAssessment = () => {
    handleFinish();
    navigate('/new-assessment?module=HAZARD');
  };

  return (
    <div className="onboard-overlay" onClick={onClose}>
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="onboard-header">
          <div className="onboard-badge">{step.badge}</div>
          <button className="onboard-close-btn" onClick={onClose} aria-label="Close Tour">×</button>
        </div>

        <div className="onboard-body">
          <div className="onboard-icon-wrapper">
            <span className="onboard-icon">{step.icon}</span>
          </div>

          <h3 className="onboard-title">{step.title}</h3>
          <p className="onboard-desc">{step.content}</p>

          <div className="onboard-highlights">
            {step.highlights.map((h, i) => (
              <div key={i} className="onboard-highlight-item">
                <span className="onboard-check">✓</span>
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="onboard-footer">
          <div className="onboard-dots">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`onboard-dot ${i === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(i)}
              />
            ))}
          </div>

          <div className="onboard-actions">
            {currentStep > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentStep((c) => c - 1)}>
                Back
              </button>
            )}
            {currentStep === steps.length - 1 ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={handleFinish}>
                  Go to Dashboard
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleStartAssessment}>
                  Run First Assessment →
                </button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleNext}>
                Next Step →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
