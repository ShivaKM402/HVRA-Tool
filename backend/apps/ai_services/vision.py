"""
AI Feature 2 — Vision AI for Field Incident Photos
Uses GPT-4o vision to analyse uploaded incident photographs and extract:
  - Damage severity (HIGH / MEDIUM / LOW)
  - Estimated water depth
  - Damage type classification
  - Descriptive summary
  - Auto-filled form field suggestions

Model: gpt-4o (multimodal vision)
Fallback: returns neutral placeholder when AI is unavailable.
"""
import base64
import logging
from .openai_client import get_openai_client

logger = logging.getLogger(__name__)


def analyze_incident_photo(image_bytes: bytes, hazard_type: str = "FLOOD") -> dict:
    """
    Analyse a field incident photograph using GPT-4o vision.

    Args:
        image_bytes: Raw bytes of the uploaded image (JPEG / PNG / WebP)
        hazard_type: Type of hazard (default: FLOOD)

    Returns:
        {
          "severity": "HIGH" | "MEDIUM" | "LOW",
          "water_depth_estimate": str,
          "damage_type": str,
          "description": str,
          "auto_filled_fields": {
              "severity": str,
              "hazard_type": str,
              "description": str
          },
          "ai_generated": bool
        }
    """
    client = get_openai_client()
    if client is None:
        return _fallback_analysis()

    try:
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        prompt = f"""You are a field disaster assessment officer analysing a flood incident photograph for KSDMA Kerala.

Analyse this {hazard_type.lower()} incident photograph and provide:
1. Damage severity: HIGH (major structural damage/deep water >1m), MEDIUM (moderate damage/water 0.3–1m), or LOW (minor/waterlogging <0.3m)
2. Estimated water depth (e.g., "approximately 0.5 metres", "not visible", "greater than 1.5 metres")
3. Damage type (e.g., "Road inundation", "Residential flooding", "Agricultural crop damage", "Infrastructure damage", "Landslide debris")
4. A 2-sentence factual description suitable for an official incident report
5. Suggested form fields to auto-fill

Return ONLY valid JSON (no markdown):
{{
  "severity": "HIGH|MEDIUM|LOW",
  "water_depth_estimate": "...",
  "damage_type": "...",
  "description": "...",
  "auto_filled_fields": {{
    "severity": "HIGH|MEDIUM|LOW",
    "hazard_type": "{hazard_type}",
    "description": "..."
  }}
}}"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64_image}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
        )
        import json
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        result["ai_generated"] = True
        return result
    except Exception as exc:
        logger.error("OpenAI vision analysis failed: %s", exc)
        return _fallback_analysis()


def _fallback_analysis() -> dict:
    return {
        "severity": "MEDIUM",
        "water_depth_estimate": "Unable to estimate — AI analysis unavailable",
        "damage_type": "Field verification required",
        "description": (
            "Automated photo analysis is currently unavailable. "
            "Please fill in incident details manually based on field observations."
        ),
        "auto_filled_fields": {
            "severity": "MEDIUM",
            "hazard_type": "FLOOD",
            "description": "Field incident reported — manual assessment required.",
        },
        "ai_generated": False,
    }

