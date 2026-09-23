import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Layer } from 'leaflet';
import L from 'leaflet';
import { getAssessmentMapData } from '../../services/api';

interface ResultsMapProps {
  assessmentId: number;
  selectedBlockId: number | null;
  onBlockSelect: (blockId: number | null) => void;
  resultsData: any[];
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  NH: '#22c55e',
  LH: '#eab308',
  MH: '#f97316',
  HH: '#ef4444',
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
}: ResultsMapProps) {
  const [geoJSON, setGeoJSON] = useState<any>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const geoJsonLayerRef = useRef<any>(null);
  const mapRef = useRef<L.Map | null>(null);

  // ── Fetch map data ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await getAssessmentMapData(assessmentId);
        if (cancelled) return;
        setGeoJSON(data);
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
  }, [assessmentId]);

  // ── Fly to bounds once map + geojson are ready ──────────────────────────
  useEffect(() => {
    if (!bounds) return;
    // Delay slightly to ensure MapContainer DOM is fully measured
    const t = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.flyToBounds(bounds, { padding: [30, 30], duration: 0.8 });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [bounds]);

  // ── Highlight selected block from table click ───────────────────────────
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

  // ── Styles ──────────────────────────────────────────────────────────────
  const featureStyle = (feature: any) => {
    const cls = feature?.properties?.classification || 'NH';
    const isSelected = feature?.properties?.unit_id === selectedBlockId;
    return {
      fillColor: CLASSIFICATION_COLORS[cls] || '#94a3b8',
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
      color: isSelected ? '#1e293b' : '#475569',
      fillOpacity: isSelected ? 0.85 : 0.55,
    };
  };

  // ── Popup + interaction for each feature ────────────────────────────────
  const onEachFeature = useCallback((feature: any, layer: Layer) => {
    const props = feature.properties;
    const unitId = props.unit_id;
    const name = props.unit_name || 'Unknown Block';
    const cls = props.classification || 'NH';
    const score =
      props.final_score !== null && props.final_score !== undefined
        ? Number(props.final_score).toFixed(2)
        : 'N/A';

    // Look up metadata from results array
    const detail = resultsData.find((r: any) => r.administrative_unit === unitId);
    const meta = detail?.metadata || {};
    const fp =
      meta.flood_prone_percentage !== undefined
        ? Number(meta.flood_prone_percentage).toFixed(1) + '%'
        : 'N/A';
    const ev = meta.event_count !== undefined ? meta.event_count : 'N/A';
    const fq =
      meta.event_frequency !== undefined
        ? Number(meta.event_frequency).toFixed(2)
        : 'N/A';
    const clsColor = CLASSIFICATION_COLORS[cls] || '#94a3b8';

    layer.bindPopup(
      `<div style="font-family:Inter,system-ui,sans-serif;padding:4px 2px;min-width:210px">
        <div style="font-size:15px;font-weight:700;color:#0f172a;border-bottom:3px solid ${clsColor};padding-bottom:5px;margin-bottom:8px">${name}</div>
        <table style="font-size:12px;color:#334155;width:100%;border-collapse:collapse">
          <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Classification</td><td style="padding:2px 4px;font-weight:700;color:${clsColor}">${cls} Hazard</td></tr>
          <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Composite Score</td><td style="padding:2px 4px">${score}</td></tr>
          <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Flood-prone %</td><td style="padding:2px 4px">${fp}</td></tr>
          <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Historical Events</td><td style="padding:2px 4px">${ev}</td></tr>
          <tr><td style="padding:2px 4px;color:#64748b;font-weight:600">Flood Frequency</td><td style="padding:2px 4px">${fq} / yr</td></tr>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsData, selectedBlockId, onBlockSelect]);

  // ── Render states ────────────────────────────────────────────────────────
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

  // Fallback centre/zoom while bounds are computed
  const defaultCenter: [number, number] = [9.6, 76.6];
  const defaultZoom = 7;

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 500, width: '100%', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}>
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

        {geoJSON && (
          <GeoJSON
            key={assessmentId}
            ref={geoJsonLayerRef}
            data={geoJSON}
            style={featureStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 20, right: 12,
        background: 'rgba(255,255,255,0.96)',
        padding: '10px 14px', borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 1000, fontSize: '0.78rem',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Hazard Level</div>
        {[
          ['HH', 'High Hazard'],
          ['MH', 'Moderate Hazard'],
          ['LH', 'Low Hazard'],
          ['NH', 'No Hazard'],
        ].map(([code, label]) => (
          <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              width: 16, height: 16,
              backgroundColor: CLASSIFICATION_COLORS[code],
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 2,
            }} />
            <span><strong>{code}</strong> — {label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
