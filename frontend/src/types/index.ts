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
  module_type: string;
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
export type ModuleType = 'HAZARD' | 'VULNERABILITY' | 'EXPOSURE' | 'COMPOSITE_RISK';
export type HazardClassification = 'NH' | 'LH' | 'MH' | 'HH';
export type RiskClass = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
export type ApprovalStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

/** Task Force review fields shared by assessments and risk assessments (HVRA §8.2). */
export interface ApprovalFields {
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  reviewer_name: string;
  reviewer_org: string;
  review_comment: string;
  reviewed_at: string | null;
  created_by_name: string | null;
}

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
  module_type: string;       // display label, e.g. "Vulnerability"
  module_code: ModuleType;
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
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  reviewer_name: string;
  reviewer_org: string;
  review_comment: string;
  reviewed_at: string | null;
  created_by_name: string | null;
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
  module_type?: string;
  module_label?: string;
  status: string;
  total_units: number;
  classification_summary: Record<string, number>;
  min_score?: number;
  max_score?: number;
  average_score?: number;
  results: AssessmentResult[];
}

// -------------------------------------------------------
// Module 4 — Composite Risk
// -------------------------------------------------------
export interface RiskAssessment {
  id: number;
  name: string;
  description: string;
  module_type: string;
  module_code: string;
  state: number;
  state_name: string;
  district: number;
  district_name: string;
  administrative_level: string;
  hazard_assessment: number | null;
  hazard_assessment_name: string | null;
  vulnerability_assessment: number | null;
  vulnerability_assessment_name: string | null;
  exposure_assessment: number | null;
  exposure_assessment_name: string | null;
  formula: 'MULTIPLICATIVE' | 'ADDITIVE';
  hazard_weight: number;
  vulnerability_weight: number;
  exposure_weight: number;
  status: AssessmentStatus;
  error_message: string;
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  reviewer_name: string;
  reviewer_org: string;
  review_comment: string;
  reviewed_at: string | null;
  created_by_name: string | null;
  result_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RiskResult {
  id: number;
  administrative_unit: number;
  unit_name: string;
  unit_code: string;
  hazard_score: number | null;
  vulnerability_score: number | null;
  exposure_score: number | null;
  risk_score: number | null;
  risk_class: RiskClass;
  notes: string;
}

export interface RiskResultsResponse {
  risk_assessment: number;
  name: string;
  module_type: string;
  module_label: string;
  formula: string;
  weights: { hazard: number; vulnerability: number; exposure: number };
  status: string;
  total_units: number;
  classification_summary: Record<string, number>;
  risk_class_colors: Record<string, string>;
  risk_class_labels: Record<string, string>;
  min_score?: number;
  max_score?: number;
  average_score?: number;
  results: RiskResult[];
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
// Auth & User Management (HVRA §2 / §10)
// -------------------------------------------------------
export type UserRole =
  | 'PLATFORM_ADMIN'
  | 'STATE_OFFICIAL'
  | 'DISTRICT_OFFICIAL'
  | 'ANALYST'
  | 'VIEWER';

export interface UserProfile {
  role: string;
  role_code: UserRole;
  role_label: string;
  organization: string;
  state: number | null;
  state_name: string | null;
  district: number | null;
  district_name: string | null;
  territory_restricted: boolean;
  is_admin: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_staff: boolean;
  /** Nested profile — returned by /auth/me/. */
  profile?: UserProfile;
  /** Flat profile fields — returned by the admin /users/ endpoint. */
  role_code?: UserRole;
  role_label?: string;
  organization?: string;
  state?: number | null;
  state_name?: string | null;
  district?: number | null;
  district_name?: string | null;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface RoleOption {
  code: string;
  label: string;
}

// -------------------------------------------------------
// Saved / Shareable Queries (HVRA §3.3)
// -------------------------------------------------------
export interface SavedQuery {
  id: number;
  name: string;
  description: string;
  module_type: string;
  hazard_type: string;
  state: number | null;
  state_name: string | null;
  district: number | null;
  district_name: string | null;
  administrative_level: string;
  parameters: Record<string, any>;
  created_by: number | null;
  created_by_name: string | null;
  share_token: string | null;
  is_shared: boolean;
  share_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedQueryPayload {
  name: string;
  description?: string;
  module_type?: ModuleType;
  hazard_type?: string;
  state?: number | null;
  district?: number | null;
  administrative_level?: string;
  parameters?: Record<string, any>;
}

// -------------------------------------------------------
// Cross-district Dashboards (HVRA §3.4)
// -------------------------------------------------------
export interface DistrictSummaryRow {
  district_id: number;
  district_name: string;
  assessment_count: number;
  unit_results: number;
  classification_summary: Record<string, number>;
  average_score: number;
  max_score: number;
}

export interface DashboardSummaryResponse {
  module_type: string;
  hazard_type: string;
  districts: DistrictSummaryRow[];
}

// -------------------------------------------------------
// Content Libraries (HVRA §4.9)
// -------------------------------------------------------
export interface ClimateContext {
  id: number;
  hazard_type: string;
  region: number | null;
  region_name: string | null;
  title: string;
  statement: string;
  source: string;
  source_url: string;
  vintage: string;
  display_order: number;
  is_active: boolean;
  is_demo: boolean;
}

export interface ClimateContextPayload {
  hazard_type?: string;
  region?: number | null;
  title: string;
  statement: string;
  source?: string;
  source_url?: string;
  vintage?: string;
  display_order?: number;
  is_active?: boolean;
  is_demo?: boolean;
}

export interface Recommendation {
  id: number;
  module_type: string;
  module_code: string;
  hazard_type: string;
  classification: string;
  text: string;
  priority: string;
  display_order: number;
  is_active: boolean;
  is_demo: boolean;
}

export interface RecommendationPayload {
  module_type?: string;
  module_code?: string;
  hazard_type?: string;
  classification?: string;
  text: string;
  priority?: string;
  display_order?: number;
  is_active?: boolean;
  is_demo?: boolean;
}

export interface HazardEventPayload {
  hazard_type: string;
  event_date: string;
  latitude: number;
  longitude: number;
  administrative_unit?: number | null;
  magnitude?: number | null;
  loss?: number | null;
  description?: string;
  source?: string;
  source_url?: string;
  is_demo?: boolean;
}

// -------------------------------------------------------
// Approval request/response payloads (HVRA §8.2)
// -------------------------------------------------------
export interface SubmitForReviewResponse {
  message: string;
  assessment?: {
    id: number;
    name: string;
    module_type: string;
    status: string;
    approval_status: ApprovalStatus;
    submitted_at: string | null;
    reviewer_name: string;
    reviewer_org: string;
    review_comment: string;
    reviewed_at: string | null;
  };
  risk_assessment?: Record<string, unknown>;
}

export interface ApprovalActionResponse {
  message: string;
  assessment?: {
    id: number;
    name: string;
    module_type: string;
    status: string;
    approval_status: ApprovalStatus;
    submitted_at: string | null;
    reviewer_name: string;
    reviewer_org: string;
    review_comment: string;
    reviewed_at: string | null;
  };
  risk_assessment?: Record<string, unknown>;
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
