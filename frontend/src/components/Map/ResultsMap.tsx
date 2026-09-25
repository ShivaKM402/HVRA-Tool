import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Polyline } from 'react-leaflet';
import type { Layer } from 'leaflet';
import L from 'leaflet';
import leafletImage from 'leaflet-image';
import { getAssessmentMapData, getRiskAssessmentMap } from '../../services/api';

interface ResultsMapProps {
  assessmentId: number;
  selectedBlockId: number | null;
  onBlockSelect: (blockId: number | null) => void;
  resultsData: any[];
  /** 'hazard' (Modules 1–3) or 'risk' (Module 4 — composite risk). */
  variant?: 'hazard' | 'risk';
  /** Overrides the default classification → color map. */
  colorMap?: Record<string, string>;
  /** Overrides the default classification → label map. */
  classificationLabels?: Record<string, string>;
  /** Optional legend title override (e.g. "Vulnerability Classification"). */
  legendTitle?: string;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  NH: '#22c55e',
  LH: '#eab308',
  MH: '#f97316',
  HH: '#ef4444',
};

const RISK_COLORS: Record<string, string> = {
  VERY_HIGH: '#7f1d1d',
  HIGH: '#ef4444',
  MODERATE: '#f59e0b',
  LOW: '#22c55e',
};

const RISK_LABELS: Record<string, string> = {
  VERY_HIGH: 'Very High Risk',
  HIGH: 'High Risk',
  MODERATE: 'Moderate Risk',
  LOW: 'Low Risk',
};

const HAZARD_LABELS: Record<string, string> = {
  HH: 'High Hazard',
  MH: 'Moderate Hazard',
  LH: 'Low Hazard',
  NH: 'No Hazard',
};

/** Compute leaflet LatLngBounds from a GeoJSON FeatureCollection */
function computeBounds(geojson: any): L.LatLngBounds | null {
  try {
    const layer = L.geoJSON(geojson);
    const bounds = layer.getBounds();
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

export default function ResultsMap({
  assessmentId,
  selectedBlockId,
  onBlockSelect,
  resultsData,
  variant = 'hazard',
  colorMap,
  classificationLabels,
  legendTitle,
}: ResultsMapProps) {
  const isRisk = variant === 'risk';
  const colors = colorMap || (isRisk ? RISK_COLORS : CLASSIFICATION_COLORS);
  const labels = classificationLabels || (isRisk ? RISK_LABELS : HAZARD_LABELS);
  const title = legendTitle || (isRisk ? 'Risk Classification' : 'Hazard Classification');

  const [geoJSON, setGeoJSON] = useState<any>(null);
  const [thematicLayers, setThematicLayers] = useState<any>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layer Visibility Toggles
  const [showBlocks, setShowBlocks] = useState(true);
  const [showHazardZones, setShowHazardZones] = useState(!isRisk);
  const [showEvents, setShowEvents] = useState(!isRisk);
  const [showStations, setShowStations] = useState(!isRisk);
  // Linear features (fault lines, cyclone tracks — HVRA §4.3)
  const [showLinearFeatures, setShowLinearFeatures] = useState(!isRisk);

  const geoJsonLayerRef = useRef<any>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [exporting, setExporting] = useState(false);

  // Map PNG export (HVRA §3.4 — "Export map")
  const handleExportPng = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setExporting(true);
    leafletImage(map, (err, canvas) => {
      setExporting(false);
      if (err || !canvas) {
        alert(`Map export failed: ${err?.message || 'unknown error'}`);
        return;
      }
      const a = document.createElement('a');
      a.download = `hvra-map-${isRisk ? 'risk' : 'assessment'}-${assessmentId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    });
  }, [assessmentId, isRisk]);

  // Fetch map data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = isRisk
          ? await getRiskAssessmentMap(assessmentId)
          : await getAssessmentMapData(assessmentId);
        if (cancelled) return;
        setGeoJSON(data);
        if ((data as any).thematic_layers) {
          setThematicLayers((data as any).thematic_layers);
        }
        const b = computeBounds(data);
        setBounds(b);
      } catch (err: any) {
        if (!cancelled) setError('Failed to load map data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [assessmentId, isRisk]);

  // Fly to bounds once map + geojson are ready
  useEffect(() => {
    if (!bounds) return;
    const t = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.flyToBounds(bounds, { padding: [30, 30], duration: 0.8 });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [bounds]);

  // Highlight selected block from table click
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer: any) => {
      const props = layer.feature?.properties;
      if (!props) return;
      if (props.unit_id === selectedBlockId) {
        layer.setStyle({ weight: 3, color: '#1e293b', fillOpacity: 0.85 });
        layer.bringToFront();
        layer.openPopup();
      } else {
        layer.setStyle(featureStyle(layer.feature));
      }
    });
  }, [selectedBlockId]);

  const featureStyle = (feature: any) => {
    const cls = feature?.properties?.classification || (isRisk ? 'LOW' : 'NH');
    const isSelected = feature?.properties?.unit_id === selectedBlockId;
    return {
      fillColor: colors[cls] || '#94a3b8',
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
      color: isSelected ? '#1e293b' : '#475569',
      fillOpacity: isSelected ? 0.85 : 0.55,
    };
  };

  const onEachFeature = useCallback((feature: any, layer: Layer) => {
    const props = feature.properties;
    const unitId = props.unit_id;
    const name = props.unit_name || 'Unknown Block';
    const cls = props.classification || (isRisk ? 'LOW' : 'NH');
    const clsColor = colors[cls] || '#94a3b8';
    const clsLabel = labels[cls] || cls;

    const score =
      isRisk
        ? (props.risk_score !== null && props.risk_score !== undefined
            ? Number(props.risk_score).toFixed(2)
            : 'N/A')
        : (props.final_score !== null && props.final_score !== undefined
            ? Number(props.final_score).toFixed(2)
            : 'N/A');

    const detail = resultsData.find((r: any) => r.administrative_unit === unitId);
    const meta = detail?.metadata || {};

    const fmt = (v: number | null | undefined) =>
      v !== null && v !== undefined ? Number(v).toFixed(2) : '—';

    const popupTable = isRisk
      ? `<tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Risk Score</td><td style="padding:2px 4px">${score}</td></tr>
         <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Hazard (H)</td><td style="padding:2px 4px">${fmt(props.hazard_score)}</td></tr>
         <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Vulnerability (V)</td><td style="padding:2px 4px">${fmt(props.vulnerability_score)}</td></tr>
         <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Exposure (E)</td><td style="padding:2px 4px">${fmt(props.exposure_score)}</td></tr>`
      : (() => {
          const fp =
            meta.flood_prone_percentage !== undefined
              ? Number(meta.flood_prone_percentage).toFixed(1) + '%'
              : 'N/A';
          const ev = meta.event_count !== undefined ? meta.event_count : 'N/A';
          const fq =
            meta.event_frequency !== undefined
              ? Number(meta.event_frequency).toFixed(2)
              : 'N/A';
          return `<tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Composite Score</td><td style="padding:2px 4px">${score}</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Hazard Area %</td><td style="padding:2px 4px">${fp}</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Historical Events</td><td style="padding:2px 4px">${ev}</td></tr>
            <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Frequency</td><td style="padding:2px 4px">${fq} / yr</td></tr>`;
        })();

    layer.bindPopup(
      `<div style="font-family:Inter,system-ui,sans-serif;padding:4px 2px;min-width:210px">
        <div style="font-size:15px;font-weight:700;color:#0f172a;border-bottom:3px solid ${clsColor};padding-bottom:5px;margin-bottom:8px">${name}</div>
        <table style="font-size:12px;color:#334155;width:100%;border-collapse:collapse">
          <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Classification</td><td style="padding:2px 4px;font-weight:700;color:${clsColor}">${clsLabel}</td></tr>
          ${popupTable}
        </table>
      </div>`,
      { maxWidth: 280 }
    );

    layer.on({
      click: () => onBlockSelect(unitId),
      mouseover: (e: any) => {
        if (unitId !== selectedBlockId) {
          e.target.setStyle({ fillOpacity: 0.75, weight: 2 });
        }
      },
      mouseout: (e: any) => {
        if (unitId !== selectedBlockId) {
          e.target.setStyle(featureStyle(feature));
        }
      },
    });
  }, [resultsData, selectedBlockId, onBlockSelect, isRisk, colors, labels]);

  if (loading) {
    return (
      <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="spinner" />
        <span style={{ marginLeft: '1rem', color: '#64748b' }}>Loading map…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444' }}>
        ⚠️ {error}
      </div>
    );
  }

  // Split thematic zones into polygon (inundation) vs linear (fault / cyclone track) features
  const zoneFeatures = thematicLayers?.hazard_zones?.features || [];
  const linearFeatures = zoneFeatures.filter(
    (f: any) =>
      f?.geometry?.type === 'LineString' ||
      f?.geometry?.type === 'MultiLineString'
  );
  const polygonFeatures = zoneFeatures.filter(
    (f: any) => !(f?.geometry?.type === 'LineString' || f?.geometry?.type === 'MultiLineString')
  );

  // Linear feature styling by hazard type (HVRA §4.3 fault lines & cyclone tracks)
  const linearStyle = (p: any) => {
    const hz = (p?.hazard_type || '').toUpperCase();
    if (hz.includes('EARTHQUAKE') || hz.includes('FAULT')) {
      return { color: '#b45309', weight: 3, dashArray: '8, 4', opacity: 0.85 };
    }
    if (hz.includes('CYCLONE')) {
      return { color: '#7c3aed', weight: 3, dashArray: '4, 6', opacity: 0.85 };
    }
    return { color: '#0369a1', weight: 2.5, dashArray: '6, 4', opacity: 0.7 };
  };

  const linearPositions = (geom: any): [number, number][] | [number, number][][] => {
    if (!geom) return [];
    if (geom.type === 'LineString') {
      return geom.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    }
    if (geom.type === 'MultiLineString') {
      return geom.coordinates.map((line: number[][]) =>
        line.map((c: number[]) => [c[1], c[0]] as [number, number])
      );
    }
    return [];
  };

  const defaultCenter: [number, number] = [9.6, 76.6];
  const defaultZoom = 7;

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 520, width: '100%', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        ref={(map) => {
          if (map) {
            (mapRef as any).current = map;
          }
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 1. Administrative Blocks Choropleth */}
        {showBlocks && geoJSON && (
          <GeoJSON
            key={`blocks-${assessmentId}`}
            ref={geoJsonLayerRef}
            data={geoJSON}
            style={featureStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* 2. Thematic Inundation & Hazard Zones (polygons) */}
        {showHazardZones && polygonFeatures.length > 0 && (
          <GeoJSON
            key={`hazard-zones-${assessmentId}`}
            data={{ type: 'FeatureCollection', features: polygonFeatures } as any}
            style={{
              fillColor: '#0284c7',
              color: '#0369a1',
              weight: 1.5,
              dashArray: '4, 4',
              fillOpacity: 0.35,
            }}
            onEachFeature={(feat: any, layer: any) => {
              const p = feat.properties || {};
              layer.bindPopup(
                `<div style="font-family:Inter,system-ui,sans-serif;padding:3px">
                  <strong style="color:#0369a1">🌊 Inundation & Hazard Zone</strong><br/>
                  <div style="font-size:12px;margin-top:4px">
                    Block: <strong>${p.block_name || 'Catchment Zone'}</strong><br/>
                    Return Period: <strong>${p.return_period || '25-year flood'}</strong><br/>
                    Estimated Depth: <strong>${p.inundation_depth_m ? p.inundation_depth_m + ' m' : '1.5 m'}</strong>
                  </div>
                </div>`
              );
            }}
          />
        )}

        {/* 2b. Linear Hazard Features — fault lines & cyclone tracks (HVRA §4.3) */}
        {showLinearFeatures && linearFeatures.map((f: any, idx: number) => {
          const p = f.properties || {};
          const hz = (p.hazard_type || '').toUpperCase();
          const style = linearStyle(p);
          const positions = linearPositions(f.geometry);
          if (!positions.length) return null;
          const isEarthquake = hz.includes('EARTHQUAKE') || hz.includes('FAULT');
          const isCyclone = hz.includes('CYCLONE');
          return (
            <Polyline
              key={`lin-${idx}`}
              positions={positions as any}
              pathOptions={{
                color: style.color,
                weight: style.weight,
                dashArray: style.dashArray,
                opacity: style.opacity,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter,system-ui,sans-serif', minWidth: 180 }}>
                  <div style={{ fontWeight: 700, color: style.color, borderBottom: '1px solid #e2e8f0', paddingBottom: 4, fontSize: 13 }}>
                    {isEarthquake ? '🌋 Fault Structure' : isCyclone ? '🌀 Cyclone Track' : '📍 Linear Hazard'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: '#334155' }}>
                    <strong>Name:</strong> {p.name || 'Linear hazard feature'}<br/>
                    <strong>Hazard Type:</strong> {p.hazard_type || 'UNKNOWN'}<br/>
                    {p.seismicity_zone && <div><strong>Seismic Zone:</strong> {p.seismicity_zone}</div>}
                    {p.intensity_category && <div><strong>Intensity:</strong> {p.intensity_category}</div>}
                    {p.year && <div><strong>Year:</strong> {p.year}</div>}
                    <small style={{ color: '#64748b' }}>{p.is_demo ? 'DEMO DATA — not official' : 'GIS layer'}</small>
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* 3. Historical Event Points */}
        {showEvents && thematicLayers?.historical_events?.features?.map((ev: any, idx: number) => {
          const coords = ev.geometry.coordinates;
          const p = ev.properties || {};
          return (
            <CircleMarker
              key={`ev-${idx}`}
              center={[coords[1], coords[0]]}
              radius={6}
              pathOptions={{
                fillColor: '#dc2626',
                color: '#ffffff',
                weight: 1.5,
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter,system-ui,sans-serif', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, color: '#dc2626', borderBottom: '1px solid #fee2e2', paddingBottom: 3 }}>
                    ⚡ Historical Hazard Event
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: '#334155' }}>
                    <strong>Date:</strong> {p.date || 'Historical'}<br/>
                    <strong>Intensity:</strong> {p.magnitude ? `Magnitude ${p.magnitude}` : 'Moderate'}<br/>
                    <strong>Est. Loss:</strong> {p.loss ? `₹ ${p.loss} Cr` : 'N/A'}<br/>
                    <strong>Desc:</strong> {p.description || 'Monsoon inundation'}<br/>
                    <small style={{ color: '#64748b' }}>Source: {p.source || 'DDMA Record'}</small>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* 4. Monitoring Stations */}
        {showStations && thematicLayers?.monitoring_stations?.features?.map((st: any, idx: number) => {
          const coords = st.geometry.coordinates;
          const p = st.properties || {};
          return (
            <CircleMarker
              key={`st-${idx}`}
              center={[coords[1], coords[0]]}
              radius={7}
              pathOptions={{
                fillColor: '#06b6d4',
                color: '#083344',
                weight: 2,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter,system-ui,sans-serif', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, color: '#0891b2', borderBottom: '1px solid #cffafe', paddingBottom: 3 }}>
                    📡 {p.name || 'Monitoring Station'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: '#334155' }}>
                    <strong>Type:</strong> {p.type || 'Telemetry Gauge'}<br/>
                    <strong>Status:</strong> <span style={{ color: '#16a34a', fontWeight: 600 }}>{p.status || 'Active'}</span><br/>
                    {p.level_m && <div><strong>Water Level:</strong> {p.level_m} m</div>}
                    {p.rainfall_24h_mm && <div><strong>24h Rainfall:</strong> {p.rainfall_24h_mm} mm</div>}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      </MapContainer>

      {/* Layer Visibility Control Box */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,255,255,0.96)',
        padding: '10px 14px', borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.14)',
        zIndex: 1000, fontSize: '0.78rem',
        border: '1px solid #e2e8f0', minWidth: 180,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🗺️</span> Thematic Map Layers
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showBlocks} onChange={(e) => setShowBlocks(e.target.checked)} />
          <span style={{ fontWeight: 600, color: '#1e293b' }}>Block Choropleth</span>
        </label>
        {!isRisk && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showHazardZones} onChange={(e) => setShowHazardZones(e.target.checked)} />
              <span style={{ color: '#0284c7', fontWeight: 600 }}>🌊 Hazard Inundation</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showLinearFeatures} onChange={(e) => setShowLinearFeatures(e.target.checked)} />
              <span style={{ color: '#b45309', fontWeight: 600 }}>〰️ Faults & Cyclone Tracks</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} />
              <span style={{ color: '#dc2626', fontWeight: 600 }}>⚡ Historical Events</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} />
              <span style={{ color: '#0891b2', fontWeight: 600 }}>📡 Telemetry Gauges</span>
            </label>
          </>
        )}
        <button
          type="button"
          onClick={handleExportPng}
          disabled={exporting}
          style={{
            marginTop: 10, width: '100%',
            padding: '7px 10px', borderRadius: 6,
            border: '1px solid #0284c7',
            background: '#0284c7', color: '#fff',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {exporting ? 'Rendering…' : '📷 Export Map as PNG'}
        </button>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 20, right: 12,
        background: 'rgba(255,255,255,0.96)',
        padding: '10px 14px', borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 1000, fontSize: '0.78rem',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>{title}</div>
        {Object.entries(labels).map(([code, label]) => (
          <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              width: 14, height: 14,
              backgroundColor: colors[code],
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 3,
            }} />
            <span><strong>{code.replace('_', ' ')}</strong> — {label}</span>
          </div>
        ))}
        {!isRisk && (
          <>
            <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
            <div style={{ fontSize: 13, color: '0f172a', marginBottom: 4 }}>Linear Hazards (HVRA §4.3)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#7c3aed" strokeWidth="3" strokeDasharray="4, 6" /></svg>
              <span style={{ fontSize: '0.75rem' }}>Cyclone Track</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#b45309" strokeWidth="3" strokeDasharray="8, 4" /></svg>
              <span style={{ fontSize: '0.75rem' }}>Fault Line / Seismic</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
