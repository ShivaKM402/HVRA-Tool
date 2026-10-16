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
  module_code?: string;
  hazard_type: string;
  category?: 'SOCIO_ECONOMIC' | 'PHYSICAL' | 'ENVIRONMENTAL' | 'OTHER' | 'HAZARD_PRIMARY' | string;
  category_display?: string;
  department?: string;
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
export type CoordinationMode = 'PARALLEL' | 'SEQUENTIAL';

/** Task Force review fields shared by assessments and risk assessments (HVRA §8.2). */
export interface ApprovalFields {
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  reviewer_name: string;
  reviewer_org: string;
  review_comment: string;
  reviewed_at: string | null;
  created_by_name: string | null;
  sent_to?: string | null;
}

export interface AssessmentIndicatorConfig {
  id: number;
  indicator: number;
  indicator_code: string;
  indicator_name: string;
  indicator_unit: string;
  department?: string;
  category?: string;
  category_display?: string;
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
  coordination_mode?: CoordinationMode;
  department_submissions?: Record<string, any>;
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
  sent_to?: string | null;
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
  metadata?: Record<string, any>;
  is_manually_overridden?: boolean;
  overridden_by?: string;
  original_raw_value?: number | null;
  original_score?: number | null;
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

export interface DepartmentIndicatorItem {
  indicator_id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  category_display: string;
  weight: number;
  default_weight: number;
  current_value?: number | null;
  original_value?: number | null;
  is_overridden?: boolean;
  overridden_by?: string;
  unit_values?: Record<number, number>;
}

export interface DepartmentItem {
  department: string;
  total_indicators: number;
  indicators: DepartmentIndicatorItem[];
  status: 'SUBMITTED' | 'PENDING';
  submitted_at: string | null;
  submitted_by: string | null;
  officer_name?: string;
  designation?: string;
  source_type?: string;
  attachment_name?: string;
  submitted_values?: Array<{ indicator_id: number; raw_value: number; administrative_unit_id?: number }>;
  notes: string;
  can_submit: boolean;
  data_gaps: string[];
}

export interface DepartmentSubmissionsResponse {
  assessment_id: number;
  assessment_name: string;
  module_type: string;
  hazard_type: string;
  coordination_mode: CoordinationMode;
  total_departments: number;
  submitted_departments: number;
  all_submitted: boolean;
  administrative_units?: Array<{ id: number; name: string }>;
  departments: DepartmentItem[];
}

export interface ExpertRecalculatePayload {
  weight_overrides?: Record<string | number, number>;
  value_overrides?: Array<{
    indicator_id: number;
    administrative_unit_id: number;
    new_raw_value: number;
    reason?: string;
  }>;
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
  sent_to?: string | null;
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
  | 'MANAGER'
  | 'SENIOR_OFFICER'
  | 'DEPARTMENT_OFFICER'
  | 'ANALYST'
  | 'VIEWER';

export interface UserProfile {
  role: string;
  role_code: UserRole;
  role_label: string;
  organization: string;
  department?: string;
  state: number | null;
  state_name: string | null;
  district: number | null;
  district_name: string | null;
  territory_restricted: boolean;
  is_admin: boolean;
  is_senior_officer?: boolean;
  is_manager?: boolean;
  is_field_officer?: boolean;
  is_ddma_coordinator?: boolean;
  can_approve_cross_department?: boolean;
  can_approve_hvra?: boolean;
  can_review_issues?: boolean;
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

// -------------------------------------------------------
// 3-Tier Issue Reporting & HVRA Publishing Pipeline Types
// -------------------------------------------------------
export type IssueStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVISION_REQUESTED_BY_SENIOR'
  | 'SENIOR_APPROVED'
  | 'REVISION_REQUESTED_BY_MANAGER'
  | 'MANAGER_APPROVED'
  | 'DRAFT_ASSESSMENT_GENERATED'
  | 'HVRA_PUBLISHED'
  | 'REJECTED';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IssueTemplateFieldOption {
  value: string;
  label: string;
}

export interface IssueTemplateField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean';
  placeholder?: string;
  required?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: IssueTemplateFieldOption[];
}

export interface IssueTemplate {
  id: number;
  hazard_type: string;
  name: string;
  version: string;
  description: string;
  is_active: boolean;
  fields_schema: IssueTemplateField[];
  updated_at: string;
}

export interface IssueAttachment {
  id: number;
  issue: number;
  file: string;
  caption: string;
  file_type: 'PHOTO' | 'DOCUMENT' | 'SENSOR_LOG';
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface IssueWorkflowLog {
  id: number;
  action: string;
  from_status: string;
  to_status: string;
  actor: number | null;
  actor_name: string;
  actor_role: string;
  comments: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IssueReportListItem {
  id: number;
  incident_number: string;
  title: string;
  hazard_type: string;
  severity: IssueSeverity;
  severity_label: string;
  department: string;
  district: number;
  district_name: string;
  location_name: string;
  status: IssueStatus;
  status_label: string;
  reported_by: number;
  reported_by_name: string;
  incident_datetime: string;
  created_at: string;
  updated_at: string;
  has_derived_assessment: boolean;
}

export interface DerivedAssessmentInfo {
  id: number;
  name: string;
  module_type: string;
  status: string;
  approval_status: string;
  is_published: boolean;
  published_at?: string | null;
  version: number;
}

export interface IssueUserPermissions {
  can_submit: boolean;
  can_senior_review: boolean;
  can_manager_review: boolean;
  can_generate_assessment: boolean;
}

export interface IssueReportDetail extends IssueReportListItem {
  description: string;
  reported_by_dept: string;
  latitude: number;
  longitude: number;
  gps_accuracy_meters?: number | null;
  state: number;
  state_name: string;
  block?: number | null;
  block_name?: string | null;
  village?: number | null;
  village_name?: string | null;
  template?: number | null;
  template_detail?: IssueTemplate;
  hazard_data: Record<string, any>;
  latest_feedback: string;
  rejection_reason: string;
  current_assignee?: number | null;
  is_cross_departmental: boolean;
  coordinated_by?: number | null;
  submitted_at?: string | null;
  senior_reviewer?: number | null;
  senior_reviewed_at?: string | null;
  senior_remarks: string;
  manager_approver?: number | null;
  manager_reviewed_at?: string | null;
  manager_remarks: string;
  is_demo: boolean;
  attachments: IssueAttachment[];
  workflow_logs: IssueWorkflowLog[];
  derived_assessment_info?: DerivedAssessmentInfo | null;
  user_permissions: IssueUserPermissions;
}

export interface WorkflowAssignmentRule {
  id: number;
  name: string;
  department: string;
  hazard_type: string;
  state?: number | null;
  district?: number | null;
  district_name?: string;
  senior_reviewer?: number | null;
  senior_reviewer_name?: string;
  manager_approver?: number | null;
  manager_approver_name?: string;
  cross_dept_coordinator?: number | null;
  coordinator_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateIssuePayload {
  hazard_type: string;
  template?: number | null;
  title: string;
  description: string;
  incident_datetime: string;
  severity: IssueSeverity;
  department?: string;
  latitude: number;
  longitude: number;
  gps_accuracy_meters?: number | null;
  location_name: string;
  state: number;
  district: number;
  block?: number | null;
  village?: number | null;
  hazard_data?: Record<string, any>;
  is_cross_departmental?: boolean;
}

export interface ReviewActionPayload {
  action: 'APPROVE' | 'REQUEST_REVISION';
  remarks: string;
}

// -------------------------------------------------------
// Real-time Disaster News & Official Alerts Feed
// -------------------------------------------------------
export type AlertSeverity = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'INFO';
export type AlertSourceType = 'OFFICIAL_ALERT' | 'NEWS_REPORT' | 'SEISMIC_OBSERVATION';
export type AlertHazardType = 'FLOOD' | 'HEAVY_RAIN' | 'LANDSLIDE' | 'CYCLONE' | 'EARTHQUAKE' | 'LIGHTNING' | 'WIND' | 'GENERAL';

export interface DisasterAlertItem {
  id: string;
  headline: string;
  title: string;
  description: string;
  instruction: string;
  source_type: AlertSourceType;
  source_name: string;
  source_url: string;
  published_at: string;
  issued_at: string;
  effective_at?: string;
  expires_at?: string;
  affected_district: string;
  affected_districts: string[];
  coordinates: [number, number]; // [lat, lon]
  hazard_type: AlertHazardType;
  hazard_label: string;
  hazard_icon: string;
  severity: AlertSeverity;
  severity_label: string;
  severity_color: string;
  magnitude?: number;
  depth_km?: number;
  urgency?: string;
  certainty?: string;
  msg_type?: string;
  is_active?: boolean;
  is_expired?: boolean;
  is_official: boolean;
  is_forecast: boolean;
  is_demo: boolean;
}

export interface SourceStatusItem {
  source?: string;
  name?: string;
  endpoint?: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'ERROR' | 'MONITORED';
  items_count?: number;
  latency_ms?: number;
  attribution?: string;
  error?: string;
}

export interface OfficialDirectoryEntity {
  name: string;
  role: string;
  url: string;
  emergency_helpline?: string;
  district_helpline?: string;
  police_fire_ambulance?: string;
  status: string;
}

export interface DisasterAlertsResponse {
  status: string;
  last_refreshed_at: string;
  cache_ttl_seconds: number;
  is_cached: boolean;
  cache_age_seconds: number;
  total_count: number;
  active_count?: number;
  expired_count?: number;
  filtered_count?: number;
  official_count: number;
  news_count: number;
  seismic_count: number;
  sources_status: {
    ndma_sachet: SourceStatusItem;
    usgs_seismic: SourceStatusItem;
    disaster_news: SourceStatusItem;
  };
  official_directory: Record<string, OfficialDirectoryEntity>;
  kerala_districts: string[];
  alerts: DisasterAlertItem[];
}

export interface DisasterAlertsFilterParams {
  district?: string;
  hazard_type?: string;
  source_type?: string;
  severity?: string;
  force_refresh?: boolean;
}

