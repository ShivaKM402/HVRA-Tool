"""
HVRA AI Copilot — Django REST API Views
Endpoints:
  POST /api/ai/copilot/chat/         → Feature 1: Disaster Copilot
  POST /api/ai/report/generate/      → Feature 2: Executive Report Generator
  POST /api/ai/weights/calibrate/    → Feature 3: Smart Weight Calibrator
"""
import logging

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .services import ai_copilot_chat, ai_generate_report, ai_calibrate_weights

logger = logging.getLogger(__name__)


def _get_api_key(request) -> str:
    """Extract OpenAI API key from request header or body."""
    # Try header first (X-OpenAI-Key)
    key = request.headers.get("X-OpenAI-Key", "").strip()
    if not key:
        # Fallback: from request body
        key = request.data.get("api_key", "").strip()
    if not key:
        raise ValueError("OpenAI API key is required. Pass it via X-OpenAI-Key header or api_key field.")
    return key


# ─────────────────────────────────────────────────────────────────────────────
# Feature 1: AI Disaster Copilot
# ─────────────────────────────────────────────────────────────────────────────

@api_view(["POST"])
def copilot_chat(request):
    """
    POST /api/ai/copilot/chat/
    Body: {
        "message": "What are the high risk zones?",
        "context_data": {...},   // optional — assessment data for context
        "history": [...]         // optional — conversation history
    }
    Header: X-OpenAI-Key: sk-...
    """
    try:
        api_key = _get_api_key(request)
        message = request.data.get("message", "").strip()
        if not message:
            return Response({"error": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

        context_data = request.data.get("context_data")
        history = request.data.get("history", [])

        result = ai_copilot_chat(
            api_key=api_key,
            user_message=message,
            context_data=context_data,
            history=history,
        )
        return Response(result, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Copilot chat error: %s", e, exc_info=True)
        return Response({"error": "An internal error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────────────────────────────────────
# Feature 2: AI Executive Report Generator
# ─────────────────────────────────────────────────────────────────────────────

@api_view(["POST"])
def generate_report(request):
    """
    POST /api/ai/report/generate/
    Body: {
        "assessment_data": {
            "name": "...",
            "district": "...",
            "module_type": "HAZARD|VULNERABILITY|EXPOSURE|RISK",
            "results": [...],
            ...
        }
    }
    Header: X-OpenAI-Key: sk-...
    """
    try:
        api_key = _get_api_key(request)
        assessment_data = request.data.get("assessment_data")
        if not assessment_data:
            return Response({"error": "assessment_data is required."}, status=status.HTTP_400_BAD_REQUEST)

        report = ai_generate_report(api_key=api_key, assessment_data=assessment_data)
        return Response({"report": report}, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Report generation error: %s", e, exc_info=True)
        return Response({"error": "An internal error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────────────────────────────────────
# Feature 3: AI Smart Weight Calibrator
# ─────────────────────────────────────────────────────────────────────────────

@api_view(["POST"])
def calibrate_weights(request):
    """
    POST /api/ai/weights/calibrate/
    Body: {
        "current_indicators": [
            {"name": "Flood Prone Area %", "current_weight": 5.0, "description": "..."},
            ...
        ],
        "district_profile": {
            "district": "Thiruvananthapuram",
            "state": "Kerala",
            "geography": "coastal",
            "avg_annual_rainfall_mm": 1800,
            "population_density": "high"
        },
        "historical_events": [
            {"year": 2018, "severity": "extreme", "affected_blocks": [...], "cause": "heavy rainfall"},
            ...
        ]
    }
    Header: X-OpenAI-Key: sk-...
    """
    try:
        api_key = _get_api_key(request)
        current_indicators = request.data.get("current_indicators")
        district_profile = request.data.get("district_profile", {})
        historical_events = request.data.get("historical_events", [])

        if not current_indicators:
            return Response({"error": "current_indicators is required."}, status=status.HTTP_400_BAD_REQUEST)

        result = ai_calibrate_weights(
            api_key=api_key,
            current_indicators=current_indicators,
            district_profile=district_profile,
            historical_events=historical_events,
        )
        return Response(result, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Weight calibration error: %s", e, exc_info=True)
        return Response({"error": "An internal error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
