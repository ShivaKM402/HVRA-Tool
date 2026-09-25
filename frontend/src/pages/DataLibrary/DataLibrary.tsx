import { useEffect, useState } from 'react';
import { getDataSources, uploadDataset } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { DataSource } from '../../types';

export default function DataLibrary() {
  // Viewer is read-only (HVRA §2) — dataset upload needs a contributing role.
  const { user } = useAuth();
  const canUpload = user?.profile?.role_code !== 'VIEWER';
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  const loadSources = async () => {
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
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleUpload = async () => {
    if (!uploadFileObj) {
      alert('Please select a file to upload (.geojson, .json, .csv).');
      return;
    }
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', uploadFileObj);
      fd.append('name', uploadFileName || uploadFileObj.name);
      fd.append('hazard_type', 'FLOOD');
      fd.append('organization', 'User Upload');
      fd.append('description', `Custom uploaded spatial dataset (${uploadFileObj.name})`);
      
      await uploadDataset(fd);
      await loadSources();
      setShowUploadModal(false);
      setUploadFileName('');
      setUploadFileObj(null);
      setUploadSuccessMsg(`Dataset "${uploadFileName || uploadFileObj.name}" successfully uploaded and verified.`);
      setTimeout(() => setUploadSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to upload dataset: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const getDatasetType = (src: DataSource): string => {
    const metaType = src.metadata?.data_type as string;
    if (metaType) return metaType;
    if (src.name.includes('Administrative')) return 'Administrative Boundaries';
    if (src.name.includes('Flood') || src.name.includes('Inundation')) return 'Flood Hazard Layer';
    if (src.name.includes('Landslide')) return 'Landslide Layer';
    if (src.name.includes('Cyclone')) return 'Cyclone Layer';
    if (src.name.includes('Historical')) return 'Historical Events';
    return 'GIS Layer';
  };

  const filtered = dataSources.filter(src => {
    const q = searchQuery.toLowerCase();
    const matchSearch = src.name.toLowerCase().includes(q) || (src.description || '').toLowerCase().includes(q) || (src.organization || '').toLowerCase().includes(q);
    const dtype = getDatasetType(src);
    const matchType = !typeFilter || dtype.toLowerCase().includes(typeFilter.toLowerCase());
    return matchSearch && matchType;
  });

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      
      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📁</span> Upload Spatial Dataset
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Upload custom GeoJSON polygons/points or CSV hazard records. Files will be parsed and registered in the catalogue for assessment queries.
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Dataset Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kerala Hydrological Survey 2024"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Select File (.geojson, .json, .csv)
                </label>
                <input
                  type="file"
                  accept=".geojson,.json,.csv,.zip"
                  className="form-control"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFileObj(e.target.files[0]);
                      if (!uploadFileName) {
                        setUploadFileName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                />
              </div>

              {uploadFileObj && (
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                  📄 <strong>{uploadFileObj.name}</strong> ({(uploadFileObj.size / 1024).toFixed(1)} KB)
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={isUploading || !uploadFileObj}
                >
                  {isUploading ? 'Validating & Uploading...' : 'Upload & Register'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Context Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>
                Kerala State Spatial Data Catalogue
              </h2>
              <span className="badge badge-warning">DEMO CATALOGUE</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
              Geospatial datasets, hazard overlays, and historical incident records configured across all 14 districts in Kerala.
            </p>
          </div>
          {canUpload ? (
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb' }}
              onClick={() => setShowUploadModal(true)}
            >
              <span>➕</span> Upload Dataset
            </button>
          ) : (
            <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
              Read-only — Viewer role cannot upload
            </span>
          )}
        </div>
      </div>

      {uploadSuccessMsg && (
        <div className="alert alert-success" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
          <span>✓</span> {uploadSuccessMsg}
        </div>
      )}

      {/* Dataset Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 className="card-title">Configured Data Layers ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search datasets..."
              style={{ width: '220px', fontSize: '0.85rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: '180px', fontSize: '0.85rem' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Flood">Flood Hazard</option>
              <option value="Landslide">Landslide Layer</option>
              <option value="Cyclone">Cyclone Layer</option>
              <option value="Historical">Historical Events</option>
              <option value="Administrative">Administrative</option>
            </select>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gov-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <div>Loading data sources...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
              ⚠️ {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon">🗃️</div>
              <div className="empty-state-title">No Datasets Found</div>
              <div className="empty-state-description">
                No datasets matched your current search filters.
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dataset Name</th>
                    <th>Type</th>
                    <th>Source Organization</th>
                    <th>Vintage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((src) => {
                    const isDemo = src.is_demo || src.name.includes('[DEMO]');
                    const isCustom = !src.is_builtin;
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
                            {src.organization || 'User Upload'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {src.vintage || '2024'}
                          </span>
                        </td>
                        <td>
                          {isCustom ? (
                            <span className="badge badge-primary">User Upload</span>
                          ) : isDemo ? (
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
            All baseline datasets currently displayed in this prototype are synthetic <strong>DEMO DATA</strong> created strictly for demonstration purposes.
            Users may upload custom validated shapefiles, GeoJSON boundaries, or CSV incident data via the upload tool.
          </div>
        </div>
      </div>
    </div>
  );
}
