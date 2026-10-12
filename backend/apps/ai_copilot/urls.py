"""AI Copilot URLs"""
from django.urls import path
from .views import copilot_chat, generate_report, calibrate_weights

urlpatterns = [
    path("ai/copilot/chat/", copilot_chat, name="ai-copilot-chat"),
    path("ai/report/generate/", generate_report, name="ai-report-generate"),
    path("ai/weights/calibrate/", calibrate_weights, name="ai-weights-calibrate"),
]
