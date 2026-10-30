"""
AI Services — URL Configuration
"""
from django.urls import path
from .views import AskHVRAView, AnalyzePhotoView, AIStatusView

urlpatterns = [
    path("ask-hvra/", AskHVRAView.as_view(), name="ask-hvra"),
    path("analyze-photo/", AnalyzePhotoView.as_view(), name="ai-analyze-photo"),
    path("status/", AIStatusView.as_view(), name="ai-status"),
]

