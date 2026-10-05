/**
 * District / Territory Context
 * Manages the active state and district context switcher in the top bar.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDistricts } from '../services/api';
import type { AdministrativeUnit } from '../types';

interface DistrictContextType {
  districts: AdministrativeUnit[];
  activeDistrictId: number | null;
  activeDistrict: AdministrativeUnit | null;
  setActiveDistrictId: (id: number | null) => void;
  loading: boolean;
  refreshDistricts: () => Promise<void>;
}

const DistrictContext = createContext<DistrictContextType | undefined>(undefined);

const DISTRICT_STORAGE_KEY = 'hvra_active_district_id';

export const DistrictProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [activeDistrictId, setActiveDistrictIdState] = useState<number | null>(() => {
    // Always reset to Thiruvananthapuram — clear any stale cached district
    localStorage.removeItem(DISTRICT_STORAGE_KEY);
    return null;
  });
  const [loading, setLoading] = useState(false);

  const fetchDistricts = async () => {
    try {
      setLoading(true);
      const data = await getDistricts();
      setDistricts(data);
      if (!activeDistrictId && data.length > 0) {
        // Default to Thiruvananthapuram if available, or first district
        const tvm = data.find((d) => d.name.toLowerCase().includes('thiruvananthapuram'));
        const defaultId = tvm ? tvm.id : data[0].id;
        setActiveDistrictIdState(defaultId);
        localStorage.setItem(DISTRICT_STORAGE_KEY, String(defaultId));
      }
    } catch (err) {
      console.warn('Could not load districts for context switcher', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  const setActiveDistrictId = (id: number | null) => {
    setActiveDistrictIdState(id);
    if (id !== null) {
      localStorage.setItem(DISTRICT_STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(DISTRICT_STORAGE_KEY);
    }
  };

  const activeDistrict = districts.find((d) => d.id === activeDistrictId) || null;

  return (
    <DistrictContext.Provider
      value={{
        districts,
        activeDistrictId,
        activeDistrict,
        setActiveDistrictId,
        loading,
        refreshDistricts: fetchDistricts,
      }}
    >
      {children}
    </DistrictContext.Provider>
  );
};

export const useDistrict = (): DistrictContextType => {
  const context = useContext(DistrictContext);
  if (!context) {
    throw new Error('useDistrict must be used within a DistrictProvider');
  }
  return context;
};
