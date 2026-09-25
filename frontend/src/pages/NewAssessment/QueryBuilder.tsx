/**
 * QueryBuilder — spec Screen 1.
 *
 * "Step-by-step Query: Build Your Hazard Assessment" — a single page where all
 * four query questions are visible at once, and a Live Preview of the
 * composite-score snapshot updates as choices are made.
 */
import { useMemo } from 'react';
import type { AssessmentPreview } from '../../services/api';
import type {
  HazardType,
  AdministrativeUnit,
  HazardIndicator,
  DataSource,
} from '../../types';
import './QueryBuilder.css';

export type QueryModule = 'HAZARD' | 'VULNERABILITY' | 'EXPOSURE';

interface QueryBuilderProps {
  moduleType: QueryModule;
  onModuleChange: (m: QueryModule) => void;

  // Q1 — hazard type
  hazards: HazardType[];
  selectedHazardCode: string;
  onHazardChange: (code: string) => void;

  // Q2 — administrative level + area of interest
  administrativeLevel: 'BLOCK' | 'VILLAGE';
  onAdministrativeLevelChange: (lvl: 'BLOCK' | 'VILLAGE') => void;
  states: AdministrativeUnit[];
  districts: AdministrativeUnit[];
  selectedStateId: number | null;
  selectedDistrictId: number | null;
  onStateChange: (id: number | null) => void;
  onDistrictChange: (id: number | null) => void;
  districtSearch: string;
  onDistrictSearchChange: (q: string) => void;
  onAddDistrict: () => void;

  // Q3 — indicators + weightage
  indicators: HazardIndicator[];
  enabledIndicators: Set<number>;
  onToggleIndicator: (id: number) => void;
  indicatorWeights: Record<number, number>;
  onWeightChange: (id: number, weight: number) => void;
  onResetWeights: () => void;
  totalWeight: number;

  // Q4 — data source
  dataSources: DataSource[];
  selectedDataSourceId: number | null;
  onDataSourceChange: (id: number | null) => void;
  uploadFileObj: File | null;
  uploadFileName: string;
  onUploadFileNameChange: (name: string) => void;
  onUploadFileChange: (file: File | null) => void;
  onUploadSubmit: () => void;
  isUploading: boolean;
  uploadSuccessMsg: string | null;
  useCustomUpload: boolean;
  onUseCustomUploadChange: (v: boolean) => void;

  // Live preview
  preview: AssessmentPreview | null;
  previewLoading: boolean;
  previewError: string | null;
  onRefreshPreview: () => void;

  // Footer actions
  queryName: string;
  onQueryNameChange: (name: string) => void;
  onSaveQuery: () => void;
  savingQuery: boolean;
  saveQueryMessage: string | null;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;

  // Territory notice (HVRA §2)
  territoryNotice: string | null;
}

const CLASS_COLORS: Record<string, string> = {
  NH: '#22c55e',
  LH: '#eab308',
  MH: '#f97316',
  HH: '#ef4444',
};

const MODULE_TITLES: Record<QueryModule, string> = {
  HAZARD: 'Hazard',
  VULNERABILITY: 'Vulnerability',
  EXPOSURE: 'Exposure',
};

export default function QueryBuilder(props: QueryBuilderProps) {
  const {
    moduleType,
    onModuleChange,
    hazards,
    selectedHazardCode,
    onHazardChange,
    administrativeLevel,
    onAdministrativeLevelChange,
    states,
    districts,
    selectedStateId,
    selectedDistrictId,
    onStateChange,
    onDistrictChange,
    districtSearch,
    onDistrictSearchChange,
    onAddDistrict,
    indicators,
    enabledIndicators,
    onToggleIndicator,
    indicatorWeights,
    onWeightChange,
    onResetWeights,
    totalWeight,
    dataSources,
    selectedDataSourceId,
    onDataSourceChange,
    uploadFileObj,
    uploadFileName,
    onUploadFileNameChange,
    onUploadFileChange,
    onUploadSubmit,
    isUploading,
    uploadSuccessMsg,
    useCustomUpload,
    onUseCustomUploadChange,
    preview,
    previewLoading,
    previewError,
    onRefreshPreview,
    queryName,
    onQueryNameChange,
    onSaveQuery,
    savingQuery,
    saveQueryMessage,
    onSubmit,
    isSubmitting,
    error,
    territoryNotice,
  } = props;

  const visibleDistricts = useMemo(
    () =>
      districts
        .filter((d) => (selectedStateId ? d.parent_id === selectedStateId : true))
        .filter((d) =>
          districtSearch
            ? d.name.toLowerCase().includes(districtSearch.toLowerCase())
            : true,
        ),
    [districts, selectedStateId, districtSearch],
  );

  const selectedDistrict = districts.find((d) => d.id === selectedDistrictId);

  // Step completion state for the 4-step strip
  const stepDone = [
    !!selectedHazardCode,
    !!selectedStateId && !!selectedDistrictId,
    enabledIndicators.size > 0,
    useCustomUpload ? !!uploadFileObj : !!selectedDataSourceId,
  ];
  const activeStep = stepDone.findIndex((d) => !d);

  const canGenerate = stepDone.every(Boolean) && !isSubmitting;

  return (
    <div className="qb">
      {/* Page title */}
      <div className="qb-titlebar">
        <h1 className="qb-title">
          Step-by-step Query: Build Your {MODULE_TITLES[moduleType]} Assessment
        </h1>
        <p className="qb-subtitle">
          Answer the prompts below — no GIS knowledge required.
        </p>
      </div>

      {/* Step strip */}
      <ol className="qb-stepper">
        {['Hazard Type', 'Admin. Unit + Extent', 'Indicators & Weightage', 'Data Source'].map(
          (label, i) => (
            <li
              key={label}
              className={`qb-step ${i === activeStep ? 'active' : ''} ${stepDone[i] ? 'done' : ''}`}
            >
              <span className="qb-step-dot">{stepDone[i] ? '✓' : i + 1}</span>
              <span className="qb-step-label">{label}</span>
            </li>
          ),
        )}
      </ol>

      {territoryNotice && <div className="qb-notice">{territoryNotice}</div>}
      {error && <div className="qb-error">⚠️ {error}</div>}

      {/* Module switch */}
      <div className="qb-modules">
        {(['HAZARD', 'VULNERABILITY', 'EXPOSURE'] as QueryModule[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModuleChange(m)}
            className={`qb-module-btn ${moduleType === m ? 'active' : ''}`}
          >
            {MODULE_TITLES[m]} Assessment
          </button>
        ))}
      </div>

      {/* Q1 — hazard type */}
      <section className="qb-section">
        <h2 className="qb-q">
          <span className="qb-q-num">Q1.</span> Which hazard do you want to assess?
        </h2>
        <div className="qb-chips">
          {hazards.map((h) => (
            <button
              key={h.code}
              type="button"
              onClick={() => onHazardChange(h.code)}
              className={`qb-chip ${selectedHazardCode === h.code ? 'active' : ''}`}
            >
              {h.name}
            </button>
          ))}
        </div>
      </section>

      {/* Q2 — administrative level + area */}
      <section className="qb-section">
        <h2 className="qb-q">
          <span className="qb-q-num">Q2.</span> Select administrative level and area of interest
        </h2>
        <div className="qb-row">
          <label className="qb-field">
            <span>Level</span>
            <select
              value={administrativeLevel}
              onChange={(e) => onAdministrativeLevelChange(e.target.value as 'BLOCK' | 'VILLAGE')}
            >
              <option value="BLOCK">Block</option>
              <option value="VILLAGE">Village</option>
            </select>
          </label>
          <label className="qb-field">
            <span>State</span>
            <select
              value={selectedStateId ?? ''}
              onChange={(e) => onStateChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name.replace(' [DEMO]', '')}</option>
              ))}
            </select>
          </label>
          <label className="qb-field">
            <span>District</span>
            <select
              value={selectedDistrictId ?? ''}
              onChange={(e) => onDistrictChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select district</option>
              {visibleDistricts.map((d) => (
                <option key={d.id} value={d.id}>{d.name.replace(' [DEMO]', '')}</option>
              ))}
            </select>
          </label>
          <label className="qb-field qb-search">
            <span>Find district</span>
            <input
              value={districtSearch}
              onChange={(e) => onDistrictSearchChange(e.target.value)}
              placeholder="Type to filter…"
            />
          </label>
          <button type="button" className="qb-addlink" onClick={onAddDistrict}>
            + Add district
          </button>
        </div>
        <p className="qb-hint">
          ⓘ Assessment computed relative to neighbouring {administrativeLevel === 'VILLAGE' ? 'villages' : 'blocks'} in the district.
        </p>
        {selectedDistrict && (
          <div className="qb-district-pills">
            {visibleDistricts.slice(0, 14).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onDistrictChange(d.id)}
                className={`qb-pill ${selectedDistrictId === d.id ? 'active' : ''}`}
              >
                {d.name.replace(' [DEMO]', '')}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Q3 — indicators + weightage */}
      <section className="qb-section">
        <h2 className="qb-q">
          <span className="qb-q-num">Q3.</span> Select indicators to include{' '}
          <span className="qb-q-note">(auto-weighted per technical framework)</span>
        </h2>

        {indicators.length === 0 ? (
          <p className="qb-hint">
            {selectedHazardCode
              ? 'Loading indicators…'
              : 'Select a hazard in Q1 to load its indicators.'}
          </p>
        ) : (
          <>
            <div className="qb-ind-head">
              <span />
              <span>Indicator</span>
              <span>Unit</span>
              <span>Weight (0–10)</span>
              <span>Share</span>
            </div>
            {indicators.map((ind) => {
              const on = enabledIndicators.has(ind.id);
              const weight = indicatorWeights[ind.id] ?? ind.default_weight;
              const share = on && totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
              return (
                <div key={ind.id} className={`qb-ind ${on ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggleIndicator(ind.id)}
                    aria-label={`Include ${ind.name}`}
                  />
                  <div className="qb-ind-name">
                    <div className="qb-ind-title">{ind.name}</div>
                    <div className="qb-ind-desc">{ind.description}</div>
                  </div>
                  <div className="qb-ind-unit">{ind.unit || '—'}</div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={weight}
                    disabled={!on}
                    onChange={(e) => onWeightChange(ind.id, Number(e.target.value))}
                    className="qb-slider"
                    aria-label={`${ind.name} weight`}
                  />
                  <div className="qb-ind-share">
                    {on ? `${weight}/10 (=${share}%)` : '—'}
                  </div>
                </div>
              );
            })}
            <div className="qb-ind-foot">
              <span>
                Weightages are pre-filled from the standard 0–10 scale (Technical Framework §4) and
                are editable by expert users.
              </span>
              <button type="button" className="qb-linkbtn" onClick={onResetWeights}>
                Reset to defaults
              </button>
            </div>
          </>
        )}
      </section>

      {/* Q4 — data source */}
      <section className="qb-section">
        <h2 className="qb-q">
          <span className="qb-q-num">Q4.</span> Choose data source
        </h2>
        <div className="qb-ds-options">
          <button
            type="button"
            onClick={() => onUseCustomUploadChange(false)}
            className={`qb-ds ${!useCustomUpload ? 'active' : ''}`}
          >
            <strong>✓ Use in-built datasets</strong>
            <span>CWD flood extents, IMD historical events</span>
          </button>
          <button
            type="button"
            onClick={() => onUseCustomUploadChange(true)}
            className={`qb-ds ${useCustomUpload ? 'active' : ''}`}
          >
            <strong>⬆ Upload my own shapefile / CSV</strong>
            <span>.shp / .geojson / .csv accepted</span>
          </button>
        </div>

        {!useCustomUpload && (
          <div className="qb-row">
            <label className="qb-field qb-grow">
              <span>Registered dataset</span>
              <select
                value={selectedDataSourceId ?? ''}
                onChange={(e) =>
                  onDataSourceChange(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Auto-select best available layer</option>
                {dataSources.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {useCustomUpload && (
          <div className="qb-row">
            <label className="qb-field qb-grow">
              <span>Dataset title</span>
              <input
                value={uploadFileName}
                onChange={(e) => onUploadFileNameChange(e.target.value)}
                placeholder="e.g. Taluka flood extent 2026"
              />
            </label>
            <label className="qb-field qb-grow">
              <span>File</span>
              <input
                type="file"
                accept=".geojson,.json,.csv"
                onChange={(e) => onUploadFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary qb-uploadbtn"
              onClick={onUploadSubmit}
              disabled={isUploading || !uploadFileObj}
            >
              {isUploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        )}
        {uploadSuccessMsg && <div className="qb-success">✅ {uploadSuccessMsg}</div>}
      </section>

      {/* Generate + save query */}
      <section className="qb-generate">
        <div className="qb-generate-row">
          <button
            type="button"
            className="qb-generate-btn"
            onClick={onSubmit}
            disabled={!canGenerate}
          >
            {isSubmitting ? 'Generating…' : '▶ Generate Assessment'}
          </button>
          <span className="qb-generate-hint">
            Runs normalization → composite score → NH/LH/MH/HH classification automatically
          </span>
        </div>

        <div className="qb-savequery">
          <input
            value={queryName}
            onChange={(e) => onQueryNameChange(e.target.value)}
            placeholder="Query name (optional) — save this configuration for reuse"
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSaveQuery}
            disabled={savingQuery || !queryName.trim()}
          >
            {savingQuery ? 'Saving…' : '💾 Save as Query'}
          </button>
          {saveQueryMessage && <span className="qb-success">{saveQueryMessage}</span>}
        </div>
      </section>

      {/* Live preview — composite score snapshot */}
      <section className="qb-preview">
        <div className="qb-preview-head">
          <h2>
            Live Preview — Composite Score Snapshot
            {preview ? ` (${preview.district.replace(' [DEMO]', '')}, ${preview.unit_count} ${preview.administrative_level === 'VILLAGE' ? 'villages' : 'blocks'})` : ''}
          </h2>
          <div className="qb-preview-actions">
            {previewLoading && <span className="qb-preview-status">computing…</span>}
            {preview && (
              <span className="qb-preview-status">
                {Object.entries(preview.classification_summary)
                  .filter(([, n]) => n > 0)
                  .map(([code, n]) => `${n} ${code}`)
                  .join(' · ')}
              </span>
            )}
            <button type="button" className="qb-linkbtn" onClick={onRefreshPreview}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {!selectedDistrictId && (
          <p className="qb-hint">Select a district in Q2 to see live block scores.</p>
        )}
        {selectedDistrictId && previewError && <p className="qb-error">⚠️ {previewError}</p>}
        {selectedDistrictId && !preview && !previewError && (
          <p className="qb-hint">{previewLoading ? 'Computing scores…' : 'No preview yet.'}</p>
        )}

        {preview && preview.units.length > 0 && (
          <div className="qb-cards">
            {preview.units.map((u) => (
              <div key={u.id} className="qb-card" style={{ borderTopColor: CLASS_COLORS[u.classification] || '#94a3b8' }}>
                <div className="qb-card-name">{u.name.replace(' [DEMO]', '')}</div>
                <div className="qb-card-score">Score {u.score.toFixed(1)}</div>
                <div
                  className="qb-card-class"
                  style={{ color: CLASS_COLORS[u.classification] || '#64748b' }}
                >
                  {u.classification === 'NH'
                    ? 'NO HAZARD'
                    : u.classification === 'LH'
                      ? 'LOW'
                      : u.classification === 'MH'
                        ? 'MEDIUM'
                        : 'HIGH'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
