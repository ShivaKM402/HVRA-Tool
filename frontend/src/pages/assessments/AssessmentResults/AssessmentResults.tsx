/**
 * Assessment Results Shell — 3 Connected Steps / Tabs
 * Step 1: Thematic Map (Raw hazard layer + historical events)
 * Step 2: Administrative Classification Map (Choropleth NH/LH/MH/HH + attribute table + unit detail)
 * Step 3: Chapter-wise Report (Narrative + export + submit for review)
 */
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAssessment, getAssessmentResults, deleteAssessment } from '@/services/api';
import type { Assessment, AssessmentResultsResponse, AssessmentResult } from '@/types';
import ResultsMap from '@/components/Map/ResultsMap';
import ResultsTable from './ResultsTable';
import ReportView from './ReportView';
import UnitDetailModal from '@/components/Modals/UnitDetailModal';
import ExportModal from '@/components/Modals/ExportModal';
import ReviewModal from '@/components/Modals/ReviewModal';
import './AssessmentResults.css';

const CLASSIFICATION_COLORS: Record<string, string> = {
  NH: '#64748b',
  LH: '#0d9488',
  MH: '#d97706',
  HH: '#e11d48',
};

export default function AssessmentResults() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active step: 'map' | 'classification' | 'report'
  const stepParam = searchParams.get('tab') || searchParams.get('step') || 'map';
  const [activeStep, setActiveStep] = useState<'map' | 'classification' | 'report'>(
    stepParam === 'report' ? 'report' : stepParam === 'classification' ? 'classification' : 'map'
  );

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [resultsData, setResultsData] = useState<AssessmentResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unit detail modal state
  const [selectedUnit, setSelectedUnit] = useState<AssessmentResult | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  // Export & Review modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleDeleteThisAssessment = async () => {
    if (!assessment) return;
    if (!window.confirm(`Are you sure you want to delete assessment "${assessment.name}"?\n\nThis will permanently delete this assessment, classification results, and maps.`)) {
      return;
    }
    try {
      await deleteAssessment(assessment.id);
      navigate('/reports');
    } catch (err: any) {
      alert(`Failed to delete assessment: ${err.message || 'Error occurred'}`);
    }
  };

  useEffect(() => {
    if (stepParam === 'map' || stepParam === 'classification' || stepParam === 'report') {
      setActiveStep(stepParam);
    }
  }, [stepParam]);

  const setStep = (step: 'map' | 'classification' | 'report') => {
    setActiveStep(step);
    setSearchParams({ tab: step });
  };

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const assessmentId = parseInt(id, 10);
        const [details, res] = await Promise.all([
          getAssessment(assessmentId),
          getAssessmentResults(assessmentId),
        ]);
        setAssessment(details);
        setResultsData(res);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load assessment results.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleUnitClick = (result: AssessmentResult) => {
    setSelectedUnit(result);
    setSelectedBlockId(result.administrative_unit);
    setIsUnitModalOpen(true);
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading assessment results...</span>
      </div>
    );
  }

  if (error || !assessment || !resultsData) {
    return (
      <div className="alert alert-error" style={{ margin: '2rem' }}>
        <span>⚠️</span>
        <div>{error || 'No assessment data found.'}</div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <Link to="/new-assessment" className="btn btn-primary btn-sm">Start New Query</Link>
          <Link to="/dashboard" className="btn btn-secondary btn-sm">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Distribution chart data
  const chartData = [
    { name: 'HH', count: resultsData.classification_summary?.['HH'] || 0, color: CLASSIFICATION_COLORS.HH, label: 'High (HH)' },
    { name: 'MH', count: resultsData.classification_summary?.['MH'] || 0, color: CLASSIFICATION_COLORS.MH, label: 'Moderate (MH)' },
    { name: 'LH', count: resultsData.classification_summary?.['LH'] || 0, color: CLASSIFICATION_COLORS.LH, label: 'Low (LH)' },
    { name: 'NH', count: resultsData.classification_summary?.['NH'] || 0, color: CLASSIFICATION_COLORS.NH, label: 'No Hazard (NH)' },
  ];

  return (
    <div className="results-shell">
      {/* Top Breadcrumb & Status Bar */}
      <div className="results-header-card">
        <div className="results-meta-row">
          <div>
            <div className="results-breadcrumb-text">
              <Link to="/dashboard">Dashboard</Link> /{' '}
              <Link to={`/new-assessment?module=${assessment.module_type}`}>
                {assessment.module_type} Assessment
              </Link>{' '}
              / <span>{assessment.district_name || 'District'}</span>
            </div>
            <h1 className="results-title">
              {assessment.name}
              <span className={`badge ${assessment.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                {assessment.status}
              </span>
              <span
                className="badge"
                style={{
                  background: assessment.approval_status === 'APPROVED' ? '#dcfce7' : assessment.approval_status === 'SUBMITTED' ? '#fef3c7' : '#f1f5f9',
                  color: assessment.approval_status === 'APPROVED' ? '#15803d' : assessment.approval_status === 'SUBMITTED' ? '#b45309' : '#475569',
                }}
              >
                Task Force: {assessment.approval_status || 'PENDING'}
              </span>
            </h1>
          </div>

          <div className="results-action-group">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsExportModalOpen(true)}
            >
              📥 Export Dossier
            </button>
            {assessment.approval_status !== 'APPROVED' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setIsReviewModalOpen(true)}
              >
                🏛️ Submit for Review
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDeleteThisAssessment}
              style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
              title="Permanently Delete Assessment"
            >
              🗑️ Delete
            </button>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">
              Dashboard Home
            </Link>
          </div>
        </div>

        {/* 3-Step Journey Indicator (MANDATORY per spec §4) */}
        <div className="journey-indicator-bar" role="tablist" aria-label="Assessment Journey Steps">
          <button
            role="tab"
            aria-selected={activeStep === 'map'}
            className={`journey-step ${activeStep === 'map' ? 'active' : ''}`}
            onClick={() => setStep('map')}
          >
            <span className="step-num">1</span>
            <div className="step-text">
              <div className="step-title">Thematic Map</div>
              <div className="step-sub">Raw hazard layers & events</div>
            </div>
          </button>

          <div className="journey-arrow">→</div>

          <button
            role="tab"
            aria-selected={activeStep === 'classification'}
            className={`journey-step ${activeStep === 'classification' ? 'active' : ''}`}
            onClick={() => setStep('classification')}
          >
            <span className="step-num">2</span>
            <div className="step-text">
              <div className="step-title">Administrative Classification</div>
              <div className="step-sub">NH / LH / MH / HH choropleth</div>
            </div>
          </button>

          <div className="journey-arrow">→</div>

          <button
            role="tab"
            aria-selected={activeStep === 'report'}
            className={`journey-step ${activeStep === 'report' ? 'active' : ''}`}
            onClick={() => setStep('report')}
          >
            <span className="step-num">3</span>
            <div className="step-text">
              <div className="step-title">Chapter-wise Report</div>
              <div className="step-sub">Official narrative & PDF</div>
            </div>
          </button>
        </div>
      </div>

      {/* STEP 1: THEMATIC MAP */}
      {activeStep === 'map' && (
        <div className="step-content-view">
          <div className="step-guidance-banner">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                Step 1: Thematic Map & Raw Hazard Footprint
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                Review the raw spatial extent of inundation polygons, fault lines, cyclone tracks, and historical disaster events plotted over administrative boundaries before relative normalization.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setStep('classification')}>
              Proceed to Classification →
            </button>
          </div>

          <div className="card" style={{ padding: '0.5rem', minHeight: '590px' }}>
            <ResultsMap

              assessmentId={assessment.id}
              selectedBlockId={selectedBlockId}
              onBlockSelect={(bId) => setSelectedBlockId(bId)}
              resultsData={resultsData.results}
              mode="thematic"
            />
          </div>

          <div className="step-footer-cta">
            <Link to={`/new-assessment?module=${assessment.module_type}`} className="btn btn-secondary">
              ← Edit Query Parameters
            </Link>
            <button className="btn btn-primary" onClick={() => setStep('classification')}>
              Proceed to Classification Map →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ADMINISTRATIVE CLASSIFICATION MAP */}
      {activeStep === 'classification' && (
        <div className="step-content-view">
          <div className="step-guidance-banner">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                Step 2: Administrative Classification Map (Relative to Neighbours)
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                Each administrative unit is shaded into 4 colorblind-safe bands (NH, LH, MH, HH) relative to neighbouring units in {assessment.district_name || 'the district'}. Click any unit on the map or table for deep attribution.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setStep('report')}>
              Send to Report →
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total Units Assessed</div>
              <div className="kpi-value">{resultsData.total_units}</div>
              <div className="kpi-sub">{assessment.administrative_level} Level</div>
            </div>
            <div className="kpi-card kpi-hh">
              <div className="kpi-label">High Hazard (HH)</div>
              <div className="kpi-value">{resultsData.classification_summary?.['HH'] || 0}</div>
              <div className="kpi-sub">Priority Intervention</div>
            </div>
            <div className="kpi-card kpi-mh">
              <div className="kpi-label">Moderate Hazard (MH)</div>
              <div className="kpi-value">{resultsData.classification_summary?.['MH'] || 0}</div>
              <div className="kpi-sub">Heightened Vigilance</div>
            </div>
            <div className="kpi-card kpi-lh">
              <div className="kpi-label">Low Hazard (LH)</div>
              <div className="kpi-value">{resultsData.classification_summary?.['LH'] || 0}</div>
              <div className="kpi-sub">Standard Monitoring</div>
            </div>
            <div className="kpi-card kpi-nh">
              <div className="kpi-label">No Hazard (NH)</div>
              <div className="kpi-value">{resultsData.classification_summary?.['NH'] || 0}</div>
              <div className="kpi-sub">Baseline Exposure</div>
            </div>
          </div>

          {/* Map + Distribution side-by-side */}
          <div className="classification-map-grid">
            <div className="card" style={{ padding: '0.5rem', flex: 2, minHeight: '590px' }}>
              <ResultsMap

                assessmentId={assessment.id}
                selectedBlockId={selectedBlockId}
                onBlockSelect={(bId) => {
                  setSelectedBlockId(bId);
                  const found = resultsData.results.find((r) => r.administrative_unit === bId);
                  if (found) {
                    setSelectedUnit(found);
                    setIsUnitModalOpen(true);
                  }
                }}
                resultsData={resultsData.results}
                mode="classification"
              />
            </div>

            <div className="card" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#0f172a' }}>
                Classification Distribution
              </h3>
              <div style={{ flex: 1, minHeight: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val, _name, item) => [`${val} Units`, item.payload.label]}
                      contentStyle={{ borderRadius: 8, fontSize: '0.8rem', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                💡 <em>Click any administrative unit on the map or in the table below to inspect its raw values and neighbor percentiles.</em>
              </div>
            </div>
          </div>

          {/* Attribute Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#0f172a' }}>
              Unit Attribute Table & Scoring Breakdown
            </h3>
            <ResultsTable
              results={resultsData.results}
              selectedBlockId={selectedBlockId}
              onBlockSelect={(bId: number | null) => {
                setSelectedBlockId(bId);
                if (bId !== null) {
                  const found = resultsData.results.find((r) => r.administrative_unit === bId);
                  if (found) handleUnitClick(found);
                }
              }}
            />
          </div>

          <div className="step-footer-cta">
            <button className="btn btn-secondary" onClick={() => setStep('map')}>
              ← Back to Thematic Map
            </button>
            <button className="btn btn-primary" onClick={() => setStep('report')}>
              Send to Chapter-wise Report →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CHAPTER-WISE REPORT */}
      {activeStep === 'report' && (
        <div className="step-content-view">
          <div className="step-guidance-banner">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                Step 3: Chapter-wise Narrative Report & Dossier
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                Auto-compiled comprehensive report with executive summary, hazard intensity classifications, spatial thematic maps, recommendations, and annexures.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsExportModalOpen(true)}>
                📥 Export Dossier
              </button>
              {assessment.approval_status !== 'APPROVED' && (
                <button className="btn btn-primary btn-sm" onClick={() => setIsReviewModalOpen(true)}>
                  🏛️ Submit for Review
                </button>
              )}
            </div>
          </div>

          {/* Embed the ReportView */}
          <ReportView />

          <div className="step-footer-cta">
            <button className="btn btn-secondary" onClick={() => setStep('classification')}>
              ← Back to Classification Map
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/dashboard" className="btn btn-secondary">
                Back to Dashboard
              </Link>
              <Link to="/reports" className="btn btn-primary">
                View All Reports Gallery →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <UnitDetailModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        result={selectedUnit}
        totalUnits={resultsData.total_units}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        assessmentId={assessment.id}
        assessmentName={assessment.name}
      />

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        mode="submit"
        assessmentId={assessment.id}
        assessmentName={assessment.name}
        onSuccess={(status) => {
          setAssessment((prev) => (prev ? { ...prev, approval_status: status as any } : prev));
        }}
      />
    </div>
  );
}
