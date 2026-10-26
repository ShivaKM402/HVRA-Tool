/**
 * Multi-Hazard Context (HVRA Architecture)
 * Manages active hazard filtering across the platform (Flood, Landslide, Coastal, Extreme Weather).
 */
import React, { createContext, useContext, useState } from 'react';

export type HazardCode = 'FLOOD' | 'LANDSLIDE' | 'COASTAL' | 'EXTREME_WEATHER';

export interface HazardMeta {
  code: HazardCode;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  tagline: string;
  leadAgency: string;
  keyIndicators: string[];
}

export const HAZARD_CATALOG: Record<HazardCode, HazardMeta> = {
  FLOOD: {
    code: 'FLOOD',
    name: 'Flood Hazard',
    shortName: 'Flood',
    icon: '🌊',
    color: '#2563eb',
    tagline: 'Riverine inundation, dam discharge & backwater surges',
    leadAgency: 'Water Resources Department (Irrigation)',
    keyIndicators: ['Flood-prone Area (%)', 'River Gauge Discharge', 'Flood Frequency', 'Submerged Roadways'],
  },
  LANDSLIDE: {
    code: 'LANDSLIDE',
    name: 'Landslide Hazard',
    shortName: 'Landslide',
    icon: '⛰️',
    color: '#0d9488',
    tagline: 'Slope stability, debris flow & Western Ghats slip zones',
    leadAgency: 'Mining & Geology / KSDMA',
    keyIndicators: ['Susceptibility Zone (%)', 'Steep Slopes (>30°)', 'Rainfall Threshold Anomaly', 'Historical Slip Log'],
  },
  COASTAL: {
    code: 'COASTAL',
    name: 'Coastal Hazard & Erosion',
    shortName: 'Coastal',
    icon: '🌀',
    color: '#8b5cf6',
    tagline: 'Storm surge, sea incursion & shoreline retreat',
    leadAgency: 'Harbour Engineering Department',
    keyIndicators: ['Shoreline Retreat Rate (m/yr)', 'Storm Surge Ingress', 'Fisherfolk Dwellings within 200m'],
  },
  EXTREME_WEATHER: {
    code: 'EXTREME_WEATHER',
    name: 'Extreme Weather & Lightning',
    shortName: 'Weather',
    icon: '⚡',
    color: '#ea580c',
    tagline: 'Severe squall gusts, lightning strikes & convective storms',
    leadAgency: 'IMD & Revenue (KSDMA)',
    keyIndicators: ['Lightning Flash Density', 'Peak Gust Velocity (km/h)', 'Sheet/Kutcha Roof Exposure'],
  },
};

interface HazardContextType {
  activeHazard: HazardCode | null;
  activeHazardMeta: HazardMeta | null;
  setActiveHazard: (code: HazardCode | null) => void;
  clearHazard: () => void;
}

const HazardContext = createContext<HazardContextType | undefined>(undefined);

const HAZARD_STORAGE_KEY = 'hvra_active_hazard_code';

export const HazardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeHazard, setActiveHazardState] = useState<HazardCode | null>(() => {
    // Check URL query param first
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const param = sp.get('hazard')?.toUpperCase();
      if (param && param in HAZARD_CATALOG) {
        return param as HazardCode;
      }
    }
    // Default to null so the user always sees the 4-column selection screen at the start!
    return null;
  });

  const setActiveHazard = (code: HazardCode | null) => {
    setActiveHazardState(code);
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (code) {
        localStorage.setItem(HAZARD_STORAGE_KEY, code);
        sp.set('hazard', code);
      } else {
        localStorage.removeItem(HAZARD_STORAGE_KEY);
        sp.delete('hazard');
      }
      const newQuery = sp.toString() ? `?${sp.toString()}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${newQuery}`);
    }
  };

  const clearHazard = () => setActiveHazard(null);

  const activeHazardMeta = activeHazard ? HAZARD_CATALOG[activeHazard] || null : null;

  return (
    <HazardContext.Provider
      value={{
        activeHazard,
        activeHazardMeta,
        setActiveHazard,
        clearHazard,
      }}
    >
      {children}
    </HazardContext.Provider>
  );
};

export const useHazard = (): HazardContextType => {
  const ctx = useContext(HazardContext);
  if (!ctx) {
    throw new Error('useHazard must be used within a HazardProvider');
  }
  return ctx;
};
