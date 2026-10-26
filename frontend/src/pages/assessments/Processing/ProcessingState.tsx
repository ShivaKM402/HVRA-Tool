/**
 * Processing State Page
 * Enters from Query Builder on submit.
 * Animates processing stages and auto-redirects to Results Map tab upon completion.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getAssessment } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import './ProcessingState.css';

export default function ProcessingState() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [assessmentName, setAssessmentName] = useState('Assessment');
  const [progressPercent, setProgressPercent] = useState(20);
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  const steps = [
    { id: 1, label: 'Ingesting Administrative Boundaries & GIS Layers', desc: 'Fetching block & panchayat polygons for district geometry' },
    { id: 2, label: 'Executing Spatial Intersections & Buffering', desc: 'Computing raw hazard polygon overlay and historical event proximity' },
    { id: 3, label: 'Indicator Weighting & Min-Max Normalization', desc: 'Applying mathematical scoring engine across all indicators' },
    { id: 4, label: 'Relative-to-Neighbours Classification', desc: 'Partitioning distribution into NH, LH, MH, and HH bands' },
    { id: 5, label: 'Compiling Dossier & Spatial Thematic Maps', desc: 'Finalizing assessment results and report metadata' },
  ];

  useEffect(() => {
    if (!id) return;
    const assessmentId = parseInt(id, 10);

    // Load actual assessment name in background without cutting the animation
    getAssessment(assessmentId)
      .then((a) => {
        if (a && a.name) {
          setAssessmentName(a.name);
        }
      })
      .catch((err) => {
        console.warn('Initial check failed', err);
      });

    // 5-second realistic generation progression (1,000ms per step = 5 seconds)
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep += 1;
      if (currentStep < steps.length) {
        setCurrentStepIndex(currentStep);
        setProgressPercent(Math.min(100, (currentStep + 1) * 20));
        setSecondsRemaining(Math.max(1, 5 - currentStep));
      } else {
        clearInterval(interval);
        setCurrentStepIndex(steps.length);
        setProgressPercent(100);
        setSecondsRemaining(0);
        setCompleted(true);

        showToast({
          title: 'Assessment Processing Completed ✓',
          message: 'Spatial calculation complete. Proceeding to Thematic Map.',
          type: 'success',
          link: `/assessments/${id}/results?tab=map`,
        });

        // Redirect smoothly after reaching 100%
        setTimeout(() => {
          navigate(`/assessments/${id}/results?tab=map`);
        }, 800);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [id, navigate, showToast]);

  return (
    <div className="processing-container">
      <div className="processing-card">
        <div className="processing-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div className="radar-screen" style={{ width: 88, height: 88 }}>
              <div className="radar-beam" />
              <div className="radar-ping-ring" />
              <div className="radar-center-blip" />
            </div>
          </div>
          <h2 className="processing-title">Generating Assessment: {assessmentName}</h2>
          <p className="processing-desc">
            The mathematical scoring and GIS intersection engine is running defensible spatial algorithms for your selected territory.
          </p>

          {/* 5-Second Generation Progress Bar */}
          <div className="processing-progress-wrap">
            <div className="processing-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="processing-progress-meta">
            <span>Spatial Computation: {progressPercent}%</span>
            <span>{completed ? '✓ Complete' : `~${secondsRemaining}s remaining`}</span>
          </div>
        </div>

        <div className="processing-steps">
          {steps.map((s, idx) => {
            const isDone = idx < currentStepIndex || completed;
            const isCurrent = idx === currentStepIndex && !completed;
            return (
              <div key={s.id} className={`processing-step-item ${isDone ? 'done' : isCurrent ? 'current' : ''}`}>
                <div className="step-circle">
                  {isDone ? '✓' : isCurrent ? <div className="spinner-tiny" /> : s.id}
                </div>
                <div className="step-info">
                  <div className="step-name">{s.label}</div>
                  <div className="step-detail">{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="processing-footer">
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {completed ? '✓ Processing complete. Redirecting to Spatial Results…' : 'Executing 5-stage GIS scoring engine (5s)...'}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to={`/assessments/${id}/results?tab=map`} className="btn btn-primary btn-sm">
              Skip Directly to Results →
            </Link>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">
              Run in Background
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

