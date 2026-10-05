import { MapIcon } from '@/components/MapIcon/MapIcon';
import { useEffect, useState, useMemo } from 'react';
import { getDataSources, deleteDataSource, uploadDataset, getDataSourcePreview } from '@/services/api';
import type { DataSourcePreviewResponse } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { DataSource } from '@/types';
import { DeleteButton } from '@/components/DeleteButton/DeleteButton';
import './DataLibrary.css';

type CategoryFilter = 'ALL' | 'HAZARD' | 'EXPOSURE' | 'VULNERABILITY' | 'ADMIN' | 'CUSTOM';

export default function DataLibrary() {
  const { user } = useAuth();
  const canUpload = user?.profile?.role_code !== 'VIEWER';

  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  // Inspector Modal State
  const [inspectedSource, setInspectedSource] = useState<DataSource | null>(null);
  const [previewData, setPreviewData] = useState<DataSourcePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'records' | 'geometry' | 'metadata'>('records');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadHazardType, setUploadHazardType] = useState('FLOOD');
  const [uploadOrganization, setUploadOrganization] = useState('');
  const [uploadVintage, setUploadVintage] = useState('2024');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadSources = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDataSources();
      setDataSources(res.results || []);
    } catch (err: any) {
      console.error('Failed to load data sources:', err);
      setError(err.message || 'Failed to load datasets from backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleOpenInspector = async (src: DataSource) => {
    setInspectedSource(src);
    setInspectorTab('records');
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await getDataSourcePreview(src.id);
      setPreviewData(res);
    } catch (err) {
      console.error('Failed to load dataset preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadGeoJSON = () => {
    if (!inspectedSource) return;
    const payload = previewData?.raw_geojson || {
      type: 'FeatureCollection',
      name: inspectedSource.name,
      record_count: previewData?.record_count || 1,
      features: previewData?.features_preview || [],
      metadata: inspectedSource.metadata,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inspectedSource.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDatasetType = (src: DataSource): string => {
    const metaType = src.metadata?.data_type as string;
    if (metaType) return metaType;
    if (src.name.includes('Administrative') || src.name.includes('Boundaries')) return 'Administrative Boundaries';
    if (src.name.includes('Flood') || src.name.includes('Inundation')) return 'Flood Hazard Layer';
    if (src.name.includes('Landslide')) return 'Landslide Susceptibility';
    if (src.name.includes('Cyclone') || src.name.includes('Surge')) return 'Cyclone & Surge Grid';
    if (src.name.includes('Vulnerability') || src.name.includes('Socio-Economic')) return 'Socio-Economic Vulnerability';
    if (src.name.includes('Infrastructure') || src.name.includes('Lifeline')) return 'Critical Infrastructure';
    if (src.name.includes('Historical')) return 'Historical Event Log';
    return 'GIS Spatial Layer';
  };

  const getCategoryFromSource = (src: DataSource): CategoryFilter => {
    if (!src.is_builtin) return 'CUSTOM';
    const dtype = getDatasetType(src).toLowerCase();
    const name = src.name.toLowerCase();
    if (dtype.includes('flood') || dtype.includes('landslide') || dtype.includes('cyclone') || dtype.includes('hazard') || dtype.includes('historical') || name.includes('flood') || name.includes('landslide')) {
      return 'HAZARD';
    }
    if (dtype.includes('infrastructure') || dtype.includes('exposure') || dtype.includes('lifeline') || name.includes('infrastructure') || name.includes('asset')) {
      return 'EXPOSURE';
    }
    if (dtype.includes('vulnerability') || dtype.includes('socio') || name.includes('vulnerability')) {
      return 'VULNERABILITY';
    }
    if (dtype.includes('administrative') || dtype.includes('boundaries') || name.includes('administrative') || name.includes('boundary')) {
      return 'ADMIN';
    }
    return 'HAZARD';
  };

  const filtered = useMemo(() => {
    return dataSources.filter(src => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        src.name.toLowerCase().includes(q) ||
        (src.description || '').toLowerCase().includes(q) ||
        (src.organization || '').toLowerCase().includes(q) ||
        (src.vintage || '').toLowerCase().includes(q);

      const cat = getCategoryFromSource(src);
      const matchCategory =
        categoryFilter === 'ALL' ||
        cat === categoryFilter ||
        (categoryFilter === 'CUSTOM' && !src.is_builtin);

      return matchSearch && matchCategory;
    });
  }, [dataSources, searchQuery, categoryFilter]);

  // KPI Metrics Calculation
  const stats = useMemo(() => {
    const total = dataSources.length;
    let hazard = 0;
    let exposure = 0;
    let vulnerability = 0;
    let custom = 0;

    dataSources.forEach(s => {
      if (!s.is_builtin) custom++;
      const cat = getCategoryFromSource(s);
      if (cat === 'HAZARD') hazard++;
      else if (cat === 'EXPOSURE') exposure++;
      else if (cat === 'VULNERABILITY') vulnerability++;
    });

    return { total, hazard, exposure, vulnerability, custom };
  }, [dataSources]);

  // Delete Data Source Handler
  const handleDeleteSource = async (src: DataSource) => {
    if (!window.confirm(`Are you sure you want to delete dataset "${src.name}"?\n\nThis will remove the data layer from the catalogue and assessment queries.`)) {
      return;
    }
    try {
      await deleteDataSource(src.id);
      setDataSources(prev => prev.filter(item => item.id !== src.id));
      if (inspectedSource?.id === src.id) {
        setInspectedSource(null);
      }
      setNoticeMsg({ text: `Dataset "${src.name}" deleted successfully.`, type: 'success' });
      setTimeout(() => setNoticeMsg(null), 5000);
    } catch (err: any) {
      alert(`Failed to delete dataset: ${err.message || 'Error occurred'}`);
    }
  };

  // Upload Dataset Handler
  const handleUpload = async () => {
    if (!uploadFileObj) {
      alert('Please select a valid spatial file (.geojson, .json, .csv, or .zip).');
      return;
    }
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', uploadFileObj);
      fd.append('name', uploadFileName || uploadFileObj.name);
      fd.append('hazard_type', uploadHazardType);
      fd.append('organization', uploadOrganization || 'User Upload');
      fd.append('vintage', uploadVintage || '2024');
      fd.append('description', `User uploaded ${uploadHazardType} spatial dataset (${uploadFileObj.name})`);

      await uploadDataset(fd);
      await loadSources();
      setShowUploadModal(false);
      setUploadFileName('');
      setUploadFileObj(null);
      setUploadOrganization('');
      setNoticeMsg({
        text: `Dataset "${uploadFileName || uploadFileObj.name}" successfully uploaded, parsed, and registered in PostGIS.`,
        type: 'success',
      });
      setTimeout(() => setNoticeMsg(null), 6000);
    } catch (err: any) {
      alert('Failed to upload dataset: ' + (err.message || 'Validation error'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="data-lib-container">
      {/* ── 1. Hero Command Header ── */}
      <div className="data-lib-hero">
        <div className="data-lib-hero-header">
          <div>
            <div className="data-lib-title-row">
              <span style={{ fontSize: '1.8rem' }}>🗄️</span>
              <h1 className="data-lib-hero-title">Geospatial Data Repository & Asset Library</h1>
              <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                KERALA SPATIAL INFRASTRUCTURE
              </span>
            </div>
            <p className="data-lib-hero-desc">
              Curated multi-hazard thematic layers, baseline exposure geodatabases, socio-economic vulnerability indicators,
              and administrative units covering all 14 revenue districts in Kerala. Connects directly to the HVRA scoring pipeline.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {canUpload ? (
              <button
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                  padding: '0.6rem 1.15rem',
                  fontSize: '0.9rem',
                }}
                onClick={() => setShowUploadModal(true)}
              >
                <span>➕</span> Ingest Spatial Dataset
              </button>
            ) : (
              <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                Read-only — Viewer role cannot ingest datasets
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={loadSources}
              title="Refresh catalogue from PostGIS"
              style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Metric KPI Cards ── */}
      <div className="data-lib-stats-grid">
        <div className="data-lib-stat-card">
          <div className="data-lib-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            📚
          </div>
          <div>
            <div className="data-lib-stat-val">{stats.total}</div>
            <div className="data-lib-stat-label">Total Data Sources</div>
          </div>
        </div>

        <div className="data-lib-stat-card">
          <div className="data-lib-stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
            🌊
          </div>
          <div>
            <div className="data-lib-stat-val">{stats.hazard}</div>
            <div className="data-lib-stat-label">Hazard Modalities</div>
          </div>
        </div>

        <div className="data-lib-stat-card">
          <div className="data-lib-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            👥
          </div>
          <div>
            <div className="data-lib-stat-val">{stats.exposure}</div>
            <div className="data-lib-stat-label">Exposure & Assets</div>
          </div>
        </div>

        <div className="data-lib-stat-card">
          <div className="data-lib-stat-icon" style={{ background: '#fefce8', color: '#f59e0b' }}>
            📉
          </div>
          <div>
            <div className="data-lib-stat-val">{stats.vulnerability}</div>
            <div className="data-lib-stat-label">Vulnerability Indices</div>
          </div>
        </div>

        <div className="data-lib-stat-card">
          <div className="data-lib-stat-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
            🌐
          </div>
          <div>
            <div className="data-lib-stat-val">EPSG:4326</div>
            <div className="data-lib-stat-label">PostGIS Projection</div>
          </div>
        </div>
      </div>

      {/* ── Notice Toast ── */}
      {noticeMsg && (
        <div
          className={`alert ${noticeMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}
          style={{
            animation: 'fadeIn 0.2s ease-out',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}
        >
          <span>{noticeMsg.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{noticeMsg.text}</span>
        </div>
      )}

      {/* ── 3. Filters & Search Toolbar ── */}
      <div className="data-lib-toolbar-card">
        <div className="data-lib-categories-nav">
          <button
            className={`data-lib-cat-btn${categoryFilter === 'ALL' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('ALL')}
          >
            All Layers ({dataSources.length})
          </button>
          <button
            className={`data-lib-cat-btn${categoryFilter === 'HAZARD' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('HAZARD')}
          >
            🌊 Hazard Prone ({stats.hazard})
          </button>
          <button
            className={`data-lib-cat-btn${categoryFilter === 'EXPOSURE' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('EXPOSURE')}
          >
            👥 Exposure & Assets ({stats.exposure})
          </button>
          <button
            className={`data-lib-cat-btn${categoryFilter === 'VULNERABILITY' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('VULNERABILITY')}
          >
            📉 Vulnerability ({stats.vulnerability})
          </button>
          <button
            className={`data-lib-cat-btn${categoryFilter === 'ADMIN' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('ADMIN')}
          >
            <MapIcon /> Boundaries
          </button>
          <button
            className={`data-lib-cat-btn${categoryFilter === 'CUSTOM' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('CUSTOM')}
          >
            📁 Custom ({stats.custom})
          </button>
        </div>

        <div className="data-lib-search-box">
          <span>🔍</span>
          <input
            type="text"
            className="data-lib-search-input"
            placeholder="Search layers, organization, vintage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Spatial Dataset Ledger Table ── */}
      <div className="data-lib-table-card">
        <div className="data-lib-table-header">
          <h2 className="data-lib-table-title">
            <span>📑</span> Configured Geospatial Layers ({filtered.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Ready for Module 1–4 Assessment Scoring Engines
          </span>
        </div>

        <div>
          {loading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
              <div style={{ fontWeight: 600 }}>Loading spatial datasets from PostGIS...</div>
            </div>
          ) : error ? (
            <div className="alert alert-error" style={{ margin: '1.5rem' }}>
              ⚠️ {error}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗃️</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>No Spatial Layers Found</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                No datasets matched your current search filters.
              </div>
              <button
                className="btn btn-secondary"
                style={{ marginTop: '1rem' }}
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                }}
              >
                Clear Search Filters
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ border: 'none' }}>
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.9rem 1.25rem' }}>Spatial Dataset & Description</th>
                    <th style={{ textAlign: 'left', padding: '0.9rem 1rem' }}>Modality Type</th>
                    <th style={{ textAlign: 'left', padding: '0.9rem 1rem' }}>Source Organization</th>
                    <th style={{ textAlign: 'left', padding: '0.9rem 1rem' }}>Vintage & CRS</th>
                    <th style={{ textAlign: 'center', padding: '0.9rem 1rem' }}>Catalogue Tier</th>
                    <th style={{ textAlign: 'right', padding: '0.9rem 1.25rem' }}>Actions & Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((src) => {
                    const isDemo = src.is_demo || src.name.includes('[DEMO]');
                    const isCustom = !src.is_builtin;
                    const dtype = getDatasetType(src);

                    return (
                      <tr key={src.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                            {src.name.replace(' [DEMO]', '')}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem', maxWidth: 460 }}>
                            {src.description || 'Geospatial vector layer formatted for HVRA spatial queries.'}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <span
                            className="badge badge-info"
                            style={{ fontSize: '0.74rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            {dtype.includes('Flood') ? '🌊' : dtype.includes('Landslide') ? '⛰️' : dtype.includes('Cyclone') ? '🌀' : dtype.includes('Vulnerability') ? '📉' : dtype.includes('Infrastructure') ? '🏥' : '<MapIcon />'} {dtype}
                          </span>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                            {src.organization || 'User Ingestion'}
                          </div>
                          {src.source_url && (
                            <a
                              href={src.source_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none' }}
                            >
                              Official Portal ↗
                            </a>
                          )}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>
                            {src.vintage || '2024'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            CRS: {src.metadata?.crs || 'EPSG:4326'}
                          </div>
                        </td>

                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                          {isCustom ? (
                            <span className="badge badge-completed" style={{ fontSize: '0.72rem' }}>
                              User Upload
                            </span>
                          ) : isDemo ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                              DEMO DATA
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                              Official Base
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }}>
                          <div className="data-lib-row-actions">
                            <button
                              className="data-lib-btn-inspect"
                              onClick={() => handleOpenInspector(src)}
                              title="Inspect Records, Geometries & Metadata"
                            >
                              👁️ Inspect
                            </button>
                            <DeleteButton 
                              onClick={() => handleDeleteSource(src)}
                              title="Delete this data source"
                            />
                          </div>
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

      {/* ── 5. Rich Multi-Tab Dataset Inspector Modal ── */}
      {inspectedSource && (
        <div className="data-lib-modal-overlay" onClick={() => setInspectedSource(null)}>
          <div className="data-lib-modal-card data-lib-inspector-wide" onClick={(e) => e.stopPropagation()}>
            <div className="data-lib-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span>🔍</span>
                <span>Dataset Inspector: {inspectedSource.name.replace(' [DEMO]', '')}</span>
              </div>
              <button
                onClick={() => setInspectedSource(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.35rem', cursor: 'pointer' }}
                title="Close Inspector"
              >
                ✕
              </button>
            </div>

            <div className="data-lib-modal-body">
              {/* Telemetry Header Summary Grid */}
              <div className="data-lib-inspector-summary">
                <div className="data-lib-inspector-pill">
                  <span className="data-lib-pill-k">Catalogue ID</span>
                  <span className="data-lib-pill-v">#{inspectedSource.id}</span>
                </div>
                <div className="data-lib-inspector-pill">
                  <span className="data-lib-pill-k">Record Count</span>
                  <span className="data-lib-pill-v" style={{ color: '#2563eb' }}>
                    {previewLoading
                      ? 'Loading…'
                      : previewData
                      ? `${previewData.record_count} Records`
                      : '1 Record'}
                  </span>
                </div>
                <div className="data-lib-inspector-pill">
                  <span className="data-lib-pill-k">Geometry Type</span>
                  <span className="data-lib-pill-v">
                    {previewData?.geometry_type || 'POLYGON'}
                  </span>
                </div>
                <div className="data-lib-inspector-pill">
                  <span className="data-lib-pill-k">Projection</span>
                  <span className="data-lib-pill-v">EPSG:4326</span>
                </div>
                <div className="data-lib-inspector-pill">
                  <span className="data-lib-pill-k">Catalogue Tier</span>
                  <span className="data-lib-pill-v">
                    {!inspectedSource.is_builtin
                      ? '📁 User Upload'
                      : inspectedSource.is_demo
                      ? '⚠️ DEMO DATA'
                      : '🏛️ Official Base'}
                  </span>
                </div>
                <div className="data-lib-inspector-pill">
                  <span className="data-lib-pill-k">Vintage</span>
                  <span className="data-lib-pill-v">{inspectedSource.vintage || '2024'}</span>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="data-lib-modal-tabs">
                <button
                  className={`data-lib-modal-tab${inspectorTab === 'records' ? ' active' : ''}`}
                  onClick={() => setInspectorTab('records')}
                >
                  <span>📊</span> Data Records & Attributes ({previewData?.features_preview?.length || 0})
                </button>
                <button
                  className={`data-lib-modal-tab${inspectorTab === 'geometry' ? ' active' : ''}`}
                  onClick={() => setInspectorTab('geometry')}
                >
                  <span><MapIcon /></span> Spatial Geometry & Coordinates
                </button>
                <button
                  className={`data-lib-modal-tab${inspectorTab === 'metadata' ? ' active' : ''}`}
                  onClick={() => setInspectorTab('metadata')}
                >
                  <span>📋</span> PostGIS Schema & JSON
                </button>
              </div>

              {/* Tab Content 1: Records Table */}
              {inspectorTab === 'records' && (
                <div>
                  {previewLoading ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }} />
                      <div>Extracting attribute features from dataset…</div>
                    </div>
                  ) : !previewData || previewData.features_preview.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🗂️</div>
                      <div style={{ fontWeight: 600 }}>No tabular records extracted</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        This layer represents a spatial polygon boundary without attribute tables.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Displaying first <strong>{previewData.features_preview.length}</strong> records from the dataset:
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                          {previewData.properties_keys.length} Attributes Defined
                        </span>
                      </div>
                      <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table className="data-lib-preview-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              {previewData.properties_keys.map((k) => (
                                <th key={k}>{k}</th>
                              ))}
                              <th>Geometry Coordinate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.features_preview.map((f, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                                {previewData.properties_keys.map((k) => (
                                  <td key={k} title={String(f.properties?.[k] ?? '')}>
                                    {String(f.properties?.[k] ?? '—')}
                                  </td>
                                ))}
                                <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.76rem', color: '#2563eb' }}>
                                  {f.geometry?.type === 'Point' && f.geometry.coordinates
                                    ? `[${Number(f.geometry.coordinates[0]).toFixed(3)}, ${Number(f.geometry.coordinates[1]).toFixed(3)}]`
                                    : f.geometry?.type || 'Polygon Boundary'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Geometry & Coordinates */}
              {inspectorTab === 'geometry' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                      Spatial Topology Specifications
                    </div>
                    <div className="data-lib-meta-kv">
                      <div className="data-lib-meta-k">Geometry Class:</div>
                      <div className="data-lib-meta-v">{previewData?.geometry_type || 'POLYGON'}</div>

                      <div className="data-lib-meta-k">Coordinate System:</div>
                      <div className="data-lib-meta-v">EPSG:4326 — World Geodetic System 1984 (WGS 84)</div>

                      <div className="data-lib-meta-k">Bounding Extent:</div>
                      <div className="data-lib-meta-v">
                        Kerala State Bounds: [74.85°E, 8.20°N] to [77.60°E, 12.80°N]
                      </div>

                      <div className="data-lib-meta-k">Storage Format:</div>
                      <div className="data-lib-meta-v">PostGIS Well-Known Binary / GeoJSON RFC 7946</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                      Raw Coordinates Stream Preview
                    </div>
                    <pre
                      style={{
                        background: '#0f172a',
                        color: '#4ade80',
                        padding: '1rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        maxHeight: '180px',
                        overflow: 'auto',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(
                        previewData?.features_preview?.[0]?.geometry || {
                          type: previewData?.geometry_type || 'Polygon',
                          status: 'Coordinates indexed in PostGIS spatial table',
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab Content 3: Metadata & JSON */}
              {inspectorTab === 'metadata' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Comprehensive JSON payload and provenance audit trail stored in the PostgreSQL database:
                  </div>
                  <pre
                    style={{
                      background: '#0b1329',
                      color: '#38bdf8',
                      padding: '1rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace',
                      maxHeight: '260px',
                      overflow: 'auto',
                      border: '1px solid rgba(255,255,255,0.08)',
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(
                      {
                        catalogue_id: inspectedSource.id,
                        name: inspectedSource.name,
                        organization: inspectedSource.organization,
                        vintage: inspectedSource.vintage,
                        description: inspectedSource.description,
                        is_builtin: inspectedSource.is_builtin,
                        is_demo: inspectedSource.is_demo,
                        metadata: inspectedSource.metadata,
                        extracted_preview: {
                          total_records: previewData?.record_count,
                          geometry_type: previewData?.geometry_type,
                          attributes: previewData?.properties_keys,
                        },
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer with Unclipped Actions */}
            <div className="data-lib-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDownloadGeoJSON}
                  style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Download GeoJSON format of this dataset"
                >
                  <span>📥</span> Download GeoJSON
                </button>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {previewData?.record_count || 1} records available
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setInspectedSource(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="data-lib-btn-delete"
                  style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem' }}
                  onClick={() => handleDeleteSource(inspectedSource)}
                  title="Permanently remove this data layer"
                >
                  🗑️ Delete Layer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Ingest Spatial Dataset Modal ── */}
      {showUploadModal && (
        <div className="data-lib-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="data-lib-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="data-lib-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📁</span> Ingest Spatial Dataset (GeoJSON / CSV / Shapefile)
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="data-lib-modal-body">
              <div style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
                Upload spatial vector polygons or tabular incident points. Files are validated for coordinates in
                <strong> EPSG:4326</strong> and registered into the PostgreSQL / PostGIS database.
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Dataset Title *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kerala Hydrological Survey 2024"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Hazard Modality
                  </label>
                  <select
                    className="form-control"
                    value={uploadHazardType}
                    onChange={(e) => setUploadHazardType(e.target.value)}
                  >
                    <option value="FLOOD">🌊 Flood</option>
                    <option value="LANDSLIDE">⛰️ Landslide</option>
                    <option value="CYCLONE">🌀 Cyclone</option>
                    <option value="COASTAL_EROSION">🏖️ Coastal Erosion</option>
                    <option value="DROUGHT">☀️ Drought</option>
                    <option value="LIGHTNING">⚡ Lightning</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Data Vintage Year
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 2024"
                    value={uploadVintage}
                    onChange={(e) => setUploadVintage(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Source Agency / Organization
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kerala Irrigation Dept / District Collectorate"
                  value={uploadOrganization}
                  onChange={(e) => setUploadOrganization(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Select File (.geojson, .json, .csv, .zip) *
                </label>
                <input
                  type="file"
                  accept=".geojson,.json,.csv,.zip"
                  className="form-control"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      setUploadFileObj(f);
                      if (!uploadFileName) {
                        setUploadFileName(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                />
              </div>

              {uploadFileObj && (
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📄</span>
                  <strong>{uploadFileObj.name}</strong>
                  <span style={{ color: '#64748b' }}>({(uploadFileObj.size / 1024).toFixed(1)} KB)</span>
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
                  {isUploading ? 'Validating & Ingesting...' : 'Upload & Register Layer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Statutory Data Disclaimer ── */}
      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbebf9' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⚠️</span> Statutory Notice on Data Provenance & Verification
          </div>
          <div style={{ fontSize: '0.825rem', color: '#78350f', lineHeight: 1.55 }}>
            Data layers tagged with <strong>DEMO DATA</strong> represent synthetic geometries created strictly for prototype verification and Task Force dry runs.
            Official assessments require authenticated uploads approved by authorized State or District Officials per Section 2 of the HVRA framework.
          </div>
        </div>
      </div>
    </div>
  );
}
