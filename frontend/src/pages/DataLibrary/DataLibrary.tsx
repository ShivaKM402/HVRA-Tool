import { useEffect, useState } from 'react';
import { getDataSources } from '../../services/api';
import type { DataSource } from '../../types';

export default function DataLibrary() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSources() {
      try {
        setLoading(true);
        setError(null);
        const res = await getDataSources();
        setDataSources(res.results || []);
      } catch (err: unknown) {
        console.error('Failed to load data sources:', err);
        setError('Failed to load datasets from backend API.');
      } finally {
        setLoading(false);
      }
    }

    loadSources();
  }, []);

  const getDatasetType = (src: DataSource): string => {
    const metaType = src.metadata?.data_type as string;
    if (metaType) return metaType;
    if (src.name.includes('Administrative')) return 'Administrative Boundaries';
    if (src.name.includes('Flood Data') || src.name.includes('Flood-prone')) return 'Flood Hazard Layer';
    if (src.name.includes('Historical')) return 'Historical Flood Events';
    return 'GIS Layer';
  };

  const getDatasetCoverage = (src: DataSource): string => {
    const metaCoverage = src.metadata?.coverage as string;
    if (metaCoverage) return metaCoverage;
    return src.vintage || 'Kottayam District';
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Pilot Header Context Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                Pilot Data Library — Kottayam District
              </h2>
              <span className="badge badge-warning">DEMO DATA</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              Catalogue of geospatial datasets configured for the <strong>Kerala → Kottayam District</strong> pilot assessment.
            </p>
          </div>
          <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
            State: <strong>Kerala</strong> | District: <strong>Kottayam</strong>
          </div>
        </div>
      </div>

      {/* Dataset Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Kottayam Pilot Datasets</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-gov-muted)' }}>
            Showing {dataSources.length} datasets
          </span>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gov-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <div>Loading Kottayam datasets...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
              ⚠️ {error}
            </div>
          ) : dataSources.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon">🗃️</div>
              <div className="empty-state-title">No Datasets Found</div>
              <div className="empty-state-description">
                No datasets are currently configured for Kottayam district.
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dataset Name</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Coverage</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSources.map((src) => {
                    const isDemo = src.is_demo || src.name.includes('[DEMO]');
                    return (
                      <tr key={src.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-gov-navy)' }}>
                            {src.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-gov-muted)', marginTop: '0.2rem' }}>
                            {src.description}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {getDatasetType(src)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                            {src.organization || 'DEMO DATA'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {getDatasetCoverage(src)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {src.last_updated ? new Date(src.last_updated).toLocaleDateString() : '2026-01-01'}
                          </span>
                        </td>
                        <td>
                          {isDemo ? (
                            <span className="badge badge-warning">DEMO DATA</span>
                          ) : (
                            <span className="badge badge-success">Official</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Government Data Disclaimer Notice */}
      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbebf9' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
            ⚠️ Important Notice Regarding Data Provenance
          </div>
          <div style={{ fontSize: '0.825rem', color: '#78350f', lineHeight: 1.5 }}>
            All datasets currently displayed in this prototype are synthetic <strong>DEMO DATA</strong> created strictly for client demonstration purposes.
            No official government data has been fabricated. For production deployment, these sample layers will be replaced with validated official datasets from Survey of India, ISRO/NRSC, and Kerala State Disaster Management Authority (KSDMA).
          </div>
        </div>
      </div>
    </div>
  );
}
