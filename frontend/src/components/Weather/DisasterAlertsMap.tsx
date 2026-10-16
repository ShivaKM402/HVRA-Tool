import React, { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DisasterAlertItem } from '@/types';
import { KERALA_DISTRICTS } from '@/services/weatherService';
import './DisasterAlertsMap.css';

interface DisasterAlertsMapProps {
  alerts: DisasterAlertItem[];
  selectedDistrict?: string;
  onDistrictSelect?: (districtName: string) => void;
}

const KERALA_CENTER: [number, number] = [10.35, 76.35];

// Smoothly pans the map when user selects a district
function MapCenterController({ coords, districtName }: { coords?: [number, number]; districtName?: string }) {
  const map = useMap();
  const lastDistrict = useRef<string | undefined>(districtName);

  useEffect(() => {
    if (districtName && districtName !== 'All' && coords && lastDistrict.current !== districtName) {
      map.flyTo(coords, Math.max(map.getZoom(), 9), { duration: 0.8 });
    }
    lastDistrict.current = districtName;
  }, [districtName, coords, map]);

  return null;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  RED: 4,
  ORANGE: 3,
  YELLOW: 2,
  GREEN: 1,
  INFO: 0,
};

const SEVERITY_COLORS: Record<string, string> = {
  RED: '#dc2626',
  ORANGE: '#ea580c',
  YELLOW: '#ca8a04',
  GREEN: '#16a34a',
  INFO: '#0284c7',
};

export const DisasterAlertsMap: React.FC<DisasterAlertsMapProps> = ({
  alerts,
  selectedDistrict = 'All',
  onDistrictSelect,
}) => {
  // Aggregate alerts per district
  const districtAlertMap = useMemo(() => {
    const map = new Map<string, DisasterAlertItem[]>();

    Object.values(KERALA_DISTRICTS).forEach((d) => {
      map.set(d.name.toLowerCase(), []);
    });

    alerts.forEach((alert) => {
      const distList = alert.affected_districts || [alert.affected_district];
      distList.forEach((dName) => {
        const key = dName.toLowerCase().replace(/ district| \[demo\]/g, '').trim();
        for (const k of Object.keys(KERALA_DISTRICTS)) {
          if (key.includes(k) || k.includes(key)) {
            const list = map.get(k) || [];
            list.push(alert);
            map.set(k, list);
            break;
          }
        }
      });
    });

    return map;
  }, [alerts]);

  // Seismic events with explicit coordinates (USGS)
  const seismicEvents = useMemo(() => {
    return alerts.filter(
      (a) => a.hazard_type === 'EARTHQUAKE' && a.coordinates && a.coordinates.length === 2
    );
  }, [alerts]);

  // Find active coordinates if a district is selected
  const activeDistrictCoords = useMemo((): [number, number] | undefined => {
    if (!selectedDistrict || selectedDistrict === 'All') return undefined;
    const key = selectedDistrict.toLowerCase().replace(/ district/g, '').trim();
    const match = Object.entries(KERALA_DISTRICTS).find(([k]) => k.includes(key) || key.includes(k));
    return match ? [match[1].lat, match[1].lon] : undefined;
  }, [selectedDistrict]);

  // Build custom Leaflet icon for a district
  const createDistrictIcon = (count: number, maxSev: string, isSelected: boolean) => {
    const color = SEVERITY_COLORS[maxSev] || '#0284c7';
    const isHigh = maxSev === 'RED' || maxSev === 'ORANGE';
    const size = isSelected ? 38 : count > 0 ? 32 : 24;

    const html = `
      <div class="alert-marker-pin" style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        color: ${color};
        box-shadow: 0 3px 12px ${color}88;
        border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'};
      ">
        <span style="color: #ffffff; font-weight: 800; font-size: ${size > 30 ? '0.75rem' : '0.68rem'};">
          ${count > 0 ? count : '•'}
        </span>
        ${isHigh ? `<div class="marker-pulse-ring" style="color: ${color};"></div>` : ''}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-alert-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  // Build custom icon for seismic epicenters
  const createSeismicIcon = (mag: number = 3.5) => {
    const size = Math.min(42, Math.max(26, Math.round(mag * 8)));
    const html = `
      <div class="alert-marker-pin" style="
        width: ${size}px;
        height: ${size}px;
        background: #7c3aed;
        color: #7c3aed;
        box-shadow: 0 0 14px #a855f7aa;
        border: 2px solid #ffffff;
      ">
        <span style="font-size: ${size > 30 ? '0.78rem' : '0.68rem'};">🌋</span>
        <div class="marker-pulse-ring" style="color: #a855f7;"></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-seismic-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  return (
    <div className="disaster-map-container">
      {/* Top Floating Status Overlay */}
      <div className="disaster-map-topbar">
        <div className="disaster-map-badge">
          <span className="map-live-dot" />
          <span>Kerala Hazard Situation Map · Real-time Incident Overlay</span>
        </div>

        {selectedDistrict && selectedDistrict !== 'All' && (
          <div
            className="disaster-map-badge"
            style={{ background: 'rgba(2, 132, 199, 0.9)', cursor: 'pointer' }}
            onClick={() => onDistrictSelect && onDistrictSelect('All')}
          >
            <span>📍 Focused on: <strong>{selectedDistrict}</strong> (Reset)</span>
          </div>
        )}
      </div>

      <MapContainer
        center={KERALA_CENTER}
        zoom={8}
        scrollWheelZoom={false}
        className="disaster-map-leaflet"
      >
        <MapCenterController coords={activeDistrictCoords} districtName={selectedDistrict} />

        {/* Basemap: Clean CartoDB Dark Matter / Positron */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />

        {/* District Markers */}
        {Object.entries(KERALA_DISTRICTS).map(([k, dist]) => {
          const dAlerts = districtAlertMap.get(k) || [];
          const count = dAlerts.length;

          let maxSev = 'INFO';
          let maxWeight = 0;
          dAlerts.forEach((a) => {
            const w = SEVERITY_WEIGHT[a.severity] ?? 0;
            if (w > maxWeight) {
              maxWeight = w;
              maxSev = a.severity;
            }
          });

          const isSelected = selectedDistrict.toLowerCase().includes(k);

          return (
            <Marker
              key={k}
              position={[dist.lat, dist.lon]}
              icon={createDistrictIcon(count, maxSev, isSelected)}
              eventHandlers={{
                click: () => {
                  if (onDistrictSelect) {
                    onDistrictSelect(dist.name);
                  }
                },
              }}
            >
              <Popup>
                <div className="alert-popup-box">
                  <div className="alert-popup-header">
                    <span className="alert-popup-title">📍 {dist.name} District</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: `${SEVERITY_COLORS[maxSev]}20`,
                        color: SEVERITY_COLORS[maxSev],
                      }}
                    >
                      {count} {count === 1 ? 'Notice' : 'Notices'}
                    </span>
                  </div>

                  {count === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', padding: '0.4rem 0' }}>
                      No active warnings or emergency incident reports currently recorded for {dist.name}.
                    </div>
                  ) : (
                    <div>
                      {dAlerts.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={`alert-popup-item is-${item.severity.toLowerCase()}`}
                        >
                          <div className="alert-popup-item-headline">
                            {item.hazard_icon} {item.headline}
                          </div>
                          <div className="alert-popup-item-meta">
                            <span>{item.source_name}</span>
                            {item.source_url && (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="alert-popup-link"
                              >
                                View Notice ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {count > 3 && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            textAlign: 'center',
                            marginTop: '0.4rem',
                            color: '#0284c7',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          onClick={() => onDistrictSelect && onDistrictSelect(dist.name)}
                        >
                          + {count - 3} more updates in list view
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Seismic Observation Pins (USGS) */}
        {seismicEvents.map((ev) => (
          <Marker
            key={ev.id}
            position={[ev.coordinates[0], ev.coordinates[1]]}
            icon={createSeismicIcon(ev.magnitude)}
          >
            <Popup>
              <div className="alert-popup-box">
                <div className="alert-popup-header">
                  <span className="alert-popup-title">🌋 Recorded Seismic Activity</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: '#f3e8ff',
                      color: '#7e22ce',
                    }}
                  >
                    M{ev.magnitude?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  {ev.headline}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.4, marginBottom: '0.4rem' }}>
                  Recorded at depth {ev.depth_km?.toFixed(1) || '10.0'} km. Verified sensor observation (not a forecast).
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Time: {new Date(ev.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
                {ev.source_url && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="alert-popup-link"
                    >
                      USGS Event Summary ↗
                    </a>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="disaster-map-legend">
        <div className="legend-title">
          <span>⚠️ Warning Level Key</span>
        </div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#dc2626' }} />
            <span>Red Alert (Severe)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#ea580c' }} />
            <span>Orange Alert</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#ca8a04' }} />
            <span>Yellow Alert</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#7c3aed' }} />
            <span>Seismic Telemetry</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisasterAlertsMap;
