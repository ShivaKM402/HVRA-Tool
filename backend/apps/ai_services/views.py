"""
AI Services — API Views
Exposes standalone endpoints:
  POST /api/ai/ask-hvra/           — Ask HVRA conversational assistant
  POST /api/ai/analyze-photo/      — Vision AI photo analysis (no issue required)
  GET  /api/ai/status/             — Check whether AI is available
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from .assistant import ask_hvra
from .vision import analyze_incident_photo
from .openai_client import is_ai_available


class AskHVRAView(APIView):
    """POST /api/ai/ask-hvra/ — Natural language Q&A over HVRA data."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        question = request.data.get("question", "").strip()
        context = request.data.get("context", {})

        if not question:
            return Response(
                {"error": "Field 'question' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(question) > 1000:
            return Response(
                {"error": "Question too long (max 1000 characters)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = ask_hvra(question, context)
        return Response(result, status=status.HTTP_200_OK)


class AnalyzePhotoView(APIView):
    """
    POST /api/ai/analyze-photo/
    Standalone Vision AI photo analysis — does not require an existing issue.
    Accepts: multipart/form-data with 'image' field.
    Used by the new incident form before an issue is created.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": "No image file provided. Send as multipart/form-data with field 'image'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = image_file.content_type or ""
        if not content_type.startswith("image/"):
            return Response(
                {"error": "Uploaded file must be an image (JPEG, PNG, WebP)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if image_file.size > 10 * 1024 * 1024:
            return Response(
                {"error": "Image must be under 10 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hazard_type = request.data.get("hazard_type", "FLOOD").upper()
        image_bytes = image_file.read()
        result = analyze_incident_photo(image_bytes, hazard_type)
        return Response(result, status=status.HTTP_200_OK)


class AIStatusView(APIView):
    """GET /api/ai/status/ — Check AI service availability."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        available = is_ai_available()
        return Response({
            "ai_available": available,
            "message": (
                "OpenAI AI features are active." if available
                else "AI features are inactive — OPENAI_API_KEY not configured."
            ),
        })

