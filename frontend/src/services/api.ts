/**
 * HVRA Digital Tool — API Service Layer
 *
 * All API calls go through this module.
 * React components NEVER make direct fetch/axios calls.
 * This ensures a single point of configuration and error handling.
 */
import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type {
  HealthCheckResponse,
  AdministrativeUnit,
  HazardType,
  HazardEvent,
  HazardIndicator,
  DataSource,
  Assessment,
  AssessmentResultsResponse,
  GeoJSONFeatureCollection,
  PaginatedResponse,
} from '../types';

const isProd = import.meta.env.PROD;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProd ? '/api' : 'http://localhost:8000/api');

// -------------------------------------------------------
// Axios instance with defaults
// -------------------------------------------------------
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// -------------------------------------------------------
// Response interceptor — consistent error handling
// -------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const message =
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      'An unknown error occurred.';
    return Promise.reject(new Error(message));
  }
);

// -------------------------------------------------------
// Health Check
// -------------------------------------------------------
export const checkHealth = async (): Promise<HealthCheckResponse> => {
  const response = await api.get<HealthCheckResponse>('/health/');
  return response.data;
};

// -------------------------------------------------------
// Administrative Units
// -------------------------------------------------------
export const getStates = async (): Promise<AdministrativeUnit[]> => {
  const response = await api.get<AdministrativeUnit[]>('/states/');
  return response.data;
};

export const getDistricts = async (stateId?: number): Promise<AdministrativeUnit[]> => {
  const params = stateId ? { state: stateId } : {};
  const response = await api.get<AdministrativeUnit[]>('/districts/', { params });
  return response.data;
};

export const getBlocks = async (districtId?: number): Promise<AdministrativeUnit[]> => {
  const params = districtId ? { district: districtId } : {};
  const response = await api.get<AdministrativeUnit[]>('/blocks/', { params });
  return response.data;
};

export const getAdminUnits = async (params?: {
  level?: string;
  parent?: number | string;
  district?: string | number;
  state?: string | number;
}): Promise<PaginatedResponse<AdministrativeUnit>> => {
  const response = await api.get<PaginatedResponse<AdministrativeUnit>>('/admin-units/', { params });
  return response.data;
};

export const getAdminUnitsGeoJSON = async (params?: {
  level?: string;
  parent?: number | string;
  district?: string | number;
  state?: string | number;
}): Promise<GeoJSONFeatureCollection> => {
  const response = await api.get<GeoJSONFeatureCollection>('/admin-units/geojson/', { params });
  return response.data;
};

// -------------------------------------------------------
// Hazards
// -------------------------------------------------------
export const getHazards = async (): Promise<HazardType[]> => {
  const response = await api.get<PaginatedResponse<HazardType>>('/hazards/');
  return response.data.results || (response.data as unknown as HazardType[]);
};

export const getHazardEvents = async (params?: {
  hazard_type?: string;
  admin_unit?: number;
}): Promise<PaginatedResponse<HazardEvent>> => {
  const response = await api.get<PaginatedResponse<HazardEvent>>('/hazard-events/', { params });
  return response.data;
};

export const getHazardEventsGeoJSON = async (params?: {
  hazard_type?: string;
}): Promise<GeoJSONFeatureCollection> => {
  const response = await api.get<GeoJSONFeatureCollection>('/hazard-events/geojson/', { params });
  return response.data;
};

export const getFloodBlockSummary = async (params?: {
  district?: string;
}): Promise<any[]> => {
  const response = await api.get<any[]>('/flood/block-summary/', { params });
  return response.data;
};

// -------------------------------------------------------
// Indicators
// -------------------------------------------------------
export const getIndicators = async (hazardType?: string): Promise<HazardIndicator[]> => {
  const params = hazardType ? { hazard_type: hazardType } : {};
  const response = await api.get<PaginatedResponse<HazardIndicator>>('/indicators/', { params });
  return response.data.results;
};

// -------------------------------------------------------
// Data Sources
// -------------------------------------------------------
export const getDataSources = async (): Promise<PaginatedResponse<DataSource>> => {
  const response = await api.get<PaginatedResponse<DataSource>>('/data-sources/');
  return response.data;
};

// -------------------------------------------------------
// Assessments
// -------------------------------------------------------
export const getAssessments = async (params?: {
  hazard_type?: string;
  status?: string;
}): Promise<PaginatedResponse<Assessment>> => {
  const response = await api.get<PaginatedResponse<Assessment>>('/assessments/', { params });
  return response.data;
};

export const getAssessment = async (id: number): Promise<Assessment> => {
  const response = await api.get<Assessment>(`/assessments/${id}/`);
  return response.data;
};

export interface CreateAssessmentPayload {
  name: string;
  description?: string;
  hazard_type: string;
  state: number;
  district: number;
  administrative_level: string;
  start_date?: string;
  end_date?: string;
  data_source?: number;
  normalization_method?: string;
  classification_method?: string;
  indicators: Array<{
    indicator_id: number;
    weight: number;
    data_source_id?: number;
  }>;
}

export const createAssessment = async (payload: CreateAssessmentPayload): Promise<Assessment> => {
  const response = await api.post<Assessment>('/assessments/', payload);
  return response.data;
};

export const processAssessment = async (id: number): Promise<{ message: string; status: string; assessment_id?: number }> => {
  const response = await api.post<{ message: string; status: string; assessment_id?: number }>(`/assessments/${id}/process/`);
  return response.data;
};

export const getAssessmentResults = async (id: number): Promise<AssessmentResultsResponse> => {
  const response = await api.get<AssessmentResultsResponse>(`/assessments/${id}/results/`);
  return response.data;
};

export const getAssessmentReport = async (id: number): Promise<any> => {
  const response = await api.get<any>(`/assessments/${id}/report/`);
  return response.data;
};

export const getAssessmentMapData = async (id: number): Promise<GeoJSONFeatureCollection & {
  classification_colors: Record<string, string>;
}> => {
  const response = await api.get(`/assessments/${id}/map/`);
  return response.data;
};

// -------------------------------------------------------
// Dataset Upload
// -------------------------------------------------------
export const uploadDataset = async (formData: FormData): Promise<{ success: boolean; message: string; dataset: unknown }> => {
  const response = await api.post('/datasets/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export default api;
