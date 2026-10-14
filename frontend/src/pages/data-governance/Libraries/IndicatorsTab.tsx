import React, { useState, useMemo, useEffect } from 'react';
import type { HazardIndicator } from '@/types';
import { useHazard, HAZARD_CATALOG, type HazardCode } from '@/context/HazardContext';

const APPROVED_DEPARTMENTS = [
  'Water Resources Department (Irrigation)',
  'Local Self Government (LSGD / Panchayats)',
  'Public Works Department (PWD)',
  'Health & Family Welfare Department',
  'Department of Economics & Statistics',
  'Revenue & Disaster Management (KSDMA)',
  'Agriculture Development & Farmers Welfare',
  'Labour & Skills Department',
  'Environment & Climate Change Department',
  'Kerala State Electricity Board (KSEB)',
  'Town & Country Planning / LSGD',
];

interface IndicatorsTabProps {
  indicators: HazardIndicator[];
  loading: boolean;
  onUpdateIndicator: (id: number, payload: Partial<HazardIndicator>) => Promise<void>;
}

export default function IndicatorsTab({
  indicators,
  loading,
  onUpdateIndicator,
}: IndicatorsTabProps) {
  const { activeHazard } = useHazard();
  const [selectedHazard, setSelectedHazard] = useState<string>(activeHazard || 'ALL');
  const [selectedModule, setSelectedModule] = useState<'ALL' | 'HAZARD' | 'VULNERABILITY' | 'EXPOSURE'>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (activeHazard) {
      setSelectedHazard(activeHazard);
    }
  }, [activeHazard]);

  // Local draft modifications: { [id]: { department?: string, default_weight?: number } }
  const [drafts, setDrafts] = useState<Record<number, { department?: string; default_weight?: number }>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<number, boolean>>({});

  // Summary counts
  const totalCount = indicators.length;
  const hazardCount = indicators.filter((i) => i.module_type === 'HAZARD' || (i as any).module_code === 'HAZARD').length;
  const vulnCount = indicators.filter((i) => i.module_type === 'VULNERABILITY' || (i as any).module_code === 'VULNERABILITY').length;
  const expoCount = indicators.filter((i) => i.module_type === 'EXPOSURE' || (i as any).module_code === 'EXPOSURE').length;

  // Filtered indicators
  const filtered = useMemo(() => {
    return indicators.filter((ind) => {
      // 1. Hazard Domain Filter
      if (selectedHazard !== 'ALL') {
        const hz = ind.hazard_type?.toUpperCase() || '';
        if (hz && hz !== selectedHazard) return false;
      }

      // 2. Module Filter
      const mod = ind.module_type?.toUpperCase() || '';
      const modCode = (ind as any).module_code?.toUpperCase() || '';
      if (selectedModule !== 'ALL') {
        if (mod !== selectedModule && modCode !== selectedModule) return false;
      }

      const currentDept = drafts[ind.id]?.department !== undefined ? drafts[ind.id].department : ind.department;
      if (selectedDept !== 'ALL') {
        if (currentDept !== selectedDept) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ind.name.toLowerCase().includes(q);
        const matchCode = ind.code.toLowerCase().includes(q);
        const matchDept = (currentDept || '').toLowerCase().includes(q);
        const matchDesc = (ind.description || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept && !matchDesc) return false;
      }

      return true;
    });
  }, [indicators, selectedHazard, selectedModule, selectedDept, searchQuery, drafts]);

  const handleDeptChange = (id: number, dept: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        department: dept,
      },
    }));
  };

  const handleWeightChange = (id: number, weight: number) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        default_weight: weight,
      },
    }));
  };

  const handleSave = async (ind: HazardIndicator) => {
    const draft = drafts[ind.id];
    if (!draft) return;

    try {
      setSavingIds((prev) => ({ ...prev, [ind.id]: true }));
      await onUpdateIndicator(ind.id, {
        department: draft.department !== undefined ? draft.department : ind.department,
        default_weight: draft.default_weight !== undefined ? draft.default_weight : ind.default_weight,
      });

      // Clear draft for this item
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[ind.id];
        return next;
      });

      setSavedSuccessIds((prev) => ({ ...prev, [ind.id]: true }));
      setTimeout(() => {
        setSavedSuccessIds((prev) => ({ ...prev, [ind.id]: false }));
      }, 3000);
    } finally {
      setSavingIds((prev) => ({ ...prev, [ind.id]: false }));
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* KPI Overview Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>TOTAL APPROVED INDICATORS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>{totalCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>✓ HVRA Official Methodology</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>HAZARD ASSESSMENT (M1)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e40af', margin: '0.2rem 0' }}>{hazardCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Primary spatial &amp; frequency metrics</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>VULNERABILITY ASSESSMENT (M2)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>{vulnCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Socio-Economic, Physical, Env, Coping</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>EXPOSURE ASSESSMENT (M3)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', margin: '0.2rem 0' }}>{expoCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Population, residential, and assets</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {/* Hazard Domain Filter Row */}
        {activeHazard && selectedHazard === activeHazard ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  background: HAZARD_CATALOG[activeHazard]?.color || '#2563eb',
                  color: '#ffffff',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>{HAZARD_CATALOG[activeHazard]?.icon}</span>
                <span>{HAZARD_CATALOG[activeHazard]?.name.toUpperCase()} INDICATORS</span>
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Statutory indicators scoped exclusively for {HAZARD_CATALOG[activeHazard]?.name} ({filtered.length} indicators).
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setSelectedHazard('ALL')}
              style={{ fontSize: '0.74rem' }}
            >
              🌐 View All Hazard Indicators
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.3rem' }}>
              Hazard Domain:
            </span>
            <button
              type="button"
              className={`btn btn-sm ${selectedHazard === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedHazard('ALL')}
              style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}
            >
              🌐 All Hazards
            </button>
            {(['FLOOD', 'LANDSLIDE', 'COASTAL', 'EXTREME_WEATHER'] as HazardCode[]).map((hz) => {
              const meta = HAZARD_CATALOG[hz];
              const isSel = selectedHazard === hz;
              return (
                <button
                  key={hz}
                  type="button"
                  className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedHazard(hz)}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.2rem 0.6rem',
                    ...(isSel ? { background: meta.color, borderColor: meta.color, color: '#ffffff' } : {}),
                  }}
                >
                  <span>{meta.icon}</span> <span>{meta.shortName}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Module Selector Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${selectedModule === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedModule('ALL')}
            >
              All Modules ({totalCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedModule === 'HAZARD' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedModule('HAZARD')}
            >
              🌊 Hazard ({hazardCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedModule === 'VULNERABILITY' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedModule('VULNERABILITY')}
            >
              🛡️ Vulnerability ({vulnCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedModule === 'EXPOSURE' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedModule('EXPOSURE')}
            >
              🎯 Exposure ({expoCount})
            </button>
          </div>

          {/* Department Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Filter Agency:</span>
            <select
              className="form-control"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem', minWidth: '220px' }}
            >
              <option value="ALL">All Departments ({APPROVED_DEPARTMENTS.length})</option>
              {APPROVED_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Real-time Search Input */}
        <div>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search indicators by name, code (e.g. FLOOD_PRONE_AREA), department, or methodology..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Main Indicators & Department Table */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 700 }}>Indicator Definition</th>
                <th style={{ padding: '0.75rem 0.75rem', color: '#475569', fontWeight: 700, width: '90px' }}>Unit</th>
                <th style={{ padding: '0.75rem 0.75rem', color: '#475569', fontWeight: 700, width: '110px' }}>Baseline Weight</th>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 700, minWidth: '280px' }}>Responsible Department / Agency</th>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 700, textAlign: 'right', width: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
                    Loading indicators...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    No indicators match your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((ind) => {
                  const draft = drafts[ind.id] || {};
                  const currentDept = draft.department !== undefined ? draft.department : (ind.department || '');
                  const currentWeight = draft.default_weight !== undefined ? draft.default_weight : ind.default_weight;
                  const isModified =
                    (draft.department !== undefined && draft.department !== ind.department) ||
                    (draft.default_weight !== undefined && draft.default_weight !== ind.default_weight);
                  const isSaving = savingIds[ind.id];
                  const isSaved = savedSuccessIds[ind.id];
                  const isExpanded = expandedId === ind.id;

                  const modName = (ind.module_type || (ind as any).module_code || 'HAZARD').toUpperCase();
                  const modColor =
                    modName === 'HAZARD' ? '#1e40af' : modName === 'VULNERABILITY' ? '#b45309' : '#b91c1c';
                  const modBg =
                    modName === 'HAZARD' ? '#eff6ff' : modName === 'VULNERABILITY' ? '#fef3c7' : '#fef2f2';

                  return (
                    <React.Fragment key={ind.id}>
                      <tr
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isModified ? '#f0f9ff' : 'transparent',
                          transition: 'background 0.2s',
                        }}
                      >
                        {/* Indicator Info */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                            {ind.name}
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                            <code style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#334155' }}>
                              {ind.code}
                            </code>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: modBg,
                                color: modColor,
                                fontWeight: 700,
                              }}
                            >
                              {modName}
                            </span>
                            {ind.category_display && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                }}
                              >
                                {ind.category_display}
                              </span>
                            )}
                          </div>
                          {ind.description && (
                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.3rem', lineHeight: 1.35 }}>
                              {ind.description}
                            </div>
                          )}
                        </td>

                        {/* Measurement Unit */}
                        <td style={{ padding: '0.75rem 0.75rem', fontWeight: 600, color: '#334155' }}>
                          <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.2rem 0.45rem', fontSize: '0.76rem' }}>
                            {ind.unit || 'unitless'}
                          </span>
                        </td>

                        {/* Baseline Weight */}
                        <td style={{ padding: '0.75rem 0.75rem' }}>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            className="form-control"
                            value={currentWeight}
                            onChange={(e) => handleWeightChange(ind.id, parseFloat(e.target.value) || 0)}
                            style={{ width: '80px', padding: '0.3rem 0.45rem', fontSize: '0.82rem', fontWeight: 600 }}
                            title="Default indicator weight on a 0–10 scale"
                          />
                        </td>

                        {/* Assigned Department Selector */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <select
                            className="form-control"
                            value={currentDept}
                            onChange={(e) => handleDeptChange(ind.id, e.target.value)}
                            style={{
                              width: '100%',
                              fontSize: '0.82rem',
                              padding: '0.35rem 0.55rem',
                              background: isModified ? '#ffffff' : '#f8fafc',
                              borderColor: isModified ? '#38bdf8' : '#cbd5e1',
                              fontWeight: 500,
                            }}
                          >
                            <option value="">-- Unassigned / General --</option>
                            {APPROVED_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>
                                🏛️ {dept}
                              </option>
                            ))}
                            {currentDept && !APPROVED_DEPARTMENTS.includes(currentDept) && (
                              <option value={currentDept}>{currentDept} (Current)</option>
                            )}
                          </select>
                        </td>

                        {/* Action Buttons */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : ind.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.74rem' }}
                              title="Inspect weightage rules and thresholds"
                            >
                              {isExpanded ? 'Hide' : 'Rules'}
                            </button>

                            {isModified ? (
                              <button
                                type="button"
                                onClick={() => handleSave(ind)}
                                disabled={isSaving}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem', fontWeight: 700 }}
                              >
                                {isSaving ? 'Saving...' : '💾 Save'}
                              </button>
                            ) : isSaved ? (
                              <span style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 700 }}>
                                ✓ Saved
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Saved</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Weightage Rules Breakdown */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <td colSpan={5} style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                                📊 Scoring Thresholds &amp; Weightage Rules for <code>{ind.code}</code> ({ind.name})
                              </div>
                              {ind.weightage_rules && ind.weightage_rules.length > 0 ? (
                                <table style={{ width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                      <th style={{ padding: '0.4rem 0.6rem' }}>Severity Tier</th>
                                      <th style={{ padding: '0.4rem 0.6rem' }}>Value Range ({ind.unit})</th>
                                      <th style={{ padding: '0.4rem 0.6rem' }}>Assigned Score (0–10)</th>
                                      <th style={{ padding: '0.4rem 0.6rem' }}>Type</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ind.weightage_rules.map((rule) => (
                                      <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{rule.label}</td>
                                        <td style={{ padding: '0.35rem 0.6rem' }}>
                                          {rule.range_min} {rule.range_max !== null ? `to ${rule.range_max}` : '+'} {ind.unit}
                                        </td>
                                        <td style={{ padding: '0.35rem 0.6rem', fontWeight: 700, color: '#1e40af' }}>{rule.score}</td>
                                        <td style={{ padding: '0.35rem 0.6rem', color: '#64748b' }}>
                                          {rule.is_prototype_threshold ? 'Configurable rule' : 'Official statutory threshold'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic' }}>
                                  Standard min-max normalization active (0 = min exposure, 10 = peak exposure across neighbouring units).
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
