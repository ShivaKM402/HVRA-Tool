/**
 * AddDistrictModal — Google-style user-friendly dialog to add a new district.
 * Non-technical users just type the name and click "Add District".
 * No code, no backend knowledge needed.
 */
import { useState, useEffect, useRef } from 'react';
import { createDistrict } from '../../services/api';
import type { AdministrativeUnit } from '../../types';
import './AddDistrictModal.css';

interface Props {
  states: AdministrativeUnit[];
  defaultStateId: number | null;
  onSuccess: (newDistrict: AdministrativeUnit) => void;
  onClose: () => void;
}

export default function AddDistrictModal({ states, defaultStateId, onSuccess, onClose }: Props) {
  const [name, setName] = useState('');
  const [stateId, setStateId] = useState<number | null>(defaultStateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; blocks: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the name input on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Please enter a district name.'); return; }
    if (!stateId) { setError('Please select a state.'); return; }

    setSaving(true);
    setError(null);
    try {
      const result = await createDistrict({ name: name.trim(), state_id: stateId });
      setSuccessMsg({
        text: result.message || `'${result.district.name}' is ready!`,
        blocks: result.blocks_auto_added,
      });
      setTimeout(() => {
        onSuccess(result.district);
        onClose();
      }, 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.name?.[0]
        || err?.response?.data?.errors?.state_id?.[0]
        || err?.message
        || 'Something went wrong. Please try again.';
      setError(msg);
      setSaving(false);
    }
  };

  const selectedState = states.find(s => s.id === stateId);

  return (
    <div className="adm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-modal">
        {/* Header */}
        <div className="adm-header">
          <div className="adm-header-icon">📍</div>
          <div>
            <h2 className="adm-title">Add a New District</h2>
            <p className="adm-subtitle">It will be available to use instantly in your assessment</p>
          </div>
          <button className="adm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {successMsg ? (
          /* Success state */
          <div className="adm-success">
            <div className="adm-success-icon">✅</div>
            <div className="adm-success-title">District Ready!</div>
            <div className="adm-success-sub">{successMsg.text}</div>
            {successMsg.blocks > 0 && (
              <div className="adm-success-blocks">
                <span>📋</span>
                <span><strong>{successMsg.blocks} talukas/blocks</strong> automatically added and ready for data entry</span>
              </div>
            )}
          </div>
        ) : (
          <div className="adm-body">
            {/* Step indicator */}
            <div className="adm-steps">
              <div className="adm-step active">
                <span className="adm-step-dot">1</span>
                <span>Name your district</span>
              </div>
              <div className="adm-step-line" />
              <div className={`adm-step ${stateId ? 'active' : ''}`}>
                <span className="adm-step-dot">2</span>
                <span>Confirm state</span>
              </div>
            </div>

            {/* District name input */}
            <div className="adm-field">
              <label className="adm-label">
                District Name <span className="adm-required">*</span>
              </label>
              <div className="adm-input-wrap">
                <span className="adm-input-icon">🏙️</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="adm-input"
                  placeholder="e.g. Wayanad, Palakkad, Thrissur…"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  maxLength={100}
                />
                {name && (
                  <button className="adm-input-clear" onClick={() => setName('')}>✕</button>
                )}
              </div>
              <div className="adm-hint">Type the official name as it appears on maps</div>
            </div>

            {/* State selector */}
            <div className="adm-field">
              <label className="adm-label">
                State <span className="adm-required">*</span>
              </label>
              <div className="adm-state-grid">
                {states.map(state => (
                  <button
                    key={state.id}
                    className={`adm-state-chip ${stateId === state.id ? 'selected' : ''}`}
                    onClick={() => { setStateId(state.id); setError(null); }}
                  >
                    {stateId === state.id && <span>✓ </span>}
                    {state.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {name && stateId && (
              <div className="adm-preview">
                <span className="adm-preview-icon">👁️</span>
                <span>
                  Your new district: <strong>{name}</strong> under <strong>{selectedState?.name}</strong>
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="adm-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="adm-actions">
              <button className="adm-btn-cancel" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="adm-btn-save"
                onClick={handleSave}
                disabled={saving || !name.trim() || !stateId}
              >
                {saving ? (
                  <>
                    <span className="adm-spinner" />
                    Adding district…
                  </>
                ) : (
                  <>
                    <span>➕</span>
                    Add District
                  </>
                )}
              </button>
            </div>

            {/* Info notice */}
            <div className="adm-notice">
              <span>ℹ️</span>
              <span>
                The district will be marked as <strong>Demo Data</strong> and saved to the system.
                You can run assessments on it right away.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
