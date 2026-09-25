/**
 * Settings page — user management (HVRA §10 RBAC).
 * Admin-only: list, create, update role, and remove platform users.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoles,
  getStates,
  getDistricts,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { User, RoleOption, AdministrativeUnit } from '../../types';

export default function Settings() {
  const { isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [states, setStates] = useState<AdministrativeUnit[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'ANALYST',
    organization: '',
    state: '',
    district: '',
    is_staff: false,
  });
  const [busy, setBusy] = useState(false);

  // Inline territory editor (HVRA §2 territorial RBAC)
  const [editingTerritory, setEditingTerritory] = useState<number | null>(null);
  const [terrState, setTerrState] = useState('');
  const [terrDistrict, setTerrDistrict] = useState('');
  const [savingTerr, setSavingTerr] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [u, r, s, d] = await Promise.all([getUsers(), getRoles(), getStates(), getDistricts()]);
      setUsers(u);
      setRoles(r);
      setStates(s);
      setDistricts(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard', { replace: true });
      return;
    }
    load();
  }, [isAdmin, navigate, load]);

  if (!isAdmin) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createUser({
        ...form,
        state: form.state ? Number(form.state) : null,
        district: form.district ? Number(form.district) : null,
      });
      setNotice(`User "${form.username}" created.`);
      setShowCreate(false);
      setForm({ username: '', password: '', email: '', first_name: '', last_name: '', role: 'ANALYST', organization: '', state: '', district: '', is_staff: false });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (id: number, role: string) => {
    setError(null);
    try {
      await updateUser(id, { role });
      setNotice('Role updated.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const handleToggleStaff = async (u: User) => {
    setError(null);
    try {
      await updateUser(u.id, { is_staff: !u.is_staff });
      setNotice(u.is_staff ? `Removed staff flag from ${u.username}.` : `${u.username} is now staff.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update user.');
    }
  };

  const startTerritoryEdit = (u: User) => {
    setEditingTerritory(editingTerritory === u.id ? null : u.id);
    setTerrState(stateOf(u) ? String(stateOf(u)) : '');
    setTerrDistrict(districtOf(u) ? String(districtOf(u)) : '');
  };

  const filteredDistricts = terrState
    ? districts.filter((d) => d.parent_id === Number(terrState))
    : districts;

  const handleSaveTerritory = async (u: User) => {
    setSavingTerr(true);
    setError(null);
    try {
      await updateUser(u.id, {
        state: terrState ? Number(terrState) : null,
        district: terrDistrict ? Number(terrDistrict) : null,
      });
      setNotice(`Territory updated for ${u.username}.`);
      setEditingTerritory(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update territory.');
    } finally {
      setSavingTerr(false);
    }
  };

  const territoryLabel = (u: User): string => {
    const districtName = u.district_name ?? u.profile?.district_name;
    const stateName = u.state_name ?? u.profile?.state_name;
    if (districtName) return `District: ${districtName}`;
    if (stateName) return `State: ${stateName}`;
    return 'All regions';
  };

  const roleOf = (u: User): string => u.role_code ?? u.profile?.role_code ?? '';
  const districtOf = (u: User): number | null => u.district ?? u.profile?.district ?? null;
  const stateOf = (u: User): number | null => u.state ?? u.profile?.state ?? null;

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) {
      setError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteUser(u.id);
      setNotice(`User "${u.username}" deleted.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.6rem' }}>⚙️</span>
            <div>
              <h2 className="card-title">User &amp; Access Management</h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                Role-based access control (HVRA §10) — Platform Administrators manage users, roles, and staff flags.
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowCreate((v) => !v); setError(null); setNotice(null); }}>
            {showCreate ? '✕ Cancel' : '➕ Create User'}
          </button>
        </div>

        {showCreate && (
          <div className="card-body" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>New Platform User</h4>
            <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <input className="form-control" placeholder="Username *" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              <input className="form-control" type="password" placeholder="Password *" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <input className="form-control" type="email" placeholder="Email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="form-control" placeholder="First name" value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <input className="form-control" placeholder="Last name" value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              <input className="form-control" placeholder="Organization (e.g. KSDMA)" value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })} />
              <select className="form-control" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>{r.label} ({r.code})</option>
                ))}
              </select>
              <select className="form-control" value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value, district: '' })}>
                <option value="">Territory state (optional)</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select className="form-control" value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}>
                <option value="">Territory district (optional)</option>
                {(form.state ? districts.filter((d) => d.parent_id === Number(form.state)) : districts).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <input type="checkbox" checked={form.is_staff}
                  onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} />
                Staff (admin privileges)
              </label>
              <button className="btn btn-primary" disabled={busy} style={{ gridColumn: '1 / -1', maxWidth: 220 }}>
                {busy ? 'Creating…' : 'Create User'}
              </button>
            </form>
          </div>
        )}

        <div className="card-body" style={{ padding: 0 }}>
          {notice && (
            <div className="alert alert-success" style={{ margin: '1rem' }}>
              <span>✅</span>
              <div>{notice}</div>
            </div>
          )}
          {error && (
            <div className="alert alert-error" style={{ margin: '1rem' }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="empty-state"><div className="spinner" /><div>Loading users…</div></div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No users yet</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1.25rem' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Email / Organization</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Role</th>
                    <th style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>Staff</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Territory (HVRA §2)</th>
                    <th style={{ textAlign: 'left', padding: '0.85rem 1rem' }}>Joined</th>
                    <th style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <Fragment key={u.id}>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
                          {u.id === currentUser?.id && (
                            <span className="badge badge-info" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>you</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>@{u.username}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>
                        <div>{u.email || '—'}</div>
                        <div style={{ color: '#94a3b8' }}>{u.organization ?? u.profile?.organization ?? ''}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <select
                          className="form-control"
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', maxWidth: 190 }}
                          value={roleOf(u)}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          {roles.map((r) => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.85rem 1rem' }}>
                        <button
                          className={`badge ${u.is_staff ? 'badge-success' : 'badge-draft'}`}
                          style={{ border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}
                          onClick={() => handleToggleStaff(u)}
                          title="Toggle staff (admin) flag"
                        >
                          {u.is_staff ? 'YES' : 'no'}
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{territoryLabel(u)}</span>
                          {(roleOf(u) === 'STATE_OFFICIAL' && !(u.state_name ?? u.profile?.state_name)) ||
                            (roleOf(u) === 'DISTRICT_OFFICIAL' && !(u.district_name ?? u.profile?.district_name)) ? (
                            <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>unassigned</span>
                          ) : null}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                            onClick={() => startTerritoryEdit(u)}
                            title={editingTerritory === u.id ? 'Close territory editor' : 'Assign state/district territory'}
                          >
                            {editingTerritory === u.id ? '✕' : '🎯'}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                        {new Date(u.date_joined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem 1.25rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#dc2626' }}
                          onClick={() => handleDelete(u)}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                    {editingTerritory === u.id && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan={7} style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                                State territory
                              </div>
                              <select
                                className="form-control"
                                style={{ minWidth: 200 }}
                                value={terrState}
                                onChange={(e) => { setTerrState(e.target.value); setTerrDistrict(''); }}
                              >
                                <option value="">All states</option>
                                {states.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                                District territory
                              </div>
                              <select
                                className="form-control"
                                style={{ minWidth: 200 }}
                                value={terrDistrict}
                                onChange={(e) => setTerrDistrict(e.target.value)}
                              >
                                <option value="">All districts</option>
                                {filteredDistricts.map((d) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={savingTerr}
                              onClick={() => handleSaveTerritory(u)}
                            >
                              {savingTerr ? 'Saving…' : 'Save Territory'}
                            </button>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              STATE_OFFICIAL → restricted to the selected state; DISTRICT_OFFICIAL → restricted to the selected district (and its blocks/villages).
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Roles reference */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">Access Levels</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
            {roles.map((r) => (
              <div key={r.code} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{r.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', fontFamily: 'monospace' }}>{r.code}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}