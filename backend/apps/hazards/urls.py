"""Hazards URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HazardTypeViewSet, HazardEventViewSet, HazardLayerViewSet, HazardIndicatorViewSet, FloodBlockSummaryView

router = DefaultRouter()
router.register(r"hazards", HazardTypeViewSet, basename="hazard")
router.register(r"hazard-events", HazardEventViewSet, basename="hazard-event")
router.register(r"hazard-layers", HazardLayerViewSet, basename="hazard-layer")
router.register(r"indicators", HazardIndicatorViewSet, basename="indicator")

urlpatterns = [
    path("flood/block-summary/", FloodBlockSummaryView.as_view(), name="flood-block-summary"),
    path("", include(router.urls)),
]
