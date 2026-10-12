import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getDepartmentSubmissions, postDepartmentSubmission } from '@/services/api';
import type { DepartmentSubmissionsResponse, DepartmentItem } from '@/types';
import { useToast } from '@/context/ToastContext';

interface DepartmentCoordinationTabProps {
  assessmentId: number;
  onRefresh: () => void;
}

const VERIFICATION_SOURCES = [
  '📡 Automated River Gauge Telemetry (CWC / Irrigation)',
  '📋 Field Ground Survey & Grama Panchayat GPS Log',
  '🏛️ Official Cadastral Register & Town Planning GIS',
  '🛰️ Satellite Radar (Sentinel-1 SAR) & Drone DEM',
  '📑 Inter-Agency Joint Multi-Department Inspection',
];

function getDefaultDesignation(department: string): string {
  if (department.includes('Irrigation') || department.includes('Water Resources')) {
    return 'Executive Engineer (Hydrology & Flood Control)';
  }
  if (department.includes('LSGD') || department.includes('Panchayat')) {
    return 'Assistant Director of Panchayats / Town Planning Officer';
  }
  if (department.includes('PWD') || department.includes('Public Works')) {
    return 'Executive Engineer (PWD Roads & Bridges)';
  }
  if (department.includes('Health')) {
    return 'District Medical Officer (DMO) / Health Disaster Officer';
  }
  if (department.includes('Economics') || department.includes('Statistics')) {
    return 'Deputy Director of Economics & Statistics';
  }
  return 'District Disaster Management Officer / Hazard Analyst';
}

function getDefaultSource(department: string): string {
  if (department.includes('Irrigation') || department.includes('Water Resources')) {
    return VERIFICATION_SOURCES[0];
  }
  if (department.includes('LSGD') || department.includes('Panchayat')) {
    return VERIFICATION_SOURCES[1];
  }
  if (department.includes('PWD') || department.includes('Public Works')) {
    return VERIFICATION_SOURCES[2];
  }
  if (department.includes('Health')) {
    return VERIFICATION_SOURCES[2];
  }
  return VERIFICATION_SOURCES[2];
}

function getDefaultNotes(department: string): string {
  if (department.includes('Irrigation') || department.includes('Water Resources')) {
    return 'Cross-verified with CWC hydrological river discharge gauge stations and monsoon flood level logs.';
  }
  if (department.includes('LSGD') || department.includes('Panchayat')) {
    return 'Validated by Village Extension Officers (VEO) and local Panchayat building spatial records.';
  }
  if (department.includes('PWD')) {
    return 'Audited against state highway and major district road flood inundation reports.';
  }
  if (department.includes('Health')) {
    return 'Emergency health access gap assessed against primary and community health centres during peak inundation.';
  }
  return 'Verified and endorsed as per official departmental field survey logs.';
}

export default function DepartmentCoordinationTab({ assessmentId, onRefresh }: DepartmentCoordinationTabProps) {
  const { showToast } = useToast();
  const [data, setData] = useState<DepartmentSubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<DepartmentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeMode, setActiveMode] = useState<'PARALLEL' | 'SEQUENTIAL'>('PARALLEL');

  // Input granularity: 'UNIFORM' (district-wide) or 'PER_UNIT' (per-Panchayat)
  const [entryGranularity, setEntryGranularity] = useState<'UNIFORM' | 'PER_UNIT'>('UNIFORM');

  // Modal form states
  const [indicatorValues, setIndicatorValues] = useState<Record<number, string>>({});
  // Per-unit values: { [indicator_id]: { [unit_id]: string } }
  const [unitIndicatorValues, setUnitIndicatorValues] = useState<Record<number, Record<number, string>>>({});
  const [officerName, setOfficerName] = useState('');
  const [designation, setDesignation] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await getDepartmentSubmissions(assessmentId);
      setData(res);
      setActiveMode(res.coordination_mode || 'PARALLEL');
    } catch (err: any) {
      console.error('Failed to load departmental submissions:', err);
      showToast({
        title: 'Coordination Data Error',
        message: err.message || 'Could not load departmental tracking data.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [assessmentId]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (selectedDept) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedDept]);

  const handleModeSwitch = async (newMode: 'PARALLEL' | 'SEQUENTIAL') => {
    try {
      setActiveMode(newMode);
      if (data && data.departments.length > 0) {
        await postDepartmentSubmission(assessmentId, {
          department: data.departments[0].department,
          coordination_mode: newMode,
        });
        showToast({
          title: 'Coordination Mode Updated',
          message: `Switched workflow to ${newMode === 'PARALLEL' ? 'Simultaneous (Parallel)' : 'Sequential Handover'} mode.`,
          type: 'success',
        });
        fetchSubmissions();
      }
    } catch (err: any) {
      showToast({
        title: 'Update Error',
        message: err.message || 'Could not update coordination mode.',
        type: 'error',
      });
    }
  };

  const handleOpenSubmit = (dept: DepartmentItem) => {
    setSelectedDept(dept);
    setEntryGranularity('UNIFORM');

    // Initialize uniform indicator values
    const initialVals: Record<number, string> = {};
    const initialUnitVals: Record<number, Record<number, string>> = {};

    dept.indicators.forEach((ind) => {
      initialVals[ind.indicator_id] =
        ind.current_value !== null && ind.current_value !== undefined ? String(ind.current_value) : '';

      initialUnitVals[ind.indicator_id] = {};
      if (data?.administrative_units) {
        data.administrative_units.forEach((u) => {
          const val = ind.unit_values?.[u.id];
          initialUnitVals[ind.indicator_id][u.id] =
            val !== null && val !== undefined ? String(val) : (ind.current_value !== null && ind.current_value !== undefined ? String(ind.current_value) : '');
        });
      }
    });

    setIndicatorValues(initialVals);
    setUnitIndicatorValues(initialUnitVals);

    // Initialize credentials & notes
    setOfficerName(dept.officer_name || dept.submitted_by || '');
    setDesignation(dept.designation || getDefaultDesignation(dept.department));
    setSourceType(dept.source_type || getDefaultSource(dept.department));
    setAttachmentName(dept.attachment_name || '');
    setSubmissionNotes(dept.notes || getDefaultNotes(dept.department));
  };

  const handleUniformChange = (indicatorId: number, val: string) => {
    setIndicatorValues((prev) => ({
      ...prev,
      [indicatorId]: val,
    }));
  };

  const handlePerUnitChange = (indicatorId: number, unitId: number, val: string) => {
    setUnitIndicatorValues((prev) => ({
      ...prev,
      [indicatorId]: {
        ...(prev[indicatorId] || {}),
        [unitId]: val,
      },
    }));
  };

  const handleCopyUniformToUnits = (indicatorId: number) => {
    const uniformVal = indicatorValues[indicatorId];
    if (uniformVal === undefined || uniformVal === '') return;
    if (!data?.administrative_units) return;

    setUnitIndicatorValues((prev) => {
      const updatedUnitMap: Record<number, string> = {};
      data.administrative_units!.forEach((u) => {
        updatedUnitMap[u.id] = uniformVal;
      });
      return {
        ...prev,
        [indicatorId]: updatedUnitMap,
      };
    });

    showToast({
      title: 'Values Copied',
      message: `Applied ${uniformVal} to all ${data.administrative_units.length} Panchayats.`,
      type: 'info',
    });
  };

  const handleConfirmSubmit = async () => {
    if (!selectedDept) return;
    try {
      setSubmitting(true);

      const submittedValuesList: Array<{ indicator_id: number; raw_value: number; administrative_unit_id?: number }> = [];

      if (entryGranularity === 'PER_UNIT' && data?.administrative_units) {
        // Collect per-unit values
        selectedDept.indicators.forEach((ind) => {
          const unitMap = unitIndicatorValues[ind.indicator_id] || {};
          data.administrative_units!.forEach((u) => {
            const rawStr = (unitMap[u.id] ?? '').trim();
            if (rawStr !== '') {
              const num = parseFloat(rawStr);
              if (!isNaN(num)) {
                submittedValuesList.push({
                  indicator_id: ind.indicator_id,
                  administrative_unit_id: u.id,
                  raw_value: num,
                });
              }
            }
          });
        });
      } else {
        // Collect district-wide uniform values
        Object.entries(indicatorValues).forEach(([idStr, valStr]) => {
          const trimmed = valStr.trim();
          if (trimmed !== '') {
            const num = parseFloat(trimmed);
            if (!isNaN(num)) {
              submittedValuesList.push({
                indicator_id: parseInt(idStr, 10),
                raw_value: num,
              });
            }
          }
        });
      }

      await postDepartmentSubmission(assessmentId, {
        department: selectedDept.department,
        coordination_mode: activeMode,
        officer_name: officerName.trim() || 'Department Officer',
        designation: designation.trim(),
        source_type: sourceType,
        attachment_name: attachmentName,
        notes: submissionNotes.trim() || `Verified and endorsed by ${selectedDept.department}`,
        submitted_values: submittedValuesList,
      });

      showToast({
        title: 'Department Data Successfully Saved',
        message: `Verified data and indicator readings recorded for ${selectedDept.department}. Hazard calculations updated!`,
        type: 'success',
      });

      setSelectedDept(null);
      await fetchSubmissions();
      onRefresh();
    } catch (err: any) {
      showToast({
        title: 'Submission Failed',
        message: err.message || 'Could not record departmental data.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <span>Loading departmental tracking and coordination status...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="alert alert-warning" style={{ margin: '1.5rem' }}>
        <span>⚠️</span>
        <div>No departmental coordination mapping available for this assessment.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Overview & Coordination Mode Header */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(60, 64, 67, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🏛️</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                Flood Hazard Inter-Agency Coordination Portal
              </h3>
              <span className={`badge ${data.all_submitted ? 'badge-success' : 'badge-warning'}`}>
                {data.submitted_departments} of {data.total_departments} Departments Completed
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', maxWidth: '780px', lineHeight: 1.4 }}>
              Responsible line departments (Water Resources, LSGD, PWD, Health, and Economics & Statistics) submit and certify indicator readings. Inputted measurements feed directly into the Flood Risk Model and eliminate data gaps.
            </p>
          </div>

          {/* Coordination Mode Toggle */}
          <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
              Submission Order
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === 'PARALLEL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleModeSwitch('PARALLEL')}
                title="All departments can submit data at any time"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
              >
                ⚡ Any Time (Simultaneous)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === 'SEQUENTIAL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleModeSwitch('SEQUENTIAL')}
                title="Departments submit one after another in order"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
              >
                🔄 In Order (Sequential)
              </button>
            </div>
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Assigned Line Departments</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{data.total_departments}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Data Submitted & Certified</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>{data.submitted_departments}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Pending Submissions</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: data.total_departments - data.submitted_departments > 0 ? '#d97706' : '#16a34a' }}>
              {data.total_departments - data.submitted_departments}
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Overall Completeness</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a73e8' }}>
              {data.total_departments > 0 ? Math.round((data.submitted_departments / data.total_departments) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Department Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {data.departments.map((dept, index) => {
          const isSubmitted = dept.status === 'SUBMITTED';
          return (
            <div
              key={dept.department}
              className="card"
              style={{
                padding: '1.25rem 1.5rem',
                borderLeft: isSubmitted ? '5px solid #16a34a' : dept.can_submit ? '5px solid #d97706' : '5px solid #94a3b8',
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(60, 64, 67, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '1.15rem' }}>🏛️</span>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                      {dept.department}
                    </h4>
                    <span className={`badge ${isSubmitted ? 'badge-success' : 'badge-warning'}`}>
                      {isSubmitted ? '✓ SUBMITTED' : '⏳ PENDING SUBMISSION'}
                    </span>
                    {activeMode === 'SEQUENTIAL' && (
                      <span className="badge badge-draft" style={{ fontSize: '0.7rem' }}>
                        Step #{index + 1}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                    {isSubmitted && dept.submitted_at ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                        <span>
                          Verified by <strong>{dept.officer_name || dept.submitted_by || 'Department Officer'}</strong>
                          {dept.designation ? ` (${dept.designation})` : ''}
                        </span>
                        <span>•</span>
                        <span>{new Date(dept.submitted_at).toLocaleString('en-GB')}</span>
                        {dept.source_type && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#0284c7' }}>{dept.source_type}</span>
                          </>
                        )}
                        {dept.attachment_name && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#16a34a' }}>📎 {dept.attachment_name}</span>
                          </>
                        )}
                      </div>
                    ) : dept.can_submit ? (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>
                        ● Action required: Awaiting departmental indicator data input and sign-off.
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>
                        🔒 Locked: Handover sequence waiting for preceding department ({data.departments[index - 1]?.department}) submission.
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${isSubmitted ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleOpenSubmit(dept)}
                    disabled={!dept.can_submit}
                    style={{ fontSize: '0.82rem' }}
                  >
                    {isSubmitted ? '✏️ Edit / Re-verify Data' : '✍️ Input & Submit Data'}
                  </button>
                </div>
              </div>

              {/* Department Indicators Breakdown */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.6rem' }}>
                  ASSIGNED FLOOD INDICATORS ({dept.indicators.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {dept.indicators.map((ind) => (
                    <div
                      key={ind.indicator_id}
                      style={{
                        background: '#fff',
                        padding: '0.75rem 0.9rem',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{ind.name}</div>
                        {ind.current_value !== null && ind.current_value !== undefined ? (
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#1a73e8',
                              background: '#eff6ff',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 4,
                              fontSize: '0.8rem',
                            }}
                          >
                            {ind.current_value} {ind.unit}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: '#d97706',
                              background: '#fffbeb',
                              padding: '0.15rem 0.45rem',
                              borderRadius: 4,
                            }}
                          >
                            Pending Entry
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>
                        <span>Code: <code>{ind.code}</code></span>
                        <span>Unit: <strong>{ind.unit}</strong></span>
                        <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Weight: {ind.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {dept.notes && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#475569', background: '#f1f5f9', padding: '0.55rem 0.85rem', borderRadius: 6 }}>
                  📝 <strong>Officer Sign-off Notes:</strong> {dept.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Streamlined Submission Modal rendered via React Portal */}
      {selectedDept &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              padding: '1.25rem',
              boxSizing: 'border-box',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) {
                setSelectedDept(null);
              }
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                width: '100%',
                maxWidth: '720px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '1.15rem 1.5rem',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>✍️</span> Department Data Sign-off: {selectedDept.department}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Enter official measurements, select verification channel, and digitally sign-off.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !submitting && setSelectedDept(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.35rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '0.25rem 0.5rem',
                    lineHeight: 1,
                  }}
                  title="Close Modal"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div
                style={{
                  padding: '1.35rem 1.5rem',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* Granularity Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    Data Entry Scope:
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${entryGranularity === 'UNIFORM' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setEntryGranularity('UNIFORM')}
                      style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                    >
                      ⚡ Quick District-wide Average
                    </button>
                    {data.administrative_units && data.administrative_units.length > 0 && (
                      <button
                        type="button"
                        className={`btn btn-sm ${entryGranularity === 'PER_UNIT' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setEntryGranularity('PER_UNIT')}
                        style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                      >
                        🏘️ Per-Panchayat Breakdown ({data.administrative_units.length} units)
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 1: Assigned Indicators Entry */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                    1. Assigned Flood Indicator Readings
                  </div>

                  {entryGranularity === 'UNIFORM' ? (
                    /* Uniform / District-Wide Input Cards */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {selectedDept.indicators.map((ind) => (
                        <div
                          key={ind.indicator_id}
                          style={{
                            background: '#f8fafc',
                            padding: '0.75rem 0.95rem',
                            borderRadius: 10,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                                {ind.name}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.45rem' }}>
                                (<code>{ind.code}</code>)
                              </span>
                            </div>
                            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                              Weight: {ind.weight}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <input
                                type="number"
                                step="any"
                                className="form-control"
                                placeholder={`Enter validated reading for ${ind.name}`}
                                value={indicatorValues[ind.indicator_id] ?? ''}
                                onChange={(e) => handleUniformChange(ind.indicator_id, e.target.value)}
                                style={{
                                  width: '100%',
                                  fontSize: '0.9rem',
                                  fontWeight: 600,
                                  paddingRight: '4.5rem',
                                  background: '#ffffff',
                                }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  right: '0.75rem',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: '0.78rem',
                                  color: '#64748b',
                                  fontWeight: 600,
                                  pointerEvents: 'none',
                                }}
                              >
                                {ind.unit}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                              Baseline:{' '}
                              <strong>
                                {ind.current_value !== null && ind.current_value !== undefined
                                  ? `${ind.current_value} ${ind.unit}`
                                  : 'Pending'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Granular Per-Panchayat Table */
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                                Grama Panchayat / Block
                              </th>
                              {selectedDept.indicators.map((ind) => (
                                <th key={ind.indicator_id} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                                  {ind.name} ({ind.unit})
                                  <button
                                    type="button"
                                    onClick={() => handleCopyUniformToUnits(ind.indicator_id)}
                                    title="Copy District value to all Panchayats"
                                    style={{
                                      marginLeft: '0.4rem',
                                      fontSize: '0.68rem',
                                      background: '#e0e7ff',
                                      color: '#4338ca',
                                      border: 'none',
                                      borderRadius: 4,
                                      padding: '0.1rem 0.35rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Fill All
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.administrative_units?.map((u) => (
                              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>
                                  {u.name}
                                </td>
                                {selectedDept.indicators.map((ind) => (
                                  <td key={ind.indicator_id} style={{ padding: '0.35rem 0.75rem' }}>
                                    <input
                                      type="number"
                                      step="any"
                                      className="form-control"
                                      value={unitIndicatorValues[ind.indicator_id]?.[u.id] ?? ''}
                                      onChange={(e) => handlePerUnitChange(ind.indicator_id, u.id, e.target.value)}
                                      style={{ width: '100%', fontSize: '0.8rem', padding: '0.25rem 0.45rem' }}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Verification Source & Channel */}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.35rem' }}>
                    2. Official Data Source / Verification Channel
                  </label>
                  <select
                    className="form-control"
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    {VERIFICATION_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section 3: Officer Credentials & Attachment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
                      3. Officer Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Er. Suresh Kumar"
                      value={officerName}
                      onChange={(e) => setOfficerName(e.target.value)}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
                      Official Designation
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Executive Engineer"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Section 4: Document Evidence Attachment */}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.35rem' }}>
                    4. Supporting Document / Certified Survey Sheet
                  </label>
                  {attachmentName ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.85rem',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        color: '#166534',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📎</span>
                        <span>
                          <strong>{attachmentName}</strong> (Evidence Attached)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachmentName('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <label
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '0.76rem', cursor: 'pointer', margin: 0 }}
                      >
                        📁 Choose File (.xlsx, .csv, .pdf)
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.pdf,.geojson"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAttachmentName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setAttachmentName(`${selectedDept.department.replace(/[^a-zA-Z]/g, '_').substring(0, 16)}_Survey_2026.xlsx`)}
                        style={{ fontSize: '0.76rem' }}
                      >
                        + Sample Survey Log (.xlsx)
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 5: Sign-off Notes / Remarks */}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
                    5. Officer Remarks & Endorsement Notes
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Enter official validation remarks..."
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem', lineHeight: 1.4 }}
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div
                style={{
                  padding: '1rem 1.5rem',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  💡 Submitting updates flood risk score & certifies this department.
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedDept(null)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Recording Submission...' : 'Confirm Department Submission'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
