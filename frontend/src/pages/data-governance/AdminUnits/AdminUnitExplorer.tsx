/**
 * Admin Unit Explorer Page (HVRA Section 6)
 * Browse state, district, block, and panchayat boundaries with spatial tree and Add District modal.
 */
import { MapIcon } from '@/components/MapIcon/MapIcon';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDistricts, getBlocks } from '@/services/api';
import AddDistrictModal from '@/pages/assessments/NewAssessment/AddDistrictModal';
import type { AdministrativeUnit } from '@/types';
import './AdminUnitExplorer.css';

export default function AdminUnitExplorer() {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<AdministrativeUnit | null>(null);
  const [blocks, setBlocks] = useState<AdministrativeUnit[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDistrictModalOpen, setIsAddDistrictModalOpen] = useState(false);

  const fetchDistricts = async () => {
    try {
      setLoadingDistricts(true);
      const data = await getDistricts();
      setDistricts(data);
      if (data.length > 0 && !selectedDistrict) {
        const tvm = data.find((d) => d.name.toLowerCase().includes('thiruvananthapuram')) || data[0];
        setSelectedDistrict(tvm);
      }
    } catch (err) {
      console.warn('Could not load districts', err);
    } finally {
      setLoadingDistricts(false);
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (!selectedDistrict) return;
    setLoadingBlocks(true);
    getBlocks(selectedDistrict.id)
      .then((data) => setBlocks(data))
      .catch((err) => console.warn('Could not load blocks', err))
      .finally(() => setLoadingBlocks(false));
  }, [selectedDistrict]);

  const filteredDistricts = districts.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-units-container">
      {/* Header */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              <Link to="/dashboard">Dashboard</Link> / <span>Administrative Units</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
              <MapIcon /> Administrative Unit & Boundary Explorer
            </h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Statutory spatial hierarchy of Kerala: State → Revenue Districts → Community Development Blocks → Grama Panchayats.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddDistrictModalOpen(true)}
            >
              + Add District
            </button>
            {selectedDistrict && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/new-assessment?district=${selectedDistrict.id}`)}
              >
                Assess {selectedDistrict.name} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Explorer Split Grid */}
      <div className="explorer-grid">
        {/* District List Sidebar */}
        <div className="card" style={{ padding: '1.25rem', height: 'fit-content' }}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search districts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="district-list">
            {loadingDistricts ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : filteredDistricts.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No districts match &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredDistricts.map((d) => {
                const isSelected = selectedDistrict?.id === d.id;
                return (
                  <div
                    key={d.id}
                    className={`district-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDistrict(d)}
                  >
                    <div>
                      <div className="district-name">{d.name}</div>
                      <div className="district-sub">Code: {d.code || `KL-${d.id}`}</div>
                    </div>
                    <span className="district-arrow">→</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected District Details & Blocks */}
        <div className="card" style={{ padding: '1.5rem' }}>
          {selectedDistrict ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <span className="badge badge-info" style={{ marginBottom: '0.4rem' }}>REVENUE DISTRICT</span>
                  <h2 style={{ margin: '0.2rem 0', fontSize: '1.4rem', color: '#0f172a' }}>
                    {selectedDistrict.name} District
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    State: Kerala · Administrative Units Level: District (Level 2)
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/new-assessment?district=${selectedDistrict.id}`)}
                >
                  Configure Assessment for {selectedDistrict.name} 🚀
                </button>
              </div>

              {/* Sub-units section */}
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
                  Subordinate Blocks ({blocks.length} Units)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Standard assessment resolution
                </span>
              </div>

              {loadingBlocks ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div className="spinner" />
                  <div style={{ marginTop: '0.5rem', color: '#64748b' }}>Loading blocks...</div>
                </div>
              ) : blocks.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: '0.88rem' }}>
                  No subordinate blocks registered for {selectedDistrict.name}.
                </div>
              ) : (
                <div className="blocks-grid">
                  {blocks.map((b) => (
                    <div key={b.id} className="block-pill-card">
                      <div className="block-pill-name">{b.name}</div>
                      <div className="block-pill-code">ID: {b.id} · Level: {b.level}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
              Select a district from the sidebar to inspect its subordinate units.
            </div>
          )}
        </div>
      </div>

      {/* Add District Modal */}
      {isAddDistrictModalOpen && (
        <AddDistrictModal
          states={[{ id: 1, name: 'Kerala', level: 'STATE', code: 'KL', parent_id: null, parent_name: null, area_sqkm: null, centroid_lat: null, centroid_lon: null, is_demo: false, created_at: '', updated_at: '' }]}
          defaultStateId={1}
          onSuccess={(created: AdministrativeUnit) => {
            fetchDistricts();
            setSelectedDistrict(created);
            setIsAddDistrictModalOpen(false);
          }}
          onClose={() => setIsAddDistrictModalOpen(false)}
        />
      )}
    </div>
  );
}
