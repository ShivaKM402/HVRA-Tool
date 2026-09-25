"""Assessments URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AssessmentViewSet, RiskAssessmentViewSet,
    SavedQueryViewSet, SharedSavedQueryView,
)

router = DefaultRouter()
router.register(r"assessments", AssessmentViewSet, basename="assessment")
router.register(r"risk-assessments", RiskAssessmentViewSet, basename="risk-assessment")
router.register(r"saved-queries", SavedQueryViewSet, basename="saved-query")

urlpatterns = [
    path("saved-queries/shared/<str:token>/", SharedSavedQueryView.as_view(), name="saved-query-shared"),
    path("", include(router.urls)),
]