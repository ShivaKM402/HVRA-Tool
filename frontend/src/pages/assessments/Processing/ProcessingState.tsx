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

    // Initial check of assessment
    getAssessment(assessmentId)
      .then((a) => {
        setAssessmentName(a.name);
        if (a.status === 'COMPLETED') {
          handleSuccess(a.name);
        }
      })
      .catch((err) => {
        console.warn('Initial check failed', err);
      });

    // Step animation timer
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          handleSuccess(assessmentName);
          return prev;
        }
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [id]);

  const handleSuccess = (name: string) => {
    setCompleted(true);
    showToast({
      title: 'Assessment Processing Completed',
      message: `"${name}" calculation complete. Proceeding to Thematic Map.`,
      type: 'success',
      link: `/assessments/${id}/results?tab=map`,
    });

    // Auto redirect after a brief moment
    setTimeout(() => {
      navigate(`/assessments/${id}/results?tab=map`);
    }, 1000);
  };

  return (
    <div className="processing-container">
      <div className="processing-card">
        <div className="processing-header">
          <div className="spinner-large" />
          <h2 className="processing-title">Generating Assessment: {assessmentName}</h2>
          <p className="processing-desc">
            The mathematical scoring and GIS intersection engine is running defensible spatial algorithms for your selected territory.
          </p>
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
            {completed ? '✓ Processing complete. Redirecting...' : 'Please wait while calculations finish...'}
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
