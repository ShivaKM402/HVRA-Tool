import { useState } from 'react';
import type { Assessment, AssessmentResult, ExpertRecalculatePayload } from '@/types';
import { expertRecalculateAssessment } from '@/services/api';
import { useToast } from '@/context/ToastContext';

interface ExpertRecalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: Assessment;
  results: AssessmentResult[];
  onSuccess: () => void;
}

interface ValueOverrideItem {
  indicator_id: number;
  indicator_code: string;
  indicator_name: string;
  administrative_unit_id: number;
  unit_name: string;
  current_raw_value: number | null;
  new_raw_value: number;
  reason: string;
}

export default function ExpertRecalibrationModal({
  isOpen,
  onClose,
  assessment,
  results,
  onSuccess,
}: ExpertRecalibrationModalProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'weights' | 'overrides'>('weights');

  // Weights state: map indicator id -> weight number
  const [weights, setWeights] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    if (assessment.indicators) {
      assessment.indicators.forEach((ind) => {
        initial[ind.indicator] = ind.weight ?? 5.0;
      });
    }
    return initial;
  });

  // Value overrides state
  const [valueOverrides, setValueOverrides] = useState<ValueOverrideItem[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | ''>('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<number | ''>('');
  const [newRawValInput, setNewRawValInput] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Extract unique administrative units from results
  const uniqueUnits = Array.from(
    new Map(
      results.map((r) => [r.administrative_unit, { id: r.administrative_unit, name: r.unit_name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const indicators = assessment.indicators || [];

  // Find currently selected unit and indicator raw value if applicable
  const currentUnitResult =
    selectedUnitId && selectedIndicatorId
      ? results.find(
          (r) =>
            r.administrative_unit === Number(selectedUnitId) &&
            r.indicator === Number(selectedIndicatorId)
        )
      : null;

  const handleWeightChange = (indicatorId: number, val: number) => {
    const clamped = Math.max(0, Math.min(10, val));
    setWeights((prev) => ({ ...prev, [indicatorId]: clamped }));
  };

  const handleAddValueOverride = () => {
    if (!selectedUnitId || !selectedIndicatorId) {
      showToast({
        title: 'Selection Required',
        message: 'Please choose both an administrative unit and an indicator.',
        type: 'warning',
      });
      return;
    }

    const numVal = parseFloat(newRawValInput);
    if (isNaN(numVal)) {
      showToast({
        title: 'Invalid Number',
        message: 'Please specify a valid numeric raw value.',
        type: 'warning',
      });
      return;
    }

    if (!overrideReason.trim()) {
      showToast({
        title: 'Justification Required',
        message: 'HVRA audit requirements mandate an expert rationale for data overrides.',
        type: 'warning',
      });
      return;
    }

    const unitObj = uniqueUnits.find((u) => u.id === Number(selectedUnitId));
    const indObj = indicators.find((i) => i.indicator === Number(selectedIndicatorId));

    const newItem: ValueOverrideItem = {
      indicator_id: Number(selectedIndicatorId),
      indicator_code: indObj?.indicator_code || '',
      indicator_name: indObj?.indicator_name || '',
      administrative_unit_id: Number(selectedUnitId),
      unit_name: unitObj?.name || '',
      current_raw_value: currentUnitResult?.raw_value ?? null,
      new_raw_value: numVal,
      reason: overrideReason.trim(),
    };

    // Filter out previous override for same unit and indicator if exists
    setValueOverrides((prev) => [
      ...prev.filter(
        (o) =>
          !(
            o.administrative_unit_id === newItem.administrative_unit_id &&
            o.indicator_id === newItem.indicator_id
          )
      ),
      newItem,
    ]);

    // Reset inputs
    setNewRawValInput('');
    setOverrideReason('');
    showToast({
      title: 'Override Queued',
      message: `Adjusted ${newItem.indicator_code} for ${newItem.unit_name}.`,
      type: 'info',
    });
  };

  const handleRemoveOverride = (unitId: number, indId: number) => {
    setValueOverrides((prev) =>
      prev.filter(
        (o) => !(o.administrative_unit_id === unitId && o.indicator_id === indId)
      )
    );
  };

  const handleSubmitRecalculation = async () => {
    try {
      setIsSubmitting(true);

      const payload: ExpertRecalculatePayload = {
        weight_overrides: weights,
        value_overrides: valueOverrides.map((o) => ({
          indicator_id: o.indicator_id,
          administrative_unit_id: o.administrative_unit_id,
          new_raw_value: o.new_raw_value,
          reason: o.reason,
        })),
      };

      await expertRecalculateAssessment(assessment.id, payload);

      showToast({
        title: 'Recalculation Complete',
        message: 'All unit hazard scores, rankings, and choropleth classes have been updated.',
        type: 'success',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Recalculation failed:', err);
      showToast({
        title: 'Recalculation Error',
        message: err.message || 'Could not recalculate assessment scores.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="modal-container"
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                Expert Review & Recalibration (HVRA §6)
              </h2>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  background: '#dbeafe',
                  color: '#1e40af',
                }}
              >
                FLOOD ASSESSMENT
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Modify indicator weightages or override observations with peer-reviewed justification.
              Scores automatically normalize and re-classify on the 0–10 scale.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              color: '#94a3b8',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 1.75rem',
            background: '#f8fafc',
            gap: '1rem',
          }}
        >
          <button
            onClick={() => setActiveTab('weights')}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'weights' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'weights' ? '#1d4ed8' : '#64748b',
              fontWeight: activeTab === 'weights' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            ⚖️ Indicator Weightages ({indicators.length})
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            style={{
              padding: '0.75rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'overrides' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'overrides' ? '#1d4ed8' : '#64748b',
              fontWeight: activeTab === 'overrides' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>📍 Unit Observation Overrides</span>
            {valueOverrides.length > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                  fontWeight: 700,
                }}
              >
                {valueOverrides.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {activeTab === 'weights' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Adjust weights (0.0 to 10.0 scale) per line department guidelines:
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const resetMap: Record<number, number> = {};
                    indicators.forEach((ind) => {
                      resetMap[ind.indicator] = ind.weight ?? 5.0;
                    });
                    setWeights(resetMap);
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.78rem',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reset to Assessment Defaults
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {indicators.map((ind) => {
                  const currentWeight = weights[ind.indicator] ?? ind.weight ?? 5.0;
                  return (
                    <div
                      key={ind.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                            {ind.indicator_name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontFamily: 'monospace',
                              background: '#e2e8f0',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            {ind.indicator_code}
                          </span>
                          {ind.department && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: '#e0e7ff',
                                color: '#3730a3',
                              }}
                            >
                              🏛️ {ind.department}
                            </span>
                          )}
                          {ind.category_display && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: '#fef3c7',
                                color: '#92400e',
                              }}
                            >
                              {ind.category_display}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Unit: {ind.indicator_unit || 'dimensionless'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '220px' }}>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.1"
                          value={currentWeight}
                          onChange={(e) => handleWeightChange(ind.indicator, parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={currentWeight}
                          onChange={(e) => handleWeightChange(ind.indicator, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '56px',
                            padding: '0.25rem 0.4rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            textAlign: 'right',
                            fontWeight: 700,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'overrides' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Form to add override */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '1.25rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#0f172a' }}>
                  Add Unit Observation Override
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Administrative Unit
                    </label>
                    <select
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="">-- Select Block / Unit --</option>
                      {uniqueUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Indicator
                    </label>
                    <select
                      value={selectedIndicatorId}
                      onChange={(e) => setSelectedIndicatorId(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="">-- Select Indicator --</option>
                      {indicators.map((i) => (
                        <option key={i.indicator} value={i.indicator}>
                          {i.indicator_name} ({i.indicator_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedUnitId && selectedIndicatorId && (
                  <div
                    style={{
                      background: '#f1f5f9',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      marginBottom: '1rem',
                      color: '#334155',
                    }}
                  >
                    Current Recorded Raw Value:{' '}
                    <strong>
                      {currentUnitResult?.raw_value !== null && currentUnitResult?.raw_value !== undefined
                        ? currentUnitResult.raw_value.toFixed(2)
                        : 'No prior record (Gap)'}
                    </strong>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      New Raw Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newRawValInput}
                      onChange={(e) => setNewRawValInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Expert Rationale / Justification
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ground-truthed gauge calibration post 2024 monsoon peak"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddValueOverride}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.55rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      height: '38px',
                    }}
                  >
                    ➕ Stage Override
                  </button>
                </div>
              </div>

              {/* Table of active / staged overrides */}
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#1e293b' }}>
                  Staged Overrides ({valueOverrides.length})
                </div>
                {valueOverrides.length === 0 ? (
                  <div
                    style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px dashed #cbd5e1',
                      color: '#64748b',
                      fontSize: '0.85rem',
                    }}
                  >
                    No unit overrides staged. Assessment will recompute using existing data layers with the updated weights.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '0.6rem 0.85rem' }}>Unit</th>
                          <th style={{ textAlign: 'left', padding: '0.6rem 0.85rem' }}>Indicator</th>
                          <th style={{ textAlign: 'right', padding: '0.6rem 0.85rem' }}>Original</th>
                          <th style={{ textAlign: 'right', padding: '0.6rem 0.85rem' }}>Override</th>
                          <th style={{ textAlign: 'left', padding: '0.6rem 0.85rem' }}>Justification</th>
                          <th style={{ textAlign: 'center', padding: '0.6rem 0.85rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valueOverrides.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.6rem 0.85rem', fontWeight: 600 }}>{item.unit_name}</td>
                            <td style={{ padding: '0.6rem 0.85rem' }}>
                              <span style={{ fontFamily: 'monospace' }}>{item.indicator_code}</span>
                            </td>
                            <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', color: '#64748b' }}>
                              {item.current_raw_value !== null ? item.current_raw_value.toFixed(2) : '-'}
                            </td>
                            <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                              {item.new_raw_value.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.6rem 0.85rem', color: '#475569', fontSize: '0.8rem' }}>
                              {item.reason}
                            </td>
                            <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveOverride(item.administrative_unit_id, item.indicator_id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                }}
                                title="Remove override"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ⚡ Recalculation operates atomically on backend scoring engine with full audit trails.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitRecalculation}
              disabled={isSubmitting}
              style={{
                background: '#2563eb',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#ffffff',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  <span>Recalculating...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Recalculate Assessment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
