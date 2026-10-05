/**
 * Save & Share Query Modals
 */
import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { createSavedQuery, shareSavedQuery } from '../../services/api';
import type { SavedQuery, SavedQueryPayload } from '../../types';

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryPayload: Partial<SavedQueryPayload>;
  onSaved?: (saved: SavedQuery) => void;
}

export function SaveQueryModal({ isOpen, onClose, queryPayload, onSaved }: SaveQueryModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(queryPayload.name || 'Custom Assessment Query');
  const [description, setDescription] = useState(queryPayload.description || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      const payload: SavedQueryPayload = {
        name,
        description,
        module_type: queryPayload.module_type || 'HAZARD',
        hazard_type: queryPayload.hazard_type || 'FLOOD',
        state: queryPayload.state || 1,
        district: queryPayload.district || null,
        administrative_level: queryPayload.administrative_level || 'BLOCK',
        parameters: {
          normalization_method: 'min_max',
          classification_method: 'threshold',
          ...(queryPayload.parameters || {}),
        },
      };

      const result = await createSavedQuery(payload);
      showToast({
        title: 'Query Saved',
        message: `Query "${name}" saved to your templates library.`,
        type: 'success',
      });
      if (onSaved) onSaved(result);
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Save Failed',
        message: err.message || 'Could not save query template.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboard-overlay" onClick={onClose} style={{ zIndex: 9997 }}>
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: 'left' }}>
        <form onSubmit={handleSave}>
          <div className="onboard-header">
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Query Template
              </div>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>Save Assessment Query</h3>
            </div>
            <button type="button" className="onboard-close-btn" onClick={onClose}>×</button>
          </div>

          <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Query Name *
              </label>
              <input
                type="text"
                className="form-control"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monsoon 2026 Thiruvananthapuram Flood Assessment"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Description / Purpose
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Standard operational query for monsoon flood vulnerability monitoring."
              />
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
              ℹ️ Preserves selected district, indicators, weights, and normalization configurations for one-click re-runs.
            </div>
          </div>

          <div className="onboard-footer" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : 'Save Query Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ShareQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: SavedQuery | null;
}

export function ShareQueryModal({ isOpen, onClose, query }: ShareQueryModalProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(query?.share_token || null);

  if (!isOpen || !query) return null;

  const handleGenerateOrCopy = async () => {
    try {
      setLoading(true);
      let token = shareToken;
      if (!token) {
        const res = await shareSavedQuery(query.id);
        token = res.saved_query.share_token;
        setShareToken(token);
      }

      const shareUrl = `${window.location.origin}/saved-queries/shared/${token}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast({
        title: 'Share Link Copied',
        message: 'Public read-only link copied to clipboard.',
        type: 'success',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.message || 'Could not copy link.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = shareToken
    ? `${window.location.origin}/saved-queries/shared/${shareToken}`
    : 'Click "Copy Link" to generate a secure shareable URL';

  return (
    <div className="onboard-overlay" onClick={onClose} style={{ zIndex: 9997 }}>
      <div className="onboard-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: 'left' }}>
        <div className="onboard-header">
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Public Sharing
            </div>
            <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>Share Query Template</h3>
          </div>
          <button type="button" className="onboard-close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
            Anyone with this link can view this query configuration and run an assessment using the same parameters without modifying your saved template.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Shareable Link
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                readOnly
                className="form-control"
                value={shareUrl}
                style={{ background: '#f8fafc', fontSize: '0.82rem' }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleGenerateOrCopy}
                disabled={loading}
              >
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>

        <div className="onboard-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
