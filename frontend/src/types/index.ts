/**
 * HVRA Digital Tool — TypeScript Type Definitions
 * Shared types across the frontend application.
 */

// -------------------------------------------------------
// Administrative
// -------------------------------------------------------
export interface AdministrativeUnit {
  id: number;
  name: string;
  code: string;
  level: 'STATE' | 'DISTRICT' | 'BLOCK' | 'VILLAGE' | 'CUSTOM';
  parent_id: number | null;
  parent_name: string | null;
  area_sqkm: number | null;
  centroid_lat: number | null;
  centroid_lon: number | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry | null;
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  count?: number;
}

// -------------------------------------------------------
// Hazards
// -------------------------------------------------------
export interface HazardType {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  icon: string;
  color: string;
}

export interface HazardEvent {
  id: number;
  hazard_type: string;
  event_date: string;
  latitude: number;
  longitude: number;
  administrative_unit: number | null;
  admin_unit_name: string | null;
  magnitude: number | null;
  loss: number | null;
  description: string;
  source: string;
  source_url: string;
  geometry: GeoJSONGeometry;
  is_demo: boolean;
  created_at: string;
}

export interface WeightageRule {
  id: number;
  label: string;
  range_min: number;
  range_max: number | null;
  score: number;
  description: string;
  is_prototype_threshold: boolean;
}

export interface HazardIndicator {
  id: number;
  hazard_type: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  default_weight: number;
  min_weight: number;
  max_weight: number;
  is_active: boolean;
  order: number;
  weightage_rules: WeightageRule[];
}

// -------------------------------------------------------
// Data Sources
// -------------------------------------------------------
export interface DataSource {
  id: number;
  name: string;
  organization: string;
  description: string;
  source_url: string;
  vintage: string;
  last_updated: string | null;
  metadata?: Record<string, any>;
  is_builtin: boolean;
  is_demo: boolean;
  created_at: string;
}

// -------------------------------------------------------
// Assessments
// -------------------------------------------------------
export type AssessmentStatus = 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type HazardClassification = 'NH' | 'LH' | 'MH' | 'HH';

export interface AssessmentIndicatorConfig {
  id: number;
  indicator: number;
  indicator_code: string;
  indicator_name: string;
  indicator_unit: string;
  weight: number;
  data_source: number | null;
}

export interface Assessment {
  id: number;
  name: string;
  description: string;
  hazard_type: string;
  state: number;
  state_name: string;
  district: number;
  district_name: string;
  administrative_level: string;
  start_date: string | null;
  end_date: string | null;
  data_source: number | null;
  normalization_method: string;
  classification_method: string;
  status: AssessmentStatus;
  error_message: string;
  indicators: AssessmentIndicatorConfig[];
  result_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AssessmentResult {
  id: number;
  administrative_unit: number;
  unit_name: string;
  unit_code: string;
  indicator: number | null;
  indicator_name: string;
  raw_value: number | null;
  normalized_value: number | null;
  weight: number | null;
  weighted_score: number | null;
  final_score: number | null;
  classification: HazardClassification | '';
  notes: string;
}

export interface AssessmentResultsResponse {
  assessment: number;
  status: string;
  total_units: number;
  classification_summary: Record<string, number>;
  min_score?: number;
  max_score?: number;
  average_score?: number;
  results: AssessmentResult[];
}

// -------------------------------------------------------
// API / Health
// -------------------------------------------------------
export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  prototype: boolean;
  database: string;
  database_engine: string;
  python_version: string;
  django_version: string;
  note: string;
}

// -------------------------------------------------------
// Query Builder (UI state)
// -------------------------------------------------------
export interface QueryBuilderState {
  step: number;
  hazard: string | null;
  state: AdministrativeUnit | null;
  district: AdministrativeUnit | null;
  administrativeLevel: string;
  selectedIndicators: SelectedIndicator[];
  dataSource: DataSource | null;
  assessmentName: string;
  startDate: string;
  endDate: string;
  normalizationMethod: string;
  classificationMethod: string;
}

export interface SelectedIndicator {
  indicator: HazardIndicator;
  weight: number;
  dataSource: DataSource | null;
}

// -------------------------------------------------------
// Pagination
// -------------------------------------------------------
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
