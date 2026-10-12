"""
HVRA AI Copilot Services
Wraps OpenAI API for:
  1. AI Disaster Copilot — NL Query Assistant
  2. AI Executive Report Generator — Auto report + mitigation plan
  3. AI Smart Weight Calibrator — Historical disaster matching
"""
import json
import logging
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


def _call_openai(api_key: str, messages: list, model: str = "gpt-4o-mini", temperature: float = 0.4, max_tokens: int = 1500) -> str:
    """Low-level helper: POST to OpenAI and return the assistant message text."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        resp = requests.post(OPENAI_CHAT_URL, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.exceptions.Timeout:
        raise ValueError("OpenAI API request timed out. Please try again.")
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response else "?"
        if status == 401:
            raise ValueError("Invalid OpenAI API key. Please check your key.")
        elif status == 429:
            raise ValueError("OpenAI rate limit exceeded. Please wait a moment.")
        else:
            raise ValueError(f"OpenAI API error ({status}): {e}")
    except Exception as e:
        raise ValueError(f"Failed to contact OpenAI: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Feature 1: AI Disaster Copilot (NL Query Assistant)
# ─────────────────────────────────────────────────────────────────────────────

COPILOT_SYSTEM_PROMPT = """You are an expert AI assistant for the HVRA Spatial Intelligence platform — a 
government-grade flood disaster risk assessment system used by disaster management authorities in Kerala, India.

Your role:
- Answer questions about flood risk, HVRA methodology (Hazard, Vulnerability, Exposure, Risk), and assessment results
- Interpret assessment scores, classifications (NH/LH/MH/HH, LOW/MODERATE/HIGH/VERY_HIGH) and explain what they mean
- Provide guidance on disaster preparedness, mitigation strategies, and risk reduction
- Help users understand the platform's data, indicators, and workflow
- Answer questions about specific districts, blocks, or indicators when context is provided

HVRA Classification Reference:
- Hazard: NH (No Hazard), LH (Low Hazard, score<4), MH (Medium Hazard, score 4-6), HH (High Hazard, score>6)
- Risk: LOW, MODERATE, HIGH, VERY_HIGH (based on composite H×V×E formula)

Always respond in a professional, concise, and helpful manner. If asked about specific data not provided, 
acknowledge the limitation and offer general guidance."""


def ai_copilot_chat(api_key: str, user_message: str, context_data: Optional[dict] = None, history: Optional[list] = None) -> dict:
    """
    Feature 1: AI Disaster Copilot
    Answers NL questions with optional assessment context injected.
    """
    messages = [{"role": "system", "content": COPILOT_SYSTEM_PROMPT}]

    # Inject assessment context if provided
    if context_data:
        context_str = json.dumps(context_data, indent=2)
        messages.append({
            "role": "system",
            "content": f"Current assessment context data:\n```json\n{context_str}\n```\nUse this data to answer the user's question accurately."
        })

    # Add conversation history (last 6 turns max)
    if history:
        for turn in history[-6:]:
            messages.append(turn)

    messages.append({"role": "user", "content": user_message})

    response_text = _call_openai(api_key, messages, temperature=0.5, max_tokens=800)
    return {"reply": response_text}


# ─────────────────────────────────────────────────────────────────────────────
# Feature 2: AI Executive Report Generator
# ─────────────────────────────────────────────────────────────────────────────

REPORT_SYSTEM_PROMPT = """You are an expert disaster risk assessment analyst writing official government reports for the 
Kerala Disaster Management Authority. Generate a structured, professional executive report based on the provided 
assessment data.

The report must follow this EXACT JSON structure (respond ONLY with valid JSON, no markdown wrapping):
{
  "executive_summary": "2-3 paragraph overview of overall risk situation",
  "key_findings": ["finding 1", "finding 2", "finding 3", "finding 4", "finding 5"],
  "high_risk_zones": [
    {"zone": "zone name", "risk_class": "VERY_HIGH|HIGH|MODERATE|LOW", "score": 0.0, "primary_driver": "main risk driver"}
  ],
  "mitigation_action_plan": [
    {
      "priority": "IMMEDIATE|SHORT_TERM|LONG_TERM",
      "action": "action title",
      "description": "detailed description",
      "responsible_agency": "agency name",
      "estimated_timeline": "timeline"
    }
  ],
  "capacity_building_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "data_gaps_and_limitations": ["gap 1", "gap 2"],
  "conclusion": "closing paragraph"
}"""


def ai_generate_report(api_key: str, assessment_data: dict) -> dict:
    """
    Feature 2: AI Executive Report Generator
    Takes assessment results and produces a structured report + mitigation plan.
    """
    data_str = json.dumps(assessment_data, indent=2)
    user_content = f"""Generate a comprehensive executive report and mitigation action plan for this HVRA assessment:

Assessment Data:
```json
{data_str}
```

Ensure the report is data-driven, references specific zones and scores from the data, and provides 
actionable, prioritized recommendations appropriate for Kerala's disaster management context."""

    messages = [
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    response_text = _call_openai(api_key, messages, temperature=0.3, max_tokens=2500)

    # Parse JSON response
    try:
        # Strip markdown code blocks if present
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        report = json.loads(clean)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped in structure
        report = {
            "executive_summary": response_text,
            "key_findings": [],
            "high_risk_zones": [],
            "mitigation_action_plan": [],
            "capacity_building_recommendations": [],
            "data_gaps_and_limitations": [],
            "conclusion": ""
        }

    return report


# ─────────────────────────────────────────────────────────────────────────────
# Feature 3: AI Smart Weight Calibrator
# ─────────────────────────────────────────────────────────────────────────────

WEIGHT_CALIBRATOR_SYSTEM_PROMPT = """You are a disaster risk expert specializing in HVRA (Hazard, Vulnerability, 
Risk Assessment) indicator weight calibration. You analyze historical disaster patterns and recommend optimized 
indicator weights for flood risk assessments in Kerala, India.

Respond ONLY with valid JSON in this exact structure:
{
  "analysis_summary": "Brief explanation of your calibration rationale",
  "recommended_weights": {
    "indicator_name": weight_value_0_to_10
  },
  "confidence_score": 0.0_to_1.0,
  "historical_match": "description of matched historical disaster patterns",
  "calibration_rationale": [
    {"indicator": "name", "original": 5.0, "recommended": 7.0, "reason": "explanation"}
  ],
  "warnings": ["any data quality or coverage warnings"]
}

Weight guidelines:
- Weights range from 0 to 10
- Higher weight = greater contribution to risk score
- Consider Kerala's monsoon patterns, Western Ghats geography, coastal proximity
- Reference past major floods: 2018 Kerala floods, 2019 floods, historical cyclone impacts"""


def ai_calibrate_weights(api_key: str, current_indicators: list, district_profile: dict, historical_events: Optional[list] = None) -> dict:
    """
    Feature 3: AI Smart Weight Calibrator
    Analyzes current indicator weights and suggests AI-optimized weights based on historical disaster data.
    """
    payload = {
        "district_profile": district_profile,
        "current_indicators": current_indicators,
        "historical_disaster_events": historical_events or []
    }
    data_str = json.dumps(payload, indent=2)

    user_content = f"""Analyze these flood risk assessment indicators and recommend optimized weights based on 
historical disaster patterns for this district profile:

```json
{data_str}
```

Calibrate the weights to best reflect the actual flood risk drivers observed historically in Kerala.
Provide specific, evidence-based reasons for each weight adjustment."""

    messages = [
        {"role": "system", "content": WEIGHT_CALIBRATOR_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    response_text = _call_openai(api_key, messages, temperature=0.2, max_tokens=1500)

    try:
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        result = json.loads(clean)
    except json.JSONDecodeError:
        result = {
            "analysis_summary": response_text,
            "recommended_weights": {},
            "confidence_score": 0.5,
            "historical_match": "Unable to parse structured response.",
            "calibration_rationale": [],
            "warnings": ["Response parsing failed; raw text returned in analysis_summary."]
        }

    return result
