import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Layer } from 'leaflet';
import L from 'leaflet';
import { getAdminUnitsGeoJSON } from '../../services/api';
import type { GeoJSONFeatureCollection } from '../../types';

// ── District config ──────────────────────────────────────────────────────────
const DISTRICTS = [
  { key: 'Kottayam',         label: 'Kottayam',              blocks: 12, center: [9.59,  76.52] as [number,number] },
  { key: 'Thiruvananthapuram', label: 'Thiruvananthapuram',  blocks: 10, center: [8.52,  76.94] as [number,number] },
  { key: 'Ernakulam',        label: 'Ernakulam (Kochi)',     blocks: 10, center: [10.00, 76.33] as [number,number] },
];

interface BlockProperties {
  id: number;
  name: string;
  code: string;
  level: string;
  area_sqkm: number | null;
  district?: string;
  state?: string;
  is_demo?: boolean;
}

function computeBounds(geojson: any): L.LatLngBounds | null {
  try {
    const g = L.geoJSON(geojson);
    const b = g.getBounds();
    return b.isValid() ? b : null;
  } catch { return null; }
}

interface DistrictMapProps {
  districtKey?: string;
  hideDropdown?: boolean;
}

export default function DistrictMap({ districtKey, hideDropdown }: DistrictMapProps) {
  const [internalDistrictKey, setInternalDistrictKey] = useState('Kottayam');
  const activeDistrictKey = districtKey || internalDistrictKey;

  const [districtGeoJSON, setDistrictGeoJSON] = useState<GeoJSONFeatureCollection | null>(null);
  const [blocksGeoJSON,   setBlocksGeoJSON]   = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<BlockProperties | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const district = DISTRICTS.find(d => d.key === activeDistrictKey) || DISTRICTS[0];

  // ── Load data whenever district changes ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setSelectedBlock(null);
      setDistrictGeoJSON(null);
      setBlocksGeoJSON(null);
      try {
        const [distData, blockData] = await Promise.all([
          getAdminUnitsGeoJSON({ district: activeDistrictKey, level: 'district' }),
          getAdminUnitsGeoJSON({ district: activeDistrictKey, level: 'block' }),
        ]);
        if (cancelled) return;
        setDistrictGeoJSON(distData);
        setBlocksGeoJSON(blockData);
        // Fly map to this district
        const bounds = computeBounds(blockData) || computeBounds(distData);
        if (bounds && mapRef.current) {
          setTimeout(() => mapRef.current?.flyToBounds(bounds, { padding: [24, 24], duration: 0.8 }), 200);
        }
      } catch {
        if (!cancelled) setError(`Failed to load ${activeDistrictKey} data.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeDistrictKey]);

  const onEachBlock = useCallback((feature: any, layer: Layer) => {
    const props = feature.properties as BlockProperties;
    const name  = props.name || 'Block';
    const area  = props.area_sqkm ? `${props.area_sqkm.toFixed(2)} sq km` : 'N/A';
    const dist  = props.district || `${activeDistrictKey} [DEMO]`;
    layer.bindPopup(
      `<div style="font-family:Inter,sans-serif;min-width:180px">
        <div style="font-size:14px;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:4px;margin-bottom:8px">${name}</div>
        <div style="font-size:12px;color:#334155;display:grid;gap:4px">
          <div><strong style="color:#64748b">District:</strong> ${dist}</div>
          <div><strong style="color:#64748b">Area:</strong> ${area}</div>
        </div>
        <div style="margin-top:8px;font-size:10px;font-weight:700;color:#d97706;background:#fffbeb;border:1px solid #fef3c7;padding:3px 8px;border-radius:4px;display:inline-block">⚠️ DEMO DATA</div>
      </div>`,
      { maxWidth: 260 }
    );
    layer.on({
      click: () => setSelectedBlock(props),
      mouseover: (e: any) => e.target.setStyle({ weight: 3, color: '#1d4ed8', fillOpacity: 0.45 }),
      mouseout:  (e: any) => e.target.setStyle({ weight: 1.5, color: '#2563eb', fillOpacity: 0.22 }),
    });
  }, [activeDistrictKey]);

  const blockStyle  = { fillColor: '#3b82f6', weight: 1.5, opacity: 1, color: '#2563eb', fillOpacity: 0.22 };
  const borderStyle = { fillColor: 'transparent', weight: 3.5, opacity: 1, color: '#0f172a', dashArray: '6,6', fillOpacity: 0 };

  return (
    <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      {/* ── Header ── */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Kerala District Pilot Map</h3>
            <span className="badge badge-warning">DEMO DATA</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gov-muted)', margin: '0.2rem 0 0' }}>
            State: <strong>Kerala</strong> | District: <strong>{district.label}</strong> | Level: <strong>Block ({district.blocks} Blocks)</strong>
          </p>
        </div>

        {/* ── District Dropdown ── */}
        {!hideDropdown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <label htmlFor="district-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
              📍 Select District:
            </label>
            <select
              id="district-select"
              value={internalDistrictKey}
              onChange={e => setInternalDistrictKey(e.target.value)}
              style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: '1.5px solid #3b82f6',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: '#1e40af',
              background: '#eff6ff',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '200px',
            }}
          >
            {DISTRICTS.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
        )}
      </div>

      {/* ── Map + Sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedBlock ? '1fr 280px' : '1fr', height: '480px' }}>
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.85)' }}>
              <div className="spinner" />
              <span style={{ marginLeft: '0.75rem', color: '#64748b', fontWeight: 500 }}>Loading {district.label}…</span>
            </div>
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444' }}>
              ⚠️ {error}
            </div>
          )}

          <MapContainer
            center={district.center}
            zoom={10}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
            ref={(map) => { if (map) mapRef.current = map; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {districtGeoJSON && (
              <GeoJSON key={`border-${activeDistrictKey}`} data={districtGeoJSON as any} style={borderStyle} />
            )}
            {blocksGeoJSON && (
              <GeoJSON key={`blocks-${activeDistrictKey}`} data={blocksGeoJSON as any} style={blockStyle} onEachFeature={onEachBlock} />
            )}
          </MapContainer>
        </div>

        {/* ── Block info sidebar ── */}
        {selectedBlock && (
          <div style={{ padding: '1rem', background: '#f8fafc', borderLeft: '1px solid #e2e8f0', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-gov-navy)' }}>Block Details</h4>
              <button onClick={() => setSelectedBlock(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ background: '#fff', borderRadius: '8px', padding: '0.85rem', border: '1px solid #e2e8f0', display: 'grid', gap: '0.6rem', fontSize: '0.85rem' }}>
              {[
                ['Block Name', selectedBlock.name],
                ['Block Code', selectedBlock.code],
                ['District',   selectedBlock.district || `${activeDistrictKey} [DEMO]`],
                ['State',      selectedBlock.state     || 'Kerala [DEMO]'],
                ['Area',       selectedBlock.area_sqkm ? `${selectedBlock.area_sqkm.toFixed(2)} sq km` : 'N/A'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span style={{ color: '#64748b', fontSize: '0.73rem', display: 'block' }}>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', padding: '0.6rem', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '0.75rem', color: '#92400e' }}>
              ⚠️ <strong>DEMO DATA:</strong> Block boundaries are synthetic grid geometries for prototype demonstration only.
            </div>
          </div>
        )}
      </div>

      {/* ── Footer legend ── */}
      <div style={{ padding: '0.5rem 1rem', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px dashed #0f172a', borderRadius: 2 }} />
          {district.label} District Boundary
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, backgroundColor: 'rgba(59,130,246,0.3)', border: '1.5px solid #2563eb', borderRadius: 2 }} />
          {district.label} Blocks ({district.blocks} units)
        </div>
      </div>
    </div>
  );
}
