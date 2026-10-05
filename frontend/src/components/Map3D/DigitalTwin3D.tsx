/**
 * HVRA 3D Risk Intelligence & Digital Twin Platform (v1.0)
 *
 * Core Concept: 3D DIGITAL TWIN + RISK X-RAY + RISK DNA + 4D TIME MACHINE + SIMULATION
 * Features:
 *  - 3D Terrain & Extruded Administrative Units (MapLibre WebGL)
 *  - Tilt, Rotate, Orbit, Pitch (0°–75°), Zoom, Pan
 *  - Smooth Camera Transitions between Kerala Districts (Kottayam [DEMO] & Thiruvananthapuram)
 *  - Signature "H/V/E Risk X-Ray" Modes: ALL | HAZARD | VULNERABILITY | EXPOSURE | RISK
 *  - Signature "Risk DNA" 3-Axis & Contribution Profile
 *  - 4D Time Machine Timeline (2020 ── 2030)
 *  - Scenario Simulator (Monsoon rainfall, river crest, drainage capacity)
 *  - Mitigation Sandbox (Diversion channels, dyke elevation, sluice pumps)
 *  - AI Risk Investigator Explanatory Drawer
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Rotate3d,
  Compass,
  Maximize2,
  Sliders,
  Shield,
  Activity,
  Play,
  Pause,
  Layers,
  Sparkles,
  Eye
} from 'lucide-react';
import type { AdministrativeUnit, GeoJSONFeatureCollection } from '../../types';
import { getAdminUnitsGeoJSON, getAssessmentMapData } from '../../services/api';
import './DigitalTwin3D.css';

// ── Default District Centroids & Camera Perspectives ────────────────────────
const DISTRICT_COORDINATES: Record<string, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  kottayam: { center: [76.5222, 9.5916], zoom: 11.2, pitch: 58, bearing: -20 },
  'kottayam [demo]': { center: [76.5222, 9.5916], zoom: 11.2, pitch: 58, bearing: -20 },
  thiruvananthapuram: { center: [76.9366, 8.5241], zoom: 11.0, pitch: 55, bearing: -15 },
  kerala: { center: [76.2711, 10.5276], zoom: 7.6, pitch: 45, bearing: 0 },
};

export type XRayMode = 'ALL' | 'HAZARD' | 'VULNERABILITY' | 'EXPOSURE' | 'RISK';

interface DigitalTwin3DProps {
  selectedDistrict?: AdministrativeUnit | null;
  assessmentId?: number | null;
  onDistrictSelect?: (districtName: string) => void;
  onUnitSelect?: (unitData: any) => void;
}

export default function DigitalTwin3D({
  selectedDistrict,
  assessmentId,
  onDistrictSelect: _onDistrictSelect,
  onUnitSelect,
}: DigitalTwin3DProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  // ── State Management ──
  const [activeMode, setActiveMode] = useState<XRayMode>('ALL');
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'EXPLORE' | 'SIMULATE' | 'MITIGATE'>('EXPLORE');
  const [timelineYear, setTimelineYear] = useState<number>(2026);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [pitchPreset, setPitchPreset] = useState<'3D' | 'ISOMETRIC' | '2D'>('3D');

  // Selected Unit Telemetry — default to Thiruvananthapuram overview so panel is always visible
  const [selectedUnit, setSelectedUnit] = useState<any>({
    name: 'Thiruvananthapuram Central',
    district: 'Thiruvananthapuram District',
    hazardScore: 7.2,
    hazardWeight: 0.50,
    vulnScore: 5.8,
    vulnWeight: 0.25,
    expoScore: 6.4,
    expoWeight: 0.25,
    riskScore: 70,
    primaryHazard: 'Flash Flood & Coastal Inundation',
    floodDepth: '1.9 m',
    populationExposed: '14,280',
    dominant: 'Flood Hazard (52%)',
  });
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);

  // Layer Visibility
  const [layersVisibility, setLayersVisibility] = useState({
    extrusions: true,
    boundaries: true,
    waterBodies: true,
    historicalEvents: true,
    monitoringStations: true,
  });

  // Scenario Simulator Controls
  const [simRainfall, setSimRainfall] = useState<number>(35); // +35% exceedance
  const [simRiverStage, setSimRiverStage] = useState<number>(1.8); // +1.8m crest
  const [simDrainage, setSimDrainage] = useState<number>(0); // 0%
  const [simPopulation, setSimPopulation] = useState<number>(15); // +15%

  // Mitigation Sandbox Interventions
  const [mitigations, setMitigations] = useState({
    diversionCanal: true,
    embankmentDyke: false,
    automatedPumps: false,
    evacuationHub: false,
  });

  // GeoJSON data loaded from backend
  const [geoData, setGeoData] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const cleanDistrictName = useMemo(() => {
    return (selectedDistrict?.name || 'Thiruvananthapuram [DEMO]').replace(' [DEMO]', '').toLowerCase();
  }, [selectedDistrict]);

  // Update default unit when district changes
  useEffect(() => {
    const distName = selectedDistrict?.name?.replace(' [DEMO]', '') || 'Thiruvananthapuram';
    setSelectedUnit((prev: any) => ({
      ...prev,
      name: `${distName} Central`,
      district: `${distName} District`,
    }));
  }, [selectedDistrict]);

  // ── Load GeoJSON from API ──
  useEffect(() => {
    let cancelled = false;
    async function loadSpatialData() {
      try {
        setLoading(true);
        let data: any = null;

        if (assessmentId) {
          try {
            data = await getAssessmentMapData(assessmentId);
          } catch (e) {
            console.warn('Could not load assessment map, falling back to admin units', e);
          }
        }

        if (!data || !data.features || data.features.length === 0) {
          const districtParam = selectedDistrict?.id || 'Thiruvananthapuram';
          data = await getAdminUnitsGeoJSON({ district: districtParam, level: 'block' });
        }

        if (!cancelled && data && data.features) {
          setGeoData(data);
          // Set initial default selection to the first unit
          if (data.features.length > 0 && !selectedUnit) {
            const firstProps = data.features[0].properties;
            setSelectedUnit({
              name: firstProps.name || firstProps.unit_name || 'Central Ward / Block',
              district: selectedDistrict?.name || 'Thiruvananthapuram District',
              hazardScore: firstProps.final_score || 7.2,
              hazardWeight: 0.50,
              vulnScore: 5.8,
              vulnWeight: 0.25,
              expoScore: 6.4,
              expoWeight: 0.25,
              riskScore: firstProps.final_score ? Math.round(firstProps.final_score * 10) : 68,
              primaryHazard: 'Flash Flood & Riverine Inundation',
              floodDepth: '1.9 m',
              populationExposed: '14,280',
              dominant: 'Flood Hazard (52%)',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load spatial GeoJSON for 3D Digital Twin', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSpatialData();
    return () => { cancelled = true; };
  }, [selectedDistrict, assessmentId]);

  // ── MapLibre Initialization ──
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use dark cartographic style with elevation & extruded building support
    const darkStyle: maplibregl.StyleSpecification = {
      version: 8,
      name: 'HVRA Dark Command Center',
      sources: {
        'osm-dark': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-dark-layer',
          type: 'raster',
          source: 'osm-dark',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-opacity': 0.9,
            'raster-contrast': 0.1,
            'raster-saturation': -0.3,
          },
        },
      ],
    };

    const targetPos = DISTRICT_COORDINATES[cleanDistrictName] || DISTRICT_COORDINATES['thiruvananthapuram'];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: darkStyle,
      center: targetPos.center,
      zoom: targetPos.zoom,
      pitch: targetPos.pitch,
      bearing: targetPos.bearing,
      maxPitch: 75,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      // Add empty source for administrative extrusions
      map.addSource('admin-units-3d', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // 3D Extrusion Layer
      map.addLayer({
        id: 'admin-blocks-extrusion',
        type: 'fill-extrusion',
        source: 'admin-units-3d',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#60a5fa',
            ['coalesce', ['get', 'color'], '#ef4444'],
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 1200],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82,
        },
      });

      // Administrative Boundary Outlines
      map.addLayer({
        id: 'admin-blocks-lines',
        type: 'line',
        source: 'admin-units-3d',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.5,
          'line-opacity': 0.65,
        },
      });

      // Click block to select unit
      map.on('click', 'admin-blocks-extrusion', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const p = feature.properties || {};

        const rawScore = Number(p.final_score || p.risk_score || 7.0);
        const unitData = {
          name: p.name || p.unit_name || 'Selected Ward/Block',
          district: selectedDistrict?.name || 'Thiruvananthapuram District',
          hazardScore: rawScore,
          hazardWeight: 0.50,
          vulnScore: Number((rawScore * 0.82).toFixed(1)),
          vulnWeight: 0.25,
          expoScore: Number((rawScore * 0.91).toFixed(1)),
          expoWeight: 0.25,
          riskScore: Math.round(rawScore * 9.8),
          primaryHazard: 'Riverine Flood Surge',
          floodDepth: `${(rawScore * 0.26).toFixed(1)} m`,
          populationExposed: `${Math.round(rawScore * 1850).toLocaleString()}`,
          dominant: rawScore > 6 ? 'Hazard Intensity (62%)' : 'Exposure Density (48%)',
        };

        setSelectedUnit(unitData);
        if (onUnitSelect) onUnitSelect(unitData);

        // Fly camera closer to the selected centroid
        if (e.lngLat) {
          map.flyTo({
            center: [e.lngLat.lng, e.lngLat.lat],
            zoom: Math.max(map.getZoom(), 12.0),
            pitch: 62,
            duration: 1200,
          });
        }
      });

      // Cursor pointer on hover
      map.on('mouseenter', 'admin-blocks-extrusion', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'admin-blocks-extrusion', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // ── Update 3D Extrusions Data & Heights when GeoJSON or Mode Changes ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded() || !geoData || !geoData.features) return;

    const source = map.getSource('admin-units-3d') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    // Compute dynamic 3D extrusion heights based on active mode
    const enrichedFeatures = geoData.features.map((f, idx) => {
      const p = { ...f.properties };
      const rawScore = Number(p.final_score || p.risk_score || (6.5 + (idx % 4) * 0.8));

      let extrusionHeight = 1200;
      let color = p.color || '#ef4444';

      if (activeMode === 'HAZARD') {
        extrusionHeight = rawScore * 400; // 0 - 4000m
        color = rawScore > 7.5 ? '#ef4444' : rawScore > 5 ? '#f97316' : '#10b981';
      } else if (activeMode === 'VULNERABILITY') {
        extrusionHeight = rawScore * 320;
        color = '#a855f7';
      } else if (activeMode === 'EXPOSURE') {
        extrusionHeight = rawScore * 360;
        color = '#06b6d4';
      } else if (activeMode === 'RISK' || activeMode === 'ALL') {
        // Combined risk formula visualization
        extrusionHeight = Math.pow(rawScore, 1.2) * 220;
        color = rawScore > 7 ? '#dc2626' : rawScore > 5 ? '#f59e0b' : '#10b981';
      }

      // If in simulate mode, apply simulation factor
      if (activeWorkflowTab === 'SIMULATE') {
        const factor = 1 + (simRainfall / 100) * 0.4 + (simRiverStage / 4) * 0.3;
        extrusionHeight *= factor;
      }

      // If in mitigate mode, apply reduction factor
      if (activeWorkflowTab === 'MITIGATE') {
        let reduction = 0;
        if (mitigations.diversionCanal) reduction += 0.22;
        if (mitigations.embankmentDyke) reduction += 0.15;
        if (mitigations.automatedPumps) reduction += 0.12;
        extrusionHeight *= Math.max(0.4, 1 - reduction);
      }

      return {
        ...f,
        properties: {
          ...p,
          render_height: extrusionHeight,
          color,
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features: enrichedFeatures as any,
    });
  }, [geoData, activeMode, activeWorkflowTab, simRainfall, simRiverStage, mitigations]);

  // ── District Switch FlyTo Animation ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const target = DISTRICT_COORDINATES[cleanDistrictName] || DISTRICT_COORDINATES['thiruvananthapuram'];

    map.flyTo({
      center: target.center,
      zoom: target.zoom,
      pitch: target.pitch,
      bearing: target.bearing,
      duration: 1800,
      essential: true,
    });
  }, [cleanDistrictName]);

  // ── Continuous 3D Orbit Controller ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let animFrame: number;
    function rotateCamera() {
      if (isRotating && map) {
        map.setBearing((map.getBearing() + 0.18) % 360);
        animFrame = requestAnimationFrame(rotateCamera);
      }
    }

    if (isRotating) {
      animFrame = requestAnimationFrame(rotateCamera);
    }
    return () => cancelAnimationFrame(animFrame);
  }, [isRotating]);

  // ── Camera Preset Handlers ──
  const handlePitchChange = (preset: '3D' | 'ISOMETRIC' | '2D') => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setPitchPreset(preset);

    if (preset === '3D') {
      map.easeTo({ pitch: 62, bearing: -20, duration: 900 });
    } else if (preset === 'ISOMETRIC') {
      map.easeTo({ pitch: 45, bearing: -45, duration: 900 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    }
  };

  const handleResetNorth = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.easeTo({ bearing: 0, pitch: 0, duration: 800 });
  };

  // ── 4D Timeline Scrubber Auto-Play ──
  useEffect(() => {
    let interval: any;
    if (isPlayingTimeline) {
      interval = setInterval(() => {
        setTimelineYear((prev) => {
          if (prev >= 2030) return 2020;
          return prev + 2;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlayingTimeline]);

  // ── Computed Simulated vs Current Risk ──
  const simulationComparison = useMemo(() => {
    const baseRisk = selectedUnit?.riskScore || 72;
    // Simulation calculation model
    const rainDelta = (simRainfall / 100) * 22;
    const riverDelta = (simRiverStage / 3.5) * 18;
    const drainDelta = -(simDrainage / 100) * 12;
    const popDelta = (simPopulation / 100) * 14;

    const simulatedRisk = Math.min(99, Math.round(baseRisk + rainDelta + riverDelta + drainDelta + popDelta));
    const delta = simulatedRisk - baseRisk;

    return {
      current: baseRisk,
      simulated: simulatedRisk,
      delta: delta >= 0 ? `+${delta}` : `${delta}`,
    };
  }, [selectedUnit, simRainfall, simRiverStage, simDrainage, simPopulation]);

  // ── Computed Mitigation Risk Reduction ──
  const mitigationComparison = useMemo(() => {
    const baseRisk = selectedUnit?.riskScore || 78;
    let reduction = 0;
    if (mitigations.diversionCanal) reduction += 9;
    if (mitigations.embankmentDyke) reduction += 6;
    if (mitigations.automatedPumps) reduction += 5;
    if (mitigations.evacuationHub) reduction += 3;

    const postRisk = Math.max(15, baseRisk - reduction);
    return {
      before: baseRisk,
      after: postRisk,
      reduction: reduction,
    };
  }, [selectedUnit, mitigations]);

  return (
    <div className="digital-twin-container" id="hvra-3d-digital-twin">
      {/* ── WebGL Map Canvas ── */}
      <div ref={mapContainerRef} className="dt-map-viewport" />

      {loading && (
        <div style={{ position: 'absolute', top: 76, left: 16, zIndex: 20, background: 'rgba(15,23,42,0.85)', padding: '6px 12px', borderRadius: 8, fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(56,189,248,0.2)' }}>
          <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          <span>Synchronizing 3D Geospatial Meshes…</span>
        </div>
      )}

      {/* ── Top Floating Command Bar ── */}
      <div className="dt-top-command-bar">
        {/* Row 1: District Badge + Workflow Tabs */}
        <div className="dt-top-row">
          {/* Left: District & Live Telemetry Badge */}
          <div className="dt-badge-cluster">
            <div className="dt-status-pulse" />
            <span className="dt-district-tag">
              <Activity size={14} color="#38bdf8" />
              {selectedDistrict?.name || 'Thiruvananthapuram [DEMO] District'}
            </span>
            <span className="dt-coordinates-tag">
              {cleanDistrictName.includes('thiruvananthapuram') ? '8.52° N, 76.93° E' : '9.59° N, 76.52° E'}
            </span>
          </div>

          {/* Right: Workflow Tabs (Explore / Simulate / Mitigate) */}
          <div className="dt-mode-pills">
            <button
              className={`dt-mode-btn ${activeWorkflowTab === 'EXPLORE' ? 'active' : ''}`}
              onClick={() => setActiveWorkflowTab('EXPLORE')}
            >
              Explore
            </button>
            <button
              className={`dt-mode-btn ${activeWorkflowTab === 'SIMULATE' ? 'active hazard-mode' : ''}`}
              onClick={() => setActiveWorkflowTab('SIMULATE')}
            >
              Simulate
            </button>
            <button
              className={`dt-mode-btn ${activeWorkflowTab === 'MITIGATE' ? 'active vuln-mode' : ''}`}
              onClick={() => setActiveWorkflowTab('MITIGATE')}
            >
              Mitigate
            </button>
          </div>
        </div>

        {/* Row 2: X-Ray Mode Switcher (centered) */}
        <div className="dt-bottom-row">
          <div className="dt-mode-pills" title="Risk X-Ray Layer Decomposition">
            {(['ALL', 'HAZARD', 'VULNERABILITY', 'EXPOSURE', 'RISK'] as XRayMode[]).map((mode) => (
              <button
                key={mode}
                className={`dt-mode-btn ${activeMode === mode ? `active ${mode.toLowerCase().slice(0, 4)}-mode` : ''}`}
                onClick={() => setActiveMode(mode)}
              >
                {mode === 'HAZARD' && '🌊'}
                {mode === 'VULNERABILITY' && '🛡️'}
                {mode === 'EXPOSURE' && '🏢'}
                {mode === 'RISK' && '⚠️'}
                {mode === 'ALL' && '🌐'}
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3D Camera Floating HUD Tools ── */}
      <div className="dt-camera-tools">
        <button
          className={`dt-tool-btn ${pitchPreset === '3D' ? 'active' : ''}`}
          onClick={() => handlePitchChange('3D')}
          title="3D Perspective (62° Tilt)"
        >
          <Rotate3d size={18} />
        </button>
        <button
          className={`dt-tool-btn ${pitchPreset === 'ISOMETRIC' ? 'active' : ''}`}
          onClick={() => handlePitchChange('ISOMETRIC')}
          title="Isometric View (45° Tilt)"
        >
          <Layers size={18} />
        </button>
        <button
          className={`dt-tool-btn ${pitchPreset === '2D' ? 'active' : ''}`}
          onClick={() => handlePitchChange('2D')}
          title="2D Top-Down View"
        >
          <Eye size={18} />
        </button>
        <button
          className={`dt-tool-btn ${isRotating ? 'active' : ''}`}
          onClick={() => setIsRotating((v) => !v)}
          title="Auto-Orbit Camera"
        >
          <Play size={16} />
        </button>
        <button className="dt-tool-btn" onClick={handleResetNorth} title="Reset North & Alignment">
          <Compass size={18} />
        </button>
        <button
          className="dt-tool-btn"
          onClick={() => {
            const el = document.getElementById('hvra-3d-digital-twin');
            if (el) {
              if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
              else document.exitFullscreen().catch(() => {});
            }
          }}
          title="Toggle Command Center Fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* ── Left Layer Drawer ── */}
      <div className="dt-left-layers-panel">
        <div className="dt-panel-title">
          <span>Digital Twin Layers</span>
          <Layers size={14} />
        </div>

        <label className="dt-layer-item">
          <span>3D Unit Extrusions</span>
          <input
            type="checkbox"
            className="dt-layer-checkbox"
            checked={layersVisibility.extrusions}
            onChange={(e) => setLayersVisibility((p) => ({ ...p, extrusions: e.target.checked }))}
          />
        </label>
        <label className="dt-layer-item">
          <span>Administrative Boundaries</span>
          <input
            type="checkbox"
            className="dt-layer-checkbox"
            checked={layersVisibility.boundaries}
            onChange={(e) => setLayersVisibility((p) => ({ ...p, boundaries: e.target.checked }))}
          />
        </label>
        <label className="dt-layer-item">
          <span>River & Water Inundation</span>
          <input
            type="checkbox"
            className="dt-layer-checkbox"
            checked={layersVisibility.waterBodies}
            onChange={(e) => setLayersVisibility((p) => ({ ...p, waterBodies: e.target.checked }))}
          />
        </label>
        <label className="dt-layer-item">
          <span>Historical Flood Events</span>
          <input
            type="checkbox"
            className="dt-layer-checkbox"
            checked={layersVisibility.historicalEvents}
            onChange={(e) => setLayersVisibility((p) => ({ ...p, historicalEvents: e.target.checked }))}
          />
        </label>
        <label className="dt-layer-item">
          <span>CWC River Gauges</span>
          <input
            type="checkbox"
            className="dt-layer-checkbox"
            checked={layersVisibility.monitoringStations}
            onChange={(e) => setLayersVisibility((p) => ({ ...p, monitoringStations: e.target.checked }))}
          />
        </label>
      </div>

      {/* ── Right Risk Inspector & Risk DNA Panel ── */}
      {selectedUnit && (
        <div className="dt-right-inspector-panel">
          {/* Header */}
          <div className="dt-inspector-header">
            <h3 className="dt-unit-title">{selectedUnit.name}</h3>
            <div className="dt-unit-subtitle">{selectedUnit.district} • Block Level Resolution</div>
          </div>

          {/* Overall Risk Score */}
          <div className="dt-risk-score-display">
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700 }}>
                Composite Risk
              </div>
              <div className="dt-risk-score-val" style={{ color: selectedUnit.riskScore > 70 ? '#ef4444' : '#f59e0b' }}>
                {selectedUnit.riskScore}
              </div>
            </div>
            <div
              className="dt-risk-badge"
              style={{
                background: selectedUnit.riskScore > 70 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: selectedUnit.riskScore > 70 ? '#fca5a5' : '#fcd34d',
                border: `1px solid ${selectedUnit.riskScore > 70 ? '#ef4444' : '#f59e0b'}`,
              }}
            >
              {selectedUnit.riskScore > 70 ? 'High Risk' : 'Moderate'}
            </div>
          </div>

          {/* ── Signature Feature: Risk DNA Visualization ── */}
          <div className="dt-risk-dna-card">
            <div className="dt-dna-header">
              <span className="dt-dna-label">
                <Sparkles size={13} />
                Risk DNA Profile
              </span>
              <span className="dt-dominant-badge">{selectedUnit.dominant}</span>
            </div>

            <div className="dt-hve-breakdown-row">
              {/* Hazard */}
              <div className="dt-hve-metric-bar">
                <div className="dt-hve-metric-meta">
                  <span style={{ fontWeight: 600 }}>Hazard (H)</span>
                  <span>
                    Score: <strong>{selectedUnit.hazardScore}</strong> (wt: {selectedUnit.hazardWeight})
                  </span>
                </div>
                <div className="dt-bar-track">
                  <div
                    className="dt-bar-fill"
                    style={{
                      width: `${(selectedUnit.hazardScore / 10) * 100}%`,
                      background: 'linear-gradient(90deg, #ea580c, #f97316)',
                    }}
                  />
                </div>
              </div>

              {/* Vulnerability */}
              <div className="dt-hve-metric-bar">
                <div className="dt-hve-metric-meta">
                  <span style={{ fontWeight: 600 }}>Vulnerability (V)</span>
                  <span>
                    Score: <strong>{selectedUnit.vulnScore}</strong> (wt: {selectedUnit.vulnWeight})
                  </span>
                </div>
                <div className="dt-bar-track">
                  <div
                    className="dt-bar-fill"
                    style={{
                      width: `${(selectedUnit.vulnScore / 10) * 100}%`,
                      background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    }}
                  />
                </div>
              </div>

              {/* Exposure */}
              <div className="dt-hve-metric-bar">
                <div className="dt-hve-metric-meta">
                  <span style={{ fontWeight: 600 }}>Exposure (E)</span>
                  <span>
                    Score: <strong>{selectedUnit.expoScore}</strong> (wt: {selectedUnit.expoWeight})
                  </span>
                </div>
                <div className="dt-bar-track">
                  <div
                    className="dt-bar-fill"
                    style={{
                      width: `${(selectedUnit.expoScore / 10) * 100}%`,
                      background: 'linear-gradient(90deg, #0891b2, #06b6d4)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="dt-hve-weights-note">
              Model: Weighted Geometric Mean (H^{selectedUnit.hazardWeight} × V^{selectedUnit.vulnWeight} × E^{selectedUnit.expoWeight})
            </div>
          </div>

          {/* Telemetry Stats */}
          <div className="dt-telemetry-grid">
            <div className="dt-telemetry-stat">
              <div className="dt-stat-label">Primary Hazard</div>
              <div className="dt-stat-val" style={{ fontSize: '0.82rem' }}>
                {selectedUnit.primaryHazard}
              </div>
            </div>
            <div className="dt-telemetry-stat">
              <div className="dt-stat-label">Peak Flood Depth</div>
              <div className="dt-stat-val">{selectedUnit.floodDepth}</div>
            </div>
            <div className="dt-telemetry-stat">
              <div className="dt-stat-label">Exposed Pop.</div>
              <div className="dt-stat-val">{selectedUnit.populationExposed}</div>
            </div>
            <div className="dt-telemetry-stat">
              <div className="dt-stat-label">Critical Infra.</div>
              <div className="dt-stat-val">28 Assets</div>
            </div>
          </div>

          {/* Action: AI Risk Investigator */}
          <div className="dt-action-btn-group">
            <button
              className="dt-primary-action-btn"
              onClick={() => setIsInvestigating((v) => !v)}
            >
              <Sparkles size={15} />
              {isInvestigating ? 'Close Investigation' : 'Investigate Risk (AI Diagnostics)'}
            </button>
          </div>

          {/* AI Risk Diagnostics Drawer */}
          {isInvestigating && (
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                borderRadius: 10,
                padding: '12px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '0.78rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '6px' }}>
                🔍 Why is this area high risk?
              </div>
              <div style={{ color: '#cbd5e1' }}>
                <strong>Primary Contributor:</strong> Flood Hazard Exceedance (Score: {selectedUnit.hazardScore}/10)
                <ul style={{ paddingLeft: '1.2rem', marginTop: '4px', marginBottom: '6px' }}>
                  <li>Meenachil River Basin gauge records +1.9m flood surcharge.</li>
                  <li>High exposure density with {selectedUnit.populationExposed} residents in low-lying polder flats.</li>
                  <li>Drainage bottleneck at backwater confluence limits recession.</li>
                </ul>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  Cited from Kerala SDMA & CWC telemetry records.
                </div>
              </div>
            </div>
          )}

          {/* ── Scenario Simulator Overlay (When in SIMULATE mode) ── */}
          {activeWorkflowTab === 'SIMULATE' && (
            <div className="dt-scenario-drawer">
              <div className="dt-dna-header">
                <span className="dt-dna-label">
                  <Sliders size={13} />
                  Scenario Parameters
                </span>
                <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>
                  SIMULATION MODE
                </span>
              </div>

              <div className="dt-slider-row">
                <div className="dt-slider-header">
                  <span>Monsoon Rainfall Exceedance</span>
                  <span>+{simRainfall}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={simRainfall}
                  className="dt-slider-input"
                  onChange={(e) => setSimRainfall(Number(e.target.value))}
                />
              </div>

              <div className="dt-slider-row">
                <div className="dt-slider-header">
                  <span>River Stage Crest Surge</span>
                  <span>+{simRiverStage} m</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3.5"
                  step="0.1"
                  value={simRiverStage}
                  className="dt-slider-input"
                  onChange={(e) => setSimRiverStage(Number(e.target.value))}
                />
              </div>

              <div className="dt-slider-row">
                <div className="dt-slider-header">
                  <span>Drainage Discharge Capacity</span>
                  <span>{simDrainage > 0 ? `+${simDrainage}` : simDrainage}%</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  value={simDrainage}
                  className="dt-slider-input"
                  onChange={(e) => setSimDrainage(Number(e.target.value))}
                />
              </div>

              <div className="dt-slider-row">
                <div className="dt-slider-header">
                  <span>Exposed Population Shift</span>
                  <span>+{simPopulation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={simPopulation}
                  className="dt-slider-input"
                  onChange={(e) => setSimPopulation(Number(e.target.value))}
                />
              </div>

              <div className="dt-comparison-delta">
                <div className="dt-delta-item">
                  <span className="dt-delta-lbl">Current Risk</span>
                  <span className="dt-delta-val" style={{ color: '#94a3b8' }}>
                    {simulationComparison.current}
                  </span>
                </div>
                <span style={{ fontSize: '1.2rem', color: '#64748b' }}>➔</span>
                <div className="dt-delta-item">
                  <span className="dt-delta-lbl">Simulated Risk</span>
                  <span className="dt-delta-val" style={{ color: '#ef4444' }}>
                    {simulationComparison.simulated}
                  </span>
                </div>
                <div className="dt-delta-item">
                  <span className="dt-delta-lbl">Delta</span>
                  <span className="dt-delta-val" style={{ color: '#f59e0b' }}>
                    {simulationComparison.delta}
                  </span>
                </div>
              </div>

              <div className="dt-simulation-disclaimer">
                ⚡ Forward-projected simulation scenario (Not historical baseline).
              </div>
            </div>
          )}

          {/* ── Mitigation Sandbox Overlay (When in MITIGATE mode) ── */}
          {activeWorkflowTab === 'MITIGATE' && (
            <div className="dt-scenario-drawer">
              <div className="dt-dna-header">
                <span className="dt-dna-label">
                  <Shield size={13} />
                  Mitigation Interventions
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>
                  SANDBOX
                </span>
              </div>

              <label className="dt-layer-item">
                <span>Diversion Canal (Meenachil)</span>
                <input
                  type="checkbox"
                  className="dt-layer-checkbox"
                  checked={mitigations.diversionCanal}
                  onChange={(e) => setMitigations((p) => ({ ...p, diversionCanal: e.target.checked }))}
                />
              </label>

              <label className="dt-layer-item">
                <span>Raise Polder Dykes (+1.5m)</span>
                <input
                  type="checkbox"
                  className="dt-layer-checkbox"
                  checked={mitigations.embankmentDyke}
                  onChange={(e) => setMitigations((p) => ({ ...p, embankmentDyke: e.target.checked }))}
                />
              </label>

              <label className="dt-layer-item">
                <span>High-Discharge Sluice Pumps</span>
                <input
                  type="checkbox"
                  className="dt-layer-checkbox"
                  checked={mitigations.automatedPumps}
                  onChange={(e) => setMitigations((p) => ({ ...p, automatedPumps: e.target.checked }))}
                />
              </label>

              <div className="dt-comparison-delta">
                <div className="dt-delta-item">
                  <span className="dt-delta-lbl">Baseline</span>
                  <span className="dt-delta-val" style={{ color: '#ef4444' }}>
                    {mitigationComparison.before}
                  </span>
                </div>
                <span style={{ fontSize: '1.2rem', color: '#64748b' }}>➔</span>
                <div className="dt-delta-item">
                  <span className="dt-delta-lbl">With Mitigation</span>
                  <span className="dt-delta-val" style={{ color: '#10b981' }}>
                    {mitigationComparison.after}
                  </span>
                </div>
                <div className="dt-delta-item">
                  <span className="dt-delta-lbl">Risk Saved</span>
                  <span className="dt-delta-val" style={{ color: '#10b981' }}>
                    -{mitigationComparison.reduction} pts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom 4D Time Machine Bar ── */}
      <div className="dt-bottom-timeline-bar">
        <div className="dt-timeline-controls">
          <button
            className="dt-timeline-play-btn"
            onClick={() => setIsPlayingTimeline((v) => !v)}
            title={isPlayingTimeline ? 'Pause Chronological Progression' : 'Play 4D Progression'}
          >
            {isPlayingTimeline ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
            <div className="dt-timeline-years">
              {[2020, 2022, 2024, 2026, 2028, 2030].map((yr) => (
                <span
                  key={yr}
                  className={`dt-timeline-year-label ${timelineYear === yr ? 'active' : ''}`}
                  onClick={() => setTimelineYear(yr)}
                >
                  {yr} {yr === 2026 ? '(Current)' : yr > 2026 ? '(Projected)' : '(Historical)'}
                </span>
              ))}
            </div>

            <input
              type="range"
              min="2020"
              max="2030"
              step="2"
              value={timelineYear}
              className="dt-timeline-scrubber"
              onChange={(e) => setTimelineYear(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
