import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import {
  fetchRadarFrames,
  KERALA_DISTRICTS,
  type RadarFrame,
  type RadarData,
} from "@/services/weatherService";
import "./WeatherRadarMap.css";

export type WeatherLayer = "precipitation" | "temperature" | "air_quality" | "wind";
export type BasemapStyle = "satellite" | "topo";

interface BasemapConfig {
  name: string;
  icon: string;
  url: string;
  subdomains?: string[];
  maxZoom: number;
}

// Only Satellite Earth (Default) and Topography — Natural Color & Night Mode removed per user request
const BASEMAP_TILES: Record<BasemapStyle, BasemapConfig> = {
  satellite: {
    name: "Satellite Earth",
    icon: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
  },
  topo: {
    name: "Topography",
    icon: "🏔️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
  },
};

interface WeatherRadarMapProps {
  selectedDistrict: string;
  onDistrictSelect?: (districtName: string) => void;
  windSpeed?: number;
  windDirection?: number;
  temperature?: number;
  precipitation?: number;
  humidity?: number;
  aqi?: number | null;
  aqiCategory?: string | null;
  aqiColor?: string | null;
  pm25?: number | null;
  pm10?: number | null;
}

const KERALA_CENTER: [number, number] = [10.25, 76.35];

function MapFlyController({ districtName, coords }: { districtName: string; coords: [number, number] }) {
  const map = useMap();
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastRef.current && lastRef.current !== districtName) {
      map.flyTo(coords, Math.max(map.getZoom(), 8), { duration: 0.9 });
    }
    lastRef.current = districtName;
  }, [districtName, coords, map]);
  return null;
}

// Wind streamline particle with historical path for smooth curve drawing
interface WindParticle {
  x: number;
  y: number;
  speed: number;
  maxAge: number;
  age: number;
  history: { x: number; y: number }[];
}

// Thermal convective energy mote for temperature layer
interface ThermalMote {
  x: number;
  y: number;
  vy: number;
  size: number;
  alpha: number;
}

// Rain droplet for precipitation layer
interface RainDrop {
  x: number;
  y: number;
  vy: number;
  len: number;
  alpha: number;
}

// Splash ripple on ground impact
interface SplashRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

// Aerosol particulate for AQI layer
interface AerosolParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

/* ───────────────────────────────────────────────────────────────────
   Smooth, High-FPS Canvas Engine for Weather Overlays
   ─────────────────────────────────────────────────────────────────── */
function WeatherOverlayCanvas({
  layer,
  windSpeed = 16,
  windDirection = 250,
  temperature = 28,
  precipitation = 5,
  aqi = null,
}: {
  layer: WeatherLayer;
  windSpeed?: number;
  windDirection?: number;
  temperature?: number;
  precipitation?: number;
  aqi?: number | null;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  // Layer-specific particle state
  const windParticlesRef = useRef<WindParticle[]>([]);
  const thermalMotesRef = useRef<ThermalMote[]>([]);
  const rainDropsRef = useRef<RainDrop[]>([]);
  const ripplesRef = useRef<SplashRipple[]>([]);
  const aerosolsRef = useRef<AerosolParticle[]>([]);

  const phaseRef = useRef<number>(0);
  const radarSweepAngleRef = useRef<number>(0);

  // Initialize particle states
  const initParticles = useCallback(() => {
    const size = map.getSize();
    const w = size.x;
    const h = size.y;

    if (layer === "wind") {
      // 120 smooth, elegant streamline ribbons spaced across the map
      const list: WindParticle[] = [];
      const count = 120;
      for (let i = 0; i < count; i++) {
        list.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: 1.2 + Math.random() * 1.6,
          maxAge: 45 + Math.floor(Math.random() * 45),
          age: Math.floor(Math.random() * 40),
          history: [],
        });
      }
      windParticlesRef.current = list;
    } else if (layer === "temperature") {
      // 40 gentle rising convective thermal shimmer motes
      const motes: ThermalMote[] = [];
      for (let i = 0; i < 40; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: -(0.5 + Math.random() * 0.9),
          size: 1.8 + Math.random() * 2.2,
          alpha: 0.25 + Math.random() * 0.45,
        });
      }
      thermalMotesRef.current = motes;
    } else if (layer === "precipitation") {
      // Clean rainfall droplets
      const drops: RainDrop[] = [];
      const count = Math.min(180, Math.max(70, Math.round(precipitation * 18)));
      for (let i = 0; i < count; i++) {
        drops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: 8 + Math.random() * 7,
          len: 10 + Math.random() * 15,
          alpha: 0.35 + Math.random() * 0.45,
        });
      }
      rainDropsRef.current = drops;
      ripplesRef.current = [];
    } else if (layer === "air_quality") {
      // 100 soft floating aerosol particles
      const list: AerosolParticle[] = [];
      for (let i = 0; i < 100; i++) {
        list.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.9,
          vy: (Math.random() - 0.5) * 0.9,
          radius: 2 + Math.random() * 3.5,
          alpha: 0.25 + Math.random() * 0.4,
        });
      }
      aerosolsRef.current = list;
    }
  }, [map, layer, precipitation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const size = map.getSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size.x * dpr);
      canvas.height = Math.round(size.y * dpr);
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      initParticles();
    };

    resize();
    map.on("resize", resize);
    map.on("zoomend", initParticles);

    // Compass wind bearing in radians
    const windRad = ((windDirection + 180) % 360) * (Math.PI / 180);

    const render = () => {
      const size = map.getSize();
      const w = size.x;
      const h = size.y;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // CRITICAL: Always clear transparently so Satellite Earth is 100% visible underneath
      ctx.clearRect(0, 0, w, h);

      phaseRef.current += 0.02;
      const phase = phaseRef.current;

      // ─────────────────────────────────────────────────────────────
      // 1. WIND LAYER: Silky, Smooth Streamline Ribbons (Windy/Apple)
      // ─────────────────────────────────────────────────────────────
      if (layer === "wind") {
        const sf = 0.012 * Math.max(windSpeed / 14, 0.5);
        const gust = 1 + Math.sin(phase * 2) * 0.12;

        windParticlesRef.current.forEach((p) => {
          // Natural aerodynamic flow curve
          const curl = Math.sin(p.x * 0.003 + p.y * 0.003) * 0.18;
          const angle = windRad + curl;
          const step = p.speed * sf * w * gust;

          p.x += Math.cos(angle) * step;
          p.y += Math.sin(angle) * step * 0.65;
          p.age++;

          p.history.push({ x: p.x, y: p.y });
          if (p.history.length > 14) p.history.shift();

          // Reset when expired or outside map bounds
          if (p.age > p.maxAge || p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) {
            p.x = Math.random() * w;
            p.y = Math.random() * h;
            p.age = 0;
            p.maxAge = 45 + Math.floor(Math.random() * 45);
            p.history = [];
            return;
          }

          if (p.history.length >= 2) {
            // Smooth bell envelope for soft fade-in and fade-out
            const lifeRatio = Math.sin((p.age / p.maxAge) * Math.PI);

            // Flowing streamline curve
            ctx.beginPath();
            ctx.moveTo(p.history[0].x, p.history[0].y);
            for (let i = 1; i < p.history.length; i++) {
              ctx.lineTo(p.history[i].x, p.history[i].y);
            }
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.82 * lifeRatio})`;
            ctx.lineWidth = 1.9;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.shadowColor = "rgba(56, 189, 248, 0.85)";
            ctx.shadowBlur = 5;
            ctx.stroke();

            // Glowing white streamline head
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * lifeRatio})`;
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 6;
            ctx.fill();
          }
        });

      // ─────────────────────────────────────────────────────────────
      // 2. TEMPERATURE LAYER: Geographic Isotherm Heatmap
      // ─────────────────────────────────────────────────────────────
      } else if (layer === "temperature") {
        // Soft geographic thermal gradients blending over districts
        Object.entries(KERALA_DISTRICTS).forEach(([key, d], idx) => {
          const pt = map.latLngToContainerPoint([d.lat, d.lon]);

          // Skip if well outside viewport
          if (pt.x < -140 || pt.x > w + 140 || pt.y < -140 || pt.y > h + 140) return;

          // Localized elevation/topography temperature calculation
          let distTemp = temperature;
          if (key === "idukki" || key === "wayanad") {
            distTemp = temperature - 6; // High elevation cooling
          } else if (key === "palakkad") {
            distTemp = temperature + 2.5; // Inland gap warming
          } else if (key === "kottayam" || key === "pathanamthitta") {
            distTemp = temperature + 1;
          }

          // Thermal color scale
          let r = 249, g = 115, b = 22; // Amber Orange (29-32°C)
          if (distTemp >= 33) {
            r = 239; g = 68; b = 68; // Coral Red / Warm
          } else if (distTemp >= 29) {
            r = 249; g = 115; b = 22; // Amber Orange
          } else if (distTemp >= 25) {
            r = 234; g = 179; b = 8; // Golden Yellow
          } else {
            r = 34; g = 197; b = 94; // Alpine Green / Cool (<25°C)
          }

          // Breathing radial thermal field
          const rad = 135 * (1 + Math.sin(phase * 1.4 + idx * 0.7) * 0.05);
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.36)`);
          grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.16)`);
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
          ctx.fill();

          // District temperature pill badge
          ctx.save();
          ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
          const tempText = `${Math.round(distTemp)}°`;
          const textWidth = ctx.measureText(tempText).width;
          const badgeX = pt.x + 8;
          const badgeY = pt.y - 12;

          ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
          ctx.beginPath();
          ctx.roundRect(badgeX - 4, badgeY - 11, textWidth + 8, 16, 4);
          ctx.fill();
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(tempText, badgeX, badgeY + 1);
          ctx.restore();
        });

        // Delicate rising convective thermal motes
        thermalMotesRef.current.forEach((m) => {
          m.y += m.vy;
          m.x += Math.sin(m.y * 0.02 + phase) * 0.35;

          if (m.y < -10) {
            m.y = h + 10;
            m.x = Math.random() * w;
          }

          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253, 186, 116, ${m.alpha * (0.6 + Math.sin(phase * 2 + m.x) * 0.4)})`;
          ctx.shadowColor = "rgba(249, 115, 22, 0.8)";
          ctx.shadowBlur = 4;
          ctx.fill();
        });

      // ─────────────────────────────────────────────────────────────
      // 3. AIR QUALITY LAYER: Atmospheric Dispersion Halos
      // ─────────────────────────────────────────────────────────────
      } else if (layer === "air_quality") {
        const realAqi = aqi ?? 60;
        let r = 34, g = 197, b = 94; // Good (green)
        if (realAqi > 200)      { r = 239; g = 68;  b = 68;  } // Poor (red)
        else if (realAqi > 100) { r = 249; g = 115; b = 22;  } // Moderate (orange)
        else if (realAqi > 50)  { r = 132; g = 204; b = 22;  } // Satisfactory (lime)

        // Pulsing dispersion rings from major urban hubs
        const urbanHubs = [
          { lat: 9.9816, lon: 76.2999 },
          { lat: 8.5241, lon: 76.9366 },
          { lat: 11.2588, lon: 75.7804 },
          { lat: 10.5276, lon: 76.2144 },
        ];

        urbanHubs.forEach((hub, idx) => {
          const pt = map.latLngToContainerPoint([hub.lat, hub.lon]);
          for (let ring = 0; ring < 3; ring++) {
            const ringPhase = (phase * 20 + ring * 26 + idx * 14) % 85;
            const ringAlpha = Math.max(0, 0.45 * (1 - ringPhase / 85));

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, ringPhase, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${ringAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          const coreGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 40);
          coreGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.32 + Math.sin(phase * 2 + idx) * 0.08})`);
          coreGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 40, 0, Math.PI * 2);
          ctx.fill();
        });

        // Floating aerosol particles
        aerosolsRef.current.forEach((p) => {
          p.x += p.vx + Math.cos(windRad) * 0.5;
          p.y += p.vy + Math.sin(windRad) * 0.5;

          if (p.x < -20) p.x = w + 20;
          if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          if (p.y > h + 20) p.y = -20;

          const aGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          aGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.alpha * 0.8})`);
          aGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = aGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });

      // ─────────────────────────────────────────────────────────────
      // 4. PRECIPITATION LAYER: Doppler Radar Sweep + Rainfall
      // ─────────────────────────────────────────────────────────────
      } else if (layer === "precipitation") {
        const radarCenter = map.latLngToContainerPoint([9.98, 76.30]);
        const rx = radarCenter.x;
        const ry = radarCenter.y;

        radarSweepAngleRef.current = (radarSweepAngleRef.current + 0.035) % (Math.PI * 2);
        const sweepAngle = radarSweepAngleRef.current;
        const maxRadius = Math.max(w, h) * 0.85;

        // Radar distance rings
        ctx.save();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        [maxRadius * 0.3, maxRadius * 0.6, maxRadius * 0.9].forEach((rad) => {
          ctx.beginPath();
          ctx.arc(rx, ry, rad, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();

        // Trailing radar sweep arc
        ctx.save();
        const trailAngle = Math.PI / 4;
        const beamGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, maxRadius);
        beamGrad.addColorStop(0, "rgba(34, 197, 94, 0.3)");
        beamGrad.addColorStop(0.7, "rgba(56, 189, 248, 0.18)");
        beamGrad.addColorStop(1, "rgba(37, 99, 235, 0.01)");

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.arc(rx, ry, maxRadius, sweepAngle - trailAngle, sweepAngle, false);
        ctx.closePath();
        ctx.fill();

        // Rotating radar beam line
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(sweepAngle) * maxRadius, ry + Math.sin(sweepAngle) * maxRadius);
        ctx.strokeStyle = "rgba(74, 222, 128, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "rgba(74, 222, 128, 1)";
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();

        // Rain droplets
        const rainVx = Math.cos(windRad) * 2;
        const rainVy = 8.5 + (precipitation / 10) * 3;

        rainDropsRef.current.forEach((p) => {
          p.x += rainVx;
          p.y += rainVy;

          if (p.y > h + 15) {
            if (Math.random() < 0.3) {
              ripplesRef.current.push({
                x: p.x,
                y: Math.min(h - 5, p.y - 15),
                r: 1,
                maxR: 8 + Math.random() * 8,
                alpha: 0.65,
              });
            }
            p.y = -15;
            p.x = Math.random() * w;
          }
          if (p.x < -15) p.x = w + 15;
          if (p.x > w + 15) p.x = -15;

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + rainVx * 1.3, p.y - p.len);
          ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha * 0.75})`;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.stroke();
        });

        // Splash ripples
        ripplesRef.current = ripplesRef.current.filter((rp) => rp.alpha > 0.05);
        ripplesRef.current.forEach((rp) => {
          rp.r += 0.55;
          rp.alpha *= 0.93;
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.4, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(125, 211, 252, ${rp.alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.off("resize", resize);
      map.off("zoomend", initParticles);
    };
  }, [map, layer, windSpeed, windDirection, temperature, precipitation, aqi, initParticles]);

  return <canvas ref={canvasRef} className="weather-overlay-canvas" />;
}

const LAYERS: { id: WeatherLayer; label: string; icon: string }[] = [
  { id: "precipitation", label: "Precipitation", icon: "🌧️" },
  { id: "temperature",   label: "Temperature",   icon: "🌡️" },
  { id: "air_quality",   label: "Air Quality",   icon: "💨" },
  { id: "wind",          label: "Wind",          icon: "🌬️" },
];

const LEGENDS: Record<WeatherLayer, { label: string; items: { color: string; text: string }[] }> = {
  precipitation: {
    label: "Doppler Radar",
    items: [
      { color: "#a855f7", text: "Severe" },
      { color: "#ef4444", text: "Heavy" },
      { color: "#3b82f6", text: "Moderate" },
      { color: "#38bdf8", text: "Light" },
    ],
  },
  temperature: {
    label: "Temperature (°C)",
    items: [
      { color: "#ef4444", text: "33+" },
      { color: "#f97316", text: "29 - 32" },
      { color: "#eab308", text: "25 - 28" },
      { color: "#22c55e", text: "< 25" },
    ],
  },
  air_quality: {
    label: "Air Quality (AQI)",
    items: [
      { color: "#ef4444", text: "Poor (>200)" },
      { color: "#f97316", text: "Moderate (101-200)" },
      { color: "#84cc16", text: "Satisfactory (51-100)" },
      { color: "#22c55e", text: "Good (0-50)" },
    ],
  },
  wind: {
    label: "Wind (km/h)",
    items: [
      { color: "#ffffff", text: "Head Particle" },
      { color: "#38bdf8", text: "Active Streamline" },
      { color: "#1e3a5f", text: "Calm" },
    ],
  },
};

function createLocationIcon(
  layer: WeatherLayer,
  temperature: number,
  windSpeed: number,
  windDirection: number,
  precipitation: number,
  aqi: number | null,
  aqiColor: string | null,
  aqiCategory: string | null,
): L.DivIcon {
  const compass = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const dir = compass[Math.round(windDirection / 22.5) % 16];
  let inner = "";

  if (layer === "precipitation") {
    const icon = precipitation > 10 ? "🌧️" : precipitation > 2 ? "🌦️" : "⛅";
    inner = `<div class="loc-bubble loc-bubble-rain"><div class="loc-temp">${Math.round(temperature)}°</div><div class="loc-icon">${icon}</div></div>`;
  } else if (layer === "temperature") {
    inner = `<div class="loc-bubble loc-bubble-temp"><div class="loc-temp">${Math.round(temperature)}°</div><div class="loc-temp-range">${Math.round(temperature - 4)}&nbsp;&nbsp;${Math.round(temperature + 2)}</div></div>`;
  } else if (layer === "air_quality") {
    const realAqi = aqi ?? 60;
    const ringColor = aqiColor ?? "#22c55e";
    const dashLen = Math.round((realAqi / 500) * 138);
    inner = `<div class="loc-bubble loc-bubble-aqi">
      <svg viewBox="0 0 60 60" width="66" height="66">
        <circle cx="30" cy="30" r="26" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
        <circle cx="30" cy="30" r="22" fill="none" stroke="#1e3a5f" stroke-width="5"/>
        <circle cx="30" cy="30" r="22" fill="none" stroke="${ringColor}" stroke-width="5"
          stroke-dasharray="${dashLen} 138" stroke-linecap="round"
          transform="rotate(-90 30 30)"/>
        <text x="30" y="29" text-anchor="middle" font-size="13" font-weight="bold" fill="#f8fafc">${realAqi}</text>
        <text x="30" y="40" text-anchor="middle" font-size="5.5" fill="${ringColor}" font-weight="700">${(aqiCategory ?? "Good").toUpperCase()}</text>
      </svg>
    </div>`;
  } else {
    inner = `<div class="loc-bubble loc-bubble-wind"><div class="loc-wind-dir">${dir}</div><div class="loc-wind-speed">${Math.round(windSpeed)}</div><div class="loc-wind-unit">KM/H</div></div>`;
  }

  return L.divIcon({
    className: "location-marker-icon",
    html: `<div class="location-marker-wrap">${inner}<div class="loc-pin"></div><div class="loc-label">My Location</div></div>`,
    iconSize: [80, 120],
    iconAnchor: [40, 105],
  });
}

export const WeatherRadarMap: React.FC<WeatherRadarMapProps> = ({
  selectedDistrict,
  onDistrictSelect,
  windSpeed = 16,
  windDirection = 250,
  temperature = 28,
  precipitation = 5,
  humidity = 72,
  aqi = null,
  aqiCategory = null,
  aqiColor = null,
  pm25 = null,
  pm10 = null,
}) => {
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<WeatherLayer>("precipitation");
  // Default basemap is Satellite Earth
  const [basemapStyle, setBasemapStyle] = useState<BasemapStyle>("satellite");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch real RainViewer radar frames
  useEffect(() => {
    fetchRadarFrames()
      .then((data) => {
        setRadarData(data);
        if (data.radarFrames.length > 0) setCurrentFrameIndex(data.radarFrames.length - 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Frame animation timer for precipitation layer
  const totalFrames = radarData?.radarFrames.length || 0;
  useEffect(() => {
    if (totalFrames === 0 || activeLayer !== "precipitation") return;
    const isLast = currentFrameIndex === totalFrames - 1;
    timerRef.current = setTimeout(
      () => setCurrentFrameIndex((p) => (p + 1) % totalFrames),
      isLast ? 1400 : 600
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentFrameIndex, totalFrames, activeLayer]);

  const currentFrame: RadarFrame | undefined = radarData?.radarFrames[currentFrameIndex];
  const formattedTime = currentFrame
    ? new Date(currentFrame.time * 1000).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "--:--";

  const selectedKey = selectedDistrict.toLowerCase().replace(/ district| \[demo\]/g, "").trim();
  const districtCoords = KERALA_DISTRICTS[selectedKey] || KERALA_DISTRICTS.thiruvananthapuram;
  const currentCenter: [number, number] = [districtCoords.lat, districtCoords.lon];
  const legend = LEGENDS[activeLayer];
  const currentBasemap = BASEMAP_TILES[basemapStyle];
  const locationIcon = createLocationIcon(
    activeLayer,
    temperature,
    windSpeed,
    windDirection,
    precipitation,
    aqi,
    aqiColor,
    aqiCategory
  );

  const aqiLabel = aqi != null ? `${aqi} (${aqiCategory ?? "—"})` : "Loading…";

  return (
    <div className="aws-map-wrapper">
      <MapContainer
        center={KERALA_CENTER}
        zoom={8}
        minZoom={5}
        maxZoom={18}
        scrollWheelZoom
        doubleClickZoom
        dragging
        className="aws-leaflet-map"
        attributionControl={false}
        zoomControl={false}
        ref={(m) => {
          if (m && !mapInstance) setMapInstance(m);
        }}
      >
        <MapFlyController districtName={districtCoords.name} coords={currentCenter} />

        {/* 🛰️ Primary Basemap: Real True-Color Earth Satellite Imagery */}
        <TileLayer
          key={basemapStyle}
          url={currentBasemap.url}
          maxZoom={currentBasemap.maxZoom}
          maxNativeZoom={currentBasemap.maxZoom}
          zIndex={100}
          opacity={1}
        />

        {/* High-visibility cities, district boundaries and landmark labels on satellite */}
        {basemapStyle === "satellite" && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
            maxNativeZoom={16}
            zIndex={250}
            opacity={0.88}
          />
        )}

        {/* 📡 Live RainViewer Doppler Radar tiles (Active frame mounted cleanly) */}
        {activeLayer === "precipitation" && radarData && currentFrame && (
          <TileLayer
            key={currentFrame.path}
            url={`${radarData.host}${currentFrame.path}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.85}
            zIndex={300}
            minZoom={3}
            maxZoom={18}
            maxNativeZoom={7}
          />
        )}

        {/* ⚡ 60fps Dynamic Animated Canvas Engine (z-index 450) */}
        <WeatherOverlayCanvas
          layer={activeLayer}
          windSpeed={windSpeed}
          windDirection={windDirection}
          temperature={temperature}
          precipitation={precipitation}
          aqi={aqi}
        />

        {/* 📍 Live location marker for current selected district */}
        <Marker position={currentCenter} icon={locationIcon}>
          <Popup>
            <div style={{ textAlign: "center", fontSize: "0.82rem", lineHeight: 1.7 }}>
              <strong style={{ fontSize: "0.92rem", color: "#60a5fa" }}>📍 {districtCoords.name}</strong>
              <br />
              🌡️ {Math.round(temperature)}°C &nbsp; 🌧️ {precipitation.toFixed(1)} mm/h
              <br />
              💨 {windSpeed.toFixed(1)} km/h · {windDirection}° &nbsp; 💦 {humidity}%
              {aqi != null && (
                <>
                  <br />
                  🍃 AQI: <strong style={{ color: aqiColor ?? "#22c55e" }}>{aqi} ({aqiCategory})</strong>
                </>
              )}
              {pm25 != null && (
                <>
                  <br />
                  PM2.5: {pm25} µg/m³ &nbsp; PM10: {pm10} µg/m³
                </>
              )}
            </div>
          </Popup>
        </Marker>

        {/* 📍 Clickable district pins across Kerala */}
        {Object.entries(KERALA_DISTRICTS).map(([key, dist]) => {
          if (key === selectedKey) return null;
          return (
            <CircleMarker
              key={key}
              center={[dist.lat, dist.lon]}
              radius={5}
              pathOptions={{
                color: "#38bdf8",
                fillColor: "#0f172a",
                fillOpacity: 0.85,
                weight: 1.5,
              }}
              eventHandlers={{
                click: () => onDistrictSelect?.(dist.name),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0f172a" }}>
                  📍 {dist.name} (Click to switch)
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* 📊 Legend panel (top-left) */}
      <div className="aws-legend-panel">
        <div className="aws-legend-title">{legend.label}</div>
        <div className="aws-legend-items">
          {legend.items.map((item) => (
            <div key={item.text} className="aws-legend-row">
              <div className="aws-legend-swatch" style={{ background: item.color }} />
              <span className="aws-legend-text">{item.text}</span>
            </div>
          ))}
        </div>
        {activeLayer === "air_quality" && pm25 != null && (
          <div className="aws-legend-pm-strip">
            <span>PM2.5: <strong>{pm25}</strong> µg</span>
            <span>PM10: <strong>{pm10}</strong> µg</span>
          </div>
        )}
      </div>

      {/* 🎛️ Top-Right Controls Bar (Layer & Basemap Pickers) */}
      <div className="aws-top-controls">
        {/* Basemap Picker Button (Satellite Earth & Topography) */}
        <div className="aws-ctrl-btn-wrap">
          <button
            className={`aws-ctrl-btn ${showBasemapMenu ? "active" : ""}`}
            onClick={() => {
              setShowBasemapMenu((v) => !v);
              setShowLayerMenu(false);
            }}
            title="Map Style"
          >
            <span>{currentBasemap.icon}</span>
            <span>{currentBasemap.name}</span>
          </button>
          {showBasemapMenu && (
            <div className="aws-dropdown-menu">
              {(Object.keys(BASEMAP_TILES) as BasemapStyle[]).map((key) => {
                const b = BASEMAP_TILES[key];
                return (
                  <button
                    key={key}
                    className={`aws-dropdown-option ${basemapStyle === key ? "selected" : ""}`}
                    onClick={() => {
                      setBasemapStyle(key);
                      setShowBasemapMenu(false);
                    }}
                  >
                    <span>{b.icon}</span>
                    <span>{b.name}</span>
                    {basemapStyle === key && <span className="aws-dropdown-check">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Weather Layer Picker Button */}
        <div className="aws-ctrl-btn-wrap">
          <button
            className={`aws-ctrl-btn ${showLayerMenu ? "active" : ""}`}
            onClick={() => {
              setShowLayerMenu((v) => !v);
              setShowBasemapMenu(false);
            }}
            title="Weather Layer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>{LAYERS.find((l) => l.id === activeLayer)?.label}</span>
          </button>
          {showLayerMenu && (
            <div className="aws-dropdown-menu">
              {LAYERS.map((lyr) => (
                <button
                  key={lyr.id}
                  className={`aws-dropdown-option ${activeLayer === lyr.id ? "selected" : ""}`}
                  onClick={() => {
                    setActiveLayer(lyr.id);
                    setShowLayerMenu(false);
                  }}
                >
                  <span>{lyr.icon}</span>
                  <span>{lyr.label}</span>
                  {activeLayer === lyr.id && <span className="aws-dropdown-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recenter Location Button */}
        <button
          className="aws-locate-btn"
          onClick={() => mapInstance?.flyTo(currentCenter, 9, { duration: 0.8 })}
          title="Recenter on My Location"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      {/* 📡 Live time badge (bottom-left) */}
      <div className="aws-time-badge">
        <span className="aws-live-dot" />
        <span>
          {activeLayer === "precipitation"
            ? `📡 Radar · ${formattedTime} IST`
            : activeLayer === "air_quality"
            ? `🍃 AQI · ${aqiLabel}`
            : activeLayer === "temperature"
            ? `🌡️ Live Heat Flow · ${Math.round(temperature)}°C`
            : `🛰️ Live Streamlines · ${windSpeed.toFixed(0)} km/h`}
        </span>
        {loading && <span className="aws-syncing">Syncing…</span>}
      </div>

      {/* 📊 Telemetry strip (bottom) */}
      <div className="aws-telemetry-strip">
        {activeLayer === "air_quality" ? (
          <>
            <div className="aws-tele-item">
              <span className="aws-tele-label">🍃 AQI</span>
              <span className="aws-tele-val" style={{ color: aqiColor ?? "#22c55e" }}>
                {aqi ?? "—"}
              </span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📊 Category</span>
              <span className="aws-tele-val" style={{ fontSize: "0.74rem" }}>
                {aqiCategory ?? "—"}
              </span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">PM2.5</span>
              <span className="aws-tele-val">{pm25 ?? "—"} µg</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">PM10</span>
              <span className="aws-tele-val">{pm10 ?? "—"} µg</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📍 District</span>
              <span className="aws-tele-val">{districtCoords.name}</span>
            </div>
          </>
        ) : activeLayer === "wind" ? (
          <>
            <div className="aws-tele-item">
              <span className="aws-tele-label">💨 Speed</span>
              <span className="aws-tele-val">{windSpeed.toFixed(1)} km/h</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">🧭 Direction</span>
              <span className="aws-tele-val">{windDirection}°</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">💦 Humidity</span>
              <span className="aws-tele-val">{humidity}%</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">🌡️ Temp</span>
              <span className="aws-tele-val">{Math.round(temperature)}°C</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📍 District</span>
              <span className="aws-tele-val">{districtCoords.name}</span>
            </div>
          </>
        ) : activeLayer === "temperature" ? (
          <>
            <div className="aws-tele-item">
              <span className="aws-tele-label">🌡️ Now</span>
              <span className="aws-tele-val">{Math.round(temperature)}°C</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📉 Low</span>
              <span className="aws-tele-val">{Math.round(temperature - 4)}°C</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📈 High</span>
              <span className="aws-tele-val">{Math.round(temperature + 2)}°C</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">💦 Humidity</span>
              <span className="aws-tele-val">{humidity}%</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📍 District</span>
              <span className="aws-tele-val">{districtCoords.name}</span>
            </div>
          </>
        ) : (
          <>
            <div className="aws-tele-item">
              <span className="aws-tele-label">🌡️ Temp</span>
              <span className="aws-tele-val">{Math.round(temperature)}°C</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">🌧️ Rain</span>
              <span className="aws-tele-val">{precipitation.toFixed(1)} mm/h</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">💨 Wind</span>
              <span className="aws-tele-val">{windSpeed.toFixed(1)} km/h</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">💦 Humidity</span>
              <span className="aws-tele-val">{humidity}%</span>
            </div>
            <div className="aws-tele-item">
              <span className="aws-tele-label">📍 District</span>
              <span className="aws-tele-val">{districtCoords.name}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WeatherRadarMap;
