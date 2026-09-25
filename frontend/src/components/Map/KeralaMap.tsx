import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { Layer } from 'leaflet';
import L from 'leaflet';
import { getAdminUnitsGeoJSON, getBlocks } from '../../services/api';
import type { GeoJSONFeatureCollection, AdministrativeUnit } from '../../types';

// ── Known district centroids (fallback when DB has no geometry) ───────────────
const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  'thiruvananthapuram': [8.5241,  76.9366],
  'thiruvananthapuram (trivandrum)': [8.5241,  76.9366],
  'kollam':             [8.8932,  76.6141],
  'pathanamthitta':     [9.2648,  76.7870],
  'alappuzha':          [9.4981,  76.3388],
  'kottayam':           [9.5916,  76.5222],
  'idukki':             [9.9189,  77.1025],
  'ernakulam':          [9.9816,  76.2999],
  'ernakulam (kochi)':  [9.9816,  76.2999],
  'thrissur':           [10.5276, 76.2144],
  'palakkad':           [10.7867, 76.6548],
  'malappuram':         [11.0730, 76.0740],
  'kozhikode':          [11.2588, 75.7804],
  'wayanad':            [11.6854, 76.1320],
  'kannur':             [11.8745, 75.3704],
  'kasaragod':          [12.4996, 74.9869],
};

// ── Kerala default center ─────────────────────────────────────────────────────
const KERALA_CENTER: [number, number] = [10.5, 76.2];

function getCentroid(
  districtName: string,
  centroidLat?: number | null,
  centroidLon?: number | null
): [number, number] {
  if (centroidLat && centroidLon) return [centroidLat, centroidLon];
  const key = districtName.toLowerCase().split(' [demo]')[0].trim();
  return DISTRICT_CENTROIDS[key] || KERALA_CENTER;
}

// ── Helper: fly map to a latlng with animation ────────────────────────────────
function FlyToDistrict({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.0 });
  }, [center, zoom, map]);
  return null;
}

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
  /** Name of the selected district (from the card grid) */
  districtKey?: string;
  /** Full AdministrativeUnit object — provides centroid when no geometry exists */
  selectedDistrict?: AdministrativeUnit | null;
  hideDropdown?: boolean;
}

export default function KeralaMap({ districtKey, selectedDistrict, hideDropdown: _hideDropdown }: DistrictMapProps) {
  const districtName = districtKey || selectedDistrict?.name || '';
  const cleanName = districtName.replace(' [DEMO]', '').trim();

  const [districtGeoJSON, setDistrictGeoJSON] = useState<GeoJSONFeatureCollection | null>(null);
  const [blocksGeoJSON,   setBlocksGeoJSON]   = useState<GeoJSONFeatureCollection | null>(null);
  const [blockList,       setBlockList]        = useState<AdministrativeUnit[]>([]);
  const [loading,         setLoading]          = useState(true);
  const [selectedBlock,   setSelectedBlock]    = useState<BlockProperties | null>(null);
  const [error,           setError]            = useState<string | null>(null);
  const [mapCenter,       setMapCenter]        = useState<[number, number]>(
    cleanName ? getCentroid(cleanName, selectedDistrict?.centroid_lat, selectedDistrict?.centroid_lon) : KERALA_CENTER
  );
  const [mapZoom, setMapZoom] = useState(cleanName ? 10 : 8);
  const mapRef = useRef<L.Map | null>(null);

  // ── Recalculate center when district changes ──────────────────────────────
  useEffect(() => {
    if (cleanName) {
      const newCenter = getCentroid(
        cleanName,
        selectedDistrict?.centroid_lat,
        selectedDistrict?.centroid_lon
      );
      setMapCenter(newCenter);
      setMapZoom(10);
    } else {
      setMapCenter(KERALA_CENTER);
      setMapZoom(8);
    }
  }, [cleanName, selectedDistrict]);

  // ── Load GeoJSON + blocks list whenever district changes ──────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedBlock(null);
    setDistrictGeoJSON(null);
    setBlocksGeoJSON(null);
    setBlockList([]);

    async function load() {
      try {
        const districtId = selectedDistrict?.id;

        // 1. Try to load GeoJSON geometry from DB
        const [distData, blockGeoData] = await Promise.all([
          getAdminUnitsGeoJSON(districtId || cleanName ? { district: districtId || cleanName, level: 'district' } : { level: 'district' }).catch(() => null),
          (districtId || cleanName) ? getAdminUnitsGeoJSON({ district: districtId || cleanName, level: 'block' }).catch(() => null) : Promise.resolve(null),
        ]);

        // 2. Always load block list (even without geometry)
        const blocks = districtId ? await getBlocks(districtId).catch(() => [] as AdministrativeUnit[]) : [];

        if (cancelled) return;

        setDistrictGeoJSON(distData?.features?.length ? distData : null);
        setBlocksGeoJSON(blockGeoData?.features?.length ? blockGeoData : null);
        setBlockList(blocks);

        // 3. Fly to bounds if geometry exists, otherwise fly to centroid
        const bounds = computeBounds(blockGeoData) || computeBounds(distData);
        if (bounds && mapRef.current) {
          setTimeout(() => mapRef.current?.flyToBounds(bounds, { padding: [24, 24], duration: 1.0 }), 200);
        }
      } catch {
        if (!cancelled) setError(`Could not load data for ${cleanName || 'Kerala'}.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [cleanName, selectedDistrict?.id]);

  const onEachBlock = useCallback((feature: any, layer: Layer) => {
    const props = feature.properties as BlockProperties;
    const name  = props.name || 'Block';
    const area  = props.area_sqkm ? `${props.area_sqkm.toFixed(2)} sq km` : 'N/A';
    const dist  = props.district || `${cleanName || 'District'} [DEMO]`;
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
      click:     () => setSelectedBlock(props),
      mouseover: (e: any) => e.target.setStyle({ weight: 3, color: '#1d4ed8', fillOpacity: 0.45 }),
      mouseout:  (e: any) => e.target.setStyle({ weight: 1.5, color: '#2563eb', fillOpacity: 0.22 }),
    });
  }, [cleanName]);

  const blockStyle  = { fillColor: '#3b82f6', weight: 1.5, opacity: 1, color: '#2563eb', fillOpacity: 0.22 };
  const borderStyle = { fillColor: 'transparent', weight: 3.5, opacity: 1, color: '#0f172a', dashArray: '6,6', fillOpacity: 0 };

  const blockCount = blockList.length || blocksGeoJSON?.features?.length || 0;

  return (
    <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      {/* ── Header ── */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Kerala District Map</h3>
            <span className="badge badge-warning">DEMO DATA</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gov-muted)', margin: '0.2rem 0 0' }}>
            State: <strong>Kerala</strong> {cleanName ? <>| District: <strong>{cleanName}</strong></> : <>| <strong>All Administrative Districts</strong></>}
            {blockCount > 0 && <> | Level: <strong>Block ({blockCount} Talukas)</strong></>}
          </p>
        </div>
      </div>

      {/* ── Map + Sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedBlock ? '1fr 280px' : '1fr', height: '420px' }}>
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.9)', gap: '0.5rem' }}>
              <div className="spinner" />
              <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.85rem' }}>Loading {cleanName || 'Kerala'}…</span>
            </div>
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <span style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
            ref={(map) => { if (map) mapRef.current = map; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Always fly to the selected district centroid */}
            <FlyToDistrict center={mapCenter} zoom={mapZoom} />

            {districtGeoJSON && (
              <GeoJSON key={`border-${cleanName}`} data={districtGeoJSON as any} style={borderStyle} />
            )}
            {blocksGeoJSON && (
              <GeoJSON key={`blocks-${cleanName}`} data={blocksGeoJSON as any} style={blockStyle} onEachFeature={onEachBlock} />
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
                ['District',   selectedBlock.district || `${cleanName} [DEMO]`],
                ['State',      selectedBlock.state     || 'Kerala [DEMO]'],
                ['Area',       selectedBlock.area_sqkm ? `${selectedBlock.area_sqkm.toFixed(2)} sq km` : 'N/A'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span style={{ color: '#64748b', fontSize: '0.73rem', display: 'block' }}>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Talukas list (shown when no geometry, so user sees what blocks exist) ── */}
      {!blocksGeoJSON && blockList.length > 0 && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 {cleanName} Talukas ({blockList.length} blocks — geometry pending)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {blockList.map(block => (
              <span
                key={block.id}
                style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: '999px', padding: '0.2rem 0.65rem',
                  fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 500,
                }}
              >
                {block.name}
              </span>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            ℹ️ Map boundaries will appear once official GIS geometry is uploaded for this district.
          </div>
        </div>
      )}

      {/* ── Footer legend ── */}
      <div style={{ padding: '0.5rem 1rem', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
        {districtGeoJSON && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px dashed #0f172a', borderRadius: 2 }} />
            {cleanName} District Boundary
          </div>
        )}
        {blocksGeoJSON && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, backgroundColor: 'rgba(59,130,246,0.3)', border: '1.5px solid #2563eb', borderRadius: 2 }} />
            {cleanName} Blocks ({blockCount} units)
          </div>
        )}
        {!blocksGeoJSON && !districtGeoJSON && !loading && (
          <div style={{ color: '#f59e0b' }}>
            📍 Map centred on {cleanName} — GIS boundaries not yet uploaded
          </div>
        )}
      </div>
    </div>
  );
}
