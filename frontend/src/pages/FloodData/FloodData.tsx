import { useEffect, useState } from 'react';
import { getFloodBlockSummary, getDistricts } from '../../services/api';
import type { AdministrativeUnit } from '../../types';

export default function FloodData() {
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load available districts on mount
  useEffect(() => {
    async function loadDistricts() {
      try {
        const dists = await getDistricts();
        setDistricts(dists || []);
      } catch (err) {
        console.error('Failed to load districts:', err);
      }
    }
    loadDistricts();
  }, []);

  // Load summaries whenever selectedDistrict changes
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const query = selectedDistrict ? { district: selectedDistrict } : undefined;
        const res = await getFloodBlockSummary(query);
        setSummaries(res || []);
      } catch (err: unknown) {
        console.error('Failed to load block summary:', err);
        setError('Failed to load flood block summary from backend API.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedDistrict]);

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header Context Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                Block Flood Summary — {selectedDistrict ? `${selectedDistrict} District` : 'All Districts (Kerala)'}
              </h2>
              <span className="badge badge-warning">DEMO DATA</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              Per-block summary of historical flood events and flood-prone area percentages.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Filter District:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              style={{
                background: '#1e293b',
                color: '#ffffff',
                border: '1px solid #475569',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <option value="">All Kerala Districts</option>
              {districts.map(d => {
                const clean = d.name.replace(' [DEMO]', '').trim();
                return (
                  <option key={d.id} value={clean}>{clean}</option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Dataset Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Block Summary Data</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-gov-muted)' }}>
            Showing {summaries.length} blocks
          </span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gov-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <div>Loading flood summaries...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
              ⚠️ {error}
            </div>
          ) : summaries.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon">🌊</div>
              <div className="empty-state-title">No Data Found</div>
              <div className="empty-state-description">
                No flood block summary is currently available.
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Block Name</th>
                    <th>Total Area (sq. km)</th>
                    <th>Flood Prone Area (sq. km)</th>
                    <th>Flood Prone %</th>
                    <th>Historical Events</th>
                    <th>Event Freq. (events/yr)</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr key={summary.block_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-gov-navy)' }}>
                          {summary.block_name}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {summary.total_area_sqkm?.toFixed(2) || '0.00'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {summary.flood_prone_area_sqkm?.toFixed(2) || '0.00'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {(summary.flood_prone_percentage || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {summary.event_count || 0}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {summary.event_frequency?.toFixed(4) || '0.0000'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
