"""Hazards views"""
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import HazardType, HazardEvent, HazardLayer, HazardIndicator
from .serializers import (
    HazardTypeSerializer, HazardEventSerializer,
    HazardLayerSerializer, HazardIndicatorSerializer,
)
from rest_framework.views import APIView
from apps.administration.models import AdministrativeUnit
from gis.spatial import process_flood_assessment


class HazardTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HazardType.objects.all()
    serializer_class = HazardTypeSerializer


class HazardEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HazardEvent.objects.select_related("administrative_unit").all()
    serializer_class = HazardEventSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ["-event_date"]

    def get_queryset(self):
        qs = super().get_queryset()
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
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())
        return qs


class FloodBlockSummaryView(APIView):
    """
    Returns a per-block summary of flood-prone area and historical events.
    Strictly scoped to Kottayam district blocks per Phase 3 requirements.
    """
    def get(self, request):
        district = request.query_params.get("district", "Kottayam")
        
        # Only Kottayam is allowed
        if "kottayam" not in district.lower():
            return Response({"error": "Only Kottayam district is supported in this demo."}, status=400)

        blocks = AdministrativeUnit.objects.filter(level="BLOCK", parent__name__icontains="Kottayam")
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
