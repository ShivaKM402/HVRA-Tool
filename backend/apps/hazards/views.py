"""Hazards views"""
from django.db import models
from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    HazardType, HazardEvent, HazardLayer, HazardIndicator,
    ClimateContext, Recommendation,
)
from .serializers import (
    HazardTypeSerializer, HazardEventSerializer,
    HazardLayerSerializer, HazardIndicatorSerializer,
    ClimateContextSerializer, RecommendationSerializer,
)
from rest_framework.views import APIView
from apps.administration.models import AdministrativeUnit
from apps.accounts.permissions import IsPlatformAdmin
from apps.accounts.territory import scope_unit_qs
from gis.spatial import process_flood_assessment


def _admin_only_writes(view):
    """Libraries are read by everyone; only Platform Admins may curate (HVRA §4.9, §2)."""
    if view.action in ("create", "update", "partial_update", "destroy"):
        return [IsPlatformAdmin()]
    return [permissions.AllowAny()]


class HazardTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HazardType.objects.all()
    serializer_class = HazardTypeSerializer


class HazardEventViewSet(viewsets.ModelViewSet):
    """Historical Hazard Events Repository (HVRA §4.9) — admin-curated."""
    queryset = HazardEvent.objects.select_related("administrative_unit").all()
    serializer_class = HazardEventSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ["-event_date"]

    def get_permissions(self):
        return _admin_only_writes(self)

    def get_queryset(self):
        qs = super().get_queryset()
        # Territorial RBAC (HVRA §2): officers only see events in their territory.
        qs = scope_unit_qs(qs, self.request.user)
        hazard_type = self.request.query_params.get("hazard_type")
        admin_unit = self.request.query_params.get("admin_unit")
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())
        if admin_unit:
            qs = qs.filter(administrative_unit_id=admin_unit)
        return qs

    @action(detail=False, methods=["get"])
    def geojson(self, request):
        """Return events as GeoJSON FeatureCollection."""
        qs = self.get_queryset()
        features = []
        for event in qs:
            features.append({
                "type": "Feature",
                "geometry": event.geometry,
                "properties": {
                    "id": event.id,
                    "hazard_type": event.hazard_type,
                    "event_date": str(event.event_date),
                    "magnitude": event.magnitude,
                    "loss": event.loss,
                    "description": event.description,
                    "source": event.source,
                    "is_demo": event.is_demo,
                },
            })
        return Response({"type": "FeatureCollection", "features": features})


class HazardLayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HazardLayer.objects.all()
    serializer_class = HazardLayerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        hazard_type = self.request.query_params.get("hazard_type")
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())
        return qs

    @action(detail=True, methods=["get"])
    def geojson(self, request, pk=None):
        """Return layer geometry as GeoJSON."""
        layer = self.get_object()
        return Response(layer.geometry or {"type": "FeatureCollection", "features": []})


class HazardIndicatorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HazardIndicator.objects.prefetch_related("weightage_rules").filter(is_active=True)
    serializer_class = HazardIndicatorSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        hazard_type = self.request.query_params.get("hazard_type")
        module_type = self.request.query_params.get("module_type")
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())
        if module_type:
            qs = qs.filter(module_type=module_type.upper())
        return qs.order_by("module_type", "order", "name")


class ClimateContextViewSet(viewsets.ModelViewSet):
    """Climate Context Library (HVRA Section 4.9) — read for all, curated by admins."""
    queryset = ClimateContext.objects.all().select_related("region")
    serializer_class = ClimateContextSerializer

    def get_permissions(self):
        return _admin_only_writes(self)

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ("list", "retrieve") and not self.request.query_params.get("include_inactive") == "1":
            qs = qs.filter(is_active=True)
        hazard_type = self.request.query_params.get("hazard_type")
        region = self.request.query_params.get("region")
        if hazard_type:
            qs = qs.filter(models.Q(hazard_type=hazard_type.upper()) | models.Q(hazard_type=""))
        if region:
            qs = qs.filter(models.Q(region_id=region) | models.Q(region__isnull=True))
        return qs.order_by("hazard_type", "display_order")


class RecommendationViewSet(viewsets.ModelViewSet):
    """Recommendations Library (HVRA Section 4.9) — read for all, curated by admins."""
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer

    def get_permissions(self):
        return _admin_only_writes(self)

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ("list", "retrieve") and not self.request.query_params.get("include_inactive") == "1":
            qs = qs.filter(is_active=True)
        module_type = self.request.query_params.get("module_type")
        hazard_type = self.request.query_params.get("hazard_type")
        classification = self.request.query_params.get("classification")
        if module_type:
            qs = qs.filter(module_type=module_type.upper())
        if hazard_type:
            qs = qs.filter(models.Q(hazard_type=hazard_type.upper()) | models.Q(hazard_type=""))
        if classification:
            qs = qs.filter(models.Q(classification=classification.upper()) | models.Q(classification=""))
        return qs.order_by("display_order", "priority")


class FloodBlockSummaryView(APIView):
    """
    Returns a per-block summary of flood-prone area and historical events.
    Supports any district or all blocks across Kerala.
    """
    def get(self, request):
        district = request.query_params.get("district")
        
        blocks_qs = AdministrativeUnit.objects.filter(level="BLOCK")
        if district:
            blocks_qs = blocks_qs.filter(
                models.Q(parent__name__icontains=district) |
                models.Q(parent__code__iexact=district)
            )

        blocks = blocks_qs.all()
        events = HazardEvent.objects.filter(administrative_unit__in=blocks, hazard_type="FLOOD")
        flood_layers = HazardLayer.objects.filter(hazard_type="FLOOD")
        
        blocks_data = [
            {
                "id": b.id,
                "name": b.name,
                "area_sqkm": b.area_sqkm,
                "geometry": b.geometry
            }
            for b in blocks
        ]
        
        events_data = [
            {
                "id": e.id,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "event_date": e.event_date
            }
            for e in events
        ]
        
        layers_data = [
            l.geometry for l in flood_layers if l.geometry
        ]
        
        results = process_flood_assessment(blocks_data, layers_data, events_data)
        
        response_data = list(results.values())
        return Response(response_data)
