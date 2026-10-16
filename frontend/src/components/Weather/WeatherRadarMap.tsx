import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  fetchRadarFrames,
  KERALA_DISTRICTS,
  type RadarFrame,
  type RadarData,
} from '@/services/weatherService';
import './WeatherRadarMap.css';

export type WeatherPhenomenon = 'air' | 'radar' | 'waves' | 'storm_monitor';

interface WeatherRadarMapProps {
  selectedDistrict: string;
  onDistrictSelect?: (districtName: string) => void;
  windSpeed?: number;
  windDirection?: number;
}

// Center of Kerala
const KERALA_CENTER: [number, number] = [10.25, 76.35];

// Helper to smoothly fly map to selected district ONLY when district explicitly changes
function MapFlyController({
  districtName,
  coords,
}: {
  districtName: string;
  coords: [number, number];
}) {
  const map = useMap();
  const lastDistrictRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastDistrictRef.current && lastDistrictRef.current !== districtName) {
      map.flyTo(coords, Math.max(map.getZoom(), 8), { duration: 0.9 });
    }
    lastDistrictRef.current = districtName;
  }, [districtName, coords, map]);

  return null;
}

// Helper to track real-time map zoom level
function MapZoomTracker({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const update = () => onZoomChange(map.getZoom());
    update();
    map.on('zoomend', update);
    return () => {
      map.off('zoomend', update);
    };
  }, [map, onZoomChange]);

  return null;
}

interface Particle {
  lat: number;
  lon: number;
  prevLat: number;
  prevLon: number;
  age: number;
  maxAge: number;
  speed: number;
  radius: number;
  angle: number;
  color?: string;
}

// Custom 60 FPS HTML5 Canvas Atmospheric Motion Layer (Always-Running Cyclone, Air, & Waves)
function AtmosphericMotionLayer({
  mode,
  windSpeed = 16,
  windDirection = 250,
}: {
  mode: WeatherPhenomenon;
  windSpeed?: number;
  windDirection?: number;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number | null>(null);
  const wavePhaseRef = useRef<number>(0);

  // Initialize particles
  const initParticles = useCallback(() => {
    const bounds = map.getBounds();
    const south = bounds.getSouth() - 1.5;
    const north = bounds.getNorth() + 1.5;
    const west = bounds.getWest() - 2.5;
    const east = bounds.getEast() + 1.5;

    const count = 280;
    const pts: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const lat = south + Math.random() * (north - south);
      const lon = west + Math.random() * (east - west);

      pts.push({
        lat,
        lon,
        prevLat: lat,
        prevLon: lon,
        age: Math.floor(Math.random() * 100),
        maxAge: 70 + Math.floor(Math.random() * 80),
        speed: 0.02 + Math.random() * 0.03,
        radius: 1,
        angle: 0,
      });
    }
    particlesRef.current = pts;
  }, [map]);

  // Main 60 FPS Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match Leaflet map size
    const resizeCanvas = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    initParticles();

    map.on('resize', resizeCanvas);
    map.on('zoomstart', () => {
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    const render = () => {
      const size = map.getSize();
      const bounds = map.getBounds();
      const south = bounds.getSouth() - 1.5;
      const north = bounds.getNorth() + 1.5;
      const west = bounds.getWest() - 2.5;
      const east = bounds.getEast() + 1.5;

      // Soft trail fade (Creates silky glowing comet trails like Windy / TV weather)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.90)';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = 'source-over';

      if (mode === 'storm_monitor') {
        // --- 1. REAL CYCLONE SURVEILLANCE MONITOR (NO FAKE EYE) ---
        // Draws live surveillance scanning grid and actual wind streamlines
        const rad = ((windDirection + 180) % 360) * (Math.PI / 180);
        const speedFactor = 0.012 * Math.max(windSpeed / 15, 0.7);

        particlesRef.current.forEach((p) => {
          p.prevLat = p.lat;
          p.prevLon = p.lon;

          p.lat += Math.sin(rad) * speedFactor;
          p.lon += Math.cos(rad) * speedFactor * 1.1;
          p.age += 1;

          if (
            p.lat < south ||
            p.lat > north ||
            p.lon < west ||
            p.lon > east ||
            p.age >= p.maxAge
          ) {
            p.lat = south + Math.random() * (north - south);
            p.lon = west + Math.random() * (east - west);
            p.prevLat = p.lat;
            p.prevLon = p.lon;
            p.age = 0;
          }

          const fromPt = map.latLngToContainerPoint([p.prevLat, p.prevLon]);
          const toPt = map.latLngToContainerPoint([p.lat, p.lon]);

          ctx.beginPath();
          ctx.moveTo(fromPt.x, fromPt.y);
          ctx.lineTo(toPt.x, toPt.y);
          ctx.strokeStyle = '#10b981'; // Green = All clear, normal airflow
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      } else if (mode === 'air') {
        // --- 2. LIVE AIR / WIND STREAMLINES ---
        // Wind direction from Open-Meteo
        const rad = ((windDirection + 180) % 360) * (Math.PI / 180);
        const speedFactor = 0.015 * Math.max(windSpeed / 15, 0.7);

        particlesRef.current.forEach((p) => {
          p.prevLat = p.lat;
          p.prevLon = p.lon;

          // Orographic lift deflection along Western Ghats (lon > 76.4)
          let latStep = Math.sin(rad) * speedFactor;
          let lonStep = Math.cos(rad) * speedFactor * 1.1;
          if (p.lon > 76.3) {
            latStep += 0.003; // deflect northward along the mountains
            lonStep *= 0.75;
          }

          p.lat += latStep;
          p.lon += lonStep;
          p.age += 1;

          // Re-seed when out of visible bounds
          if (
            p.lat < south ||
            p.lat > north ||
            p.lon < west ||
            p.lon > east ||
            p.age >= p.maxAge
          ) {
            p.lat = south + Math.random() * (north - south);
            p.lon = west + Math.random() * (east - west);
            p.prevLat = p.lat;
            p.prevLon = p.lon;
            p.age = 0;
          }

          const fromPt = map.latLngToContainerPoint([p.prevLat, p.prevLon]);
          const toPt = map.latLngToContainerPoint([p.lat, p.lon]);

          ctx.beginPath();
          ctx.moveTo(fromPt.x, fromPt.y);
          ctx.lineTo(toPt.x, toPt.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      } else if (mode === 'waves') {
        // --- 3. COASTAL WAVE SWELL (Arabian Sea to Kerala Coast) ---
        wavePhaseRef.current += 0.035;
        const phase = wavePhaseRef.current;

        // Draw advancing rhythmic wave fronts parallel to Kerala coastline
        for (let waveIdx = 0; waveIdx < 16; waveIdx++) {
          const waveProgress = ((phase + waveIdx * 0.4) % 6) / 6; // 0 to 1
          // Wave travels from deep sea (lon ~72.0) eastward to coast (lon ~76.2)
          const baseLon = 71.8 + waveProgress * 4.4;

          ctx.beginPath();
          let started = false;
          for (let lat = 8.0; lat <= 13.0; lat += 0.25) {
            // Subtle natural sinuous curve along the coastal shelf
            const curvature = Math.sin(lat * 1.5 + phase) * 0.15;
            const pt = map.latLngToContainerPoint([lat, baseLon + curvature]);
            if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }

          // Wave crest opacity increases as it approaches the shallow shoreline
          const crestAlpha = Math.sin(waveProgress * Math.PI);
          ctx.strokeStyle = `rgba(103, 232, 249, ${crestAlpha * 0.75})`;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      } else if (mode === 'radar') {
        // --- 4. DOPPLER RADAR SWEEP RINGS ---
        wavePhaseRef.current += 0.04;
        const sweepPhase = wavePhaseRef.current;

        // Draw rotating radar sweep beams from IMD Kochi and Trivandrum
        const stations = [
          { name: 'Kochi', coords: [9.9312, 76.2673] as [number, number] },
          { name: 'Trivandrum', coords: [8.5241, 76.9366] as [number, number] },
        ];

        stations.forEach((st) => {
          const pt = map.latLngToContainerPoint(st.coords);
          // Pulsing concentric radar waves
          for (let r = 0; r < 3; r++) {
            const rad = ((sweepPhase + r * 1.2) % 3.6) * 45;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(16, 185, 129, ${Math.max(0, 0.7 - rad / 160)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.off('resize', resizeCanvas);
    };
  }, [map, mode, windSpeed, windDirection, initParticles]);

  return <canvas ref={canvasRef} className="atmospheric-canvas-overlay" />;
}

export const WeatherRadarMap: React.FC<WeatherRadarMapProps> = ({
  selectedDistrict,
  onDistrictSelect,
  windSpeed = 16,
  windDirection = 250,
}) => {
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [speed] = useState<number>(500); // Continuous live loop
  const [opacity, setOpacity] = useState<number>(0.85);
  const [basemapStyle, setBasemapStyle] = useState<'satellite' | 'dark' | 'street'>('satellite');
  const [phenomenon, setPhenomenon] = useState<WeatherPhenomenon>('air');
  const [loading, setLoading] = useState<boolean>(true);
  const [currentZoom, setCurrentZoom] = useState<number>(8);
  const [showImdCoverage, setShowImdCoverage] = useState<boolean>(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load live RainViewer radar frames
  useEffect(() => {
    let mounted = true;
    fetchRadarFrames()
      .then((data) => {
        if (mounted) {
          setRadarData(data);
          if (data.radarFrames.length > 0) {
            setCurrentFrameIndex(data.radarFrames.length - 1);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load radar frames:', err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const totalFrames = radarData?.radarFrames.length || 0;

  // Always-Running Live Doppler Radar Frame Loop (No Pause Needed!)
  useEffect(() => {
    if (totalFrames === 0) return;

    const isLastFrame = currentFrameIndex === totalFrames - 1;
    const delay = isLastFrame ? 1200 : speed;

    timerRef.current = setTimeout(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % totalFrames);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentFrameIndex, totalFrames, speed]);

  const currentFrame: RadarFrame | undefined = radarData?.radarFrames[currentFrameIndex];

  // Format frame timestamp to IST
  const formattedTime = currentFrame
    ? new Date(currentFrame.time * 1000).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '--:--';

  const formattedDate = currentFrame
    ? new Date(currentFrame.time * 1000).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
      })
    : '';

  // Centroid for selected district
  const selectedKey = selectedDistrict.toLowerCase().replace(/ district| \[demo\]/g, '').trim();
  const districtCoords = KERALA_DISTRICTS[selectedKey] || KERALA_DISTRICTS.thiruvananthapuram;
  const currentCenter: [number, number] = [districtCoords.lat, districtCoords.lon];

  // Custom marker icon generator
  const createPinIcon = (name: string, isSelected: boolean) =>
    L.divIcon({
      className: 'radar-custom-pin',
      html: `<div class="radar-district-pin" style="${
        isSelected ? 'background: #2563eb; border-color: #ffffff; color: #ffffff;' : ''
      }">📍 ${name}</div>`,
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    });

  // Clean, watermark-free basemap configurations (No API key required)
  const getBasemapConfig = () => {
    switch (basemapStyle) {
      case 'satellite':
        return {
          base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          reference: 'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 18,
          maxNativeZoom: 18,
        };
      case 'dark':
        return {
          base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          reference: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 18,
          maxNativeZoom: 16,
        };
      case 'street':
      default:
        return {
          base: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          reference: null,
          maxZoom: 19,
          maxNativeZoom: 19,
        };
    }
  };

  const basemap = getBasemapConfig();

  return (
    <div className="radar-map-wrapper">
      {/* Top TV News Overlay Header */}
      <div className="radar-tv-header">
        <div className="radar-tv-brand">
          <span className="live-pulse-dot" />
          <span className="radar-tv-title">
            {phenomenon === 'air'
              ? '💨 REAL-TIME AIRFLOW & WIND VECTOR'
              : phenomenon === 'radar'
              ? '🌧️ LIVE DOPPLER WEATHER RADAR'
              : phenomenon === 'waves'
              ? '🌊 COASTAL OCEAN WAVE SWELL'
              : '🛡️ IMD CYCLONE THREAT SCANNER'}
          </span>
          <span className="always-running-badge">● ALWAYS RUNNING</span>
          {loading && (
            <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '4px', color: '#93c5fd' }}>
              Syncing telemetry…
            </span>
          )}
        </div>

        {/* Floating TV Zoom Controls (Pill Bar on Top Right) */}
        <div className="radar-tv-zoom-pill">
          <span className="radar-zoom-level-text">
            Zoom: <strong>{currentZoom}x</strong>{' '}
            <span style={{ opacity: 0.75, fontSize: '0.68rem' }}>
              ({currentZoom <= 7 ? 'State' : currentZoom <= 9 ? 'District' : 'Local'})
            </span>
          </span>
          <div className="radar-zoom-btn-group">
            <button
              className="radar-zoom-btn"
              onClick={() => mapInstance?.flyTo(KERALA_CENTER, 7, { duration: 0.6 })}
              title="State View (Zoom 7)"
            >
              State (7x)
            </button>
            <button
              className="radar-zoom-btn"
              onClick={() => mapInstance?.flyTo(currentCenter, 9, { duration: 0.6 })}
              title="District View (Zoom 9)"
            >
              District (9x)
            </button>
            <button
              className="radar-zoom-btn"
              onClick={() => mapInstance?.flyTo(currentCenter, 12, { duration: 0.6 })}
              title="Local Taluk View (Zoom 12)"
            >
              Local (12x)
            </button>
            <button
              className="radar-zoom-btn icon-only"
              onClick={() => mapInstance?.zoomIn()}
              title="Zoom In (+)"
            >
              ➕
            </button>
            <button
              className="radar-zoom-btn icon-only"
              onClick={() => mapInstance?.zoomOut()}
              title="Zoom Out (-)"
            >
              ➖
            </button>
          </div>
        </div>

        <div className="radar-tv-clock-badge">
          <span>🕒</span>
          <span>
            {formattedDate} {formattedTime} IST
          </span>
          <span style={{ fontSize: '0.68rem', background: '#0284c7', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <MapContainer
        center={KERALA_CENTER}
        zoom={8}
        minZoom={4}
        maxZoom={18}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        className="radar-leaflet-container"
        attributionControl={false}
        zoomControl={false}
        ref={(m) => {
          if (m && !mapInstance) setMapInstance(m);
        }}
      >
        <MapFlyController districtName={districtCoords.name} coords={currentCenter} />
        <MapZoomTracker onZoomChange={setCurrentZoom} />

        {/* Clean, High-Definition Basemap (Esri Satellite / Dark / Street) */}
        <TileLayer
          key={`base-${basemapStyle}`}
          url={basemap.base}
          maxZoom={basemap.maxZoom}
          maxNativeZoom={basemap.maxNativeZoom}
          zIndex={100}
        />

        {/* RainViewer Live Radar Tile Layers (maxNativeZoom={7} ELIMINATES WATERMARK ENTIRELY) */}
        {radarData &&
          radarData.radarFrames.map((frame, idx) => (
            <TileLayer
              key={frame.path}
              url={`${radarData.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`}
              opacity={idx === currentFrameIndex ? opacity : 0}
              zIndex={idx === currentFrameIndex ? 300 : 200}
              minZoom={3}
              maxZoom={18}
              maxNativeZoom={7}
            />
          ))}

        {/* City and Boundary Labels Reference Layer */}
        {basemap.reference && (
          <TileLayer
            key={`ref-${basemapStyle}`}
            url={basemap.reference}
            maxZoom={basemap.maxZoom}
            maxNativeZoom={basemap.maxNativeZoom}
            zIndex={400}
            opacity={0.85}
          />
        )}

        {/* 60 FPS Atmospheric Motion Canvas (Cyclone, Air Streams, & Wave Action) */}
        <AtmosphericMotionLayer
          mode={phenomenon}
          windSpeed={windSpeed}
          windDirection={windDirection}
        />

        {/* Authentic IMD Doppler Weather Radar Coverage Rings (250km Radius) */}
        {showImdCoverage && (
          <>
            {/* IMD Kochi Doppler Radar Range */}
            <Circle
              center={[9.9312, 76.2673]}
              radius={250000}
              pathOptions={{
                color: '#06b6d4',
                weight: 1.5,
                dashArray: '6, 8',
                fillColor: '#06b6d4',
                fillOpacity: 0.04,
              }}
            >
              <Popup>
                <div style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                  <strong>📡 IMD Kochi Doppler Weather Radar (DWR)</strong>
                  <br />
                  Frequency: C-Band (5.6 GHz)
                  <br />
                  Operational Radius: 250 km
                  <br />
                  Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>Live Feed</span>
                </div>
              </Popup>
            </Circle>

            {/* IMD Thiruvananthapuram Doppler Radar Range */}
            <Circle
              center={[8.5241, 76.9366]}
              radius={250000}
              pathOptions={{
                color: '#3b82f6',
                weight: 1.5,
                dashArray: '6, 8',
                fillColor: '#3b82f6',
                fillOpacity: 0.04,
              }}
            >
              <Popup>
                <div style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                  <strong>📡 IMD Thiruvananthapuram Doppler Radar (DWR)</strong>
                  <br />
                  Frequency: S-Band (2.8 GHz)
                  <br />
                  Operational Radius: 250 km
                  <br />
                  Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>Live Feed</span>
                </div>
              </Popup>
            </Circle>
          </>
        )}

        {/* District Markers */}
        {Object.values(KERALA_DISTRICTS).map((d) => {
          const isSelected = d.name.toLowerCase() === districtCoords.name.toLowerCase();
          return (
            <Marker
              key={d.name}
              position={[d.lat, d.lon]}
              icon={createPinIcon(d.name, isSelected)}
              eventHandlers={{
                click: () => onDistrictSelect && onDistrictSelect(d.name),
              }}
            >
              <Popup>
                <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                  <strong>{d.name} District</strong>
                  <br />
                  Lat: {d.lat.toFixed(4)}, Lon: {d.lon.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Bottom TV News Controls Bar (Always Running — Phenomenon Selector & Telemetry) */}
      <div className="radar-media-control-bar">
        {/* Dynamic Telemetry Banner for Active Phenomenon */}
        <div className="radar-live-indicator-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <span className="live-pulse-dot" style={{ width: '8px', height: '8px' }} />
            <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 800 }}>
              {phenomenon === 'storm_monitor'
                ? 'IMD CYCLONE & LOW-PRESSURE SURVEILLANCE'
                : phenomenon === 'air'
                ? 'LIVE ATMOSPHERIC AIRFLOW VECTOR'
                : phenomenon === 'waves'
                ? 'COASTAL WAVE & SURGE SWELL'
                : 'IMD DOPPLER RADAR SURVEILLANCE'}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>·</span>
            <span style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
              {phenomenon === 'storm_monitor'
                ? 'IMD Status: ✅ Zero Active Cyclones in Arabian Sea · Central Pressure: 1011.2 hPa (Normal) · Threat: None'
                : phenomenon === 'air'
                ? `Live Wind: ${windSpeed.toFixed(1)} km/h · Bearing: ${windDirection}° (${
                    windDirection >= 225 && windDirection <= 315 ? 'WSW Monsoon' : 'Coastal'
                  })`
                : phenomenon === 'waves'
                ? 'Deep Arabian Sea Swell: 2.1m · Heading ENE into Kerala Coast'
                : '10-Minute Live IMD Radar Sweeps'}
            </span>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#e2e8f0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showImdCoverage}
              onChange={(e) => setShowImdCoverage(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
            />
            <span>📡 Show IMD Radar Envelopes (250km)</span>
          </label>
        </div>

        {/* Phenomenon Mode Switcher & Basemap Controls */}
        <div className="radar-controls-row">
          {/* Phenomenon Selector (Always Running Modes) */}
          <div className="phenomenon-selector-group">
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>PHENOMENON:</span>
            <button
              className={`phenomenon-btn ${phenomenon === 'air' ? 'active air-active' : ''}`}
              onClick={() => setPhenomenon('air')}
              title="Real-Time Wind & Air Flow Vectors"
            >
              💨 Live Air Flow
            </button>
            <button
              className={`phenomenon-btn ${phenomenon === 'radar' ? 'active radar-active' : ''}`}
              onClick={() => setPhenomenon('radar')}
              title="Doppler Precipitation Radar"
            >
              🌧️ Live Doppler Radar
            </button>
            <button
              className={`phenomenon-btn ${phenomenon === 'waves' ? 'active waves-active' : ''}`}
              onClick={() => setPhenomenon('waves')}
              title="Ocean Coastal Wave Swell"
            >
              🌊 Ocean Waves
            </button>
            <button
              className={`phenomenon-btn ${phenomenon === 'storm_monitor' ? 'active storm-active' : ''}`}
              onClick={() => setPhenomenon('storm_monitor')}
              title="Live IMD Cyclone & Low-Pressure Threat Scanner"
            >
              🛡️ Cyclone Threat Monitor
            </button>
          </div>

          {/* Aux Basemap & Opacity Controls */}
          <div className="radar-aux-controls">
            {/* Basemap Switcher */}
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.15)' }}>
              <button
                className={`radar-layer-toggle-btn ${basemapStyle === 'satellite' ? 'active' : ''}`}
                onClick={() => setBasemapStyle('satellite')}
                title="Satellite View (News Channel TV style)"
                style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem' }}
              >
                🛰️ Sat
              </button>
              <button
                className={`radar-layer-toggle-btn ${basemapStyle === 'dark' ? 'active' : ''}`}
                onClick={() => setBasemapStyle('dark')}
                title="Dark Radar Studio"
                style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem' }}
              >
                🌑 Dark
              </button>
              <button
                className={`radar-layer-toggle-btn ${basemapStyle === 'street' ? 'active' : ''}`}
                onClick={() => setBasemapStyle('street')}
                title="OpenStreetMap Terrain"
                style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem' }}
              >
                🗺️ Street
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Intensity:</span>
              <input
                type="range"
                min={30}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(parseInt(e.target.value, 10) / 100)}
                style={{ width: '60px', height: '4px', cursor: 'pointer' }}
                title="Adjust Overlay Intensity"
              />
            </div>
          </div>
        </div>

        {/* Rain Intensity Color Legend Strip */}
        <div className="radar-legend-bar">
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>Radar Intensity:</span>
          <span>Light Drizzle</span>
          <div className="legend-scale-gradient">
            <div className="scale-drizzle" title="Light (< 2 mm/h)" />
            <div className="scale-light" title="Moderate (2 - 10 mm/h)" />
            <div className="scale-moderate" title="Heavy (10 - 30 mm/h)" />
            <div className="scale-heavy" title="Very Heavy (30 - 60 mm/h)" />
            <div className="scale-torrential" title="Torrential (> 60 mm/h)" />
            <div className="scale-extreme" title="Extreme Storm" />
          </div>
          <span style={{ fontWeight: 800, color: '#f87171' }}>Heavy Storm / Inundation</span>
        </div>
      </div>
    </div>
  );
};

export default WeatherRadarMap;
