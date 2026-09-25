import { useEffect, useMemo, useState } from 'react';
import {
  getClimateContexts,
  createClimateContext,
  updateClimateContext,
  deleteClimateContext,
  getRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  getHazardEvents,
  createHazardEvent,
  updateHazardEvent,
  deleteHazardEvent,
  getHazards,
  getDistricts,
} from '../../services/api';
import type {
  ClimateContext,
  Recommendation,
  HazardEvent,
  HazardType,
  AdministrativeUnit,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';

type TabKey = 'climate' | 'recommendations' | 'events';

const TABS: { key: TabKey; label: string; icon: string; blurb: string }[] = [
  { key: 'climate', label: 'Climate Context', icon: '☀️', blurb: 'Curated, sourced statements about climate drivers (HVRA §4.9). Used to populate the Climate Context chapter of assessment & risk reports.' },
  { key: 'recommendations', label: 'Recommendations', icon: '🛡️', blurb: 'Configuration/adaptation recommendations per module (HVRA §4.9). Included in report recommendations chapters.' },
  { key: 'events', label: 'Historical Events', icon: '⚡', blurb: 'Historical hazard event repository (HVRA §4.9). Displayed on maps and reports as event records.' },
];

const MODULE_OPTIONS = ['HAZARD', 'VULNERABILITY', 'EXPOSURE', 'COMPOSITE_RISK'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];

interface FormState {
  show: boolean;
  editingId: number | null;
  saving: boolean;
  error: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #cbd5e1', fontSize: '0.85rem',
  background: '#ffffff', color: '#0f172a',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.78rem', fontWeight: 600, color: '#334155',
  display: 'block', marginBottom: '0.3rem',
};

export default function Libraries() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>('climate');

  const [hazards, setHazards] = useState<HazardType[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);

  const [climates, setClimates] = useState<ClimateContext[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [hz, ds] = await Promise.all([getHazards(), getDistricts()]);
        setHazards(hz);
        setDistricts(ds);
      } catch {
        setLoadError('Failed to load hazard types / districts.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const reloadAll = async () => {
    const params = includeInactive ? { include_inactive: '1' as string } : undefined;
    const [c, r, e] = await Promise.all([
      getClimateContexts(params as never),
      getRecommendations(params as never),
      getHazardEvents({ limit: 1000 }),
    ]);
    setClimates(c as ClimateContext[]);
    setRecommendations(r as Recommendation[]);
    setEvents(e.results || (e as unknown as HazardEvent[]));
  };

  useEffect(() => {
    if (!isAdmin) return;
    reloadAll().catch(() => setLoadError('Failed to load library entries.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, includeInactive]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const hazardNames = useMemo(() => {
    const map: Record<string, string> = {};
    hazards.forEach(h => { map[h.code] = h.name; });
    return map;
  }, [hazards]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const tabMeta = TABS.find(t => t.key === tab)!;

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="btn"
              style={{
                background: tab === t.key ? '#0f172a' : '#ffffff',
                color: tab === t.key ? '#ffffff' : '#334155',
                border: tab === t.key ? '1px solid #0f172a' : '1px solid #cbd5e1',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#475569' }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Show inactive entries
        </label>
      </div>

      <div style={{ fontSize: '0.9rem', color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1rem' }}>
        {tabMeta.icon} <strong>{tabMeta.label}</strong> — {tabMeta.blurb}
        <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>
          Edits here are write-protected: only Platform Administrators can add/update/remove library entries (HVRA §2).
        </span>
      </div>

      {notice && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: 8, padding: '0.7rem 1rem', fontSize: '0.85rem' }}>
          ✅ {notice}
        </div>
      )}
      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '0.7rem 1rem', fontSize: '0.85rem' }}>
          ⚠️ {loadError}
        </div>
      )}

      {tab === 'climate' && (
        <ClimateTab
          items={climates as ClimateContext[]}
          hazards={hazards}
          districts={districts}
          hazardNames={hazardNames}
          loading={loading}
          onCreate={async p => { const x = await createClimateContext(p); setClimates(prev => [...prev, x]); flash('Climate context added.'); }}
          onUpdate={async (id, p) => { const x = await updateClimateContext(id, p); setClimates(prev => prev.map(c => c.id === id ? { ...c, ...x } : c)); flash('Climate context updated.'); }}
          onDelete={async id => { await deleteClimateContext(id); setClimates(prev => prev.filter(c => c.id !== id)); flash('Climate context deleted.'); }}
        />
      )}

      {tab === 'recommendations' && (
        <RecommendationsTab
          items={recommendations as Recommendation[]}
          hazards={hazards}
          hazardNames={hazardNames}
          loading={loading}
          onCreate={async p => { const x = await createRecommendation(p); setRecommendations(prev => [...prev, x]); flash('Recommendation added.'); }}
          onUpdate={async (id, p) => { const x = await updateRecommendation(id, p); setRecommendations(prev => prev.map(r => r.id === id ? { ...r, ...x } : r)); flash('Recommendation updated.'); }}
          onDelete={async id => { await deleteRecommendation(id); setRecommendations(prev => prev.filter(r => r.id !== id)); flash('Recommendation deleted.'); }}
        />
      )}

      {tab === 'events' && (
        <EventsTab
          items={events as HazardEvent[]}
          hazards={hazards}
          districts={districts}
          hazardNames={hazardNames}
          loading={loading}
          onCreate={async p => { const x = await createHazardEvent(p); setEvents(prev => [...prev, x]); flash('Historical event added.'); }}
          onUpdate={async (id, p) => { const x = await updateHazardEvent(id, p); setEvents(prev => prev.map(e => e.id === id ? { ...e, ...x } : e)); flash('Event updated.'); }}
          onDelete={async id => { await deleteHazardEvent(id); setEvents(prev => prev.filter(e => e.id !== id)); flash('Event deleted.'); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic building blocks
// ---------------------------------------------------------------------------

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function FormShell({ form, onClose, onSave, title, children }: {
  form: FormState;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: '1.25rem', display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
          {form.editingId ? `✏️ Edit ${title}` : `➕ Add ${title}`}
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
      </div>
      {form.error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
          ⚠️ {form.error}
        </div>
      )}
      <form onSubmit={onSave} style={{ display: 'grid', gap: '1rem' }}>
        {children}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="submit" className="btn btn-primary" disabled={form.saving}>
            {form.saving ? 'Saving…' : form.editingId ? 'Update' : 'Add'}
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };

// ---------------------------------------------------------------------------
// Climate Context tab
// ---------------------------------------------------------------------------

function ClimateTab({ items, hazards, districts, hazardNames, loading, onCreate, onUpdate, onDelete }: {
  items: ClimateContext[];
  hazards: HazardType[];
  districts: AdministrativeUnit[];
  hazardNames: Record<string, string>;
  loading: boolean;
  onCreate: (p: any) => Promise<void>;
  onUpdate: (id: number, p: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({ show: false, editingId: null, saving: false, error: null });
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [hazardType, setHazardType] = useState('');
  const [region, setRegion] = useState('');
  const [source, setSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [vintage, setVintage] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const reset = () => {
    setTitle(''); setStatement(''); setHazardType(''); setRegion('');
    setSource(''); setSourceUrl(''); setVintage(''); setDisplayOrder(0);
    setIsActive(true); setIsDemo(false);
  };

  const startAdd = () => { reset(); setForm({ show: true, editingId: null, saving: false, error: null }); };
  const startEdit = (c: ClimateContext) => {
    setTitle(c.title); setStatement(c.statement); setHazardType(c.hazard_type || '');
    setRegion(c.region ? String(c.region) : ''); setSource(c.source || '');
    setSourceUrl(c.source_url || ''); setVintage(c.vintage || '');
    setDisplayOrder(c.display_order ?? 0); setIsActive(c.is_active); setIsDemo(c.is_demo);
    setForm({ show: true, editingId: c.id, saving: false, error: null });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !statement.trim()) {
      setForm(f => ({ ...f, error: 'Title and statement are required.' }));
      return;
    }
    setForm(f => ({ ...f, saving: true, error: null }));
    try {
      const payload = {
        title: title.trim(), statement: statement.trim(),
        hazard_type: hazardType || '', region: region ? Number(region) : null,
        source, source_url: sourceUrl, vintage,
        display_order: displayOrder, is_active: isActive, is_demo: isDemo,
      };
      if (form.editingId) await onUpdate(form.editingId, payload);
      else await onCreate(payload);
      setForm({ show: false, editingId: null, saving: false, error: null });
    } catch (err: any) {
      setForm(f => ({ ...f, saving: false, error: err?.response?.data?.detail || err?.message || 'Failed to save.' }));
    }
  };

  const del = async (c: ClimateContext) => {
    if (!window.confirm(`Delete climate context "${c.title}"?`)) return;
    try { await onDelete(c.id); } catch (err: any) { alert('Delete failed: ' + (err?.message || '')); }
  };

  if (loading && items.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading library…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={startAdd}>➕ Add Climate Context</button>
      </div>

      {form.show && (
        <FormShell form={form} onClose={() => setForm({ ...form, show: false })} onSave={save} title="Climate Context">
          <Field label="Title" required>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. South-west monsoon intensification" />
          </Field>
          <Field label="Statement" required>
            <textarea style={inputStyle} rows={3} value={statement} onChange={e => setStatement(e.target.value)} placeholder="Sourced climate driver statement shown in reports…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
            <Field label="Hazard Type">
              <select style={inputStyle} value={hazardType} onChange={e => setHazardType(e.target.value)}>
                <option value="">General / state-wide</option>
                {hazards.map(h => <option key={h.code} value={h.code}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="Region (District)">
              <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">State-wide</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Vintage">
              <input style={inputStyle} value={vintage} onChange={e => setVintage(e.target.value)} placeholder="2024" />
            </Field>
            <Field label="Display Order">
              <input type="number" style={inputStyle} value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
            <Field label="Source">
              <input style={inputStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. IMD, Kerala SDRF" />
            </Field>
            <Field label="Source URL">
              <input style={inputStyle} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#64748b' }}>
              <input type="checkbox" checked={isDemo} onChange={e => setIsDemo(e.target.checked)} /> Demo data (sample)
            </label>
          </div>
        </FormShell>
      )}

      <div style={cardStyle}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Title</th><th>Hazard</th><th>Region</th><th>Vintage</th><th>Order</th><th>State</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ color: '#64748b' }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: 420 }}>{c.statement}</div>
                    {c.source && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>Source: {c.source}</div>}
                  </td>
                  <td>{c.hazard_type ? hazardNames[c.hazard_type] || c.hazard_type : 'General'}</td>
                  <td>{c.region_name || 'State-wide'}</td>
                  <td>{c.vintage || '—'}</td>
                  <td>{c.display_order ?? 0}</td>
                  <td>
                    {c.is_demo && <span className="badge badge-info" style={{ marginRight: 4 }}>DEMO</span>}
                    <span className={`badge ${c.is_active ? 'badge-success' : 'badge-secondary'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => startEdit(c)} style={{ marginRight: 4 }}>✏️</button>
                    <button className="btn btn-sm" onClick={() => del(c)} style={{ color: '#dc2626' }}>🗑️</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No climate context entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommendations tab
// ---------------------------------------------------------------------------

function RecommendationsTab({ items, hazards, hazardNames, loading, onCreate, onUpdate, onDelete }: {
  items: Recommendation[];
  hazards: HazardType[];
  hazardNames: Record<string, string>;
  loading: boolean;
  onCreate: (p: any) => Promise<void>;
  onUpdate: (id: number, p: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({ show: false, editingId: null, saving: false, error: null });
  const [moduleType, setModuleType] = useState('HAZARD');
  const [hazardType, setHazardType] = useState('');
  const [classification, setClassification] = useState('');
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const reset = () => {
    setModuleType('HAZARD'); setHazardType(''); setClassification('');
    setText(''); setPriority('MEDIUM'); setDisplayOrder(0);
    setIsActive(true); setIsDemo(false);
  };
  const startAdd = () => { reset(); setForm({ show: true, editingId: null, saving: false, error: null }); };
  const startEdit = (r: Recommendation) => {
    setModuleType(r.module_code || 'HAZARD'); setHazardType(r.hazard_type || '');
    setClassification(r.classification || ''); setText(r.text);
    setPriority(r.priority || 'MEDIUM'); setDisplayOrder(r.display_order ?? 0);
    setIsActive(r.is_active); setIsDemo(r.is_demo);
    setForm({ show: true, editingId: r.id, saving: false, error: null });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setForm(f => ({ ...f, error: 'Recommendation text is required.' })); return; }
    setForm(f => ({ ...f, saving: true, error: null }));
    try {
      const payload = {
        module_code: moduleType, hazard_type: hazardType || '',
        classification: classification || '', text: text.trim(),
        priority, display_order: displayOrder, is_active: isActive, is_demo: isDemo,
      };
      if (form.editingId) await onUpdate(form.editingId, payload);
      else await onCreate(payload);
      setForm({ show: false, editingId: null, saving: false, error: null });
    } catch (err: any) {
      setForm(f => ({ ...f, saving: false, error: err?.response?.data?.detail || err?.message || 'Failed to save.' }));
    }
  };

  const del = async (r: Recommendation) => {
    if (!window.confirm('Delete this recommendation?')) return;
    try { await onDelete(r.id); } catch (err: any) { alert('Delete failed: ' + (err?.message || '')); }
  };

  if (loading && items.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading library…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={startAdd}>➕ Add Recommendation</button>
      </div>

      {form.show && (
        <FormShell form={form} onClose={() => setForm({ ...form, show: false })} onSave={save} title="Recommendation">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem' }}>
            <Field label="Module" required>
              <select style={inputStyle} value={moduleType} onChange={e => setModuleType(e.target.value)}>
                {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Hazard Type">
              <select style={inputStyle} value={hazardType} onChange={e => setHazardType(e.target.value)}>
                <option value="">All hazards</option>
                {hazards.map(h => <option key={h.code} value={h.code}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="Classification">
              <input style={inputStyle} value={classification} onChange={e => setClassification(e.target.value)} placeholder="e.g. Very High / MH" />
            </Field>
            <Field label="Priority">
              <select style={inputStyle} value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Display Order">
              <input type="number" style={inputStyle} value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Recommendation" required>
            <textarea style={inputStyle} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Configuration / adaptation action…" />
          </Field>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#64748b' }}>
              <input type="checkbox" checked={isDemo} onChange={e => setIsDemo(e.target.checked)} /> Demo data (sample)
            </label>
          </div>
        </FormShell>
      )}

      <div style={cardStyle}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Module</th><th>Hazard</th><th>Classification</th><th>Recommendation</th><th>Priority</th><th>State</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ color: '#64748b' }}>{i + 1}</td>
                  <td>{r.module_type || r.module_code}</td>
                  <td>{r.hazard_type ? hazardNames[r.hazard_type] || r.hazard_type : 'All'}</td>
                  <td>{r.classification || '—'}</td>
                  <td style={{ maxWidth: 420 }}>{r.text}</td>
                  <td><span className={`badge ${r.priority === 'HIGH' ? 'badge-danger' : r.priority === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>{r.priority || '—'}</span></td>
                  <td>
                    {r.is_demo && <span className="badge badge-info" style={{ marginRight: 4 }}>DEMO</span>}
                    <span className={`badge ${r.is_active ? 'badge-success' : 'badge-secondary'}`}>{r.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => startEdit(r)} style={{ marginRight: 4 }}>✏️</button>
                    <button className="btn btn-sm" onClick={() => del(r)} style={{ color: '#dc2626' }}>🗑️</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No recommendations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historical Events tab
// ---------------------------------------------------------------------------

function EventsTab({ items, hazards, districts, hazardNames, loading, onCreate, onUpdate, onDelete }: {
  items: HazardEvent[];
  hazards: HazardType[];
  districts: AdministrativeUnit[];
  hazardNames: Record<string, string>;
  loading: boolean;
  onCreate: (p: any) => Promise<void>;
  onUpdate: (id: number, p: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({ show: false, editingId: null, saving: false, error: null });
  const [hazardType, setHazardType] = useState('FLOOD');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [latitude, setLatitude] = useState('10.5');
  const [longitude, setLongitude] = useState('76.2');
  const [adminUnit, setAdminUnit] = useState('');
  const [magnitude, setMagnitude] = useState('');
  const [loss, setLoss] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  const reset = () => {
    setHazardType('FLOOD'); setEventDate(new Date().toISOString().slice(0, 10));
    setLatitude('10.5'); setLongitude('76.2'); setAdminUnit('');
    setMagnitude(''); setLoss(''); setDescription(''); setSource(''); setSourceUrl('');
    setIsDemo(false);
  };
  const startAdd = () => { reset(); setForm({ show: true, editingId: null, saving: false, error: null }); };
  const startEdit = (ev: HazardEvent) => {
    setHazardType(ev.hazard_type); setEventDate(ev.event_date);
    setLatitude(String(ev.latitude)); setLongitude(String(ev.longitude));
    setAdminUnit(ev.administrative_unit ? String(ev.administrative_unit) : '');
    setMagnitude(ev.magnitude != null ? String(ev.magnitude) : '');
    setLoss(ev.loss != null ? String(ev.loss) : '');
    setDescription(ev.description || ''); setSource(ev.source || '');
    setSourceUrl(ev.source_url || ''); setIsDemo(ev.is_demo);
    setForm({ show: true, editingId: ev.id, saving: false, error: null });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latitude); const lon = parseFloat(longitude);
    if (!hazardType || !eventDate || isNaN(lat) || isNaN(lon)) {
      setForm(f => ({ ...f, error: 'Hazard type, date, latitude and longitude are required.' }));
      return;
    }
    setForm(f => ({ ...f, saving: true, error: null }));
    try {
      const payload = {
        hazard_type: hazardType, event_date: eventDate,
        latitude: lat, longitude: lon,
        administrative_unit: adminUnit ? Number(adminUnit) : null,
        magnitude: magnitude === '' ? null : parseFloat(magnitude),
        loss: loss === '' ? null : parseFloat(loss),
        description, source, source_url: sourceUrl, is_demo: isDemo,
      };
      if (form.editingId) await onUpdate(form.editingId, payload);
      else await onCreate(payload);
      setForm({ show: false, editingId: null, saving: false, error: null });
    } catch (err: any) {
      setForm(f => ({ ...f, saving: false, error: err?.response?.data?.detail || err?.message || 'Failed to save.' }));
    }
  };

  const del = async (ev: HazardEvent) => {
    if (!window.confirm(`Delete event "${ev.description || ev.event_date}"?`)) return;
    try { await onDelete(ev.id); } catch (err: any) { alert('Delete failed: ' + (err?.message || '')); }
  };

  if (loading && items.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading library…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={startAdd}>➕ Add Historical Event</button>
      </div>

      {form.show && (
        <FormShell form={form} onClose={() => setForm({ ...form, show: false })} onSave={save} title="Historical Event">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
            <Field label="Hazard Type" required>
              <select style={inputStyle} value={hazardType} onChange={e => setHazardType(e.target.value)}>
                {hazards.map(h => <option key={h.code} value={h.code}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="Event Date" required>
              <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </Field>
            <Field label="Latitude" required>
              <input type="number" step="any" style={inputStyle} value={latitude} onChange={e => setLatitude(e.target.value)} />
            </Field>
            <Field label="Longitude" required>
              <input type="number" step="any" style={inputStyle} value={longitude} onChange={e => setLongitude(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
            <Field label="District / Unit">
              <select style={inputStyle} value={adminUnit} onChange={e => setAdminUnit(e.target.value)}>
                <option value="">Not linked</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Magnitude">
              <input type="number" step="any" style={inputStyle} value={magnitude} onChange={e => setMagnitude(e.target.value)} placeholder="e.g. rainfall mm" />
            </Field>
            <Field label="Loss (₹ Cr)">
              <input type="number" step="any" style={inputStyle} value={loss} onChange={e => setLoss(e.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <textarea style={inputStyle} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Event summary…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
            <Field label="Source">
              <input style={inputStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. NDRF / media reports" />
            </Field>
            <Field label="Source URL">
              <input style={inputStyle} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#64748b' }}>
            <input type="checkbox" checked={isDemo} onChange={e => setIsDemo(e.target.checked)} /> Demo data (sample)
          </label>
        </FormShell>
      )}

      {items.length > 500 && (
        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Showing the 500 most recent of {items.length} historical events. The full repository is available via the API.
        </div>
      )}

      <div style={cardStyle}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Hazard</th><th>Location</th><th>Magnitude</th><th>Loss</th><th>Description</th><th>State</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 500).map((ev, i) => (
                <tr key={ev.id}>
                  <td style={{ color: '#64748b' }}>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{ev.event_date}</td>
                  <td>{hazardNames[ev.hazard_type] || ev.hazard_type}</td>
                  <td>{ev.admin_unit_name || `${ev.latitude.toFixed(3)}, ${ev.longitude.toFixed(3)}`}</td>
                  <td>{ev.magnitude != null ? ev.magnitude : '—'}</td>
                  <td>{ev.loss != null ? `₹${ev.loss} Cr` : '—'}</td>
                  <td style={{ maxWidth: 320, fontSize: '0.8rem', color: '#475569' }}>{ev.description}</td>
                  <td>{ev.is_demo && <span className="badge badge-info">DEMO</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => startEdit(ev)} style={{ marginRight: 4 }}>✏️</button>
                    <button className="btn btn-sm" onClick={() => del(ev)} style={{ color: '#dc2626' }}>🗑️</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No historical events found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}