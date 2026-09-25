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
  RiskAssessment,
  RiskResultsResponse,
  GeoJSONFeatureCollection,
  PaginatedResponse,
  User,
  AuthResponse,
  RoleOption,
  SavedQuery,
  SavedQueryPayload,
  DashboardSummaryResponse,
  ClimateContext,
  ClimateContextPayload,
  Recommendation,
  RecommendationPayload,
  HazardEventPayload,
  SubmitForReviewResponse,
  ApprovalActionResponse,
} from '../types';

const isProd = import.meta.env.PROD;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProd ? '/api' : 'http://localhost:8000/api');

// -------------------------------------------------------
// Token helpers — session persisted in localStorage
// -------------------------------------------------------
const TOKEN_KEY = 'hvra_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

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
// Request interceptor — attach the auth token, if present
// -------------------------------------------------------
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// -------------------------------------------------------
// Response interceptor — consistent error handling + 401 redirect
// -------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const isAuthCall = Boolean(
      error.config?.url && /\/auth\/(login|register)\//.test(error.config.url)
    );

    // Session expired / invalid token → drop credentials and send to login.
    if (status === 401 && !isAuthCall) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    let message: string;
    const data = error.response?.data as
      | { message?: string; detail?: string; errors?: Record<string, unknown> }
      | undefined;

    if (data?.message) {
      message = data.message;
    } else if (data?.detail) {
      message = data.detail;
    } else if (data?.errors) {
      const first = Object.values(data.errors)[0];
      message = Array.isArray(first) ? String(first[0]) : String(first ?? 'Invalid request.');
    } else {
      message = error.message || 'An unknown error occurred.';
    }
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

export const createDistrict = async (payload: {
  name: string;
  state_id: number;
  centroid_lat?: number | null;
  centroid_lon?: number | null;
}): Promise<{ district: AdministrativeUnit; message: string; blocks_auto_added: number; already_existed: boolean }> => {
  const response = await api.post<{
    success: boolean;
    district: AdministrativeUnit;
    message: string;
    blocks_auto_added: number;
    already_existed: boolean;
  }>(
    '/admin-units/create-district/',
    payload
  );
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
  limit?: number;
  page?: number;
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
export const getIndicators = async (hazardType?: string, moduleType?: string): Promise<HazardIndicator[]> => {
  const params: Record<string, string> = {};
  if (hazardType) params.hazard_type = hazardType;
  if (moduleType) params.module_type = moduleType;
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
  module_type?: string;
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
  module_type?: 'HAZARD' | 'VULNERABILITY' | 'EXPOSURE';
  hazard_type?: string;
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

// -------------------------------------------------------
// Live query preview (spec Screen 1 — composite score snapshot)
// -------------------------------------------------------
export interface PreviewUnit {
  id: number;
  name: string;
  score: number;
  classification: string;
  classification_label: string;
}

export interface AssessmentPreview {
  units: PreviewUnit[];
  unit_count: number;
  classification_summary: Record<string, number>;
  indicator_count: number;
  district: string;
  district_id: number;
  hazard_type: string;
  module_type: string;
  administrative_level: string;
  indicators: { code: string; weight: number }[];
}

export const previewAssessment = async (payload: {
  module_type: string;
  hazard_type?: string;
  district: number;
  administrative_level?: string;
  classification_method?: string;
  normalization_method?: string;
  indicators?: { code: string; weight: number }[];
}): Promise<AssessmentPreview> => {
  const response = await api.post<AssessmentPreview>('/assessments/preview/', payload);
  return response.data;
};

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
// Module 4 — Composite Risk (Risk = H × V × E)
// -------------------------------------------------------
export interface CreateRiskAssessmentPayload {
  name: string;
  description?: string;
  state: number;
  district: number;
  administrative_level?: string;
  hazard_assessment?: number | null;
  vulnerability_assessment?: number | null;
  exposure_assessment?: number | null;
  formula?: 'MULTIPLICATIVE' | 'ADDITIVE';
  hazard_weight?: number;
  vulnerability_weight?: number;
  exposure_weight?: number;
}

export const createRiskAssessment = async (
  payload: CreateRiskAssessmentPayload
): Promise<{ risk_assessment: RiskAssessment; processing: { message: string; status: string; risk_assessment_id?: number } }> => {
  const response = await api.post('/risk-assessments/', payload);
  return response.data;
};

export const processRiskAssessment = async (id: number): Promise<{ message: string; status: string; risk_assessment_id?: number }> => {
  const response = await api.post(`/risk-assessments/${id}/process/`);
  return response.data;
};

export const getRiskAssessments = async (params?: {
  status?: string;
  district?: number;
}): Promise<PaginatedResponse<RiskAssessment>> => {
  const response = await api.get<PaginatedResponse<RiskAssessment>>('/risk-assessments/', { params });
  return response.data;
};

export const getRiskAssessment = async (id: number): Promise<RiskAssessment> => {
  const response = await api.get<RiskAssessment>(`/risk-assessments/${id}/`);
  return response.data;
};

export const getRiskAssessmentResults = async (id: number): Promise<RiskResultsResponse> => {
  const response = await api.get<RiskResultsResponse>(`/risk-assessments/${id}/results/`);
  return response.data;
};

export const getRiskAssessmentMap = async (id: number): Promise<GeoJSONFeatureCollection & {
  classification_colors: Record<string, string>;
  classification_labels?: Record<string, string>;
  risk_mode?: boolean;
}> => {
  const response = await api.get(`/risk-assessments/${id}/map/`);
  return response.data;
};

export const getRiskAssessmentReport = async (id: number): Promise<any> => {
  const response = await api.get(`/risk-assessments/${id}/report/`);
  return response.data;
};

export const downloadRiskReportDocx = async (id: number, filename = 'HVRA_Risk_Report.docx'): Promise<void> => {
  const response = await api.get(`/risk-assessments/${id}/export/docx/`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadRiskReportPdf = async (id: number, filename = 'HVRA_Risk_Report.pdf'): Promise<void> => {
  const response = await api.get(`/risk-assessments/${id}/export/pdf/`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// -------------------------------------------------------
// Dataset Upload & Report Exports
// -------------------------------------------------------
export const uploadDataset = async (formData: FormData): Promise<{ success: boolean; message: string; dataset: unknown; data_source_id?: number }> => {
  const response = await api.post('/datasets/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getExportDocxUrl = (id: number): string => `${API_BASE_URL}/assessments/${id}/export/docx/`;
export const getExportPdfUrl = (id: number): string => `${API_BASE_URL}/assessments/${id}/export/pdf/`;
export const getExportCsvUrl = (id: number): string => `${API_BASE_URL}/assessments/${id}/export/csv/`;

export const downloadReportDocx = async (id: number, filename = 'HVRA_Report.docx'): Promise<void> => {
  const response = await api.get(`/assessments/${id}/export/docx/`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadReportPdf = async (id: number, filename = 'HVRA_Report.pdf'): Promise<void> => {
  const response = await api.get(`/assessments/${id}/export/pdf/`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadReportCsv = async (id: number, filename = 'HVRA_Results.csv'): Promise<void> => {
  const response = await api.get(`/assessments/${id}/export/csv/`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// -------------------------------------------------------
// Authentication (HVRA §2 — user accounts & sessions)
// -------------------------------------------------------
export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login/', { username, password });
  if (response.data?.token) setToken(response.data.token);
  return response.data;
};

export const register = async (payload: {
  username: string;
  password: string;
  password2?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  organization?: string;
}): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register/', payload);
  if (response.data?.token) setToken(response.data.token);
  return response.data;
};

export const logout = async (): Promise<void> => {
  try {
    if (getToken()) {
      await api.post('/auth/logout/');
    }
  } finally {
    clearToken();
  }
};

export const getMe = async (): Promise<User> => {
  const response = await api.get<User>('/auth/me/');
  return response.data;
};

// -------------------------------------------------------
// User Management (HVRA §10 — RBAC)
// -------------------------------------------------------
export const getUsers = async (params?: { role?: string }): Promise<User[]> => {
  const response = await api.get<PaginatedResponse<User>>('/users/', { params });
  return response.data.results || (response.data as unknown as User[]);
};

export interface CreateUserPayload {
  username: string;
  password: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  organization?: string;
  state?: number | null;
  district?: number | null;
  is_staff?: boolean;
}

export const createUser = async (payload: CreateUserPayload): Promise<User> => {
  const response = await api.post<User>('/users/', payload);
  return response.data;
};

export const updateUser = async (id: number, payload: Partial<CreateUserPayload>): Promise<User> => {
  const response = await api.patch<User>(`/users/${id}/`, payload);
  return response.data;
};

export const deleteUser = async (id: number): Promise<void> => {
  await api.delete(`/users/${id}/`);
};

export const getRoles = async (): Promise<RoleOption[]> => {
  const response = await api.get<RoleOption[]>('/users/roles/');
  return response.data;
};

// -------------------------------------------------------
// Task Force Approval Workflow (HVRA §8.2)
// -------------------------------------------------------
export const submitAssessmentForReview = async (id: number): Promise<SubmitForReviewResponse> => {
  const response = await api.post<SubmitForReviewResponse>(`/assessments/${id}/submit-for-review/`);
  return response.data;
};

export const approveAssessment = async (
  id: number,
  comment = ''
): Promise<ApprovalActionResponse> => {
  const response = await api.post<ApprovalActionResponse>(`/assessments/${id}/approve/`, {
    review_comment: comment,
  });
  return response.data;
};

export const rejectAssessment = async (
  id: number,
  comment = ''
): Promise<ApprovalActionResponse> => {
  const response = await api.post<ApprovalActionResponse>(`/assessments/${id}/reject/`, {
    review_comment: comment,
  });
  return response.data;
};

export const submitRiskForReview = async (id: number): Promise<SubmitForReviewResponse> => {
  const response = await api.post<SubmitForReviewResponse>(`/risk-assessments/${id}/submit-for-review/`);
  return response.data;
};

export const approveRisk = async (id: number, comment = ''): Promise<ApprovalActionResponse> => {
  const response = await api.post<ApprovalActionResponse>(`/risk-assessments/${id}/approve/`, {
    review_comment: comment,
  });
  return response.data;
};

export const rejectRisk = async (id: number, comment = ''): Promise<ApprovalActionResponse> => {
  const response = await api.post<ApprovalActionResponse>(`/risk-assessments/${id}/reject/`, {
    review_comment: comment,
  });
  return response.data;
};

// -------------------------------------------------------
// Saved / Shareable Queries (HVRA §3.3)
// -------------------------------------------------------
export const getSavedQueries = async (params?: {
  module_type?: string;
}): Promise<SavedQuery[]> => {
  const response = await api.get<PaginatedResponse<SavedQuery>>('/saved-queries/', { params });
  return response.data.results;
};

export const createSavedQuery = async (payload: SavedQueryPayload): Promise<SavedQuery> => {
  const response = await api.post<SavedQuery>('/saved-queries/', payload);
  return response.data;
};

export const deleteSavedQuery = async (id: number): Promise<void> => {
  await api.delete(`/saved-queries/${id}/`);
};

export const shareSavedQuery = async (
  id: number
): Promise<{ message: string; saved_query: SavedQuery }> => {
  const response = await api.post(`/saved-queries/${id}/share/`);
  return response.data;
};

export const runSavedQuery = async (
  id: number
): Promise<{
  message: string;
  assessment?: Assessment;
  risk_assessment?: RiskAssessment;
  processing?: Record<string, unknown>;
}> => {
  const response = await api.post(`/saved-queries/${id}/run/`);
  return response.data;
};

export const getSharedSavedQuery = async (token: string): Promise<SavedQuery> => {
  const response = await api.get<SavedQuery>(`/saved-queries/shared/${token}/`);
  return response.data;
};

// -------------------------------------------------------
// Cross-district Dashboards (HVRA §3.4)
// -------------------------------------------------------
export const getDashboardSummary = async (params?: {
  module_type?: string;
  hazard_type?: string;
}): Promise<DashboardSummaryResponse> => {
  const response = await api.get<DashboardSummaryResponse>('/assessments/dashboard-summary/', { params });
  return response.data;
};

export const getRiskDashboardSummary = async (): Promise<DashboardSummaryResponse> => {
  const response = await api.get<DashboardSummaryResponse>('/risk-assessments/dashboard-summary/');
  return response.data;
};

// -------------------------------------------------------
// Content Libraries (HVRA §4.9)
// -------------------------------------------------------
export const getClimateContexts = async (params?: {
  hazard_type?: string;
  region?: number;
}): Promise<ClimateContext[]> => {
  const response = await api.get<PaginatedResponse<ClimateContext>>('/climate-contexts/', { params });
  return response.data.results;
};

export const getRecommendations = async (params?: {
  module_type?: string;
  hazard_type?: string;
}): Promise<Recommendation[]> => {
  const response = await api.get<PaginatedResponse<Recommendation>>('/recommendations/', { params });
  return response.data.results;
};

// -------------------------------------------------------
// Library curation (admin-only writes — HVRA §4.9 / §2)
// -------------------------------------------------------
export const createClimateContext = async (payload: ClimateContextPayload): Promise<ClimateContext> => {
  const response = await api.post<ClimateContext>('/climate-contexts/', payload);
  return response.data;
};

export const updateClimateContext = async (id: number, payload: Partial<ClimateContextPayload>): Promise<ClimateContext> => {
  const response = await api.patch<ClimateContext>(`/climate-contexts/${id}/`, payload);
  return response.data;
};

export const deleteClimateContext = async (id: number): Promise<void> => {
  await api.delete(`/climate-contexts/${id}/`);
};

export const createRecommendation = async (payload: RecommendationPayload): Promise<Recommendation> => {
  const response = await api.post<Recommendation>('/recommendations/', payload);
  return response.data;
};

export const updateRecommendation = async (id: number, payload: Partial<RecommendationPayload>): Promise<Recommendation> => {
  const response = await api.patch<Recommendation>(`/recommendations/${id}/`, payload);
  return response.data;
};

export const deleteRecommendation = async (id: number): Promise<void> => {
  await api.delete(`/recommendations/${id}/`);
};

export const createHazardEvent = async (payload: HazardEventPayload): Promise<HazardEvent> => {
  const response = await api.post<HazardEvent>('/hazard-events/', payload);
  return response.data;
};

export const updateHazardEvent = async (id: number, payload: Partial<HazardEventPayload>): Promise<HazardEvent> => {
  const response = await api.patch<HazardEvent>(`/hazard-events/${id}/`, payload);
  return response.data;
};

export const deleteHazardEvent = async (id: number): Promise<void> => {
  await api.delete(`/hazard-events/${id}/`);
};

export default api;
