/**
 * HVRA AI Copilot — Frontend API Service
 * Communicates with the Django AI endpoints, injecting the
 * user-provided OpenAI API key via the X-OpenAI-Key header.
 */
import axios from 'axios';

const isProd = import.meta.env.PROD;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isProd ? '/api' : 'http://localhost:8000/api');

// ── Key management (session storage — more secure than localStorage) ─────────
const AI_KEY_STORAGE = 'hvra_openai_key';

export const getStoredApiKey = (): string => sessionStorage.getItem(AI_KEY_STORAGE) || '';
export const setStoredApiKey = (key: string): void => sessionStorage.setItem(AI_KEY_STORAGE, key);
export const clearStoredApiKey = (): void => sessionStorage.removeItem(AI_KEY_STORAGE);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotChatRequest {
  message: string;
  context_data?: Record<string, unknown>;
  history?: ChatMessage[];
}

export interface CopilotChatResponse {
  reply: string;
}

export interface MitigationAction {
  priority: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM';
  action: string;
  description: string;
  responsible_agency: string;
  estimated_timeline: string;
}

export interface HighRiskZone {
  zone: string;
  risk_class: string;
  score: number;
  primary_driver: string;
}

export interface AIReport {
  executive_summary: string;
  key_findings: string[];
  high_risk_zones: HighRiskZone[];
  mitigation_action_plan: MitigationAction[];
  capacity_building_recommendations: string[];
  data_gaps_and_limitations: string[];
  conclusion: string;
}

export interface CalibrationRationale {
  indicator: string;
  original: number;
  recommended: number;
  reason: string;
}

export interface WeightCalibrationResult {
  analysis_summary: string;
  recommended_weights: Record<string, number>;
  confidence_score: number;
  historical_match: string;
  calibration_rationale: CalibrationRationale[];
  warnings: string[];
}

export interface IndicatorInput {
  name: string;
  current_weight: number;
  description?: string;
}

// ── API Helpers ───────────────────────────────────────────────────────────────

function makeAiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-OpenAI-Key': apiKey,
  };
}

// ── Feature 1: AI Disaster Copilot ───────────────────────────────────────────

export async function aiCopilotChat(
  apiKey: string,
  req: CopilotChatRequest
): Promise<CopilotChatResponse> {
  const res = await axios.post<CopilotChatResponse>(
    `${API_BASE_URL}/ai/copilot/chat/`,
    req,
    { headers: makeAiHeaders(apiKey), timeout: 60000 }
  );
  return res.data;
}

// ── Feature 2: AI Executive Report Generator ─────────────────────────────────

export async function aiGenerateReport(
  apiKey: string,
  assessmentData: Record<string, unknown>
): Promise<{ report: AIReport }> {
  const res = await axios.post<{ report: AIReport }>(
    `${API_BASE_URL}/ai/report/generate/`,
    { assessment_data: assessmentData },
    { headers: makeAiHeaders(apiKey), timeout: 90000 }
  );
  return res.data;
}

// ── Feature 3: AI Smart Weight Calibrator ────────────────────────────────────

export async function aiCalibrateWeights(
  apiKey: string,
  currentIndicators: IndicatorInput[],
  districtProfile: Record<string, unknown>,
  historicalEvents?: Record<string, unknown>[]
): Promise<WeightCalibrationResult> {
  const res = await axios.post<WeightCalibrationResult>(
    `${API_BASE_URL}/ai/weights/calibrate/`,
    {
      current_indicators: currentIndicators,
      district_profile: districtProfile,
      historical_events: historicalEvents || [],
    },
    { headers: makeAiHeaders(apiKey), timeout: 60000 }
  );
  return res.data;
}
