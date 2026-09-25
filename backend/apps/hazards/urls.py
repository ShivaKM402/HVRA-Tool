"""Hazards URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HazardTypeViewSet, HazardEventViewSet, HazardLayerViewSet,
    HazardIndicatorViewSet, ClimateContextViewSet, RecommendationViewSet,
    FloodBlockSummaryView,
)

router = DefaultRouter()
router.register(r"hazards", HazardTypeViewSet, basename="hazard")
router.register(r"hazard-events", HazardEventViewSet, basename="hazard-event")
router.register(r"hazard-layers", HazardLayerViewSet, basename="hazard-layer")
router.register(r"indicators", HazardIndicatorViewSet, basename="indicator")
router.register(r"climate-contexts", ClimateContextViewSet, basename="climate-context")
router.register(r"recommendations", RecommendationViewSet, basename="recommendation")

urlpatterns = [
    path("flood/block-summary/", FloodBlockSummaryView.as_view(), name="flood-block-summary"),
    path("", include(router.urls)),
]
